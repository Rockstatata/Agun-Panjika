"""Aggregate filtered detections to unit-week tables.

Units are districts (``district_id``). Regions and the national total are sums
of districts, so every level adds up. Weeks are ISO weeks (1 to 52 or 53).

Output: data/processed/district_week.parquet with columns
    district_id, region_id, iso_year, iso_week, sensor, count, frp_sum, count_all,
    aqua, night, lowfrp, hiconf
``count`` and ``frp_sum`` use the default filters (confidence + static sources);
``aqua``, ``night``, ``lowfrp`` (FRP < 15 MW) and ``hiconf`` (confidence >= 0.8) split the
kept count; for MODIS they describe the detections the harmonisation model learns from.
``count_all`` is the unfiltered count, used to show what the kiln filter removed.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from pipeline.config import PROCESSED

SENSORS = ("modis", "snpp", "noaa20", "noaa21")


def iso_weeks_between(start: pd.Timestamp, end: pd.Timestamp) -> pd.DataFrame:
    """All (iso_year, iso_week) pairs whose Monday falls in [start, end]."""
    mondays = pd.date_range(start - pd.Timedelta(days=start.weekday()), end, freq="W-MON")
    iso = mondays.isocalendar()
    return pd.DataFrame({"iso_year": iso.year.astype(int).values, "iso_week": iso.week.astype(int).values,
                         "week_start": mondays.date})


def to_district_week(det: pd.DataFrame) -> pd.DataFrame:
    det = det[det["district_id"] != "outside"].copy()
    iso = det["acq_datetime_utc"].dt.tz_convert("UTC").dt.isocalendar()
    det["iso_year"] = iso.year.astype(int)
    det["iso_week"] = iso.week.astype(int)
    keys = ["district_id", "region_id", "sensor", "iso_year", "iso_week"]
    k = det[det["keep"]].assign(
        is_aqua=lambda x: x["satellite"] == "Aqua", is_night=lambda x: x["daynight"] == "N",
        is_low=lambda x: x["frp_mw"] < 15, is_hi=lambda x: x["confidence_norm"] >= 0.8)
    if "pix_km2" not in k:
        k["pix_km2"] = np.nan
    k = k.assign(is_nadir=k["pix_km2"] < 1.5)
    kept = k.groupby(keys).agg(count=("lat", "size"), frp_sum=("frp_mw", "sum"), aqua=("is_aqua", "sum"),
                               night=("is_night", "sum"), lowfrp=("is_low", "sum"), hiconf=("is_hi", "sum"),
                               pix_sum=("pix_km2", "sum"), nadir=("is_nadir", "sum"))
    allc = det.groupby(keys).agg(count_all=("lat", "size"))
    agg = allc.join(kept, how="left").fillna(0).reset_index()

    # Zero-fill: every district x every week the sensor was flying.
    districts = det[["district_id", "region_id"]].drop_duplicates()
    frames = []
    for sensor in agg["sensor"].unique():
        t = det.loc[det["sensor"] == sensor, "acq_datetime_utc"].dt.tz_localize(None)
        weeks = iso_weeks_between(t.min().normalize(), t.max().normalize())
        # Drop a trailing week covered by fewer than 3 days of data (e.g. ISO 2025-W01
        # holds only 30-31 Dec 2024 in the archive files); it would look like a new season.
        last_day = t.max().normalize().date()
        if (last_day - weeks["week_start"].iloc[-1]).days + 1 < 3:
            weeks = weeks.iloc[:-1]
        grid = districts.merge(weeks, how="cross")
        grid["sensor"] = sensor
        frames.append(grid)
    full = pd.concat(frames, ignore_index=True).merge(agg, on=keys, how="left")
    dropped = agg.merge(full[keys], on=keys, how="left", indicator=True)
    lost = dropped[dropped["_merge"] == "left_only"]
    if len(lost):
        print(f"  dropped {int(lost['count_all'].sum())} detections in partial trailing weeks")
    ints = ["count", "count_all", "aqua", "night", "lowfrp", "hiconf", "nadir"]
    full[ints] = full[ints].fillna(0).astype(int)
    full[["frp_sum", "pix_sum"]] = full[["frp_sum", "pix_sum"]].fillna(0.0)
    return full.sort_values(keys).reset_index(drop=True)


def wide(dw: pd.DataFrame, level: str = "district_id") -> pd.DataFrame:
    """Pivot to one row per unit-week with M, F, V, J columns (NaN where a sensor was not flying)."""
    keys = [level, "iso_year", "iso_week"] if level != "national" else ["iso_year", "iso_week"]
    d = dw if level != "national" else dw.assign(national="bgd")
    gkeys = keys if level != "national" else ["national", "iso_year", "iso_week"]
    vals = ["count", "frp_sum", "count_all", "aqua", "night", "lowfrp", "hiconf", "pix_sum", "nadir"]
    vals = [v for v in vals if v in d]
    g = d.groupby([*gkeys, "sensor"])[vals].sum().reset_index()
    w = g.pivot_table(index=gkeys, columns="sensor", values=vals)
    w.columns = [f"{a}_{b}" for a, b in w.columns]
    w = w.reset_index()
    ren = {"count_modis": "M", "frp_sum_modis": "F", "count_snpp": "V", "frp_sum_snpp": "FV",
           "count_noaa20": "J", "count_noaa21": "K",
           "count_all_modis": "M_all", "count_all_snpp": "V_all", "count_all_noaa20": "J_all",
           "count_all_noaa21": "K_all", "aqua_modis": "A", "night_modis": "N", "lowfrp_modis": "L",
           "hiconf_modis": "H", "pix_sum_modis": "PIX", "nadir_modis": "NAD"}
    return w.rename(columns=ren)


def main() -> None:
    det = pd.read_parquet(PROCESSED / "detections.parquet")
    dw = to_district_week(det)
    dw.to_parquet(PROCESSED / "district_week.parquet", index=False)
    print(f"district_week rows: {len(dw):,}")
    print(dw.groupby("sensor").agg(weeks=("iso_week", "size"), count=("count", "sum"),
                                   count_all=("count_all", "sum")).to_string())


if __name__ == "__main__":
    main()
