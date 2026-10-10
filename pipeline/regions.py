"""Tag each detection with district, upazila and analysis region.

Boundaries: geoBoundaries gbOpen BGD ADM2 (64 districts) and ADM3 (upazilas).
Detections outside every polygon (coast, offshore, border pixels) are snapped to
the nearest district if within ``MAX_SNAP_KM``; otherwise they get ``outside``.
"""

from __future__ import annotations

import re

import geopandas as gpd
import pandas as pd
import requests

from pipeline.config import BOUNDARIES, COUNTRY, PROCESSED, UTM_EPSG

MAX_SNAP_KM = 3.0
GB_API = "https://www.geoboundaries.org/api/current/gbOpen/{iso3}/{level}/"

# Bangla district names (geoBoundaries spelling -> Bangla). Native-speaker review pending.
DISTRICT_BN = {
    "Bagerhat": "বাগেরহাট", "Bandarban": "বান্দরবান", "Barguna": "বরগুনা", "Barisal": "বরিশাল",
    "Bhola": "ভোলা", "Bogra": "বগুড়া", "Brahamanbaria": "ব্রাহ্মণবাড়িয়া", "Chandpur": "চাঁদপুর",
    "Chittagong": "চট্টগ্রাম", "Chuadanga": "চুয়াডাঙ্গা", "Comilla": "কুমিল্লা", "Cox's Bazar": "কক্সবাজার",
    "Dhaka": "ঢাকা", "Dinajpur": "দিনাজপুর", "Faridpur": "ফরিদপুর", "Feni": "ফেনী",
    "Gaibandha": "গাইবান্ধা", "Gazipur": "গাজীপুর", "Gopalganj": "গোপালগঞ্জ", "Habiganj": "হবিগঞ্জ",
    "Jamalpur": "জামালপুর", "Jessore": "যশোর", "Jhalokati": "ঝালকাঠি", "Jhenaidah": "ঝিনাইদহ",
    "Joypurhat": "জয়পুরহাট", "Khagrachhari": "খাগড়াছড়ি", "Khulna": "খুলনা", "Kishoreganj": "কিশোরগঞ্জ",
    "Kurigram": "কুড়িগ্রাম", "Kushtia": "কুষ্টিয়া", "Lakshmipur": "লক্ষ্মীপুর", "Lalmonirhat": "লালমনিরহাট",
    "Madaripur": "মাদারীপুর", "Magura": "মাগুরা", "Manikganj": "মানিকগঞ্জ", "Maulvibazar": "মৌলভীবাজার",
    "Meherpur": "মেহেরপুর", "Munshiganj": "মুন্সীগঞ্জ", "Mymensingh": "ময়মনসিংহ", "Naogaon": "নওগাঁ",
    "Narail": "নড়াইল", "Narayanganj": "নারায়ণগঞ্জ", "Narsingdi": "নরসিংদী", "Natore": "নাটোর",
    "Nawabganj": "চাঁপাইনবাবগঞ্জ", "Netrakona": "নেত্রকোনা", "Nilphamari": "নীলফামারী", "Noakhali": "নোয়াখালী",
    "Pabna": "পাবনা", "Panchagarh": "পঞ্চগড়", "Patuakhali": "পটুয়াখালী", "Pirojpur": "পিরোজপুর",
    "Rajbari": "রাজবাড়ী", "Rajshahi": "রাজশাহী", "Rangamati": "রাঙামাটি", "Rangpur": "রংপুর",
    "Satkhira": "সাতক্ষীরা", "Shariatpur": "শরীয়তপুর", "Sherpur": "শেরপুর", "Sirajganj": "সিরাজগঞ্জ",
    "Sunamganj": "সুনামগঞ্জ", "Sylhet": "সিলেট", "Tangail": "টাঙ্গাইল", "Thakurgaon": "ঠাকুরগাঁও",
}


def slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", name.lower().replace("'", "")).strip("_")


def download_boundaries(level: str) -> gpd.GeoDataFrame:
    path = BOUNDARIES / f"{COUNTRY['iso3'].lower()}_{level}.geojson"
    if not path.exists():
        meta = requests.get(GB_API.format(iso3=COUNTRY["iso3"], level=level), timeout=60).json()
        path.write_bytes(requests.get(meta["gjDownloadURL"], timeout=600).content)
    return gpd.read_file(path)


def load_districts() -> gpd.GeoDataFrame:
    g = download_boundaries("ADM2")[["shapeName", "geometry"]].rename(columns={"shapeName": "district"})
    g["district_id"] = g["district"].map(slug)
    return g.to_crs(4326)


def load_upazilas(districts: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """ADM3 has no parent code, so assign each upazila to the district holding its interior point."""
    u = download_boundaries("ADM3")[["shapeName", "geometry"]].rename(columns={"shapeName": "upazila"}).to_crs(4326)
    pts = u.copy()
    pts["geometry"] = u.geometry.representative_point()
    j = gpd.sjoin(pts, districts[["district_id", "geometry"]], how="left", predicate="within")
    j = j[~j.index.duplicated()]
    u["district_id"] = j["district_id"]
    u["upazila_id"] = u["district_id"].fillna("x") + "__" + u["upazila"].map(slug)
    return u


def district_to_region() -> dict[str, str]:
    out = {}
    for reg in COUNTRY["regions"]:
        for d in reg["districts"]:
            out[slug(d)] = reg["id"]
    return out


def _tag(points: gpd.GeoDataFrame, polys: gpd.GeoDataFrame, col: str) -> pd.Series:
    j = gpd.sjoin(points, polys[[col, "geometry"]], how="left", predicate="within")
    j = j[~j.index.duplicated()]
    tagged = j[col]
    missing = tagged.isna()
    if missing.any():
        utm = points.loc[missing].to_crs(UTM_EPSG)
        near = gpd.sjoin_nearest(utm, polys[[col, "geometry"]].to_crs(UTM_EPSG), how="left",
                                 max_distance=MAX_SNAP_KM * 1000)
        near = near[~near.index.duplicated()]
        tagged.loc[missing] = near[col]
    return tagged


def tag_regions(det: pd.DataFrame) -> pd.DataFrame:
    districts = load_districts()
    upazilas = load_upazilas(districts)
    # Tag unique locations only: many detections repeat the same pixel centre.
    locs = det[["lat", "lon"]].drop_duplicates().reset_index(drop=True)
    pts = gpd.GeoDataFrame(locs, geometry=gpd.points_from_xy(locs.lon, locs.lat), crs=4326)
    # The API bbox covers neighbouring land too: anything beyond the snap distance from the
    # country is "outside" without the (slow) nearest-polygon search.
    country = districts.to_crs(UTM_EPSG).union_all().simplify(200).buffer(MAX_SNAP_KM * 1000)
    near = pts.to_crs(UTM_EPSG).within(country).to_numpy()
    locs["district_id"] = "outside"
    locs["upazila_id"] = "outside"
    if near.any():
        sub = pts[near]
        locs.loc[near, "district_id"] = _tag(sub, districts, "district_id").fillna("outside").values
        locs.loc[near, "upazila_id"] = _tag(sub, upazilas, "upazila_id").fillna("outside").values
    out = det.drop(columns=[c for c in ("district_id", "upazila_id", "region_id") if c in det]).merge(
        locs, on=["lat", "lon"], how="left")
    d2r = district_to_region()
    out["region_id"] = out["district_id"].map(d2r).fillna("rest")
    out.loc[out["district_id"] == "outside", "region_id"] = "outside"
    return out


def district_table() -> pd.DataFrame:
    d = load_districts()
    d2r = district_to_region()
    return pd.DataFrame({
        "district_id": d["district_id"], "name_en": d["district"],
        "name_bn": d["district"].map(DISTRICT_BN).fillna(d["district"]),
        "region_id": d["district_id"].map(d2r).fillna("rest"),
    })


def main() -> None:
    det = pd.read_parquet(PROCESSED / "detections.parquet")
    det = tag_regions(det)
    det.to_parquet(PROCESSED / "detections.parquet", index=False)
    print(det.groupby(["region_id", "sensor"]).size().unstack().fillna(0).astype(int).to_string())


if __name__ == "__main__":
    main()
