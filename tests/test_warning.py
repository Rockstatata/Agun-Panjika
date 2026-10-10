"""Tests for the early-warning, fire-weather, partner and conformal-band code."""

from __future__ import annotations

import json

import numpy as np
import pandas as pd
import pytest

from pipeline.config import PROCESSED, WEB_DATA
from pipeline.fireweather import danger_class, ffmc_step, fwi_of, isi_of, run_fwi
from pipeline.harmonise import AnnualBands, ConformalBands, _cq


def test_ffmc_isi_match_van_wagner_reference():
    # Standard FWI test case (Van Wagner & Pickett 1985): T=17 C, RH=42%, wind=25 km/h, no rain,
    # yesterday's FFMC=85 -> FFMC 87.7, ISI 10.9. Neither depends on latitude.
    ffmc = ffmc_step(85.0, 17.0, 42.0, 25.0, 0.0)
    assert ffmc == pytest.approx(87.69, abs=0.05)
    assert isi_of(ffmc, 25.0) == pytest.approx(10.85, abs=0.1)


def test_fwi_rises_in_dry_spell_and_falls_after_rain():
    dates = pd.date_range("2024-02-01", periods=30, freq="D")
    dry = pd.DataFrame({"date": dates, "t": 32.0, "h": 35.0, "w": 12.0, "r": 0.0})
    out = run_fwi(dry)
    assert out["fwi"].iloc[-1] > out["fwi"].iloc[2]
    wet = dry.copy()
    wet.loc[20:, "r"] = 30.0
    out_wet = run_fwi(wet)
    assert out_wet["fwi"].iloc[-1] < out["fwi"].iloc[-1]
    assert fwi_of(0.0, 0.0) == 0.0
    assert danger_class(3) == "low" and danger_class(60) == "extreme"


def test_conformal_quantile_is_conservative_for_small_n():
    r = np.arange(12, dtype=float)
    assert _cq(r, 0.9, True) == 11.0  # ceil(13 * 0.9) = 12th smallest
    assert _cq(r, 0.9, False) == 0.0  # floor(13 * 0.1) = 1st smallest


def test_conformal_bands_cover_simulated_errors():
    rng = np.random.default_rng(0)
    pred = rng.gamma(2, 20, 4000)
    month = rng.integers(1, 13, 4000)
    obs = np.expm1(np.log1p(pred) + rng.normal(0, 0.4, 4000))
    b = ConformalBands().fit(pred[:2000], obs[:2000], month[:2000])
    lo, hi = b.bounds(pred[2000:], month[2000:])
    cover = np.mean((obs[2000:] >= lo) & (obs[2000:] <= hi))
    assert 0.75 <= cover <= 0.88
    assert np.all(lo <= pred[2000:]) and np.all(hi >= pred[2000:])


def test_annual_bands_contain_prediction():
    f = pd.DataFrame({"u": ["a"] * 10, "obs": np.linspace(90, 110, 10), "pred": 100.0})
    lo, hi = AnnualBands().fit(f, "u").bounds("a", 100.0)
    assert lo <= 100 <= hi


have_fc = (WEB_DATA / "forecast.json").exists()
have_partner = (WEB_DATA / "partner.json").exists()


@pytest.mark.skipif(not have_fc, reason="run the pipeline first")
def test_forecast_outputs_are_valid():
    fc = json.loads((WEB_DATA / "forecast.json").read_text(encoding="utf-8"))
    for o in fc["products"]["next2"]["outlook"].values():
        if o["active"]:
            assert 0 <= o["p_above"] <= 1
            assert o["lo80"] <= o["expected"] <= o["hi80"]
    sk = fc["products"]["next2"]["skill"]
    assert sk["bss_full"] > 0 and sk["auc_full"] > 0.6  # better than climatology on held-out years
    rss = (WEB_DATA / "alerts.rss").read_text(encoding="utf-8")
    assert rss.startswith("<?xml") and "<rss" in rss
    assert "urn:oasis:names:tc:emergency:cap:1.2" in (WEB_DATA / "alerts_cap.xml").read_text(encoding="utf-8")


@pytest.mark.skipif(not have_partner, reason="run the pipeline first")
def test_esa_burned_area_shows_no_2012_jump_in_harmonised_record():
    p = json.loads((WEB_DATA / "partner.json").read_text())
    assert abs(np.log(p["jump_2012"]["harmonised"])) < abs(np.log(p["jump_2012"]["stitched"]))
    assert 0.7 < p["jump_2012"]["harmonised"] < 1.4
    assert p["corr_log_annual"]["harmonised"] > p["corr_log_annual"]["stitched"]


@pytest.mark.skipif(not (PROCESSED / "validation.json").exists(), reason="run the pipeline first")
def test_shipped_model_beats_naive_and_intervals_are_calibrated():
    v = json.loads((PROCESSED / "validation.json").read_text())
    s = {r["model"]: r for r in v["summary"]}
    assert s[v["chosen_model"]]["mae_week"] < 0.85 * s["naive"]["mae_week"]
    cov = v["interval_coverage"]
    assert 0.7 <= cov["national_week"] <= 0.9


@pytest.mark.skipif(not (WEB_DATA / "alerts_bn.rss").exists(), reason="run the pipeline first")
def test_feeds_are_bilingual():
    assert '<language>bn-BD</language>' in (WEB_DATA / "alerts_bn.rss").read_text(encoding="utf-8")
    cap = (WEB_DATA / "alerts_cap.xml").read_text(encoding="utf-8")
    if "<entry>" in cap:  # quiet weeks have no alerts
        assert "<language>bn-BD</language>" in cap and "<language>en</language>" in cap


@pytest.mark.skipif(not (WEB_DATA / "local" / "rangamati.json").exists(), reason="run the pipeline first")
def test_cht_upazilas_match_official_counts():
    expected = {"rangamati": 10, "khagrachhari": 8, "bandarban": 7}  # 2020 boundaries (before Guimara)
    for did, n in expected.items():
        doc = json.loads((WEB_DATA / "local" / f"{did}.json").read_text(encoding="utf-8"))
        assert len(doc["levels"]["upazila"]) == n
        assert len(doc["levels"]["union"]) > n
