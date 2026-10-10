"""NASA POWER daily weather and aerosol for the analysis regions (no key needed).

Per region, a few points inside the region polygon are averaged:
  PRECTOTCORR  precipitation (mm/day, bias-corrected)
  T2M_MAX      daily maximum 2 m temperature (C)
  RH2M         2 m relative humidity (%)
  WS2M         2 m wind speed (m/s)
  GWETTOP      surface soil wetness (0 to 1)
  CLOUD_AMT    cloud amount (%), used by the harmonisation: cloud hides fires from both sensors
Plus aerosol optical depth at 550 nm (AOD_55) over Dhaka for the smoke view.

Output: data/processed/weather_daily.parquet, weather_week.parquet, dhaka_aod.parquet
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import date

import geopandas as gpd
import numpy as np
import pandas as pd
import requests

from pipeline.config import PROCESSED, RAW
from pipeline.regions import district_to_region, load_districts

POWER = "https://power.larc.nasa.gov/api/temporal/daily/point"
PARAMS = ["PRECTOTCORR", "T2M_MAX", "RH2M", "WS2M", "GWETTOP", "CLOUD_AMT"]
START = date(2001, 1, 1)
DHAKA = (90.40, 23.78)
CACHE = RAW / "power"


def region_points(max_per_region: int = 6) -> pd.DataFrame:
    """Up to ``max_per_region`` points per region on a 0.25 degree lattice inside its polygon
    (POWER's native grid is about 0.5 degree, so small hill districts still get their own cells)."""
    d = load_districts()
    d["region_id"] = d["district_id"].map(district_to_region()).fillna("rest")
    regs = d.dissolve("region_id").reset_index()
    rows = []
    for r in regs.itertuples():
        minx, miny, maxx, maxy = r.geometry.bounds
        pts = [(x, y) for x in np.arange(np.floor(minx * 4) / 4 + 0.125, maxx, 0.25)
               for y in np.arange(np.floor(miny * 4) / 4 + 0.125, maxy, 0.25)]
        inside = [p for p in pts if r.geometry.contains(gpd.points_from_xy([p[0]], [p[1]])[0])]
        if not inside:
            c = r.geometry.representative_point()
            inside = [(c.x, c.y)]
        step = max(1, len(inside) // max_per_region)
        for x, y in inside[::step][:max_per_region]:
            rows.append({"region_id": r.region_id, "lon": round(x, 2), "lat": round(y, 2)})
    return pd.DataFrame(rows)


def fetch_point(lon: float, lat: float, params: list[str], community: str = "AG",
                end: date | None = None) -> pd.DataFrame:
    end = end or date.today()
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"{community}_{lon}_{lat}_{'-'.join(params)}.parquet"
    old = pd.read_parquet(path) if path.exists() else None
    start = START if old is None else (old.index.max() - pd.Timedelta(days=30)).date()
    url = (f"{POWER}?parameters={','.join(params)}&community={community}&longitude={lon}&latitude={lat}"
           f"&start={start:%Y%m%d}&end={end:%Y%m%d}&format=JSON")
    for attempt in range(4):
        try:
            r = requests.get(url, timeout=300)
            r.raise_for_status()
            p = r.json()["properties"]["parameter"]
            break
        except (requests.RequestException, KeyError, ValueError):
            if attempt == 3:
                if old is not None:
                    return old
                raise
    df = pd.DataFrame(p).replace(-999.0, np.nan)
    df.index = pd.to_datetime(df.index, format="%Y%m%d")
    if old is not None:
        df = pd.concat([old[old.index < df.index.min()], df])
    df = df.dropna(how="all")
    df.to_parquet(path)
    return df


def region_daily() -> pd.DataFrame:
    pts = region_points()
    with ThreadPoolExecutor(max_workers=4) as ex:
        frames = list(ex.map(lambda r: fetch_point(r.lon, r.lat, PARAMS).assign(region_id=r.region_id),
                             pts.itertuples()))
    df = pd.concat(frames).rename_axis("date").reset_index()
    return df.groupby(["region_id", "date"], as_index=False)[PARAMS].mean()


def to_week(daily: pd.DataFrame) -> pd.DataFrame:
    iso = daily["date"].dt.isocalendar()
    d = daily.assign(iso_year=iso.year.astype(int), iso_week=iso.week.astype(int))
    w = d.groupby(["region_id", "iso_year", "iso_week"]).agg(
        precip=("PRECTOTCORR", "sum"), tmax=("T2M_MAX", "mean"), rh=("RH2M", "mean"), wind=("WS2M", "mean"),
        soil=("GWETTOP", "mean"), cloud=("CLOUD_AMT", "mean"), rain_days=("PRECTOTCORR", lambda s: int((s >= 1).sum())),
        n_days=("PRECTOTCORR", "count")).reset_index()
    return w


def dhaka_aod() -> pd.DataFrame:
    df = fetch_point(*DHAKA, ["AOD_55"], community="RE")
    return df.rename_axis("date").reset_index()


def main() -> None:
    daily = region_daily()
    daily.to_parquet(PROCESSED / "weather_daily.parquet", index=False)
    week = to_week(daily)
    week.to_parquet(PROCESSED / "weather_week.parquet", index=False)
    aod = dhaka_aod()
    aod.to_parquet(PROCESSED / "dhaka_aod.parquet", index=False)
    print(f"weather: {daily.date.min():%Y-%m-%d}..{daily.date.max():%Y-%m-%d}, {len(week):,} region-weeks; "
          f"AOD {aod.date.min():%Y-%m-%d}..{aod.date.max():%Y-%m-%d}")
    print(week.groupby("region_id")[["precip", "tmax", "rh", "soil"]].mean().round(2).to_string())


if __name__ == "__main__":
    main()
