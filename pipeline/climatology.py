"""Build the harmonised series for every unit, then season normals and alert levels.

Units: national (``bgd``), the analysis regions, and the 64 districts.

harmonised value for a unit-week, on the VIIRS S-NPP scale:
  * observed   S-NPP count (filtered), while S-NPP flies
  * bridged    NOAA-20 / NOAA-21 x monthly bridge factor, after S-NPP ends
  * estimated  model estimate from MODIS (2003 to 2011, and any week without S-NPP)

Normal: for each unit and ISO week, the distribution over baseline years of
cumulative activity from week 1 to that week. Percentiles compare a year with the
other baseline years (never with itself).
"""

from __future__ import annotations

import json
import pickle
from datetime import UTC, datetime

import numpy as np
import pandas as pd

from pipeline.aggregate import wide
from pipeline.config import HISTORY_FIRST_YEAR, PROCESSED, RECORD_FIRST_YEAR
from pipeline.harmonise import ConformalBands, week_month

LEVELS = [(25, "below"), (75, "normal"), (90, "above"), (101, "extreme")]
QUIET_MEDIAN = 3.0  # below this baseline median cumulative count, the area is too quiet to rank


def level_for(pct: float) -> str:
    for cut, name in LEVELS:
        if pct < cut:
            return name
    return "extreme"


def _unit_tables(dw: pd.DataFrame) -> dict[str, pd.DataFrame]:
    nat = wide(dw, "national").rename(columns={"national": "unit_id"})
    reg = wide(dw, "region_id").rename(columns={"region_id": "unit_id"})
    dis = wide(dw, "district_id").rename(columns={"district_id": "unit_id"})
    return {"national": nat, "region": reg, "district": dis}


def _bridged(t: pd.DataFrame, k20: dict, k21: dict) -> pd.Series:
    """S-NPP-scale value from NOAA-20 and NOAA-21: mean of the available bridged counts."""
    bj = t["J"] * t["month"].map(k20) if "J" in t else pd.Series(np.nan, index=t.index)
    bk = t["K"] * t["month"].map(k21) if "K" in t else pd.Series(np.nan, index=t.index)
    return pd.concat([bj, bk], axis=1).mean(axis=1, skipna=True)


def _bridge_bands(reg: pd.DataFrame, k20: dict, k21: dict) -> ConformalBands:
    """80% bands for bridged weeks, from region-weeks where S-NPP and a successor both flew."""
    t = reg.copy()
    t["month"] = week_month(t["iso_year"], t["iso_week"])
    for c in ("J", "K"):
        if c not in t:
            t[c] = np.nan
    b = _bridged(t, k20, k21)
    ok = b.notna() & t["V"].notna()
    return ConformalBands().fit(b[ok].to_numpy(), t.loc[ok, "V"].to_numpy(), t.loc[ok, "month"].to_numpy())


def build_harmonised(dw: pd.DataFrame) -> pd.DataFrame:
    with open(PROCESSED / "model.pkl", "rb") as f:
        models = pickle.load(f)
    bridge = json.loads((PROCESSED / "bridge_factors.json").read_text())
    k20 = {int(m): v for m, v in bridge["noaa20_to_snpp_monthly"].items()}
    k21 = {int(m): v for m, v in bridge["noaa21_to_snpp_monthly"].items()}
    snpp_end = datetime.fromisoformat(bridge["snpp_end_utc"].replace("Z", "+00:00"))
    end_iso = snpp_end.isocalendar()

    tables = _unit_tables(dw)
    bands = _bridge_bands(tables["region"], k20, k21)

    frames = []
    for utype, t in tables.items():
        est = pd.read_parquet(PROCESSED / f"estimates_{utype}.parquet")
        key = {"national": None, "region": "region_id", "district": "district_id"}[utype]
        if key:
            est = est.rename(columns={key: "unit_id"})
        else:
            est["unit_id"] = "bgd"
        t = t[t["iso_year"] >= RECORD_FIRST_YEAR].merge(
            est[["unit_id", "iso_year", "iso_week", "est", "lo80", "hi80"]],
            on=["unit_id", "iso_year", "iso_week"], how="left")
        for c in ("J", "K", "V", "M", "V_all", "M_all", "J_all"):
            if c not in t:
                t[c] = np.nan
        t["unit_type"] = utype
        t["month"] = week_month(t["iso_year"], t["iso_week"])
        after_end = (t["iso_year"] > end_iso.year) | ((t["iso_year"] == end_iso.year) & (t["iso_week"] >= end_iso.week))
        bridged = _bridged(t, k20, k21)

        obs = t["V"].notna() & ~after_end
        # Bridge after the handover, and also in any S-NPP outage week where NOAA-20/21 flew.
        brg = bridged.notna() & (after_end | t["V"].isna())
        t["src"] = np.select([obs, brg, t["est"].notna()], ["observed", "bridged", "estimated"], "none")
        t["harm"] = np.select([obs, brg], [t["V"], bridged], t["est"])
        blo, bhi = bands.bounds(np.nan_to_num(bridged.to_numpy()), t["month"].to_numpy())
        t["lo"] = np.select([t["src"] == "estimated", t["src"] == "bridged"], [t["lo80"], blo], t["harm"])
        t["hi"] = np.select([t["src"] == "estimated", t["src"] == "bridged"], [t["hi80"], bhi], t["harm"])
        t["naive"] = models["naive"].k * t["M"]
        frames.append(t)
    h = pd.concat(frames, ignore_index=True)
    h = h[h["src"] != "none"]
    return h[["unit_type", "unit_id", "iso_year", "iso_week", "month", "M", "V", "J", "K", "naive", "est",
              "harm", "lo", "hi", "src", "M_all", "V_all", "J_all"]].reset_index(drop=True)


def complete_years(h: pd.DataFrame) -> list[int]:
    n = h[h["unit_type"] == "national"].groupby("iso_year")["iso_week"].max()
    return [int(y) for y, w in n.items() if w >= 52]


def percentiles_by_week(h: pd.DataFrame, baseline: list[int]) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Return (normals, season) tables.

    normals: unit_type, unit_id, iso_week, p10, p25, p50, p75, p90 of cumulative activity.
    season:  unit_type, unit_id, iso_year, iso_week, cum, pct, level, rank10 (years of last 10 beaten).
    """
    normals, seasons = [], []
    for (ut, uid), g in h.groupby(["unit_type", "unit_id"], sort=False):
        wk = g.pivot_table(index="iso_year", columns="iso_week", values="harm", aggfunc="sum")
        wk = wk.reindex(columns=range(1, 54))
        # A year with no week 53 carries its week-52 total forward.
        have = g.groupby("iso_year")["iso_week"].max()
        cum = wk.fillna(0).cumsum(axis=1)
        for y, last in have.items():
            if last < 53:
                cum.loc[y, last + 1:] = np.nan if last < 52 else cum.loc[y, 52]
        base = cum.loc[cum.index.intersection(baseline)]
        q = base.quantile([0.1, 0.25, 0.5, 0.75, 0.9]).T
        q.columns = ["p10", "p25", "p50", "p75", "p90"]
        q["unit_type"], q["unit_id"] = ut, uid
        normals.append(q.reset_index(names="iso_week"))

        b = base.to_numpy()
        years = base.index.to_numpy()
        for y in cum.index:
            row = cum.loc[y].to_numpy()
            others = b[years != y]
            last10 = base.loc[[yy for yy in base.index if y - 10 <= yy < y]].to_numpy()
            for wi in range(53):
                v = row[wi]
                if np.isnan(v) or wi + 1 > have[y]:
                    continue
                col = others[:, wi]
                col = col[~np.isnan(col)]
                if len(col) == 0:
                    continue
                pct = 100.0 * (np.sum(col < v) + 0.5 * np.sum(col == v)) / len(col)
                quiet = np.median(col) < QUIET_MEDIAN and v < QUIET_MEDIAN
                l10 = last10[:, wi] if len(last10) else np.array([])
                seasons.append((ut, uid, int(y), wi + 1, float(v), round(pct, 1),
                                "quiet" if quiet else level_for(pct),
                                int(np.sum(l10[~np.isnan(l10)] < v)), int(np.sum(~np.isnan(l10)))))
    season = pd.DataFrame(seasons, columns=["unit_type", "unit_id", "iso_year", "iso_week", "cum", "pct",
                                            "level", "beat_last10", "n_last10"])
    return pd.concat(normals, ignore_index=True), season


def main() -> None:
    dw = pd.read_parquet(PROCESSED / "district_week.parquet")
    h = build_harmonised(dw)
    h.to_parquet(PROCESSED / "harmonised.parquet", index=False)
    baseline = [y for y in complete_years(h) if y >= HISTORY_FIRST_YEAR]
    normals, season = percentiles_by_week(h, baseline)
    normals.to_parquet(PROCESSED / "normals.parquet", index=False)
    season.to_parquet(PROCESSED / "season.parquet", index=False)
    meta = {"baseline_years": [min(baseline), max(baseline)], "built_utc": datetime.now(UTC).isoformat()}
    (PROCESSED / "climatology_meta.json").write_text(json.dumps(meta))
    nat = h[h.unit_type == "national"].groupby(["iso_year", "src"])["harm"].sum().unstack().round(0)
    print(nat.to_string())
    print(f"baseline years {baseline[0]}-{baseline[-1]}; season rows {len(season):,}")
    last = season[(season.unit_type != "district")].sort_values(["iso_year", "iso_week"]).groupby("unit_id").tail(1)
    print(last.to_string(index=False))


if __name__ == "__main__":
    main()
