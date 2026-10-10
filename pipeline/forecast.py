"""Early warning: fire-activity outlooks and weekly anomaly alerts.

Three products, all built on the harmonised weekly record (VIIRS S-NPP scale):

1. Two-week outlook (all year). At the end of each week, the chance that the next two
   weeks will be above normal (above the 75th percentile of that two-week window in the
   baseline years) and the expected number of detections with an 80% range.
2. Season outlook (January to May). The chance that the rest of the burning season
   (to the end of May, ISO week 22) will be above normal, and the expected total.
3. Weekly anomaly alerts. Districts whose fire this week is unusually high for the time
   of year (above the 90th percentile of that week in the baseline years).

Inputs at issue time: harmonised fire up to the issue week, and the Fire Weather Index
(pipeline/fireweather.py) from NASA POWER up to the issue week plus the 16-day weather
forecast for the two target weeks. Rainfall, soil wetness and ENSO were tested and added
no skill; FWI does.

Hindcast skill is measured leave-one-year-out over 2003-2025 against climatology (Brier
skill score, ROC AUC, reliability) and persistence, at two bounds: "fire_only" (no weather
forecast, a guaranteed floor) and "full" (observed FWI of the target weeks standing in for
a perfect forecast, an upper bound). Live skill sits between the two. The season outlook
showed no skill beyond climatology, so the app shows the normal range for the rest of
the season rather than a probability. The outlooks are about how much fire is detected
in an area, never about individual fires.
"""

from __future__ import annotations

import io
import json
import warnings
from datetime import UTC, datetime

import numpy as np
import pandas as pd
import requests

from pipeline.config import COUNTRY, PROCESSED, WEB_DATA
from pipeline.harmonise import _cq, week_month

SEASON_END_WEEK = 22  # end of May
ONI_URL = "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt"
ONI_SEASONS = ["DJF", "JFM", "FMA", "MAM", "AMJ", "MJJ", "JJA", "JAS", "ASO", "SON", "OND", "NDJ"]
WEATHER_FEATURES = ["p4_anom", "p12_anom", "soil2_anom", "tmax2_anom", "rh2_anom", "raindays4"]


# ------------------------------------------------------------------------- inputs


def load_oni() -> pd.DataFrame:
    """Monthly ONI keyed by the centre month of each 3-month season."""
    cache = PROCESSED / "oni.csv"
    try:
        txt = requests.get(ONI_URL, timeout=60).text
        df = pd.read_csv(io.StringIO(txt), sep=r"\s+")
        df.to_csv(cache, index=False)
    except (requests.RequestException, ValueError):
        df = pd.read_csv(cache)
    df["month"] = df["SEAS"].map({s: i + 1 for i, s in enumerate(ONI_SEASONS)}) + 0
    # centre month of DJF is January, of JFM February, ... (index + 1 already = centre month)
    return df.rename(columns={"YR": "year", "ANOM": "oni"})[["year", "month", "oni"]]


def unit_weeks() -> pd.DataFrame:
    h = pd.read_parquet(PROCESSED / "harmonised.parquet")
    h = h[h.unit_type.isin(["national", "region"])]
    return h[["unit_type", "unit_id", "iso_year", "iso_week", "harm"]].copy()


def weather_weeks(units: list[str]) -> pd.DataFrame:
    w = pd.read_parquet(PROCESSED / "weather_week.parquet").rename(columns={"region_id": "unit_id"})
    nat = w.groupby(["iso_year", "iso_week"], as_index=False)[["precip", "tmax", "rh", "wind", "soil", "rain_days"]] \
        .mean().assign(unit_id="bgd")
    return pd.concat([w, nat], ignore_index=True)


def load_fwi_weeks() -> pd.DataFrame:
    """Weekly FWI per unit with the next-two-week mean (observed history, forecast at the end)."""
    fw = pd.read_parquet(PROCESSED / "fwi_week.parquet").rename(columns={"region_id": "unit_id"})
    nat = fw.groupby(["iso_year", "iso_week"], as_index=False)[["fwi", "dc"]].mean().assign(unit_id="bgd")
    fw = pd.concat([fw[["unit_id", "iso_year", "iso_week", "fwi", "dc"]], nat], ignore_index=True)
    fw = fw.sort_values(["unit_id", "iso_year", "iso_week"]).reset_index(drop=True)
    g = fw.groupby("unit_id")["fwi"]
    fw["fwi_next2"] = (g.shift(-1) + g.shift(-2)) / 2
    return fw


# ----------------------------------------------------------------------- features


def _roll(s: pd.Series, n: int) -> pd.Series:
    return s.rolling(n, min_periods=1).sum()


def build_table(fire: pd.DataFrame, wx: pd.DataFrame, oni: pd.DataFrame) -> pd.DataFrame:
    """One row per unit and issue week, with features known at issue time and future targets."""
    rows = []
    for uid, g in fire.groupby("unit_id"):
        g = g.sort_values(["iso_year", "iso_week"]).reset_index(drop=True)
        g = g.merge(wx[wx.unit_id == uid].drop(columns="unit_id"), on=["iso_year", "iso_week"], how="left")
        g["last4"] = _roll(g["harm"], 4)
        g["cum"] = g.groupby("iso_year")["harm"].cumsum()
        g["next2"] = g["harm"].shift(-1) + g["harm"].shift(-2)
        # Keep the two target weeks inside the same ISO year so the window is well defined.
        same = (g["iso_year"].shift(-2) == g["iso_year"])
        g.loc[~same, "next2"] = np.nan
        # Rest of the burning season (weeks after the issue week up to week 22).
        rest = []
        for _y, gy in g.groupby("iso_year"):
            v = gy["harm"].to_numpy()
            w = gy["iso_week"].to_numpy()
            in_season = w <= SEASON_END_WEEK
            total = np.where(in_season, v, 0)
            complete = (w.max() >= SEASON_END_WEEK)
            r = [float(total[i + 1:].sum()) if complete and w[i] < SEASON_END_WEEK else np.nan for i in range(len(v))]
            rest += r
        g["rest_season"] = rest
        g["p4"] = _roll(g["precip"], 4)
        g["p12"] = _roll(g["precip"], 12)
        g["soil2"] = g["soil"].rolling(2, min_periods=1).mean()
        g["tmax2"] = g["tmax"].rolling(2, min_periods=1).mean()
        g["rh2"] = g["rh"].rolling(2, min_periods=1).mean()
        g["raindays4"] = _roll(g["rain_days"], 4)
        g["unit_id"] = uid
        rows.append(g)
    t = pd.concat(rows, ignore_index=True)
    t["month"] = week_month(t["iso_year"], t["iso_week"])
    t = t.merge(oni, left_on=["iso_year", "month"], right_on=["year", "month"], how="left").drop(columns="year")
    t["oni"] = t.groupby("unit_id")["oni"].ffill()
    fw = load_fwi_weeks()
    t = t.merge(fw, on=["unit_id", "iso_year", "iso_week"], how="left")
    t["wsin"] = np.sin(2 * np.pi * t["iso_week"] / 52.18)
    t["wcos"] = np.cos(2 * np.pi * t["iso_week"] / 52.18)
    return t


def add_climatology(t: pd.DataFrame, years: list[int], exclude: int | None = None) -> pd.DataFrame:
    """Per unit and ISO week, baseline statistics from ``years`` (minus ``exclude``), and anomalies."""
    base = t[t.iso_year.isin([y for y in years if y != exclude])]
    agg = base.groupby(["unit_id", "iso_week"]).agg(
        clim_next2=("next2", "median"), q75_next2=("next2", lambda s: s.quantile(0.75)),
        clim_rest=("rest_season", "median"), q75_rest=("rest_season", lambda s: s.quantile(0.75)),
        clim_last4=("last4", "median"), clim_cum=("cum", "median"),
        clim_p4=("p4", "mean"), clim_p12=("p12", "mean"), clim_soil2=("soil2", "mean"),
        clim_tmax2=("tmax2", "mean"), clim_rh2=("rh2", "mean"), clim_fwi=("fwi", "mean"),
        clim_dc=("dc", "mean"), clim_fwi_next2=("fwi_next2", "mean")).reset_index()
    out = t.drop(columns=[c for c in agg.columns if c.startswith(("clim_", "q75_"))], errors="ignore") \
        .merge(agg, on=["unit_id", "iso_week"], how="left")
    out["l_last1"] = np.log1p(out["harm"])
    out["l_last4"] = np.log1p(out["last4"])
    out["l_cum"] = np.log1p(out["cum"])
    out["anom_last4"] = np.log1p(out["last4"]) - np.log1p(out["clim_last4"])
    out["anom_cum"] = np.log1p(out["cum"]) - np.log1p(out["clim_cum"])
    out["l_clim_next2"] = np.log1p(out["clim_next2"])
    out["l_clim_rest"] = np.log1p(out["clim_rest"])
    out["p4_anom"] = np.log1p(out["p4"]) - np.log1p(out["clim_p4"])
    out["p12_anom"] = np.log1p(out["p12"]) - np.log1p(out["clim_p12"])
    out["soil2_anom"] = out["soil2"] - out["clim_soil2"]
    out["tmax2_anom"] = out["tmax2"] - out["clim_tmax2"]
    out["rh2_anom"] = out["rh2"] - out["clim_rh2"]
    out["fwi_anom"] = out["fwi"] - out["clim_fwi"]
    out["dc_anom"] = out["dc"] - out["clim_dc"]
    out["fwi_next2_anom"] = out["fwi_next2"] - out["clim_fwi_next2"]
    out["above_next2"] = (out["next2"] > out["q75_next2"]).astype(float).where(out["next2"].notna())
    out["above_rest"] = (out["rest_season"] > out["q75_rest"]).astype(float).where(out["rest_season"].notna())
    return out


# ------------------------------------------------------------------------- models

FIRE_FEATURES = ["l_last1", "l_last4", "l_cum", "anom_last4", "anom_cum", "wsin", "wcos"]
FWI_FEATURES = ["fwi_anom", "dc_anom", "fwi_next2_anom"]
FEATURES = {
    "next2": FIRE_FEATURES + ["l_clim_next2"] + FWI_FEATURES,
    "rest": FIRE_FEATURES + ["l_clim_rest"] + FWI_FEATURES[:2],
}
FEATURES_FIRE_ONLY = {"next2": FIRE_FEATURES + ["l_clim_next2"], "rest": FIRE_FEATURES + ["l_clim_rest"]}


def _clf(cols=None):
    import lightgbm as lgb

    return lgb.LGBMClassifier(n_estimators=300, learning_rate=0.02, num_leaves=7, min_child_samples=60,
                              subsample=0.8, subsample_freq=1, colsample_bytree=0.8, random_state=2026, verbose=-1)


def _reg():
    import lightgbm as lgb

    return lgb.LGBMRegressor(objective="poisson", n_estimators=300, learning_rate=0.03, num_leaves=15,
                             min_child_samples=40, subsample=0.8, subsample_freq=1, colsample_bytree=0.8,
                             random_state=2026, verbose=-1)


def _prep(df: pd.DataFrame, cols: list[str]) -> pd.DataFrame:
    # Anomalies default to 0 (normal) when an input is missing.
    return df[cols].astype(float).fillna(0)


def _season_rows(df: pd.DataFrame, target: str) -> pd.DataFrame:
    if target == "rest":
        return df[df.iso_week < SEASON_END_WEEK]
    return df


def hindcast(t: pd.DataFrame, years: list[int], target: str) -> pd.DataFrame:
    """Leave-one-year-out hindcasts: probability of above normal and expected count."""
    tcol, acol = ("next2", "above_next2") if target == "next2" else ("rest_season", "above_rest")
    out = []
    for y in years:
        d = add_climatology(t, years, exclude=y)
        d = _season_rows(d[d[tcol].notna()], target)
        tr, te = d[d.iso_year != y], d[d.iso_year == y].copy()
        if te.empty:
            continue
        for name, cols in (("full", FEATURES[target]), ("fire_only", FEATURES_FIRE_ONLY[target])):
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                clf = _clf(cols).fit(_prep(tr, cols), tr[acol])
                te[f"p_{name}"] = clf.predict_proba(_prep(te, cols))[:, 1]
                reg = _reg().fit(_prep(tr, cols), tr[tcol])
                te[f"n_{name}"] = reg.predict(_prep(te, cols))
        te["p_clim"] = 0.25
        te["n_clim"] = te[f"clim_{'next2' if target == 'next2' else 'rest'}"]
        # Persistence: scale the climatological expectation by how anomalous the last 4 weeks were.
        ratio = (te["last4"] + 1) / (te["clim_last4"] + 1)
        te["n_persist"] = te["n_clim"] * ratio.clip(0.2, 5)
        out.append(te)
    return pd.concat(out, ignore_index=True)


def _auc(y: np.ndarray, p: np.ndarray) -> float:
    from sklearn.metrics import roc_auc_score

    return float(roc_auc_score(y, p)) if len(np.unique(y)) == 2 else float("nan")


def skill(H: pd.DataFrame, target: str) -> dict:
    tcol, acol = ("next2", "above_next2") if target == "next2" else ("rest_season", "above_rest")
    y = H[acol].to_numpy()
    out = {"n": int(len(H)), "base_rate": round(float(y.mean()), 3)}
    bs_clim = float(np.mean((H["p_clim"] - y) ** 2))
    for m in ("full", "fire_only"):
        bs = float(np.mean((H[f"p_{m}"] - y) ** 2))
        out[f"brier_{m}"] = round(bs, 4)
        out[f"bss_{m}"] = round(1 - bs / bs_clim, 3)
        out[f"auc_{m}"] = round(_auc(y, H[f"p_{m}"].to_numpy()), 3)
    out["brier_clim"] = round(bs_clim, 4)
    for m in ("full", "fire_only", "clim", "persist"):
        out[f"mae_{m}"] = round(float(np.abs(H[f"n_{m}"] - H[tcol]).mean()), 2)
    # Reliability diagram for the full model.
    bins = np.linspace(0, 1, 6)
    idx = np.clip(np.digitize(H["p_full"], bins) - 1, 0, 4)
    out["reliability"] = [{"p": round(float(H["p_full"][idx == i].mean()), 3),
                           "obs": round(float(y[idx == i].mean()), 3), "n": int((idx == i).sum())}
                          for i in range(5) if (idx == i).sum() > 0]
    # Hit rate / false alarms when "warning" = probability >= 0.5.
    warn = H["p_full"] >= 0.5
    out["warning_hit_rate"] = round(float((warn & (y == 1)).sum() / max((y == 1).sum(), 1)), 3)
    out["warning_false_alarm_ratio"] = round(float((warn & (y == 0)).sum() / max(warn.sum(), 1)), 3)
    return out


def conformal_bounds(H: pd.DataFrame, target: str) -> tuple[float, float]:
    tcol = "next2" if target == "next2" else "rest_season"
    r = np.log1p(H[tcol]) - np.log1p(H["n_full"])
    return _cq(r, 0.9, False), _cq(r, 0.9, True)


# ----------------------------------------------------------------------- alerts


def weekly_alerts(years: list[int]) -> pd.DataFrame:
    """District-weeks above the 90th percentile of that week's baseline (and at least 5 detections)."""
    h = pd.read_parquet(PROCESSED / "harmonised.parquet")
    d = h[h.unit_type == "district"][["unit_id", "iso_year", "iso_week", "harm"]]
    base = d[d.iso_year.isin(years)]
    q = base.groupby(["unit_id", "iso_week"])["harm"].agg(q90=lambda s: s.quantile(0.9), med="median").reset_index()
    j = d.merge(q, on=["unit_id", "iso_week"], how="left")
    j["ratio"] = (j["harm"] + 1) / (j["med"] + 1)
    j["alert"] = (j["harm"] > j["q90"]) & (j["harm"] >= 5)
    return j


def _level(p: float) -> str:
    return "high" if p >= 0.6 else "elevated" if p >= 0.4 else "normal" if p >= 0.15 else "low"


def main() -> None:
    fire = unit_weeks()
    wx = weather_weeks(fire.unit_id.unique().tolist())
    oni = load_oni()
    t = build_table(fire, wx, oni)
    complete = sorted(int(y) for y, w in fire[fire.unit_id == "bgd"].groupby("iso_year")["iso_week"].max().items()
                      if w >= 52)
    years = [y for y in complete if y >= 2003]
    current_year = int(fire.iso_year.max())
    print(f"hindcast years {years[0]}-{years[-1]}, live year {current_year}")

    result = {"generated_utc": datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
              "hindcast_years": [years[0], years[-1]], "products": {}}
    for target in ("next2", "rest"):
        H = hindcast(t, years, target)
        sk = skill(H, target)
        lo, hi = conformal_bounds(H, target)
        sk["interval_log"] = [round(lo, 3), round(hi, 3)]
        tcol = "next2" if target == "next2" else "rest_season"
        inside = (np.log1p(H[tcol]) - np.log1p(H["n_full"])).between(lo, hi).mean()
        sk["interval_coverage_in_sample"] = round(float(inside), 3)
        H.to_parquet(PROCESSED / f"hindcast_{target}.parquet", index=False)
        # Skill per unit and by issue month, for the method page.
        acol = "above_next2" if target == "next2" else "above_rest"

        def _bss(g: pd.DataFrame, acol: str = acol) -> float:
            return round(1 - np.mean((g["p_full"] - g[acol]) ** 2) / max(np.mean((0.25 - g[acol]) ** 2), 1e-9), 3)

        by_unit = {u: {"bss": _bss(g), "auc": round(_auc(g[acol].to_numpy(), g["p_full"].to_numpy()), 3)}
                   for u, g in H.groupby("unit_id")}
        sk["by_unit"] = by_unit

        # Live outlook: fit on all complete years, issue from the latest week of the live year.
        d = add_climatology(t, years)
        trn = _season_rows(d[d[tcol].notna() & d.iso_year.isin(years)], target)
        cols = FEATURES[target]
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            clf = _clf(cols).fit(_prep(trn, cols), trn[f"above_{'next2' if target == 'next2' else 'rest'}"])
            reg = _reg().fit(_prep(trn, cols), trn[tcol])
        live = d[d.iso_year == current_year]
        live = live[live.iso_week == live.groupby("unit_id")["iso_week"].transform("max")]
        outlooks = {}
        for r in live.itertuples():
            row = live.loc[[r.Index]]
            if target == "rest" and r.iso_week >= SEASON_END_WEEK:
                outlooks[r.unit_id] = {"active": False, "issue_week": int(r.iso_week)}
                continue
            p = float(clf.predict_proba(_prep(row, cols))[:, 1][0])
            n = float(reg.predict(_prep(row, cols))[0])
            outlooks[r.unit_id] = {
                "active": True, "issue_year": int(r.iso_year), "issue_week": int(r.iso_week),
                "p_above": round(p, 3), "level": _level(p), "expected": round(n, 1),
                "lo80": round(max(0.0, float(np.expm1(np.log1p(n) + lo))), 1),
                "hi80": round(float(np.expm1(np.log1p(n) + hi)), 1),
                "normal_median": round(float(getattr(r, "clim_next2" if target == "next2" else "clim_rest")), 1),
                "normal_q75": round(float(getattr(r, "q75_next2" if target == "next2" else "q75_rest")), 1),
                "drivers": {"fire_last4_vs_normal": round(float(r.anom_last4), 2),
                            "fwi_now_anom": round(float(r.fwi_anom), 1) if pd.notna(r.fwi_anom) else None,
                            "fwi_next2_anom": round(float(r.fwi_next2_anom), 1) if pd.notna(r.fwi_next2_anom) else None,
                            "drought_code_anom": round(float(r.dc_anom), 0) if pd.notna(r.dc_anom) else None},
            }
        sk["feature_importance"] = dict(zip(cols, clf.feature_importances_.tolist(), strict=True))
        sk["has_skill"] = bool(sk["bss_fire_only"] >= 0.05)
        result["products"][target] = {"skill": sk, "outlook": outlooks}
        print(target, {k: v for k, v in sk.items() if k not in ("reliability", "by_unit", "coefficients")})

    # Weekly anomaly alerts (latest 8 weeks) and the hindcast archive of alerts per year.
    A = weekly_alerts(years)
    latest = A[A.iso_year == current_year]
    last_week = int(latest.iso_week.max())
    recent = latest[(latest.iso_week > last_week - 8) & latest.alert].sort_values(["iso_week", "harm"],
                                                                                   ascending=[False, False])
    mpath = WEB_DATA / "manifest.json"
    names = json.loads(mpath.read_text(encoding="utf-8"))["districts"] if mpath.exists() else []
    nmap = {d["district_id"]: d for d in names}
    result["alerts"] = {
        "rule": ("District week above the 90th percentile of the same week in the baseline years, "
                 "with at least 5 detections."),
        "latest_week": last_week,
        "items": [{"district_id": r.unit_id, "name_en": nmap.get(r.unit_id, {}).get("name_en", r.unit_id),
                   "name_bn": nmap.get(r.unit_id, {}).get("name_bn", r.unit_id), "iso_year": int(r.iso_year),
                   "iso_week": int(r.iso_week), "count": round(float(r.harm), 1), "normal": round(float(r.med), 1),
                   "q90": round(float(r.q90), 1)} for r in recent.itertuples()],
        "per_year_counts": A[A.alert].groupby("iso_year").size().astype(int).to_dict(),
    }
    (PROCESSED / "forecast.json").write_text(json.dumps(result, indent=1, default=float))
    (WEB_DATA / "forecast.json").write_text(
        json.dumps(result, separators=(",", ":"), default=float, ensure_ascii=False), encoding="utf-8")
    write_feeds(result)
    print(f"alerts in last 8 weeks: {len(result['alerts']['items'])}")


# ------------------------------------------------------------------------- feeds


BN_DIGITS = str.maketrans("0123456789", "০১২৩৪৫৬৭৮৯")
LEVEL_BN = {"elevated": "বাড়তি", "high": "উচ্চ"}


def _bn(x: float | int) -> str:
    return f"{x:,.0f}".translate(BN_DIGITS)


def feed_items(result: dict) -> list[dict]:
    """Bilingual alert items (English and Bangla) shared by the RSS and CAP feeds."""
    names = {"bgd": (COUNTRY["name_en"], COUNTRY["name_bn"])}
    names.update({r["id"]: (r["name_en"], r["name_bn"]) for r in COUNTRY["regions"]})
    items = []
    for a in result["alerts"]["items"][:30]:
        items.append({
            "guid": f"alert-{a['district_id']}-{a['iso_year']}-{a['iso_week']}", "area_en": a["name_en"],
            "area_bn": a["name_bn"], "severity": "Moderate",
            "title_en": f"Unusual fire activity: {a['name_en']}, week {a['iso_week']} of {a['iso_year']}",
            "desc_en": (f"{a['count']:.0f} VIIRS-equivalent fire detections, against a normal of {a['normal']:.0f} "
                        f"for this week (90th percentile {a['q90']:.0f})."),
            "title_bn": f"অস্বাভাবিক আগুন: {a['name_bn']}, {_bn(a['iso_year'])} সালের {_bn(a['iso_week'])} নম্বর সপ্তাহ",
            "desc_bn": (f"VIIRS-সমতুল্য {_bn(a['count'])}টি আগুন শনাক্ত, এই সপ্তাহে স্বাভাবিক {_bn(a['normal'])}টি "
                        f"(৯০ পার্সেন্টাইল {_bn(a['q90'])})।"),
        })
    for uid, o in result["products"]["next2"]["outlook"].items():
        if o.get("active") and o["level"] in ("elevated", "high") and o.get("normal_q75", 0) >= 10:
            en, bn = names.get(uid, (uid, uid))
            items.append({
                "guid": f"outlook-{uid}-{o['issue_year']}-{o['issue_week']}", "area_en": en, "area_bn": bn,
                "severity": "Moderate" if o["level"] == "elevated" else "Severe",
                "title_en": f"Two-week fire outlook {o['level']}: {en}",
                "desc_en": (f"{o['p_above'] * 100:.0f}% chance that the next two weeks are above normal; expected "
                            f"{o['expected']:.0f} detections (80% range {o['lo80']:.0f} to {o['hi80']:.0f})."),
                "title_bn": f"দুই সপ্তাহের আগুনের পূর্বাভাস {LEVEL_BN[o['level']]}: {bn}",
                "desc_bn": (f"আগামী দুই সপ্তাহে স্বাভাবিকের চেয়ে বেশি আগুনের সম্ভাবনা {_bn(o['p_above'] * 100)}%; "
                            f"প্রত্যাশিত {_bn(o['expected'])}টি শনাক্তকরণ (৮০% সীমা {_bn(o['lo80'])} থেকে "
                            f"{_bn(o['hi80'])})।"),
            })
    return items


def write_feeds(result: dict) -> None:
    """RSS 2.0 (English and Bangla) and CAP 1.2 (Common Alerting Protocol, one info block per language)."""
    from xml.sax.saxutils import escape

    now = result["generated_utc"]
    items = feed_items(result)
    for lang, fname, title, desc in (
        ("en", "alerts.rss", "Agun Panjika fire alerts",
         "Unusual fire activity and fire outlooks for Bangladesh, from harmonised NASA MODIS and VIIRS detections. "
         "Describes detected fire, not individual fires."),
        ("bn", "alerts_bn.rss", "আগুন পঞ্জিকা: আগুনের সতর্কতা",
         "নাসার MODIS ও VIIRS-এর সমন্বিত তথ্য থেকে বাংলাদেশে অস্বাভাবিক আগুন ও আগুনের পূর্বাভাস। এটি শনাক্ত আগুনের "
         "বিবরণ, কোনো নির্দিষ্ট আগুনের পূর্বাভাস নয়।"),
    ):
        rss = ['<?xml version="1.0" encoding="UTF-8"?>', '<rss version="2.0"><channel>',
               f"<title>{escape(title)}</title>", f"<description>{escape(desc)}</description>",
               f"<language>{'bn-BD' if lang == 'bn' else 'en'}</language>", f"<lastBuildDate>{now}</lastBuildDate>"]
        for it in items:
            rss.append(f"<item><title>{escape(it['title_' + lang])}</title>"
                       f"<description>{escape(it['desc_' + lang])}</description>"
                       f'<guid isPermaLink="false">{it["guid"]}-{lang}</guid><pubDate>{now}</pubDate></item>')
        rss.append("</channel></rss>")
        (WEB_DATA / fname).write_text("\n".join(rss), encoding="utf-8")

    cap = ['<?xml version="1.0" encoding="UTF-8"?>', '<feed xmlns="http://www.w3.org/2005/Atom">',
           "<title>Agun Panjika CAP alerts</title>", f"<updated>{now}</updated>"]
    for it in items:
        infos = "".join(
            f"<info><language>{code}</language><category>Fire</category>"
            f"<event>{escape(it['title_' + lang])}</event>"
            f"<urgency>Future</urgency><severity>{it['severity']}</severity><certainty>Possible</certainty>"
            f"<senderName>Agun Panjika</senderName><description>{escape(it['desc_' + lang])}</description>"
            f"<area><areaDesc>{escape(it['area_' + lang])}</areaDesc></area></info>"
            for lang, code in (("en", "en"), ("bn", "bn-BD")))
        cap.append(
            f"<entry><id>{it['guid']}</id><title>{escape(it['title_en'])}</title><updated>{now}</updated>"
            '<content type="text/xml"><alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">'
            f"<identifier>{it['guid']}</identifier><sender>agun-panjika</sender><sent>{now}</sent>"
            f"<status>Actual</status><msgType>Alert</msgType><scope>Public</scope>{infos}</alert></content></entry>")
    cap.append("</feed>")
    (WEB_DATA / "alerts_cap.xml").write_text("\n".join(cap), encoding="utf-8")


if __name__ == "__main__":
    main()
