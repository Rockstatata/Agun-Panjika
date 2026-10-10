"""Stretch views beyond the border, from FIRMS India and Myanmar country files.

* Borderless hill view: the Chittagong Hill Tracts with Tripura, Mizoram (India) and
  Chin State (Myanmar), one fire season that ignores borders (PRD: 2021 Mizoram fires).
* Upwind smoke view: crop and stubble burning across the Indo-Gangetic Plain
  (Punjab & Haryana, Uttar Pradesh, Bihar, West Bengal), upwind of Dhaka in winter.

Only detections inside the two areas are kept; the large raw files are deleted after
cropping. Recent dates come from the FIRMS area API like the Bangladesh data.

Output: data/processed/neighbour_detections.parquet (area, unit_id, sensor, ...)
"""

from __future__ import annotations

import os
import re
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from datetime import date

import geopandas as gpd
import numpy as np
import pandas as pd
import requests

from pipeline.config import BOUNDARIES, FIRMS_BASE, PROCESSED, RAW
from pipeline.ingest import data_availability, dedupe, fetch_api_range, normalise_columns

AREAS = {
    "hills": {"bbox": [91.0, 20.6, 94.4, 24.7],
              "units": {"tripura": ("IND", "Tripura"), "mizoram": ("IND", "Mizoram"), "chin": ("MMR", "Chin")}},
    "igp": {"bbox": [73.8, 21.5, 89.0, 32.6],
            "units": {"punjab_haryana": ("IND", "Punjab|Haryana|Chandigarh|Delhi"),
                      "uttar_pradesh": ("IND", "Uttar Pradesh"), "bihar": ("IND", "Bihar"),
                      "west_bengal": ("IND", "West Bengal")}},
}
UNIT_NAMES = {
    "tripura": ("Tripura (India)", "ত্রিপুরা (ভারত)"), "mizoram": ("Mizoram (India)", "মিজোরাম (ভারত)"),
    "chin": ("Chin State (Myanmar)", "চিন রাজ্য (মিয়ানমার)"), "cht": ("Chittagong Hill Tracts", "পার্বত্য চট্টগ্রাম"),
    "punjab_haryana": ("Punjab & Haryana", "পাঞ্জাব ও হরিয়ানা"), "uttar_pradesh": ("Uttar Pradesh", "উত্তর প্রদেশ"),
    "bihar": ("Bihar", "বিহার"), "west_bengal": ("West Bengal", "পশ্চিমবঙ্গ"),
}
COUNTRY_FILES = {"IND": "India", "MMR": "Myanmar"}
SOURCES = {"modis": range(2003, 2025), "viirs-snpp": range(2012, 2025)}
CACHE = RAW / "neighbours"


def adm1(iso3: str) -> gpd.GeoDataFrame:
    path = BOUNDARIES / f"{iso3.lower()}_ADM1.geojson"
    if not path.exists():
        meta = requests.get(f"https://www.geoboundaries.org/api/current/gbOpen/{iso3}/ADM1/", timeout=60).json()
        path.write_bytes(requests.get(meta["simplifiedGeometryGeoJSON"], timeout=600).content)
    return gpd.read_file(path).to_crs(4326)


def unit_polygons() -> gpd.GeoDataFrame:
    rows = []
    for area, a in AREAS.items():
        for uid, (iso3, pattern) in a["units"].items():
            g = adm1(iso3)
            folded = g["shapeName"].map(lambda n: unicodedata.normalize("NFKD", n).encode("ascii", "ignore").decode())
            sel = g[folded.str.contains(pattern, flags=re.IGNORECASE, regex=True)]
            if sel.empty:
                raise ValueError(f"no ADM1 match for {pattern} in {iso3}: {sorted(g.shapeName)}")
            rows.append({"area": area, "unit_id": uid, "geometry": sel.union_all()})
    return gpd.GeoDataFrame(rows, crs=4326)


def _crop_file(source: str, year: int, country: str) -> pd.DataFrame | None:
    out = CACHE / f"{source}_{year}_{country}.parquet"
    if out.exists():
        return pd.read_parquet(out)
    url = f"{FIRMS_BASE}/data/country/{source}/{year}/{source}_{year}_{country}.csv"
    tmp = CACHE / f"_{source}_{year}_{country}.csv"
    with requests.get(url, stream=True, timeout=600) as r:
        if r.status_code != 200:
            return None
        with open(tmp, "wb") as f:
            for chunk in r.iter_content(1 << 20):
                f.write(chunk)
    keep = []
    for part in pd.read_csv(tmp, chunksize=500_000):
        for area, a in AREAS.items():
            w, s, e, n = a["bbox"]
            m = part["longitude"].between(w, e) & part["latitude"].between(s, n)
            if m.any():
                keep.append(part[m].assign(area=area))
    tmp.unlink(missing_ok=True)
    df = pd.concat(keep, ignore_index=True) if keep else pd.DataFrame()
    df.to_parquet(out, index=False)
    return df


def archive() -> pd.DataFrame:
    CACHE.mkdir(parents=True, exist_ok=True)
    jobs = [(s, y, c) for s, yrs in SOURCES.items() for y in yrs for c in COUNTRY_FILES.values()]
    with ThreadPoolExecutor(max_workers=3) as ex:
        frames = list(ex.map(lambda j: _crop_file(*j), jobs))
    frames = [f for f in frames if f is not None and not f.empty]
    out = []
    for f in frames:
        hint = "modis" if "brightness" in f.columns else "snpp"
        n = normalise_columns(f, sensor_hint=hint)
        n["area"] = f["area"].values
        out.append(n)
    return pd.concat(out, ignore_index=True)


def recent(since: date = date(2025, 1, 1)) -> pd.DataFrame | None:
    if not os.environ.get("FIRMS_MAP_KEY"):
        return None
    avail = data_availability()
    frames = []
    for area, a in AREAS.items():
        for sensor in ("modis", "snpp", "noaa20"):
            df = fetch_api_range(sensor, since, date.today(), avail, bbox=a["bbox"], tag=area)
            if df is not None and not df.empty:
                frames.append(df.assign(area=area))
    return pd.concat(frames, ignore_index=True) if frames else None


def tag_units(det: pd.DataFrame) -> pd.DataFrame:
    polys = unit_polygons()
    locs = det[["lon", "lat", "area"]].drop_duplicates().reset_index(drop=True)
    pts = gpd.GeoDataFrame(locs, geometry=gpd.points_from_xy(locs.lon, locs.lat), crs=4326)
    j = gpd.sjoin(pts, polys[["unit_id", "area", "geometry"]], how="left", predicate="within",
                  lsuffix="pt", rsuffix="poly")
    j = j[~j.index.duplicated()]
    locs["unit_id"] = np.where(j["area_poly"] == j["area_pt"], j["unit_id"], None)
    return det.merge(locs, on=["lon", "lat", "area"], how="left").dropna(subset=["unit_id"])


def main() -> None:
    det = archive()
    rec = recent()
    if rec is not None:
        det = pd.concat([det, rec], ignore_index=True)
    det = dedupe(det)
    det = tag_units(det)
    # Same confidence and static-source rules as Bangladesh (FIRMS type 2/3 dropped).
    is_modis = det["sensor"] == "modis"
    det["keep"] = np.where(is_modis, det["confidence_norm"] >= 0.30, det["confidence_norm"] >= 0.5)
    det["keep"] &= ~det["type"].isin([2, 3]).fillna(False).to_numpy()
    det.to_parquet(PROCESSED / "neighbour_detections.parquet", index=False)
    print(det[det.keep].groupby(["unit_id", "sensor"]).size().unstack().fillna(0).astype(int).to_string())
    write_json()




# --------------------------------------------------------------------- weekly series


def to_unit_week(det: pd.DataFrame) -> pd.DataFrame:
    """District-week-shaped table for neighbour units, so the Bangladesh feature code can be reused."""
    from pipeline.aggregate import iso_weeks_between

    d = det[det["keep"]].copy()
    iso = d["acq_datetime_utc"].dt.isocalendar()
    d["iso_year"], d["iso_week"] = iso.year.astype(int), iso.week.astype(int)
    d = d.assign(is_aqua=d["satellite"] == "Aqua", is_night=d["daynight"] == "N", is_low=d["frp_mw"] < 15,
                 is_hi=d["confidence_norm"] >= 0.8)
    keys = ["unit_id", "sensor", "iso_year", "iso_week"]
    g = d.groupby(keys).agg(count=("lat", "size"), frp_sum=("frp_mw", "sum"), aqua=("is_aqua", "sum"),
                            night=("is_night", "sum"), lowfrp=("is_low", "sum"), hiconf=("is_hi", "sum")).reset_index()
    frames = []
    for sensor, gs in d.groupby("sensor"):
        t = gs["acq_datetime_utc"].dt.tz_localize(None)
        weeks = iso_weeks_between(t.min().normalize(), t.max().normalize())
        if (t.max().normalize().date() - weeks["week_start"].iloc[-1]).days + 1 < 3:
            weeks = weeks.iloc[:-1]
        grid = pd.DataFrame({"unit_id": sorted(d["unit_id"].unique())}).merge(weeks, how="cross")
        frames.append(grid.assign(sensor=sensor))
    full = pd.concat(frames, ignore_index=True).merge(g, on=keys, how="left").fillna(0)
    full["count_all"] = full["count"]
    full["district_id"] = full["unit_id"]
    full["region_id"] = full["unit_id"]
    return full


def series(det: pd.DataFrame) -> dict:
    """Harmonised weekly series per neighbour unit: S-NPP observed from 2012, ensemble estimate before."""
    from pipeline.harmonise import EnsembleModel, build_features, training_rows

    dw = to_unit_week(det)
    feat = build_features(dw, "region_id")
    model = EnsembleModel().fit(training_rows(feat))
    feat = feat[feat["iso_year"] >= 2003].copy()
    feat["est"] = np.where(feat["M"].notna(), model.predict(feat.fillna({"M": 0})), np.nan)
    bridged = feat[[c for c in ("J", "K") if c in feat]].mean(axis=1) if {"J", "K"} & set(feat) else np.nan
    feat["harm"] = feat["V"].where(feat["V"].notna(), bridged)
    feat["src"] = np.where(feat["V"].notna(), "observed", np.where(pd.notna(bridged), "bridged", "estimated"))
    feat.loc[feat["harm"].isna(), "harm"] = feat["est"]
    out = {}
    for uid, g in feat.groupby("region_id"):
        g = g.sort_values(["iso_year", "iso_week"])
        area = next(a for a, v in AREAS.items() if uid in v["units"])
        out[uid] = {"area": area, "name_en": UNIT_NAMES[uid][0], "name_bn": UNIT_NAMES[uid][1],
                    "weeks": [[int(r.iso_year), int(r.iso_week), round(float(r.harm), 1), r.src[0]]
                              for r in g.itertuples() if pd.notna(r.harm)]}
    return out


def write_json() -> None:
    import json

    from pipeline.config import WEB_DATA

    det = pd.read_parquet(PROCESSED / "neighbour_detections.parquet")
    out = {"units": series(det), "cols": ["iso_year", "iso_week", "harm", "src(o/e/b)"]}
    # Chittagong Hill Tracts from the Bangladesh record, for the borderless hill view.
    h = pd.read_parquet(PROCESSED / "harmonised.parquet")
    cht = h[(h.unit_type == "region") & h.unit_id.isin(["rangamati", "khagrachhari", "bandarban"])] \
        .groupby(["iso_year", "iso_week"]).agg(harm=("harm", "sum"), src=("src", "first")).reset_index()
    out["units"]["cht"] = {"area": "hills", "name_en": UNIT_NAMES["cht"][0], "name_bn": UNIT_NAMES["cht"][1],
                           "weeks": [[int(r.iso_year), int(r.iso_week), round(float(r.harm), 1), r.src[0]]
                                     for r in cht.itertuples()]}
    # Dhaka aerosol optical depth (NASA POWER), weekly, for the upwind smoke view.
    aod_path = PROCESSED / "dhaka_aod.parquet"
    if aod_path.exists():
        a = pd.read_parquet(aod_path)
        iso = a["date"].dt.isocalendar()
        w = a.assign(iso_year=iso.year.astype(int), iso_week=iso.week.astype(int)) \
            .groupby(["iso_year", "iso_week"])["AOD_55"].mean().dropna()
        out["dhaka_aod"] = [[int(y), int(wk), round(float(v), 3)] for (y, wk), v in w.items() if y >= 2003]
    (WEB_DATA / "neighbours.json").write_text(json.dumps(out, separators=(",", ":"), ensure_ascii=False),
                                              encoding="utf-8")
    print({u: len(v["weeks"]) for u, v in out["units"].items()})


if __name__ == "__main__":
    main()
