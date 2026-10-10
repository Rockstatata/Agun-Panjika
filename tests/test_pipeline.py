"""Pipeline tests.

Unit tests run on synthetic data. Data tests (marked ``data``) check the real outputs
and are skipped until the pipeline has been run (python -m pipeline.run_all).
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from pipeline.climatology import level_for
from pipeline.config import OVERLAP_YEARS, PROCESSED, WEB_DATA
from pipeline.harmonise import MonthlyFactors, NaiveFactor, NegBinModel, _irls_nb2
from pipeline.ingest import normalise_columns
from pipeline.kilns import apply_filters, flag_static_cells

SCHEMA = Path(__file__).resolve().parent.parent / "pipeline" / "schema" / "region.schema.json"
have_data = (PROCESSED / "detections.parquet").exists() and (WEB_DATA / "national.json").exists()
data = pytest.mark.skipif(not have_data, reason="run the pipeline first")


# ------------------------------------------------------------------------ unit tests


def test_normalise_modis_and_viirs():
    modis = pd.DataFrame({"latitude": [22.1], "longitude": [92.2], "acq_date": ["2024-04-01"], "acq_time": [445],
                          "satellite": ["Aqua"], "confidence": [80], "frp": [12.5], "daynight": ["D"], "type": [0]})
    viirs = pd.DataFrame({"latitude": [22.1], "longitude": [92.2], "acq_date": ["2024-04-01"], "acq_time": [712],
                          "satellite": ["N"], "confidence": ["n"], "frp": [3.1], "daynight": ["D"], "type": [2]})
    m, v = normalise_columns(modis), normalise_columns(viirs)
    assert m.sensor[0] == "modis" and m.confidence_norm[0] == pytest.approx(0.8)
    assert str(m.acq_datetime_utc[0]) == "2024-04-01 04:45:00+00:00"
    assert v.sensor[0] == "snpp" and v.confidence_norm[0] == pytest.approx(0.6)


def test_alert_levels():
    assert level_for(10) == "below"
    assert level_for(25) == "normal"
    assert level_for(74.9) == "normal"
    assert level_for(75) == "above"
    assert level_for(90) == "extreme"
    assert level_for(100) == "extreme"


def _det(rows, daynight="D"):
    df = pd.DataFrame(rows, columns=["lat", "lon", "date", "sensor", "type"])
    df["acq_datetime_utc"] = pd.to_datetime(df.pop("date"), utc=True)
    df["confidence_norm"] = 0.9
    df["daynight"] = daynight
    return df


def test_kiln_cell_flagged_and_jhum_kept():
    kiln = [(23.5001, 90.1001, f"{y}-{m:02d}-10", "snpp", 0) for y in (2019, 2020, 2021) for m in (1, 2, 11, 12)]
    jhum = [(22.0001, 92.3001, f"{y}-04-0{d}", "snpp", 0) for y in (2019, 2020, 2021) for d in (1, 2, 3, 4)]
    modis_near_kiln = [(23.5040, 90.1001, "2020-01-15", "modis", 0)]
    det = _det(kiln + jhum + modis_near_kiln)
    det.loc[: len(kiln) - 1, "daynight"] = "N"  # industrial heat: night overpasses
    cells = flag_static_cells(det)
    assert len(cells) == 1
    out = apply_filters(det, cells)
    assert out.loc[: len(kiln) - 1, "static_flag"].all()
    assert not out.loc[len(kiln): len(kiln) + len(jhum) - 1, "static_flag"].any()
    assert out.iloc[-1]["static_flag"]  # MODIS 1 km pixel next to the kiln cell


def test_daytime_repeat_burning_is_not_a_kiln():
    fields = [(23.5001, 90.1001, f"{y}-{m:02d}-10", "snpp", 0) for y in (2019, 2020, 2021) for m in (1, 2, 11, 12)]
    assert flag_static_cells(_det(fields, daynight="D")).empty


def test_firms_type_2_dropped():
    det = _det([(23.0, 90.0, "2020-04-01", "snpp", 2), (23.1, 90.1, "2020-04-01", "snpp", 0)])
    out = apply_filters(det, flag_static_cells(det))
    assert out["keep"].tolist() == [False, True]


def test_irls_recovers_known_coefficients():
    rng = np.random.default_rng(0)
    n = 4000
    x = rng.normal(size=n)
    X = np.column_stack([np.ones(n), x])
    mu = np.exp(1.0 + 0.5 * x)
    alpha = 0.5
    y = rng.negative_binomial(1 / alpha, (1 / alpha) / (1 / alpha + mu))
    beta, cov, _ = _irls_nb2(X, y.astype(float), alpha)
    assert beta[0] == pytest.approx(1.0, abs=0.08)
    assert beta[1] == pytest.approx(0.5, abs=0.05)
    assert np.all(np.diag(cov) > 0)


def _toy_region_weeks():
    rng = np.random.default_rng(1)
    rows = []
    for y in range(2012, 2018):
        for w in range(1, 53):
            month = min(12, (w - 1) // 4 + 1)
            M = rng.poisson(30 if month in (3, 4) else 1)
            ratio = 4 if month in (3, 4) else 12
            V = rng.poisson(ratio * M + (2 if month not in (3, 4) else 0))
            rows.append({"region_id": "r1", "iso_year": y, "iso_week": w, "month": month, "M": M,
                         "F": 20.0 * M, "V": V})
    d = pd.DataFrame(rows)
    d["lM"], d["lF"] = np.log1p(d.M), np.log1p(d.F)
    d["rm"] = d.region_id + "_" + d.month.astype(str).str.zfill(2)
    return d


def test_seasonal_models_beat_naive_on_seasonal_ratio():
    d = _toy_region_weeks()
    tr, te = d[d.iso_year < 2017], d[d.iso_year == 2017]
    err = {}
    for m in (NaiveFactor(), MonthlyFactors(), NegBinModel()):
        err[m.name] = np.abs(m.fit(tr).predict(te) - te.V).mean()
    assert err["monthly"] < err["naive"]
    assert err["negbin"] < err["naive"]


def test_negbin_interval_draws_shape():
    d = _toy_region_weeks()
    nb = NegBinModel().fit(d)
    draws = nb.sample(d.head(10), n=50)
    assert draws.shape == (50, 10) and (draws >= 0).all()


# ------------------------------------------------------------------------ data tests


@data
def test_modis_total_matches_farukh_2023():
    det = pd.read_parquet(PROCESSED / "detections.parquet", columns=["sensor", "year"])
    assert int(((det.sensor == "modis") & det.year.between(2003, 2021)).sum()) == 54669


@data
def test_viirs_bridge_totals_match_prd():
    det = pd.read_parquet(PROCESSED / "detections.parquet", columns=["sensor", "year"])
    y = det.year.between(2019, 2024)
    assert int(((det.sensor == "noaa20") & y).sum()) == 61912
    assert int(((det.sensor == "snpp") & y).sum()) == 61553


@data
def test_exported_intervals_contain_estimate():
    for path in [WEB_DATA / "national.json", *sorted((WEB_DATA / "region").glob("[!d]*.json"))]:
        doc = json.loads(path.read_text(encoding="utf-8"))
        for wk in doc["weeks"]:
            lo, hi = wk.get("lo", wk["harm"]), wk.get("hi", wk["harm"])
            assert lo <= wk["harm"] <= hi, (path.name, wk)
        for yr in doc["annual"]:
            assert yr["lo"] <= yr["harm"] <= yr["hi"], (path.name, yr)


@data
def test_region_json_validates_against_schema():
    import jsonschema

    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    for path in [WEB_DATA / "national.json", *sorted((WEB_DATA / "region").glob("[!d]*.json"))]:
        jsonschema.validate(json.loads(path.read_text(encoding="utf-8")), schema)


@data
def test_regions_sum_to_national():
    nat = json.loads((WEB_DATA / "national.json").read_text(encoding="utf-8"))
    tot = {(w["y"], w["w"]): 0.0 for w in nat["weeks"]}
    for path in (WEB_DATA / "region").glob("[!d]*.json"):
        for w in json.loads(path.read_text(encoding="utf-8"))["weeks"]:
            tot[(w["y"], w["w"])] += w["harm"]
    for w in nat["weeks"]:
        assert tot[(w["y"], w["w"])] == pytest.approx(w["harm"], abs=1.0)


@data
def test_validation_written_and_beats_naive():
    val = json.loads((WEB_DATA / "validation.json").read_text())
    assert len(val["years"]) == len(OVERLAP_YEARS)
    s = {r["model"]: r for r in val["summary"]}
    assert s["negbin"]["mae_week"] < s["naive"]["mae_week"]
    assert s["negbin"]["mae_week_offseason"] < s["naive"]["mae_week_offseason"]


@data
def test_district_documents_sum_to_regions():
    nat = json.loads((WEB_DATA / "national.json").read_text(encoding="utf-8"))
    tot = {(w["y"], w["w"]): 0.0 for w in nat["weeks"]}
    files = sorted((WEB_DATA / "region").glob("d_*.json"))
    assert len(files) == 64
    for path in files:
        for w in json.loads(path.read_text(encoding="utf-8"))["weeks"]:
            if (w["y"], w["w"]) in tot:
                tot[(w["y"], w["w"])] += w["harm"]
    for w in nat["weeks"]:
        assert tot[(w["y"], w["w"])] == pytest.approx(w["harm"], abs=2.0)


@data
def test_record_starts_2001_and_has_unfiltered_totals():
    nat = json.loads((WEB_DATA / "national.json").read_text(encoding="utf-8"))
    years = [a["y"] for a in nat["annual"]]
    assert min(years) == 2001
    for a in nat["annual"]:
        assert a["all"] >= a["harm"] - 1  # adding kilns back never lowers the total
    assert "2024" in nat["rain"] or 2024 in nat["rain"]
