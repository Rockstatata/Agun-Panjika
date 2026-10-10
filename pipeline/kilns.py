"""Static-source (brick kiln / industry) filter.

1. FIRMS ``type`` 2 (static land source) and 3 (offshore) are dropped.
2. Detections are gridded at about 400 m. A cell is a probable kiln or industrial
   site if it has detections in ``min_months`` or more different calendar months,
   in ``min_years`` or more different years, and most detections fall outside the
   March to April jhum peak, and most of its detections come from night overpasses
   (industrial heat; crop burning is a daytime signal).

VIIRS 375 m detections define the cells. MODIS pixels are 1 km, so a MODIS
detection is flagged if any static cell lies in its 3 x 3 cell neighbourhood.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from pipeline.config import PROCESSED

CELL_DEG = 0.0036  # about 400 m in latitude; about 370 m in longitude at 23 N
PEAK_MONTHS = (3, 4)


def _cells(lat: pd.Series, lon: pd.Series) -> tuple[np.ndarray, np.ndarray]:
    return np.floor(lat.to_numpy() / CELL_DEG).astype(np.int64), np.floor(lon.to_numpy() / CELL_DEG).astype(np.int64)


def flag_static_cells(det: pd.DataFrame, min_months: int = 4, min_years: int = 3,
                      max_peak_share: float = 0.5, min_night_share: float = 0.5,
                      min_detections: int = 10) -> pd.DataFrame:
    """Return a table of flagged static cells with their stats."""
    v = det[det["sensor"] != "modis"].copy()
    v["ci"], v["cj"] = _cells(v["lat"], v["lon"])
    t = v["acq_datetime_utc"]
    v["month"] = t.dt.month
    v["yr"] = t.dt.year
    v["peak"] = v["month"].isin(PEAK_MONTHS)
    g = v.groupby(["ci", "cj"]).agg(
        n=("lat", "size"), months=("month", "nunique"), years=("yr", "nunique"),
        peak_share=("peak", "mean"), lat=("lat", "mean"), lon=("lon", "mean"),
        typed_static=("type", lambda s: (s == 2).mean()),
        night_share=("daynight", lambda s: (s == "N").mean()),
    ).reset_index()
    # Industrial heat (kilns, gas flares, power plants, factories) shows up mainly in VIIRS night passes;
    # repeated crop burning in the same field shows up by day. A satellite-imagery spot check of 20 cells
    # found every day-only cell was farmland or forest, so day-dominated cells are kept as vegetation fire.
    # A second check found the remaining doubtful cells all had fewer than 10 detections in 13+ years.
    flagged = g[(g.months >= min_months) & (g.years >= min_years) & (g.peak_share < max_peak_share)
                & (g.night_share >= min_night_share) & (g.n >= min_detections)]
    return flagged.reset_index(drop=True)


def apply_filters(det: pd.DataFrame, cells: pd.DataFrame) -> pd.DataFrame:
    """Add ``conf_ok`` and ``static_flag`` columns; ``keep`` is the default analysis set."""
    out = det.copy()
    is_modis = out["sensor"] == "modis"
    # VIIRS: nominal and high (0.6, 0.95); MODIS: confidence >= 30.
    out["conf_ok"] = np.where(is_modis, out["confidence_norm"] >= 0.30, out["confidence_norm"] >= 0.5)

    ci, cj = _cells(out["lat"], out["lon"])
    static = set(zip(cells["ci"].tolist(), cells["cj"].tolist(), strict=False))
    in_cell = np.fromiter(((a, b) in static for a, b in zip(ci, cj, strict=False)), bool, len(out))
    near = in_cell.copy()
    m_idx = np.flatnonzero(is_modis.to_numpy())
    for di in (-1, 0, 1):
        for dj in (-1, 0, 1):
            hit = np.fromiter(((ci[k] + di, cj[k] + dj) in static for k in m_idx), bool, len(m_idx))
            near[m_idx] |= hit
    typed = out["type"].isin([2, 3]).fillna(False).to_numpy()
    out["static_flag"] = typed | np.where(is_modis, near, in_cell)
    out["static_reason"] = np.select([typed, out["static_flag"]], ["firms_type", "kiln_cell"], "")
    out["keep"] = out["conf_ok"] & ~out["static_flag"]
    return out


def write_spotcheck(cells: pd.DataFrame, n: int = 20, seed: int = 2026) -> None:
    """Random sample of flagged cells with imagery links, for the PRD precision check (>= 80% real kilns)."""
    from pipeline.config import ROOT

    prev = [p for p in (ROOT / "docs").glob("kiln_spotcheck_round*.csv")]
    if prev:
        done = pd.concat([pd.read_csv(p) for p in prev])
        key = set(zip(done.lat.round(4), done.lon.round(4), strict=True))
        cells = cells[[(a, b) not in key for a, b in zip(cells.lat.round(4), cells.lon.round(4), strict=True)]]
    s = cells.sample(min(n, len(cells)), random_state=seed).reset_index(drop=True)
    url = "https://www.google.com/maps/@{:.5f},{:.5f},600m/data=!3m1!1e3"
    s["google_maps"] = [url.format(la, lo) for la, lo in zip(s.lat, s.lon, strict=True)]
    s["is_kiln_or_industry"] = ""  # fill in Y / N after looking at the imagery
    s["notes"] = ""
    out = ROOT / "docs" / f"kiln_spotcheck_round{len(prev) + 1}.csv"
    cols = ["lat", "lon", "n", "months", "years", "peak_share", "google_maps", "is_kiln_or_industry", "notes"]
    s[cols].round(5).to_csv(out, index=False)
    print(f"wrote {out}")


def main() -> None:
    import sys

    det = pd.read_parquet(PROCESSED / "detections.parquet")
    # Flag cells from Bangladesh detections only (the API bbox also covers neighbouring land).
    inside = det["district_id"] != "outside" if "district_id" in det else True
    cells = flag_static_cells(det[inside & ~det["type"].isin([3]).fillna(False)])
    cells.to_parquet(PROCESSED / "static_cells.parquet", index=False)
    if "--spotcheck" in sys.argv:
        write_spotcheck(cells)
    det = apply_filters(det, cells)
    det.to_parquet(PROCESSED / "detections.parquet", index=False)
    print(f"static cells flagged: {len(cells):,}")
    print(det.groupby(["sensor", "static_reason"]).size().unstack().fillna(0).astype(int).to_string())
    print("kept share by sensor:")
    print(det.groupby("sensor")["keep"].mean().round(3).to_string())
    m = det["acq_datetime_utc"].dt.month
    print("removed share, off-season vs Mar-Apr (S-NPP):")
    s = det[det.sensor == "snpp"]
    print(s.groupby(m[s.index].isin(PEAK_MONTHS))["static_flag"].mean().round(3).to_string())


if __name__ == "__main__":
    main()
