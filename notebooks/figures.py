"""Validation and presentation figures (PNG, 1920x1080-friendly) from the pipeline outputs.

    python notebooks/figures.py      ->  docs/figures/*.png

The same code is laid out cell by cell in notebooks/validation.ipynb.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
P = ROOT / "data" / "processed"
OUT = ROOT / "docs" / "figures"
OUT.mkdir(parents=True, exist_ok=True)

PAPER, INK, MUTED, GRID = "#FAF7F2", "#1F1B16", "#6B6259", "#E6E0D6"
EMBER = ["#FDE6CF", "#F9B47A", "#EE7A35", "#C84B1A", "#7F2A0C"]
plt.rcParams.update({"figure.facecolor": PAPER, "axes.facecolor": PAPER, "axes.edgecolor": GRID,
                     "axes.labelcolor": INK, "xtick.color": MUTED, "ytick.color": MUTED, "text.color": INK,
                     "font.size": 13, "axes.spines.top": False, "axes.spines.right": False,
                     "axes.grid": True, "grid.color": GRID, "grid.linewidth": 0.8})


def save(fig, name):
    fig.savefig(OUT / name, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print("wrote", OUT / name)


def annual_national() -> pd.DataFrame:
    h = pd.read_parquet(P / "harmonised.parquet")
    n = h[h.unit_type == "national"]
    a = n.groupby("iso_year").agg(modis=("M", "sum"), viirs=("V", "sum"), harm=("harm", "sum"), naive=("naive", "sum"),
                                  weeks=("iso_week", "count"))
    return a[a.weeks >= 52]


def fig_stitched_jump():
    """The problem in one picture: join raw records where VIIRS begins and fire 'quadruples'."""
    a = annual_national()
    fig, ax = plt.subplots(figsize=(12.8, 6.4))
    stitched = np.where(a.index < 2012, a.modis, a.viirs)
    ax.plot(a.index, stitched, color=INK, lw=3, marker="o", label="Raw record, stitched (MODIS to 2011, VIIRS after)")
    ax.axvline(2011.5, color=MUTED, ls=":", lw=2)
    ax.annotate("VIIRS arrives:\nfire seems to quadruple overnight", xy=(2012, stitched[list(a.index).index(2012)]),
                xytext=(2004, max(stitched) * 0.85), arrowprops=dict(arrowstyle="->", color=INK), fontsize=14)
    ax.set_ylabel("Fire detections per year, Bangladesh")
    ax.legend(frameon=False, loc="lower right")
    ax.set_title("The broken record", loc="left", fontsize=20, fontweight="bold")
    save(fig, "01_stitched_jump.png")


def fig_harmonised():
    """The fix: one record on the VIIRS scale, estimates with an 80% band."""
    a = annual_national()
    est = json.loads((ROOT / "web/public/data/national.json").read_text(encoding="utf-8"))["annual"]
    e = pd.DataFrame(est).set_index("y").loc[a.index]
    fig, ax = plt.subplots(figsize=(12.8, 6.4))
    raw = np.where(a.index < 2012, a.modis, a.viirs)
    ax.plot(a.index, raw, color=MUTED, lw=2, ls="--", label="Raw stitched record")
    ax.fill_between(e.index, e.lo, e.hi, color=EMBER[2], alpha=0.25, lw=0, label="80% band (estimated years)")
    ax.plot(e.index, e.harm, color=EMBER[3], lw=3.5, marker="o", label="Agun Panjika harmonised record")
    ax.axvline(2011.5, color=MUTED, ls=":", lw=2)
    ax.set_ylabel("VIIRS-equivalent detections per year")
    ax.legend(frameon=False, loc="upper right")
    ax.set_title("One record, 2003 to today", loc="left", fontsize=20, fontweight="bold")
    save(fig, "02_harmonised.png")


def fig_monthly_ratio():
    h = pd.read_parquet(P / "harmonised.parquet")
    n = h[(h.unit_type == "national") & h.iso_year.between(2012, 2024)]
    g = n.groupby("month")[["V", "M"]].sum()
    r = g.V / g.M.clip(lower=1)
    fig, ax = plt.subplots(figsize=(12.8, 5.6))
    ax.bar(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], r,
           color=[EMBER[3] if v > 6 else EMBER[1] for v in r])
    for i, v in enumerate(r):
        ax.text(i, v + 0.15, f"{v:.1f}x", ha="center", fontsize=12)
    ax.set_ylabel("VIIRS detections per MODIS detection")
    ax.set_title("VIIRS sees more, and how much more depends on the month", loc="left", fontsize=18,
                 fontweight="bold")
    save(fig, "03_monthly_ratio.png")


def fig_validation():
    v = json.loads((P / "validation.json").read_text())
    s = pd.DataFrame(v["summary"]).set_index("model")
    order = [m for m in ["prd_4.4x", "naive", "monthly", "negbin", "gbm", "ensemble"] if m in s.index]
    labels = {"prd_4.4x": "Single 4.4x", "naive": "Single factor\n(refit)", "monthly": "12 monthly\nfactors",
              "negbin": "Neg. binomial", "gbm": "Boosted trees", "ensemble": "Agun Panjika\nensemble"}
    fig, ax = plt.subplots(figsize=(12.8, 6))
    vals = s.loc[order, "mae_week"]
    ax.bar([labels[m] for m in order], vals, color=[EMBER[3] if m == "ensemble" else "#B5ACA2" for m in order])
    for i, x in enumerate(vals):
        ax.text(i, x + 0.6, f"{x:.1f}", ha="center", fontsize=13)
    ax.set_ylabel("Weekly error, held-out years (detections)")
    ax.set_title("Tested on years the model never saw (2012 to 2024)", loc="left", fontsize=18, fontweight="bold")
    save(fig, "04_validation.png")


def fig_partner():
    p = json.loads((P / "partner.json").read_text())
    a = pd.DataFrame(p["annual"]).set_index("y")
    norm = a / a[a.index >= 2012].mean()
    fig, ax = plt.subplots(figsize=(12.8, 6))
    ax.plot(norm.index, norm.ba_km2, color="#3F7F9F", lw=3, label="ESA Sentinel-3 / Fire_cci burned area")
    ax.plot(norm.index, norm.harm, color=EMBER[3], lw=3, label="Agun Panjika harmonised record")
    ax.plot(norm.index, norm.stitched, color=MUTED, lw=2, ls="--", label="Raw stitched record")
    ax.axvline(2011.5, color=MUTED, ls=":", lw=2)
    ax.set_ylabel("Relative to 2012-2024 mean")
    ax.legend(frameon=False, loc="upper right")
    ax.set_title(f"An independent witness agrees: no jump in 2012 (x{p['jump_2012']['harmonised']} vs "
                 f"x{p['jump_2012']['stitched']})", loc="left", fontsize=17, fontweight="bold")
    save(fig, "05_esa_crosscheck.png")


def fig_calendar():
    h = pd.read_parquet(P / "harmonised.parquet")
    n = h[h.unit_type == "national"].pivot_table(index="iso_year", columns="iso_week", values="harm")
    n = n.reindex(columns=range(1, 54))
    from matplotlib.colors import BoundaryNorm, ListedColormap

    vals = n.values[~np.isnan(n.values)]
    bounds = [0, 0.5, *np.quantile(vals[vals >= 0.5], [0.35, 0.6, 0.8, 0.93]), vals.max() + 1]
    cmap = ListedColormap(["#F1ECE4", *EMBER])
    fig, ax = plt.subplots(figsize=(14, 7))
    ax.imshow(n.values, aspect="auto", cmap=cmap, norm=BoundaryNorm(bounds, cmap.N), interpolation="nearest")
    ax.set_yticks(range(len(n.index)), [("~" if y < 2012 else "") + str(y) for y in n.index], fontsize=10)
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    ax.set_xticks([0, 4, 8, 13, 17, 22, 26, 30, 35, 39, 43, 48], months)
    ax.grid(False)
    ax.set_title("The fire calendar: every week of every year, one scale", loc="left", fontsize=18,
                 fontweight="bold")
    save(fig, "06_calendar.png")


def fig_outlook_skill():
    f = json.loads((P / "forecast.json").read_text())
    s = f["products"]["next2"]["skill"]
    rel = pd.DataFrame(s["reliability"])
    fig, ax = plt.subplots(figsize=(6.4, 6.4))
    ax.plot([0, 1], [0, 1], color=MUTED, ls="--")
    ax.scatter(rel.p, rel.obs, s=np.clip(rel.n / 8, 30, 600), color=EMBER[3])
    ax.set_xlabel("Predicted chance of above-normal fire")
    ax.set_ylabel("How often it happened")
    ax.set_title(f"Two-week outlook: AUC {s['auc_full']:.2f}", loc="left", fontweight="bold")
    save(fig, "07_outlook_reliability.png")


def fig_pixels(day: str = "2019-04-06", region: str = "bandarban"):
    """Same afternoon, two sensors: MODIS 1 km+ footprints vs VIIRS 375 m footprints."""
    from matplotlib.patches import Rectangle

    d = pd.read_parquet(P / "detections.parquet")
    x = d[(d.region_id == region) & d.keep & (d.daynight == "D") & (d.acq_datetime_utc.dt.date.astype(str) == day)]
    fig, axes = plt.subplots(1, 2, figsize=(14, 7.6), sharex=True, sharey=True)
    for ax, (sat, label, color) in zip(axes, (("Aqua", "MODIS (Aqua)", EMBER[2]), ("N", "VIIRS (Suomi NPP)", EMBER[4])),
                                        strict=True):
        s = x[x.satellite == sat]
        t = s.acq_datetime_utc.dt.strftime("%H:%M").mode()
        for r in s.itertuples():
            side_km = float(np.sqrt(r.pix_km2)) if pd.notna(r.pix_km2) else (1.0 if sat == "Aqua" else 0.375)
            dlat = side_km / 111.0
            dlon = side_km / (111.0 * np.cos(np.radians(r.lat)))
            ax.add_patch(Rectangle((r.lon - dlon / 2, r.lat - dlat / 2), dlon, dlat, facecolor=color, alpha=0.55,
                                   edgecolor=INK, lw=0.3))
        ax.set_title(f"{label}: {len(s)} fires" + (f"  (overpass {t.iloc[0]} UTC)" if len(t) else ""), loc="left",
                     fontsize=15, fontweight="bold")
        ax.set_aspect(1 / np.cos(np.radians(21.9)))
        ax.grid(False)
    lo = x.lon.quantile([0.01, 0.99]).to_numpy()
    la = x.lat.quantile([0.01, 0.99]).to_numpy()
    axes[0].set_xlim(lo[0] - 0.05, lo[1] + 0.05)
    axes[0].set_ylim(la[0] - 0.05, la[1] + 0.05)
    ratio = len(x[x.satellite == "N"]) / max(len(x[x.satellite == "Aqua"]), 1)
    fig.suptitle(f"Same fires, same afternoon ({day}, Bandarban): VIIRS counts {ratio:.1f}x more",
                 x=0.01, ha="left", fontsize=18, fontweight="bold")
    save(fig, "08_two_satellites_one_afternoon.png")


def fig_fire_weather():
    """Fire in each fifth of fire-weather anomaly (Jan-May weeks, regions), relative to normal for the week."""
    h = pd.read_parquet(P / "harmonised.parquet")
    fw = pd.read_parquet(P / "fwi_week.parquet")
    r = h[h.unit_type == "region"].merge(fw, left_on=["unit_id", "iso_year", "iso_week"],
                                         right_on=["region_id", "iso_year", "iso_week"])
    r = r[r.iso_week.between(6, 18) & r.iso_year.between(2003, 2025)].copy()
    r["fwi_anom"] = r.fwi - r.groupby(["unit_id", "iso_week"]).fwi.transform("mean")
    r["fire_anom"] = np.log1p(r.harm) - np.log1p(r.groupby(["unit_id", "iso_week"]).harm.transform("median"))
    r["q"] = pd.qcut(r.fwi_anom, 5, labels=["Wettest\nfifth", "2nd", "3rd", "4th", "Driest\nfifth"])
    g = r.groupby("q", observed=True).fire_anom.mean().apply(np.exp)
    fig, ax = plt.subplots(figsize=(10, 5.6))
    ax.bar(g.index.astype(str), g.values, color=[EMBER[0], EMBER[1], EMBER[2], EMBER[3], EMBER[4]])
    ax.axhline(1, color=INK, lw=1.5, ls="--")
    for i, v in enumerate(g.values):
        ax.text(i, v + 0.04, f"{v:.2f}x", ha="center", fontsize=14, fontweight="bold")
    ax.set_ylabel("Fire detected, relative to normal for the week")
    ax.set_xlabel("Fire Weather Index anomaly (NASA POWER), Jan-May weeks")
    ax.set_title("Fire weather foretells fire", loc="left", fontsize=18, fontweight="bold")
    save(fig, "09_fire_weather.png")


def fig_feature_importance():
    v = json.loads((P / "validation.json").read_text())
    imp = pd.Series(v["final_fit"]["gbm_feature_importance"]).sort_values()
    nice = {"M": "MODIS count", "F": "MODIS FRP", "A": "Aqua count", "T": "Terra count", "N": "Night count",
            "L": "Small-fire count", "H": "High-confidence count", "P": "Districts burning",
            "lM_prev": "MODIS last week", "lM_next": "MODIS next week", "lM_4": "MODIS 4-week mean",
            "month": "Month", "iso_week": "Week", "mean_frp": "Mean fire power", "cloud": "Cloud (POWER)",
            "precip": "Rain (POWER)", "rh": "Humidity (POWER)", "fwi": "Fire Weather Index", "dc": "Drought Code",
            "night_share": "Night share", "low_share": "Small-fire share", "aqua_share": "Aqua share",
            "pix_mean": "MODIS pixel size", "nadir_share": "Near-nadir share", "pix_nat": "View geometry (national)"}
    groups = {"MODIS fires": ["M", "F", "A", "T", "N", "L", "H", "P", "lM_prev", "lM_next", "lM_4", "mean_frp",
                              "night_share", "low_share", "aqua_share"],
              "View geometry": ["pix_mean", "nadir_share", "pix_nat"],
              "Weather": ["cloud", "precip", "rh", "fwi", "dc"], "Season": ["month", "iso_week"]}
    colors = {"MODIS fires": EMBER[3], "View geometry": "#3F7F9F", "Weather": "#6A9F6A", "Season": "#B5ACA2"}
    col = {k: c for g, ks in groups.items() for k in ks for c in [colors[g]]}
    fig, ax = plt.subplots(figsize=(10, 8))
    ax.barh([nice.get(k, k) for k in imp.index], imp.values, color=[col.get(k, MUTED) for k in imp.index])
    from matplotlib.patches import Patch
    ax.legend(handles=[Patch(color=c, label=g) for g, c in colors.items()], frameon=False, loc="lower right")
    ax.set_xlabel("LightGBM split count")
    ax.grid(axis="y", visible=False)
    ax.set_title("What the harmonisation model looks at", loc="left", fontsize=18, fontweight="bold")
    save(fig, "10_feature_importance.png")


def fig_hills():
    n = json.loads((ROOT / "web/public/data/neighbours.json").read_text(encoding="utf-8"))
    fig, ax = plt.subplots(figsize=(12.8, 6))
    cols = {"cht": EMBER[3], "mizoram": "#3F7F9F", "tripura": "#6A9F6A", "chin": "#8A5AA8"}
    for u, c in cols.items():
        w = pd.DataFrame(n["units"][u]["weeks"], columns=["y", "w", "v", "s"])
        a = w.groupby("y").agg(v=("v", "sum"), k=("w", "count"))
        a = a[(a.k >= 52) & (a.index >= 2003)]
        ax.plot(a.index, a.v, color=c, lw=3 if u == "cht" else 2, marker="o", ms=4, label=n["units"][u]["name_en"])
    ax.axvline(2011.5, color=MUTED, ls=":", lw=2)
    ax.legend(frameon=False)
    ax.set_ylabel("VIIRS-equivalent detections per year")
    ax.set_title("One hill fire season across three countries", loc="left", fontsize=18, fontweight="bold")
    save(fig, "11_borderless_hills.png")


def fig_satellite_timeline():
    from matplotlib.patches import FancyBboxPatch
    rows = [("MODIS Terra", 2000.83, 2027.0, "#B5ACA2", "AM, 1 km"),
            ("MODIS Aqua", 2002.5, 2027.0, "#8A8178", "PM, 1 km"),
            ("VIIRS Suomi NPP", 2012.05, 2026.84, EMBER[3], "375 m, ends 2 Nov 2026"),
            ("VIIRS NOAA-20", 2018.25, 2030, EMBER[2], "375 m"), ("VIIRS NOAA-21", 2024.05, 2030, EMBER[1], "375 m")]
    fig, ax = plt.subplots(figsize=(12.8, 4.2))
    for i, (name, a, b, c, note) in enumerate(rows):
        y = len(rows) - i
        ax.add_patch(FancyBboxPatch((a, y - 0.32), b - a, 0.64, boxstyle="round,pad=0,rounding_size=0.25", color=c))
        ax.text(a + 0.2, y, f"{name}  ·  {note}", va="center", fontsize=11, color=INK, fontweight="bold")
    ax.axvline(2026.84, color=INK, lw=2)
    ax.text(2027.35, 3, "S-NPP data end\n2 Nov 2026", fontsize=10, va="center", fontweight="bold")
    ax.axvspan(2026.75, 2027.2, color=EMBER[0], alpha=0.6)
    ax.text(2027.25, 5.35, "MODIS shutdown begins\nlate 2026 / early 2027", fontsize=9, color=MUTED)
    ax.set_xlim(2000, 2031.5)
    ax.set_ylim(0, len(rows) + 0.8)
    ax.set_yticks([])
    ax.grid(axis="y", visible=False)
    ax.set_title("The watchers: why the record breaks, and what carries it on", loc="left", fontsize=17,
                 fontweight="bold")
    save(fig, "00_satellite_timeline.png")


if __name__ == "__main__":
    for fn in (fig_pixels, fig_stitched_jump, fig_harmonised, fig_monthly_ratio, fig_validation, fig_partner,
               fig_calendar, fig_outlook_skill, fig_fire_weather, fig_feature_importance, fig_hills,
               fig_satellite_timeline):
        fn()
