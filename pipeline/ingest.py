"""Download FIRMS country CSVs (and optionally API data) and normalise them.

Output: data/raw/{source}_{year}_{country}.csv and data/processed/detections.parquet
"""

from __future__ import annotations

import argparse
import io
import os
import sys
import time
from datetime import date, timedelta

import numpy as np
import pandas as pd
import requests

from pipeline.config import API_SOURCES, COUNTRY, FIRMS_BASE, PROCESSED, RAW, SOURCES

SESSION = requests.Session()
SESSION.headers["User-Agent"] = "agun-panjika/0.1 (NASA Space Apps 2026)"


API_MAX_DAYS = 5  # FIRMS area API: "Invalid day range. Expects [1..5]"


def _redact(text: str) -> str:
    """Never print the MAP_KEY (CI logs are public on open repos)."""
    key = os.environ.get("FIRMS_MAP_KEY")
    return text.replace(key, "***") if key else text


def _get(url: str, retries: int = 3) -> requests.Response | None:
    for attempt in range(retries):
        try:
            r = SESSION.get(url, timeout=120)
            if r.status_code == 404:
                return None
            r.raise_for_status()
            return r
        except requests.RequestException as exc:  # pragma: no cover - network
            if attempt == retries - 1:
                print(f"  failed {_redact(url)}: {_redact(str(exc))}", file=sys.stderr)
                return None
            time.sleep(2 * (attempt + 1))
    return None


def fetch_country_year(source: str, year: int, force: bool = False) -> pd.DataFrame | None:
    """Fetch one FIRMS yearly country CSV, caching it under data/raw."""
    name = COUNTRY["firms_name"]
    path = RAW / f"{source}_{year}_{name}.csv"
    if not path.exists() or force:
        url = f"{FIRMS_BASE}/data/country/{source}/{year}/{source}_{year}_{name}.csv"
        r = _get(url)
        if r is None or not r.text.strip():
            return None
        path.write_bytes(r.content)
    df = pd.read_csv(path)
    if df.empty:
        return None
    df["source_file"] = path.name
    return df


def fetch_api(source: str, days: int = 5, day: date | None = None, map_key: str | None = None,
              bbox: list[float] | None = None) -> pd.DataFrame | None:
    """Fetch detections for a bbox (default: the country) from the FIRMS area API.

    The API allows 1 to 5 days per request; ``day`` is the start date. Returns an empty
    DataFrame when the request worked but found no fire, and None when it failed.
    The key allows 5,000 transactions per 10 minutes (one 5-day request costs about 10),
    so on "Exceeding allowed transaction limit" we wait and retry.
    """
    map_key = map_key or os.environ.get("FIRMS_MAP_KEY")
    if not map_key:
        raise RuntimeError("Set FIRMS_MAP_KEY to use the FIRMS area API")
    w, s, e, n = bbox or COUNTRY["bbox"]
    url = f"{FIRMS_BASE}/api/area/csv/{map_key}/{source}/{w},{s},{e},{n}/{days}"
    if day:
        url += f"/{day.isoformat()}"
    for attempt in range(20):
        try:
            r = SESSION.get(url, timeout=180)
        except requests.RequestException as exc:
            print(f"  api {source} {day}: {_redact(str(exc))}", file=sys.stderr)
            time.sleep(10)
            continue
        text = r.text
        if "transaction limit" in text.lower():
            if attempt == 0:
                print("  FIRMS transaction limit reached; waiting for the 10-minute window", file=sys.stderr)
            time.sleep(60)
            continue
        if r.status_code != 200 or not text.startswith("latitude"):
            print(f"  api {source} {day}: HTTP {r.status_code} {_redact(text[:100])}", file=sys.stderr)
            return None
        df = pd.read_csv(io.StringIO(text))
        df["source_file"] = f"api:{source}"
        return df
    return None


_SAT_TO_SENSOR = {
    "Terra": "modis", "Aqua": "modis", "T": "modis", "A": "modis",
    "N": "snpp", "Suomi NPP": "snpp", "NPP": "snpp",
    "N20": "noaa20", "NOAA-20": "noaa20", "1": "noaa20",
    "N21": "noaa21", "NOAA-21": "noaa21", "2": "noaa21",
}


def normalise_columns(df: pd.DataFrame, sensor_hint: str | None = None) -> pd.DataFrame:
    """Map MODIS and VIIRS FIRMS columns onto one detection schema."""
    out = pd.DataFrame()
    out["lat"] = df["latitude"].astype("float64")
    out["lon"] = df["longitude"].astype("float64")
    t = df["acq_time"].astype(int).astype(str).str.zfill(4)
    out["acq_datetime_utc"] = pd.to_datetime(
        df["acq_date"].astype(str) + " " + t.str[:2] + ":" + t.str[2:], format="%Y-%m-%d %H:%M", utc=True
    )
    sat = df["satellite"].astype(str)
    sensor = sat.map(_SAT_TO_SENSOR)
    if sensor_hint is not None:
        sensor = sensor.fillna(sensor_hint)
    out["sensor"] = sensor
    out["satellite"] = sat
    conf = df["confidence"]
    if pd.api.types.is_numeric_dtype(conf):
        out["confidence_norm"] = conf.astype(float) / 100.0
    else:
        out["confidence_norm"] = conf.astype(str).str.lower().str[0].map({"l": 0.2, "n": 0.6, "h": 0.95})
    out["frp_mw"] = df["frp"].astype(float)
    # Pixel size along scan and track (km); MODIS pixels grow from 1 km at nadir to ~4.8 km at the swath edge.
    out["pix_km2"] = (df["scan"].astype(float) * df["track"].astype(float)) if {"scan", "track"} <= set(df) else np.nan
    out["daynight"] = df["daynight"].astype(str)
    out["type"] = df["type"].astype("Int64") if "type" in df else pd.array([pd.NA] * len(df), dtype="Int64")
    out["source_file"] = df.get("source_file", "")
    return out


def ingest_all(years: range, force: bool = False) -> pd.DataFrame:
    frames = []
    for source, meta in SOURCES.items():
        for year in years:
            if year < meta["first_year"]:
                continue
            raw = fetch_country_year(source, year, force=force)
            if raw is None:
                print(f"  {source} {year}: no file")
                continue
            norm = normalise_columns(raw, sensor_hint=meta["sensor"])
            print(f"  {source} {year}: {len(norm):,} detections")
            frames.append(norm)
    det = pd.concat(frames, ignore_index=True)
    return dedupe(det)


def dedupe(det: pd.DataFrame) -> pd.DataFrame:
    """Drop exact duplicates (same sensor, satellite, time, location)."""
    before = len(det)
    det = det.drop_duplicates(subset=["sensor", "satellite", "acq_datetime_utc", "lat", "lon"]).reset_index(drop=True)
    if before != len(det):
        print(f"  dropped {before - len(det):,} exact duplicates")
    return det


def append_api(det: pd.DataFrame, days: int, start: date | None = None) -> pd.DataFrame:
    """Append recent API detections (NRT) to the archive, for the live season."""
    frames = [det]
    for sensor, sources in API_SOURCES.items():
        for src in sources:
            if not src.endswith("NRT"):
                continue
            df = fetch_api(src, days=days, day=start)
            if df is not None:
                frames.append(normalise_columns(df, sensor_hint=sensor))
                print(f"  api {src}: {len(df):,} detections")
    return dedupe(pd.concat(frames, ignore_index=True))


def data_availability(map_key: str | None = None) -> dict[str, tuple[date, date]]:
    """Date range each FIRMS API source currently covers."""
    map_key = map_key or os.environ.get("FIRMS_MAP_KEY")
    r = _get(f"{FIRMS_BASE}/api/data_availability/csv/{map_key}/ALL")
    if r is None:
        return {}
    df = pd.read_csv(io.StringIO(r.text))
    return {row.data_id: (date.fromisoformat(str(row.min_date)), date.fromisoformat(str(row.max_date)))
            for row in df.itertuples()}


def fetch_api_range(sensor: str, since: date, until: date, avail: dict, refetch_days: int = 14,
                    bbox: list[float] | None = None, tag: str = "") -> pd.DataFrame | None:
    """Backfill [since, until] in 5-day API requests, standard processing (SP) where it exists, NRT after.

    One source per day avoids double counting SP and NRT copies of the same detection.
    Chunks older than ``refetch_days`` are cached under data/raw/api and not fetched again.
    """
    cache = RAW / "api"
    cache.mkdir(exist_ok=True)
    frames = []
    sp = next((s for s in API_SOURCES[sensor] if s.endswith("_SP")), None)
    nrt = next((s for s in API_SOURCES[sensor] if s.endswith("_NRT")), None)
    sp_end = avail.get(sp, (None, None))[1] if sp else None
    day = since
    while day <= until:
        src = sp if sp_end and day <= sp_end else nrt
        if src is None or src not in avail:
            day += timedelta(days=API_MAX_DAYS)
            continue
        last = min(day + timedelta(days=API_MAX_DAYS - 1), until, sp_end if src == sp else until)
        n = (last - day).days + 1
        path = cache / f"{tag + '_' if tag else ''}{src}_{day.isoformat()}_{n}.csv"
        fresh = (date.today() - last).days > refetch_days
        if path.exists() and fresh:
            df = pd.read_csv(path) if path.stat().st_size > 0 else None
        else:
            df = fetch_api(src, days=n, day=day, bbox=bbox)
            if df is None:  # failed: do not cache, try again next run
                day = last + timedelta(days=1)
                continue
            if df.empty:
                path.write_text("")
            else:
                df.drop(columns=["source_file"]).to_csv(path, index=False)
        if df is not None and not df.empty:
            df["source_file"] = path.name
            frames.append(normalise_columns(df, sensor_hint=sensor))
        day = last + timedelta(days=1)
    return pd.concat(frames, ignore_index=True) if frames else None


def append_api_range(det: pd.DataFrame, since: date, until: date | None = None) -> pd.DataFrame:
    until = until or date.today()
    avail = data_availability()
    if not avail:
        print("  FIRMS API not reachable or MAP_KEY invalid; skipping live data", file=sys.stderr)
        return det
    frames = [det]
    for sensor in API_SOURCES:
        # NOAA-21 has no country files: pull it from its first day so the bridge gets a 2024+ overlap.
        start = min(since, date(2024, 1, 1)) if sensor == "noaa21" else since
        df = fetch_api_range(sensor, start, until, avail)
        if df is not None:
            print(f"  api {sensor} {start}..{until}: {len(df):,} detections")
            frames.append(df)
    return dedupe(pd.concat(frames, ignore_index=True))


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--first", type=int, default=2000)
    p.add_argument("--last", type=int, default=date.today().year)
    p.add_argument("--force", action="store_true", help="re-download cached files")
    p.add_argument("--api-days", type=int, default=0, help="also pull the last N days (1-5) from the FIRMS API")
    p.add_argument("--api-since", type=date.fromisoformat, default=None,
                   help="backfill from this date (e.g. 2025-01-01) to today from the FIRMS API (needs FIRMS_MAP_KEY)")
    args = p.parse_args(argv)

    det = ingest_all(range(args.first, args.last + 1), force=args.force)
    if args.api_since:
        det = append_api_range(det, since=args.api_since)
    elif args.api_days:
        det = append_api(det, days=args.api_days)
    det["year"] = det["acq_datetime_utc"].dt.year.astype(np.int16)
    out = PROCESSED / "detections.parquet"
    det.to_parquet(out, index=False)
    print(f"wrote {out} ({len(det):,} rows)")
    print(det.groupby(["sensor", "year"]).size().unstack(0).fillna(0).astype(int).to_string())


if __name__ == "__main__":
    main()
