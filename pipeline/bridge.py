"""S-NPP -> NOAA-20 / NOAA-21 continuity bridge.

For each successor satellite, three bridge forms are compared leave-one-year-out on
its overlap with S-NPP (NOAA-20: 2019-2024 country files; NOAA-21: from Jan 2024, API):

  identity   no correction (factor 1)
  single     one factor = sum(S-NPP) / sum(successor)
  monthly    monthly factors shrunk toward the single factor:
             k_m = (V_m + tau * k) / (J_m + tau), tau = 300 detections

The form with the lowest held-out season-total error (ties: weekly error) is shipped.
After S-NPP stops (13:00 UTC 2 Nov 2026), the series continues as the successor
counts times the bridge factor, on the S-NPP scale.
"""

from __future__ import annotations

import json

import pandas as pd

from pipeline.config import BRIDGE_YEARS, PROCESSED, WEB_DATA
from pipeline.harmonise import week_month

SNPP_END_UTC = "2026-11-02T13:00:00Z"
TAU = 300.0


def factors_for(form: str, d: pd.DataFrame, src: str) -> dict[int, float]:
    if form == "identity":
        return dict.fromkeys(range(1, 13), 1.0)
    k = d["V"].sum() / max(d[src].sum(), 1)
    if form == "single":
        return dict.fromkeys(range(1, 13), float(k))
    g = d.groupby("month")[["V", src]].sum().reindex(range(1, 13), fill_value=0)
    return {int(m): float((r["V"] + TAU * k) / (r[src] + TAU)) for m, r in g.iterrows()}


def national_weeks(dw: pd.DataFrame) -> pd.DataFrame:
    w = dw.groupby(["iso_year", "iso_week", "sensor"])["count"].sum().unstack("sensor").reset_index()
    w["month"] = week_month(w["iso_year"], w["iso_week"])
    return w.rename(columns={"snpp": "V", "noaa20": "J", "noaa21": "K"})


def evaluate(ov: pd.DataFrame, src: str) -> tuple[str, dict, pd.DataFrame]:
    rows = []
    for form in ("identity", "single", "monthly"):
        for y in sorted(ov.iso_year.unique()):
            tr, te = ov[ov.iso_year != y], ov[ov.iso_year == y]
            if tr.empty or len(te) < 8:
                continue
            k = factors_for(form, tr, src)
            pred = te[src] * te["month"].map(k)
            rows.append({"form": form, "year": int(y), "weeks": len(te),
                         "mae_week": float((pred - te["V"]).abs().mean()),
                         "total_pct_err": float(100 * (pred.sum() / te["V"].sum() - 1))})
    v = pd.DataFrame(rows)
    score = v.assign(a=v.total_pct_err.abs()).groupby("form").agg(abs_total=("a", "mean"), mae=("mae_week", "mean"))
    best = score.sort_values(["abs_total", "mae"]).index[0]
    return best, score.round(2).to_dict(orient="index"), v


def main() -> None:
    dw = pd.read_parquet(PROCESSED / "district_week.parquet")
    nat = national_weeks(dw)
    out: dict = {"snpp_end_utc": SNPP_END_UTC, "tau": TAU}
    for sat, src, years in (("noaa20", "J", BRIDGE_YEARS), ("noaa21", "K", None)):
        if src not in nat:
            out[sat] = {"form": "identity", "note": "no data"}
            continue
        ov = nat[nat["V"].notna() & nat[src].notna()]
        if years is not None:
            ov = ov[ov.iso_year.isin(years)]
        if len(ov) < 52:
            out[sat] = {"form": "identity", "note": "less than a year of overlap"}
            continue
        form, score, v = evaluate(ov, src)
        k = factors_for(form, ov, src)
        out[sat] = {
            "form": form, "monthly": {m: round(f, 4) for m, f in k.items()},
            "overlap": [int(ov.iso_year.min()), int(ov.iso_year.max())], "weeks": int(len(ov)),
            "totals": {"snpp": int(ov["V"].sum()), sat: int(ov[src].sum())},
            "loyo_score": score, "loyo": v.round(2).to_dict(orient="records"),
        }
    # Flat fields the app and climatology read.
    out["overlap_years"] = out["noaa20"].get("overlap", [min(BRIDGE_YEARS), max(BRIDGE_YEARS)])
    out["noaa20_to_snpp_monthly"] = out["noaa20"].get("monthly", dict.fromkeys(range(1, 13), 1.0))
    out["noaa21_to_snpp_monthly"] = out["noaa21"].get("monthly", out["noaa20_to_snpp_monthly"])
    out["national_totals"] = out["noaa20"].get("totals", {"snpp": 0, "noaa20": 0})
    (PROCESSED / "bridge_factors.json").write_text(json.dumps(out, indent=1))
    (WEB_DATA / "bridge.json").write_text(json.dumps(out, separators=(",", ":")))
    for sat in ("noaa20", "noaa21"):
        print(sat, out[sat].get("form"), out[sat].get("loyo_score"), out[sat].get("totals"))


if __name__ == "__main__":
    main()
