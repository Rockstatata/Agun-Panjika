"""Union- and upazila-level fire calendars for the Chittagong Hill Tracts (PRD persona: CHT community
organisation or NGO, "union-level calendar").

Values are on the same VIIRS S-NPP scale as the rest of the record:
  * 2012 onward: S-NPP detections in the unit (filtered), NOAA-20/21 after the handover or in outages
  * 2003-2011: the district's harmonised estimate, shared by the unit's MODIS detections that week
    (or, when MODIS saw nothing in the district, by the unit's long-run S-NPP share for that month)

Output: web/public/data/local/{district_id}.json
"""

from __future__ import annotations

import json
import re

import geopandas as gpd
import numpy as np
import pandas as pd
import requests

from pipeline.config import BOUNDARIES, COUNTRY, PROCESSED, WEB_DATA
from pipeline.harmonise import week_month
from pipeline.regions import load_districts, slug

DISTRICTS = ["rangamati", "khagrachhari", "bandarban"]
GB = "https://www.geoboundaries.org/api/current/gbOpen/{iso3}/{level}/"

# Bangla upazila names, matched on the first letters of the normalised English name.
# Native-speaker review pending.
UPAZILA_BN = {
    "rangamati": "রাঙামাটি সদর", "baghai": "বাঘাইছড়ি", "barkal": "বরকল", "belai": "বিলাইছড়ি", "bilai": "বিলাইছড়ি",
    "jurai": "জুরাছড়ি", "kapta": "কাপ্তাই", "kawkh": "কাউখালী", "kaukh": "কাউখালী", "langa": "লংগদু",
    "longa": "লংগদু", "nanya": "নানিয়ারচর", "nania": "নানিয়ারচর", "rajas": "রাজস্থলী", "khagr": "খাগড়াছড়ি সদর",
    "dighi": "দীঘিনালা", "laksh": "লক্ষ্মীছড়ি", "lakhs": "লক্ষ্মীছড়ি", "mahal": "মহালছড়ি", "manik": "মানিকছড়ি",
    "matir": "মাটিরাঙ্গা", "panch": "পানছড়ি", "ramga": "রামগড়", "guima": "গুইমারা", "bandarban": "বান্দরবান সদর",
    "alika": "আলীকদম", "lama": "লামা", "naikh": "নাইক্ষ্যংছড়ি", "naiks": "নাইক্ষ্যংছড়ি", "rowan": "রোয়াংছড়ি",
    "rowna": "রোয়াংছড়ি", "ruma": "রুমা", "thanc": "থানচি",
}


def upazila_bn(name: str) -> str | None:
    k = re.sub(r"[^a-z]", "", name.lower())
    for key in sorted(UPAZILA_BN, key=len, reverse=True):
        if k.startswith(key):
            return UPAZILA_BN[key]
    return None


def _boundaries(level: str) -> gpd.GeoDataFrame:
    path = BOUNDARIES / f"{COUNTRY['iso3'].lower()}_{level}_simplified.geojson"
    if not path.exists():
        meta = requests.get(GB.format(iso3=COUNTRY["iso3"], level=level), timeout=60).json()
        path.write_bytes(requests.get(meta["simplifiedGeometryGeoJSON"], timeout=600).content)
    return gpd.read_file(path).to_crs(4326)


def units() -> gpd.GeoDataFrame:
    """Unions in the CHT districts with their upazila and district."""
    d = load_districts()
    d = d[d.district_id.isin(DISTRICTS)]
    up = _boundaries("ADM3")[["shapeName", "geometry"]].rename(columns={"shapeName": "upazila"})
    un = _boundaries("ADM4")[["shapeName", "geometry"]].rename(columns={"shapeName": "union"})

    def parent(child: gpd.GeoDataFrame, par: gpd.GeoDataFrame, cols: list[str]) -> gpd.GeoDataFrame:
        pts = child.copy()
        pts["geometry"] = child.geometry.representative_point()
        j = gpd.sjoin(pts, par[[*cols, "geometry"]], how="inner", predicate="within")
        j = j[~j.index.duplicated()]
        return child.loc[j.index].assign(**{c: j[c] for c in cols})

    up = parent(up, d, ["district_id"])
    up["upazila_id"] = up["district_id"] + "__" + up["upazila"].map(slug)
    un = parent(un, up, ["district_id", "upazila_id", "upazila"])
    un["union_id"] = un["upazila_id"] + "__" + un["union"].map(slug)
    return un.reset_index(drop=True)


def tag(det: pd.DataFrame, un: gpd.GeoDataFrame) -> pd.DataFrame:
    det = det[det.district_id.isin(DISTRICTS)].drop(columns=["upazila_id", "union_id"], errors="ignore")
    locs = det[["lat", "lon"]].drop_duplicates().reset_index(drop=True)
    pts = gpd.GeoDataFrame(locs, geometry=gpd.points_from_xy(locs.lon, locs.lat), crs=4326)
    j = gpd.sjoin(pts, un[["union_id", "upazila_id", "district_id", "geometry"]], how="left", predicate="within")
    j = j[~j.index.duplicated()]
    locs["union_id"], locs["upazila_id"] = j["union_id"].values, j["upazila_id"].values
    locs["unit_district"] = j["district_id"].values
    out = det.merge(locs, on=["lat", "lon"], how="left").dropna(subset=["union_id"])
    # Simplified union outlines and full-resolution district outlines disagree by a pixel at borders;
    # keep a detection only in unions of its own district.
    return out[out["unit_district"] == out["district_id"]].drop(columns="unit_district")


def unit_series(det: pd.DataFrame, level: str, dist_est: pd.DataFrame, snpp_end_week: tuple[int, int]) -> pd.DataFrame:
    """Weekly harmonised value per unit at ``level`` (union_id or upazila_id)."""
    d = det[det.keep].copy()
    iso = d.acq_datetime_utc.dt.isocalendar()
    d["iso_year"], d["iso_week"] = iso.year.astype(int), iso.week.astype(int)
    c = d.groupby([level, "district_id", "sensor", "iso_year", "iso_week"]).size().unstack("sensor", fill_value=0)
    c = c.reset_index()
    for s in ("modis", "snpp", "noaa20", "noaa21"):
        if s not in c:
            c[s] = 0
    # Full grid: every unit x every week of the district estimate table.
    weeks = dist_est[["iso_year", "iso_week"]].drop_duplicates()
    ulist = det[[level, "district_id"]].drop_duplicates()
    g = ulist.merge(weeks, how="cross").merge(c, on=[level, "district_id", "iso_year", "iso_week"], how="left")
    g = g.fillna({"modis": 0, "snpp": 0, "noaa20": 0, "noaa21": 0})
    g = g.merge(dist_est, on=["district_id", "iso_year", "iso_week"], how="left")
    g["month"] = week_month(g["iso_year"], g["iso_week"])
    # Long-run S-NPP share of the unit within its district, by month.
    ov = g[g.iso_year.between(2012, 2024)]
    sh = ov.groupby([level, "district_id", "month"])["snpp"].sum()
    sh = (sh / sh.groupby(["district_id", "month"]).transform("sum")).rename("clim_share").reset_index()
    g = g.merge(sh, on=[level, "district_id", "month"], how="left")
    n_units = g.groupby("district_id")[level].transform("nunique")
    g["clim_share"] = g["clim_share"].fillna(1.0 / n_units)
    mt = g.groupby(["district_id", "iso_year", "iso_week"])["modis"].transform("sum")
    share = np.where(mt > 0, g["modis"] / mt.where(mt > 0, 1), g["clim_share"])
    est = g["dist_est"] * share
    viirs_flying = g["iso_year"] * 100 + g["iso_week"] >= 201204
    after = g["iso_year"] * 100 + g["iso_week"] >= snpp_end_week[0] * 100 + snpp_end_week[1]
    bridged = g[["noaa20", "noaa21"]].replace(0, np.nan).mean(axis=1).fillna(0)
    g["value"] = np.where(~viirs_flying, est, np.where(after, bridged, g["snpp"]))
    g["src"] = np.where(~viirs_flying, "e", np.where(after, "b", "o"))
    return g[[level, "district_id", "iso_year", "iso_week", "value", "src"]]


def main() -> None:
    det = pd.read_parquet(PROCESSED / "detections.parquet")
    un = units()
    det = tag(det, un)
    h = pd.read_parquet(PROCESSED / "harmonised.parquet")
    dist_est = h[(h.unit_type == "district") & h.unit_id.isin(DISTRICTS)].rename(
        columns={"unit_id": "district_id", "harm": "dist_est"})[["district_id", "iso_year", "iso_week", "dist_est"]]
    bridge = json.loads((PROCESSED / "bridge_factors.json").read_text())
    end = pd.Timestamp(bridge["snpp_end_utc"]).isocalendar()
    names = un.drop_duplicates("union_id").set_index("union_id")
    upn = un.drop_duplicates("upazila_id").set_index("upazila_id")
    for did in DISTRICTS:
        doc = {"district_id": did, "levels": {}}
        for level in ("upazila_id", "union_id"):
            s = unit_series(det[det.district_id == did], level, dist_est[dist_est.district_id == did],
                            (end.year, end.week))
            out = {}
            for uid, g in s.groupby(level):
                years = {}
                for y, gy in g.groupby("iso_year"):
                    arr = [None] * 53
                    for w, v in zip(gy.iso_week, gy.value, strict=True):
                        arr[int(w) - 1] = round(float(v), 1)
                    years[int(y)] = arr
                if level == "union_id":
                    name_en = names.loc[uid, "union"]
                    parent = names.loc[uid, "upazila_id"]
                    meta = {"name_en": name_en, "name_bn": None, "upazila_id": parent}
                else:
                    name_en = upn.loc[uid, "upazila"]
                    meta = {"name_en": name_en, "name_bn": upazila_bn(name_en)}
                total = float(g[g.iso_year.between(2012, 2025)]["value"].sum())
                out[uid] = {**meta, "total_2012_2025": round(total), "years": years}
            doc["levels"][level.replace("_id", "")] = out
        path = WEB_DATA / "local" / f"{did}.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"  local/{did}.json: {len(doc['levels']['upazila'])} upazilas, {len(doc['levels']['union'])} unions, "
              f"{path.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
