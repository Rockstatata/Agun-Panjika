"""Write the static JSON (and CSV) the web app reads.

/data/manifest.json             regions, districts, data date, model version, handover date
/data/national.json             unit JSON for the whole country
/data/region/{id}.json          unit JSON per analysis region
/data/districts.json            compact harmonised weekly series + season for all districts (map)
/data/districts.geojson         simplified district boundaries
/data/points/{year}.json        detections for the map (kept + static), per year
/data/static_cells.json         flagged kiln / industry cells
/data/validation.json, bridge.json   written by harmonise.py and bridge.py
/data/download/harmonised.csv   full series with intervals
"""

from __future__ import annotations

import json
import math
from datetime import UTC, datetime

import numpy as np
import pandas as pd

from pipeline.config import COUNTRY, PROCESSED, UTM_EPSG, WEB_DATA
from pipeline.regions import district_table, district_to_region, load_districts

MODEL_VERSION = "ensemble-nb-gbm-conformal-v2"
LEVEL_CODE = {"below": "b", "normal": "n", "above": "a", "extreme": "e", "quiet": "q"}


def _num(x, nd: int = 1):
    if x is None or (isinstance(x, float) and math.isnan(x)) or pd.isna(x):
        return None
    v = round(float(x), nd)
    return int(v) if v == int(v) else v


def _dump(path, obj) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    s = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    path.write_text(s, encoding="utf-8")
    return len(s.encode("utf-8"))


def annual_block(h: pd.DataFrame, ann: pd.DataFrame) -> list[dict]:
    """Annual totals with an 80% interval: observed weeks are exact, estimated weeks use summed draws
    (or summed weekly bounds where no annual interval was computed, e.g. districts).

    ``all`` is the same total without the kiln / static-source filter: observed weeks use the unfiltered
    S-NPP count, estimated weeks are scaled by that year's unfiltered / filtered MODIS ratio.
    """
    out = []
    for y, g in h.groupby("iso_year"):
        est_w = g.src == "estimated"
        obs = float(g.loc[~est_w, "harm"].sum())
        row = ann[ann.iso_year == y] if "est" in ann else ann.iloc[:0]
        if len(row) and est_w.any():
            r = row.iloc[0]
            harm, lo, hi = obs + r.est, obs + r.lo80, obs + r.hi80
        else:
            harm = float(g["harm"].sum())
            lo, hi = float(g["lo"].sum()), float(g["hi"].sum())
        m, m_all = float(g.loc[est_w, "M"].sum()), float(g.loc[est_w, "M_all"].sum())
        ratio = m_all / m if m > 0 else 1.0
        obs_all = float(g.loc[g.src == "observed", "V_all"].fillna(0).sum())
        obs_all += float(g.loc[g.src == "bridged", "harm"].sum())
        all_ = obs_all + (harm - obs) * ratio
        out.append({"y": int(y), "harm": _num(harm), "lo": _num(lo), "hi": _num(hi), "all": _num(all_)})
    return out


def rain_block(unit_type: str, unit_id: str, region_id: str | None = None) -> dict:
    """Weekly rainfall (mm, NASA POWER) by year for the season chart's dry-spell overlay."""
    path = PROCESSED / "weather_week.parquet"
    if not path.exists():
        return {}
    w = pd.read_parquet(path)
    if unit_type == "national":
        w = w.groupby(["iso_year", "iso_week"], as_index=False)["precip"].mean()
    else:
        w = w[w.region_id == (region_id or unit_id)]
    out = {}
    for y, g in w[w.iso_year >= 2001].groupby("iso_year"):
        arr = [None] * 53
        for wk, v in zip(g.iso_week, g.precip, strict=True):
            arr[int(wk) - 1] = _num(v, 0)
        out[int(y)] = arr
    return out


def unit_json(h: pd.DataFrame, season: pd.DataFrame, normals: pd.DataFrame, unit: dict,
              updated: str, handover: str, static_removed: int, ann: pd.DataFrame | None = None,
              rain: dict | None = None) -> dict:
    """One region (or national) document, following the PRD JSON contract plus normals."""
    weeks = []
    for r in h.itertuples(index=False):
        row = {"y": int(r.iso_year), "w": int(r.iso_week), "modis": _num(r.M, 0), "viirs": _num(r.V, 0),
               "n20": _num(r.J, 0), "naive": _num(r.naive), "harm": _num(r.harm), "src": r.src}
        if r.src == "estimated":  # observed and bridged weeks have lo = hi = harm
            row["lo"], row["hi"] = _num(r.lo), _num(r.hi)
        # Missing sensors (not yet flying) are omitted rather than written as null.
        weeks.append({k: v for k, v in row.items() if v is not None})
    s = season.sort_values(["iso_year", "iso_week"])
    cur = s.iloc[-1]
    # Per year, per ISO week: percentile, level code string and "beat X of last 10 years".
    seasons = {}
    for y, g in s.groupby("iso_year"):
        seasons[int(y)] = {"pct": [_num(v, 0) for v in g["pct"]], "lv": "".join(LEVEL_CODE[v] for v in g["level"]),
                           "b10": g["beat_last10"].tolist(), "n10": int(g["n_last10"].iloc[-1])}
    nm = normals.sort_values("iso_week")
    return {
        "region": unit,
        "updated_utc": updated,
        "weeks": weeks,
        "annual": annual_block(h, ann if ann is not None else pd.DataFrame(columns=["iso_year"])),
        "season": {"year": int(cur.iso_year), "to_week": int(cur.iso_week), "cum": _num(cur.cum, 0),
                   "pct": _num(cur.pct, 0), "level": cur.level, "beat_last10": int(cur.beat_last10),
                   "n_last10": int(cur.n_last10)},
        "seasons": seasons,
        "normals": {c: [_num(v, 0) for v in nm[c]] for c in ("p10", "p25", "p50", "p75", "p90")},
        "handover": {"snpp_end_utc": handover},
        "static_removed": int(static_removed),
        "rain": rain or {},
    }


def write_region_json(h, season, normals, units, updated, handover, removed) -> None:
    """Unit documents: national, regions, and every district (``region/d_<district>.json``)."""
    ann_all = pd.read_parquet(PROCESSED / "estimates_annual.parquet")
    d2r = district_to_region()
    sizes = []
    for ut, uid, meta in units:
        sel = (h.unit_type == ut) & (h.unit_id == uid)
        if not sel.any() or season[(season.unit_type == ut) & (season.unit_id == uid)].empty:
            print(f"  warning: no data for {ut} {uid} (check the district names in the country config)")
            continue
        region_for_rain = d2r.get(uid, "rest") if ut == "district" else uid
        doc = unit_json(h[sel].sort_values(["iso_year", "iso_week"]),
                        season[(season.unit_type == ut) & (season.unit_id == uid)],
                        normals[(normals.unit_type == ut) & (normals.unit_id == uid)],
                        meta, updated, handover, removed.get(uid, 0), ann_all[ann_all.unit_id == uid],
                        rain_block(ut, uid, region_for_rain))
        name = {"national": "national.json", "district": f"region/d_{uid}.json"}.get(ut, f"region/{uid}.json")
        size = _dump(WEB_DATA / name, doc)
        if ut == "district":
            sizes.append(size)
        else:
            print(f"  {name}: {size / 1024:.0f} KB")
    if sizes:
        print(f"  region/d_*.json: {len(sizes)} districts, mean {np.mean(sizes) / 1024:.0f} KB")


def write_districts(h, season, dtab) -> None:
    """Per-year district files for the map: weekly harmonised value, season percentile and level code."""
    d = h[h.unit_type == "district"]
    s = season[season.unit_type == "district"]
    for y, gy in d.groupby("iso_year"):
        sy = s[s.iso_year == y]
        out = {}
        for did, g in gy.groupby("unit_id"):
            arr = [None] * 53
            for w, v in zip(g.iso_week, g.harm, strict=False):
                arr[int(w) - 1] = _num(v, 0)
            ss = sy[sy.unit_id == did].sort_values("iso_week")
            out[did] = {"harm": arr, "pct": [_num(v, 0) for v in ss.pct],
                        "lv": "".join(LEVEL_CODE[v] for v in ss.level)}
        _dump(WEB_DATA / f"districts/{int(y)}.json", {"year": int(y), "districts": out})
    print(f"  districts/*.json: {d.iso_year.nunique()} years")


def write_geojson() -> None:
    g = load_districts()
    g = g.to_crs(UTM_EPSG)
    g["geometry"] = g.geometry.simplify(400, preserve_topology=True)
    g = g.to_crs(4326)
    g = g[["district_id", "district", "geometry"]]
    path = WEB_DATA / "districts.geojson"
    gj = json.loads(g.to_json(drop_id=True))

    def rnd(c):
        return [rnd(x) for x in c] if isinstance(c[0], list) else [round(c[0], 4), round(c[1], 4)]
    for f in gj["features"]:
        f["geometry"]["coordinates"] = rnd(f["geometry"]["coordinates"])
    size = _dump(path, gj)
    print(f"  districts.geojson: {size / 1024:.0f} KB")


def write_points(det: pd.DataFrame) -> None:
    """Per-year map points from the year's primary sensor (MODIS before 2012, S-NPP after, NOAA-20 after
    the handover), as a flat array [lon, lat, iso_week, status, ...]; status 1 = kept fire,
    2 = static source (kiln / industry), 0 = low confidence."""
    det = det[det.district_id != "outside"].copy()
    iso = det["acq_datetime_utc"].dt.isocalendar()
    det["iso_year"], det["iso_week"] = iso.year.astype(int), iso.week.astype(int)
    det["status"] = np.select([det.static_flag, det.keep], [2, 1], 0)
    for y, g in det.groupby("iso_year"):
        sensors = set(g.sensor)
        primary = "snpp" if "snpp" in sensors else ("noaa20" if "noaa20" in sensors else "modis")
        g = g[g.sensor == primary]
        flat = []
        for r in g.itertuples(index=False):
            flat += [round(r.lon, 3), round(r.lat, 3), int(r.iso_week), int(r.status)]
        _dump(WEB_DATA / f"points/{int(y)}.json", {"year": int(y), "sensor": primary, "stride": 4, "pts": flat})


def write_static_cells() -> None:
    c = pd.read_parquet(PROCESSED / "static_cells.parquet")
    _dump(WEB_DATA / "static_cells.json",
          [{"lat": round(r.lat, 4), "lon": round(r.lon, 4), "n": int(r.n), "months": int(r.months),
            "years": int(r.years), "peak_share": round(r.peak_share, 2)} for r in c.itertuples()])


def write_csv(h: pd.DataFrame) -> None:
    cols = {"unit_type": "unit_type", "unit_id": "unit_id", "iso_year": "iso_year", "iso_week": "iso_week",
            "M": "modis_count", "V": "viirs_snpp_count", "J": "viirs_noaa20_count", "naive": "naive_scaled",
            "harm": "harmonised", "lo": "lo80", "hi": "hi80", "src": "source"}
    out = h[h.unit_type != "district"][list(cols)].rename(columns=cols)
    path = WEB_DATA / "download/harmonised.csv"
    path.parent.mkdir(parents=True, exist_ok=True)
    out.round(2).to_csv(path, index=False)
    hd = h[h.unit_type == "district"][list(cols)].rename(columns=cols)
    hd.round(2).to_csv(WEB_DATA / "download/harmonised_districts.csv", index=False)
    print(f"  download/harmonised.csv: {len(out):,} rows")


def write_manifest(h, updated, handover, validation, bridge, clim_meta, det) -> None:
    dtab = district_table()
    last = h[h.unit_type == "national"].sort_values(["iso_year", "iso_week"]).iloc[-1]
    by_sensor = det.groupby("sensor")["acq_datetime_utc"].max().dt.strftime("%Y-%m-%d").to_dict()
    summary = {r["model"]: r for r in validation["summary"]}
    manifest = {
        "country": {k: COUNTRY[k] for k in ("iso3", "name_en", "name_bn", "bbox")},
        "regions": [{"id": r["id"], "name_en": r["name_en"], "name_bn": r["name_bn"]} for r in COUNTRY["regions"]],
        "districts": dtab.sort_values("name_en").to_dict(orient="records"),
        "updated_utc": updated,
        "data_through": {"iso_year": int(last.iso_year), "iso_week": int(last.iso_week), "by_sensor": by_sensor},
        "model_version": MODEL_VERSION,
        "naive_factor": validation["final_fit"]["naive_k"],
        "baseline_years": clim_meta["baseline_years"],
        "handover": {"snpp_end_utc": handover, "bridge_overlap_years": bridge["overlap_years"]},
        "validation_headline": {m: {k: summary[m][k] for k in ("mae_week", "mae_week_offseason",
                                                               "abs_total_pct_err", "mae_vs_naive_pct")}
                                for m in summary},
        "years": sorted(int(y) for y in h.iso_year.unique()),
    }
    _dump(WEB_DATA / "manifest.json", manifest)


def main() -> None:
    h = pd.read_parquet(PROCESSED / "harmonised.parquet")
    season = pd.read_parquet(PROCESSED / "season.parquet")
    normals = pd.read_parquet(PROCESSED / "normals.parquet")
    det = pd.read_parquet(PROCESSED / "detections.parquet")
    validation = json.loads((PROCESSED / "validation.json").read_text())
    bridge = json.loads((PROCESSED / "bridge_factors.json").read_text())
    clim_meta = json.loads((PROCESSED / "climatology_meta.json").read_text())
    updated = datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    handover = bridge["snpp_end_utc"]

    # Static detections removed, VIIRS S-NPP + NOAA-20, by region and nationally.
    v = det[(det.sensor != "modis") & det.static_flag]
    removed = v.groupby("region_id").size().to_dict()
    removed["bgd"] = int(len(v))

    units = [("national", "bgd", {"id": "bgd", "name_en": COUNTRY["name_en"], "name_bn": COUNTRY["name_bn"]})]
    units += [("region", r["id"], {"id": r["id"], "name_en": r["name_en"], "name_bn": r["name_bn"]})
              for r in COUNTRY["regions"]]
    units += [("district", r.district_id, {"id": f"d_{r.district_id}", "name_en": r.name_en, "name_bn": r.name_bn})
              for r in district_table().itertuples()]
    # Static detections removed per district too.
    removed.update(v.groupby("district_id").size().to_dict())
    print("writing JSON:")
    write_region_json(h, season, normals, units, updated, handover, removed)
    write_districts(h, season, district_table())
    write_geojson()
    write_points(det)
    write_static_cells()
    write_csv(h)
    write_manifest(h, updated, handover, validation, bridge, clim_meta, det)
    print("done")


if __name__ == "__main__":
    main()
