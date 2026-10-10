"""Partner-agency cross-check: ESA Fire_cci burned area (CEDA, open access).

* 2003-2018: Harmonised Medium Resolution Burned Area grid v6.0 (MRBA60)
* 2019-2024: Sentinel-3 SYN (OLCI + SLSTR) Burned Area grid v1.1 (FireCCIS311)

Both are monthly 0.25 degree grids of burned area. Burned area comes from surface
reflectance change, not from the thermal hotspots FIRMS detects, so it is an
independent witness of the same fire seasons. We use it to test whether our
harmonised series has a jump at the 2012 sensor change (it should not) and
how well it tracks interannual variability.

Output: data/processed/partner_ba.parquet (region_id, year, month, ba_km2, source)
        web/public/data/partner.json
"""

from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor

import geopandas as gpd
import numpy as np
import pandas as pd
import requests
from shapely.geometry import box

from pipeline.config import COUNTRY, PROCESSED, RAW, WEB_DATA
from pipeline.regions import district_to_region, load_districts

CEDA = "https://dap.ceda.ac.uk/neodc/esacci/fire/data/burned_area"
PRODUCTS = {
    "esa_mrba60": {"years": range(2003, 2019),
                   "path": "Harmonised/grid/v6.0/{y}/{y}{m:02d}01-ESACCI-L4_FIRE-BA-MR_HAR-fv6.0.0.nc"},
    "esa_s3syn": {"years": range(2019, 2025),
                  "path": "Sentinel3_SYN/grid/v1.1/{y}/{y}{m:02d}01-ESACCI-L4_FIRE-BA-SYN-fv1.1.nc"},
}
CACHE = RAW / "partner"


def _cell_weights() -> pd.DataFrame:
    """Area share of each 0.25 degree cell falling in each region (cells over Bangladesh only)."""
    d = load_districts()
    d["region_id"] = d["district_id"].map(district_to_region()).fillna("rest")
    regions = d.dissolve("region_id").reset_index()[["region_id", "geometry"]].to_crs(6933)
    w, s, e, n = COUNTRY["bbox"]
    lats = np.arange(np.floor(s * 4) / 4, n, 0.25)
    lons = np.arange(np.floor(w * 4) / 4, e, 0.25)
    cells = gpd.GeoDataFrame(
        [{"lat": la + 0.125, "lon": lo + 0.125} for la in lats for lo in lons],
        geometry=[box(lo, la, lo + 0.25, la + 0.25) for la in lats for lo in lons], crs=4326).to_crs(6933)
    cells["cell_area"] = cells.area
    ov = gpd.overlay(cells, regions, how="intersection", keep_geom_type=True)
    ov["share"] = ov.area / ov["cell_area"]
    return ov[["lat", "lon", "region_id", "share"]]


def _fetch_month(product: str, y: int, m: int, weights: pd.DataFrame) -> pd.DataFrame | None:
    import xarray as xr

    out = CACHE / f"{product}_{y}{m:02d}.csv"
    if out.exists():
        return pd.read_csv(out)
    url = f"{CEDA}/{PRODUCTS[product]['path'].format(y=y, m=m)}"
    r = requests.get(url, timeout=300)
    if r.status_code != 200:
        print(f"  {product} {y}-{m:02d}: HTTP {r.status_code}")
        return None
    tmp = CACHE / f"_{product}_{y}{m:02d}.nc"
    tmp.write_bytes(r.content)
    try:
        with xr.open_dataset(tmp) as ds:
            w, s, e, n = COUNTRY["bbox"]
            sub = ds["burned_area"].isel(time=0).sel(lat=slice(n, s), lon=slice(w, e))
            if sub.sizes["lat"] == 0:  # ascending latitude
                sub = ds["burned_area"].isel(time=0).sel(lat=slice(s, n), lon=slice(w, e))
            df = sub.to_dataframe().reset_index()[["lat", "lon", "burned_area"]]
    finally:
        tmp.unlink(missing_ok=True)
    df["lat"], df["lon"] = df["lat"].round(3), df["lon"].round(3)
    wt = weights.assign(lat=weights["lat"].round(3), lon=weights["lon"].round(3))
    j = wt.merge(df, on=["lat", "lon"], how="left").fillna({"burned_area": 0.0})
    j["ba_km2"] = j["burned_area"] * j["share"] / 1e6
    res = j.groupby("region_id", as_index=False)["ba_km2"].sum()
    res["year"], res["month"], res["source"] = y, m, product
    res.to_csv(out, index=False)
    return res


def download_all() -> pd.DataFrame:
    CACHE.mkdir(parents=True, exist_ok=True)
    weights = _cell_weights()
    jobs = [(p, y, m) for p, meta in PRODUCTS.items() for y in meta["years"] for m in range(1, 13)]
    with ThreadPoolExecutor(max_workers=6) as ex:
        frames = list(ex.map(lambda a: _fetch_month(*a, weights), jobs))
    return pd.concat([f for f in frames if f is not None], ignore_index=True)


def cross_check(ba: pd.DataFrame, harm: pd.DataFrame) -> dict:
    """Compare annual burned area with annual harmonised, raw-MODIS and naive-stitched counts."""
    nat_ba = ba.groupby("year")["ba_km2"].sum()
    h = harm[harm.unit_type == "national"]
    ann = h.groupby("iso_year").agg(harm=("harm", "sum"), modis=("M", "sum"), viirs=("V", "sum"),
                                    naive=("naive", "sum"))
    # The record a user would get by stitching raw files: MODIS until 2011, VIIRS after.
    ann["stitched"] = np.where(ann.index < 2012, ann["modis"], ann["viirs"])
    df = ann.join(nat_ba.rename("ba_km2"), how="inner")
    df = df[(df.index >= 2003) & (df.index <= 2024)]

    def ratio_jump(col: str) -> float:
        """Ratio of (series / burned area) after vs before 2012; 1.0 means no artificial jump."""
        r = df[col] / df["ba_km2"]
        return float(r[r.index >= 2012].median() / r[r.index < 2012].median())

    def corr(col: str, years=None) -> float:
        d = df if years is None else df[df.index.isin(years)]
        return float(np.corrcoef(np.log(d[col]), np.log(d["ba_km2"]))[0, 1])

    # Monthly seasonality agreement (2012-2024, observed VIIRS years).
    month_h = h.assign(month=h["month"]).groupby(["iso_year", "month"])["harm"].sum()
    month_ba = ba.groupby(["year", "month"])["ba_km2"].sum()
    mm = pd.concat([month_h.rename("harm"), month_ba.rename_axis(["iso_year", "month"]).rename("ba")], axis=1).dropna()
    clim = mm.groupby(level="month").mean()
    out = {
        "products": {
            "esa_mrba60": "ESA Fire_cci Harmonised Medium Resolution Burned Area grid v6.0 (2003-2018)",
            "esa_s3syn": "ESA Fire_cci Sentinel-3 SYN Burned Area grid v1.1 (2019-2024)",
        },
        "annual": [{"y": int(y), "ba_km2": round(float(r.ba_km2), 1), "harm": round(float(r.harm)),
                    "stitched": round(float(r.stitched)), "modis": round(float(r.modis))} for y, r in df.iterrows()],
        "monthly_climatology": [{"m": int(m), "ba_km2": round(float(r.ba), 2), "harm": round(float(r.harm), 1)}
                                for m, r in clim.iterrows()],
        "jump_2012": {"harmonised": round(ratio_jump("harm"), 2), "stitched": round(ratio_jump("stitched"), 2),
                      "modis_only": round(ratio_jump("modis"), 2)},
        "corr_log_annual": {"harmonised": round(corr("harm"), 2), "modis_only": round(corr("modis"), 2),
                            "stitched": round(corr("stitched"), 2)},
        "corr_log_annual_estimated_years": round(corr("harm", range(2003, 2012)), 2),
        "corr_seasonal_cycle": round(float(np.corrcoef(clim["harm"], clim["ba"])[0, 1]), 2),
        "note": "Burned area is not a fire count; agreement in timing and year-to-year change is what matters.",
    }
    return out


def main() -> None:
    ba = download_all()
    ba.to_parquet(PROCESSED / "partner_ba.parquet", index=False)
    harm = pd.read_parquet(PROCESSED / "harmonised.parquet")
    out = cross_check(ba, harm)
    (WEB_DATA / "partner.json").write_text(json.dumps(out, separators=(",", ":")))
    (PROCESSED / "partner.json").write_text(json.dumps(out, indent=1))
    print(json.dumps({k: out[k] for k in ("jump_2012", "corr_log_annual", "corr_log_annual_estimated_years",
                                          "corr_seasonal_cycle")}, indent=1))


if __name__ == "__main__":
    main()
