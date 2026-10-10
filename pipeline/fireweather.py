"""Fire Weather Index (Canadian FWI System, Van Wagner 1987) for the analysis regions.

History: NASA POWER daily weather (2001 to a few days ago).
Forecast: the next 16 days from the Open-Meteo forecast API (no key), so the danger
rating can look ahead. POWER and the forecast are joined at the last POWER day, and the
fuel-moisture codes carry over from history into the forecast.

Inputs and approximations (documented on the method page):
  temperature  daily maximum 2 m temperature (stands in for noon temperature)
  humidity     daily mean 2 m relative humidity (noon humidity is usually lower)
  wind         POWER 2 m wind x 1.33 (log-profile to 10 m), in km/h; forecast 10 m wind
  rain         24 h precipitation
Day-length factors use the 10-30 N tables.

Output: data/processed/fwi_daily.parquet, fwi_week.parquet; web/public/data/fireweather.json
"""

from __future__ import annotations

import json
import math
from datetime import UTC, datetime

import numpy as np
import pandas as pd
import requests

from pipeline.config import PROCESSED, WEB_DATA
from pipeline.weather import region_points

DMC_EL = [7.9, 8.4, 8.9, 9.5, 9.9, 10.2, 10.1, 9.7, 9.1, 8.6, 8.1, 7.8]  # 10-30 N
DC_FL = [-1.6, -1.6, -1.6, 0.9, 3.8, 5.8, 6.4, 5.0, 2.4, 0.4, -1.6, -1.6]
OPEN_METEO = "https://api.open-meteo.com/v1/forecast"
# GWIS / EFFIS-style danger classes on FWI.
CLASSES = [(5.2, "low"), (11.2, "moderate"), (21.3, "high"), (38.0, "very_high"), (50.0, "extreme"), (1e9, "extreme")]


def ffmc_step(ffmc: float, t: float, h: float, w: float, r: float) -> float:
    mo = 147.2 * (101 - ffmc) / (59.5 + ffmc)
    if r > 0.5:
        rf = r - 0.5
        inc = 42.5 * rf * math.exp(-100 / (251 - mo)) * (1 - math.exp(-6.93 / rf))
        if mo > 150:
            inc += 0.0015 * (mo - 150) ** 2 * math.sqrt(rf)
        mo = min(mo + inc, 250)
    ed = 0.942 * h ** 0.679 + 11 * math.exp((h - 100) / 10) + 0.18 * (21.1 - t) * (1 - math.exp(-0.115 * h))
    if mo > ed:
        ko = 0.424 * (1 - (h / 100) ** 1.7) + 0.0694 * math.sqrt(w) * (1 - (h / 100) ** 8)
        kd = ko * 0.581 * math.exp(0.0365 * t)
        m = ed + (mo - ed) * 10 ** (-kd)
    else:
        ew = 0.618 * h ** 0.753 + 10 * math.exp((h - 100) / 10) + 0.18 * (21.1 - t) * (1 - math.exp(-0.115 * h))
        if mo < ew:
            kl = 0.424 * (1 - ((100 - h) / 100) ** 1.7) + 0.0694 * math.sqrt(w) * (1 - ((100 - h) / 100) ** 8)
            kw = kl * 0.581 * math.exp(0.0365 * t)
            m = ew - (ew - mo) * 10 ** (-kw)
        else:
            m = mo
    return min(max(59.5 * (250 - m) / (147.2 + m), 0.0), 101.0)


def dmc_step(dmc: float, t: float, h: float, r: float, month: int) -> float:
    t = max(t, -1.1)
    rk = 1.894 * (t + 1.1) * (100 - h) * DMC_EL[month - 1] * 1e-4
    if r > 1.5:
        re = 0.92 * r - 1.27
        mo = 20 + math.exp(5.6348 - dmc / 43.43)
        if dmc <= 33:
            b = 100 / (0.5 + 0.3 * dmc)
        elif dmc <= 65:
            b = 14 - 1.3 * math.log(dmc)
        else:
            b = 6.2 * math.log(dmc) - 17.2
        mr = mo + 1000 * re / (48.77 + b * re)
        pr = max(244.72 - 43.43 * math.log(mr - 20), 0.0)
    else:
        pr = dmc
    return max(pr + rk, 0.0)


def dc_step(dc: float, t: float, r: float, month: int) -> float:
    if r > 2.8:
        rd = 0.83 * r - 1.27
        qo = 800 * math.exp(-dc / 400)
        qr = qo + 3.937 * rd
        dc = max(400 * math.log(800 / qr), 0.0)
    v = max(0.36 * (max(t, -2.8) + 2.8) + DC_FL[month - 1], 0.0)
    return dc + 0.5 * v


def isi_of(ffmc: float, w: float) -> float:
    m = 147.2 * (101 - ffmc) / (59.5 + ffmc)
    ff = 91.9 * math.exp(-0.1386 * m) * (1 + m ** 5.31 / 4.93e7)
    return 0.208 * math.exp(0.05039 * w) * ff


def bui_of(dmc: float, dc: float) -> float:
    if dmc == 0 and dc == 0:
        return 0.0
    if dmc <= 0.4 * dc:
        b = 0.8 * dmc * dc / (dmc + 0.4 * dc)
    else:
        b = dmc - (1 - 0.8 * dc / (dmc + 0.4 * dc)) * (0.92 + (0.0114 * dmc) ** 1.7)
    return max(b, 0.0)


def fwi_of(isi: float, bui: float) -> float:
    fd = 0.626 * bui ** 0.809 + 2 if bui <= 80 else 1000 / (25 + 108.64 * math.exp(-0.023 * bui))
    b = 0.1 * isi * fd
    return math.exp(2.72 * (0.434 * math.log(b)) ** 0.647) if b > 1 else b


def run_fwi(df: pd.DataFrame, state: tuple[float, float, float] = (85.0, 6.0, 15.0)) -> pd.DataFrame:
    """df: date, t, h, w (km/h), r, sorted by date. Returns FFMC, DMC, DC, ISI, BUI, FWI per day."""
    ffmc, dmc, dc = state
    rows = []
    for x in df.itertuples():
        t, h, w, r = x.t, min(max(x.h, 0.0), 100.0), max(x.w, 0.0), max(x.r, 0.0)
        if any(np.isnan(v) for v in (t, h, w, r)):
            rows.append((ffmc, dmc, dc, np.nan, np.nan, np.nan))
            continue
        m = x.date.month
        ffmc = ffmc_step(ffmc, t, h, w, r)
        dmc = dmc_step(dmc, t, h, r, m)
        dc = dc_step(dc, t, r, m)
        isi = isi_of(ffmc, w)
        bui = bui_of(dmc, dc)
        rows.append((ffmc, dmc, dc, isi, bui, fwi_of(isi, bui)))
    out = df[["date"]].copy()
    out[["ffmc", "dmc", "dc", "isi", "bui", "fwi"]] = np.array(rows)
    return out


def danger_class(fwi: float) -> str:
    for cut, name in CLASSES:
        if fwi < cut:
            return name
    return "extreme"


def forecast_inputs() -> pd.DataFrame:
    """16-day forecast averaged over each region's points."""
    pts = region_points()
    frames = []
    for r in pts.itertuples():
        url = (f"{OPEN_METEO}?latitude={r.lat}&longitude={r.lon}&daily=temperature_2m_max,relative_humidity_2m_mean,"
               "wind_speed_10m_mean,precipitation_sum&forecast_days=16&timezone=Asia%2FDhaka")
        try:
            d = requests.get(url, timeout=60).json()["daily"]
        except (requests.RequestException, KeyError, ValueError):
            continue
        frames.append(pd.DataFrame({"date": pd.to_datetime(d["time"]), "t": d["temperature_2m_max"],
                                    "h": d["relative_humidity_2m_mean"], "w": d["wind_speed_10m_mean"],
                                    "r": d["precipitation_sum"], "region_id": r.region_id}))
    if not frames:
        return pd.DataFrame(columns=["region_id", "date", "t", "h", "w", "r"])
    f = pd.concat(frames).astype({"t": float, "h": float, "w": float, "r": float})
    return f.groupby(["region_id", "date"], as_index=False)[["t", "h", "w", "r"]].mean().dropna()


def main() -> None:
    wx = pd.read_parquet(PROCESSED / "weather_daily.parquet")
    hist = wx.rename(columns={"T2M_MAX": "t", "RH2M": "h", "PRECTOTCORR": "r"})
    hist["w"] = wx["WS2M"] * 1.33 * 3.6
    fc = forecast_inputs()
    frames = []
    for rid, g in hist.groupby("region_id"):
        g = g.sort_values("date").dropna(subset=["t", "h", "w", "r"])
        last = g["date"].max()
        f = fc[(fc.region_id == rid) & (fc.date > last)]
        both = pd.concat([g[["date", "t", "h", "w", "r"]].assign(kind="observed"),
                          f[["date", "t", "h", "w", "r"]].assign(kind="forecast")], ignore_index=True)
        out = run_fwi(both)
        out["kind"] = both["kind"].values
        out["region_id"] = rid
        frames.append(out)
    daily = pd.concat(frames, ignore_index=True)
    daily.to_parquet(PROCESSED / "fwi_daily.parquet", index=False)
    iso = daily["date"].dt.isocalendar()
    week = daily.assign(iso_year=iso.year.astype(int), iso_week=iso.week.astype(int)) \
        .groupby(["region_id", "iso_year", "iso_week"], as_index=False).agg(
            fwi=("fwi", "mean"), fwi_max=("fwi", "max"), dc=("dc", "mean"), ffmc=("ffmc", "mean"),
            forecast_days=("kind", lambda s: int((s == "forecast").sum())))
    week.to_parquet(PROCESSED / "fwi_week.parquet", index=False)

    # Climatology of daily FWI by day of year (2003-2025) to express the forecast as an anomaly.
    daily["doy"] = daily["date"].dt.dayofyear
    clim = daily[(daily.kind == "observed") & daily.date.dt.year.between(2003, 2025)] \
        .groupby(["region_id", "doy"])["fwi"].quantile([0.5, 0.9]).unstack()
    clim.columns = ["p50", "p90"]
    clim = clim.reset_index()
    recent = daily[daily.date >= daily.date.max() - pd.Timedelta(days=45)].merge(clim, on=["region_id", "doy"],
                                                                                   how="left")
    # National view: mean over regions (FWI is an index, so a mean, not a sum).
    nat = recent.groupby("date", as_index=False).agg(fwi=("fwi", "mean"), p50=("p50", "mean"), p90=("p90", "mean"),
                                                     kind=("kind", "first"))
    recent = pd.concat([recent, nat.assign(region_id="bgd")], ignore_index=True)
    out = {"generated_utc": datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
           "classes": [{"max": c, "name": n} for c, n in CLASSES[:-1]], "regions": {}}
    for rid, g in recent.groupby("region_id"):
        out["regions"][rid] = [{"d": r.date.strftime("%Y-%m-%d"), "fwi": round(float(r.fwi), 1),
                                "p50": round(float(r.p50), 1), "p90": round(float(r.p90), 1),
                                "cls": danger_class(float(r.fwi)), "fc": r.kind == "forecast"}
                               for r in g.itertuples() if pd.notna(r.fwi)]
    (WEB_DATA / "fireweather.json").write_text(json.dumps(out, separators=(",", ":")))
    obs = daily[daily.kind == "observed"]
    print(f"FWI {obs.date.min():%Y-%m-%d}..{daily.date.max():%Y-%m-%d} ({(daily.kind == 'forecast').sum()} forecast "
          f"region-days)")
    print(obs.assign(m=obs.date.dt.month).groupby("m")["fwi"].mean().round(1).to_string())


if __name__ == "__main__":
    main()
