"""MODIS -> VIIRS S-NPP harmonisation, challengers and leave-one-year-out validation.

Models are fit on region-weeks from the overlap years (2012 to 2024), where V is the
S-NPP count and M the MODIS count:

* negbin   V ~ NegBin(mu, alpha),  log mu = a[region, month] + b log(M+1) + g log(F+1)
* gbm      LightGBM (Poisson) on MODIS count, FRP, Aqua/Terra split, night share,
           small-fire and high-confidence counts, burning districts, the neighbouring
           weeks' MODIS counts, month and week
* ensemble 0.3 negbin + 0.7 gbm (shipped)

Baselines: the PRD's single 4.4x factor, a single factor refit on each training fold (naive),
and 12 national monthly factors. The shipped ensemble is 0.3 x negbin + 0.7 x a 5-seed bagged
LightGBM that also sees NASA POWER weather and FWI, the night / small-fire / Aqua mix, and MODIS
view geometry (pixel size), all of which exist for the MODIS-only years too.

Intervals are conformal: 80% bounds come from the spread of held-out (leave-one-year-out)
errors, by activity level and season, so they are calibrated on years the model never
saw. Their coverage is itself checked with a nested leave-one-year-out.

The national series is the sum of regions. District values share the region value by
the district's MODIS detections that week (or its long-run S-NPP share for that month
when MODIS saw nothing), so districts add up to their region.
"""

from __future__ import annotations

import json
import pickle
from dataclasses import dataclass, field
from datetime import date

import numpy as np
import pandas as pd

from pipeline.aggregate import wide
from pipeline.config import AQUA_START, OVERLAP_YEARS, PROCESSED, RECORD_FIRST_YEAR, WEB_DATA

OFF_SEASON = (10, 11, 12, 1, 2)
PEAK = (2, 3, 4, 5)
RNG = np.random.default_rng(2026)
GBM_COLS = ["M", "F", "A", "T", "N", "L", "H", "P", "lM_prev", "lM_next", "lM_4", "month", "iso_week", "mean_frp",
            # weather (NASA POWER, FWI): cloud hides fires from both sensors; fire weather changes fire size
            "cloud", "precip", "rh", "fwi", "dc",
            # what kind of fires MODIS saw: night, small-FRP and Aqua shares
            "night_share", "low_share", "aqua_share",
            # MODIS view geometry: off-nadir pixels are up to ~10x larger and miss small fires
            "pix_mean", "nadir_share", "pix_nat"]
WEIGHT_NB = 0.3
GBM_SEEDS = (1, 2, 3, 4, 5)
SHIPPED = "ensemble"


def week_month(iso_year: pd.Series, iso_week: pd.Series) -> np.ndarray:
    """Calendar month of the Thursday of each ISO week."""
    return np.array([date.fromisocalendar(int(y), int(w), 4).month for y, w in zip(iso_year, iso_week, strict=False)])


def build_features(dw: pd.DataFrame, level: str = "region_id") -> pd.DataFrame:
    w = wide(dw, level)
    if level == "district_id":
        w = w.merge(dw[["district_id", "region_id"]].drop_duplicates(), on="district_id", how="left")
    w["month"] = week_month(w["iso_year"], w["iso_week"])
    for c in ("A", "N", "L", "H"):
        if c not in w:
            w[c] = 0.0
    w["T"] = w["M"] - w["A"]
    if level == "region_id":
        m = dw[(dw["sensor"] == "modis") & (dw["count"] > 0)]
        p = m.groupby(["region_id", "iso_year", "iso_week"])["district_id"].nunique().rename("P")
        w = w.merge(p, on=["region_id", "iso_year", "iso_week"], how="left")
    w["P"] = w.get("P", pd.Series(0, index=w.index)).fillna(0)
    for c in ("M", "F", "A", "T"):
        w["l" + c] = np.log1p(w[c])
    w = w.sort_values([level, "iso_year", "iso_week"]).reset_index(drop=True)
    g = w.groupby(level)["M"]
    w["lM_prev"] = np.log1p(g.shift(1)).fillna(0)
    w["lM_next"] = np.log1p(g.shift(-1)).fillna(0)
    w["lM_4"] = np.log1p(g.transform(lambda s: s.rolling(4, min_periods=1).mean()))
    gt = w.groupby(level)["T"]
    w["lT_prev"] = np.log1p(gt.shift(1)).fillna(0)
    w["lT_next"] = np.log1p(gt.shift(-1)).fillna(0)
    w["mean_frp"] = np.log1p(w["F"] / w["M"].clip(lower=1))
    for c, src in (("night_share", "N"), ("low_share", "L"), ("aqua_share", "A")):
        w[c] = w[src] / w["M"].clip(lower=1)
    if "PIX" in w:
        w["pix_mean"] = (w["PIX"] / w["M"]).where(w["M"] > 0)
        w["nadir_share"] = (w["NAD"] / w["M"]).where(w["M"] > 0)
        nat = w.groupby(["iso_year", "iso_week"])[["PIX", "M"]].transform("sum")
        w["pix_nat"] = (nat["PIX"] / nat["M"]).where(nat["M"] > 0)
    w = add_weather(w, level)
    w["rm"] = w["region_id"] + "_" + w["month"].astype(str).str.zfill(2)
    return w


def add_weather(w: pd.DataFrame, level: str) -> pd.DataFrame:
    """Join weekly NASA POWER weather and FWI by region (districts use their region's weather)."""
    from pipeline.config import PROCESSED as P_

    keys = ["region_id", "iso_year", "iso_week"]
    sources = ((P_ / "weather_week.parquet", ["cloud", "precip", "rh"]), (P_ / "fwi_week.parquet", ["fwi", "dc"]))
    for path, cols in sources:
        if path.exists():
            x = pd.read_parquet(path)
            have = [c for c in cols if c in x]
            w = w.drop(columns=[c for c in have if c in w]).merge(x[keys + have], on=keys, how="left")
    return w


def training_rows(feat: pd.DataFrame) -> pd.DataFrame:
    """Overlap region-weeks with both sensors flying the whole week (S-NPP starts 19 Jan 2012)."""
    ok = feat["iso_year"].isin(OVERLAP_YEARS) & feat["V"].notna() & feat["M"].notna()
    ok &= ~((feat["iso_year"] == 2012) & (feat["iso_week"] < 4))
    return feat[ok]


# --------------------------------------------------------------------------- models


@dataclass
class NaiveFactor:
    name: str = "naive"
    k: float = 1.0

    def fit(self, d: pd.DataFrame) -> NaiveFactor:
        self.k = d["V"].sum() / d["M"].sum()
        return self

    def predict(self, d: pd.DataFrame) -> np.ndarray:
        return self.k * d["M"].to_numpy()


@dataclass
class PRDFactor:
    """The single 4.4x factor the PRD names as the baseline (2024: 8,083 / 1,876 rounded)."""
    name: str = "prd_4.4x"
    k: float = 4.4

    def fit(self, d: pd.DataFrame) -> PRDFactor:
        return self

    def predict(self, d: pd.DataFrame) -> np.ndarray:
        return self.k * d["M"].to_numpy()


@dataclass
class MonthlyFactors:
    name: str = "monthly"
    k: dict = field(default_factory=dict)

    def fit(self, d: pd.DataFrame) -> MonthlyFactors:
        g = d.groupby("month")[["V", "M"]].sum()
        self.k = (g["V"] / g["M"].clip(lower=1)).to_dict()
        return self

    def predict(self, d: pd.DataFrame) -> np.ndarray:
        return d["month"].map(self.k).to_numpy() * d["M"].to_numpy()


def _nb2_loglik(y: np.ndarray, mu: np.ndarray, alpha: float) -> float:
    from scipy.special import gammaln
    r = 1.0 / alpha
    return float(np.sum(gammaln(y + r) - gammaln(r) - gammaln(y + 1)
                        + r * np.log(r / (r + mu)) + y * np.log(mu / (r + mu) + 1e-300)))


def _irls_nb2(X: np.ndarray, y: np.ndarray, alpha: float, start: np.ndarray | None = None,
              max_iter: int = 100, tol: float = 1e-8, ridge: float = 1e-6):
    """NB2 regression with log link by iteratively reweighted least squares.

    Returns (beta, covariance from the expected information, log-likelihood).
    """
    p = X.shape[1]
    beta = np.zeros(p) if start is None else start.copy()
    if start is None:
        beta[:-2] = np.log(y.mean() + 0.1)
    for _ in range(max_iter):
        eta = np.clip(X @ beta, -30, 15)
        mu = np.exp(eta)
        w = mu / (1.0 + alpha * mu)
        z = eta + (y - mu) / mu
        XtW = X.T * w
        info = XtW @ X + ridge * np.eye(p)
        new = np.linalg.solve(info, XtW @ z)
        if np.max(np.abs(new - beta)) < tol:
            beta = new
            break
        beta = new
    mu = np.exp(np.clip(X @ beta, -30, 15))
    w = mu / (1.0 + alpha * mu)
    cov = np.linalg.inv((X.T * w) @ X + ridge * np.eye(p))
    return beta, cov, _nb2_loglik(y, mu, alpha)


@dataclass
class NegBinModel:
    name: str = "negbin"
    levels: list = field(default_factory=list)
    params: np.ndarray | None = None
    cov: np.ndarray | None = None
    alpha: float = 1.0
    pool: dict = field(default_factory=dict)
    cols: tuple = ("lM", "lF")

    def _cells(self, d: pd.DataFrame) -> pd.Series:
        return d["rm"].map(lambda c: self.pool.get(c, c))

    def _design(self, d: pd.DataFrame) -> np.ndarray:
        idx = pd.Categorical(self._cells(d), categories=self.levels).codes
        X = np.zeros((len(d), len(self.levels) + len(self.cols)))
        ok = idx >= 0
        X[np.flatnonzero(ok), idx[ok]] = 1.0
        for i, c in enumerate(self.cols):
            X[:, len(self.levels) + i] = d[c].to_numpy()
        return X

    def fit(self, d: pd.DataFrame, min_fires: int = 10) -> NegBinModel:
        # Region-months with (almost) no S-NPP fire would push their intercept to -inf.
        # Pool those monsoon cells into one "quiet" intercept per region, and pool any
        # region whose quiet cell is still empty into one national quiet intercept.
        tot = d.groupby("rm")["V"].sum()
        sparse = tot[tot < min_fires].index
        self.pool = {c: c.rsplit("_", 1)[0] + "_quiet" for c in sparse}
        qt = d.assign(c=self._cells(d)).groupby("c")["V"].sum()
        for c, q in list(self.pool.items()):
            if qt.get(q, 0) < min_fires:
                self.pool[c] = "all_quiet"
        self.levels = sorted(self._cells(d).unique())
        X, y = self._design(d), d["V"].to_numpy()

        # Profile likelihood: IRLS at fixed alpha, 1-D search over log(alpha).
        from scipy.optimize import minimize_scalar

        cache: dict[float, tuple] = {}

        def fit_at(log_a: float):
            if log_a not in cache:
                cache[log_a] = _irls_nb2(X, y, float(np.exp(log_a)),
                                         start=next(iter(cache.values()))[0] if cache else None)
            return cache[log_a]

        opt = minimize_scalar(lambda la: -fit_at(la)[2], bounds=(np.log(0.05), np.log(50)),
                              method="bounded", options={"xatol": 0.02})
        self.params, self.cov, _ = fit_at(opt.x)
        self.alpha = float(np.exp(opt.x))
        return self

    def predict(self, d: pd.DataFrame) -> np.ndarray:
        return np.exp(np.clip(self._design(d) @ self.params, -30, 15))

    def sample(self, d: pd.DataFrame, n: int = 300) -> np.ndarray:
        """Posterior-predictive draws, shape (n, len(d)): parameter + NB count noise."""
        X = self._design(d)
        cov = (self.cov + self.cov.T) / 2 + np.eye(len(self.params)) * 1e-10
        betas = RNG.multivariate_normal(self.params, cov, size=n, method="eigh")
        mu = np.exp(np.clip(betas @ X.T, -20, 12))
        r = 1.0 / self.alpha
        return RNG.negative_binomial(r, r / (r + mu)).astype(np.float32)

    @property
    def summary(self) -> dict:
        return {"beta_logM": float(self.params[-2]), "gamma_logF": float(self.params[-1]),
                "alpha": self.alpha, "n_intercepts": len(self.levels)}


@dataclass
class GBMModel:
    name: str = "gbm"
    cols: tuple = tuple(GBM_COLS)
    regions: list = field(default_factory=list)
    model: object = None

    seeds: tuple = GBM_SEEDS
    models: list = field(default_factory=list)

    def _X(self, d: pd.DataFrame) -> pd.DataFrame:
        X = pd.DataFrame({c: (d[c] if c in d else np.nan) for c in self.cols}, index=d.index).astype(float)
        X["region"] = pd.Categorical(d["region_id"], categories=self.regions)
        return X

    def fit(self, d: pd.DataFrame) -> GBMModel:
        import lightgbm as lgb

        self.regions = sorted(d["region_id"].unique())
        X = self._X(d)
        # Bag over seeds: same data, different row/column subsamples, averaged.
        self.models = [lgb.LGBMRegressor(objective="poisson", n_estimators=500, learning_rate=0.03, num_leaves=15,
                                         min_child_samples=30, subsample=0.8, subsample_freq=1,
                                         colsample_bytree=0.8, random_state=s, verbose=-1).fit(X, d["V"])
                       for s in self.seeds]
        self.model = self.models[0]
        return self

    def predict(self, d: pd.DataFrame) -> np.ndarray:
        X = self._X(d)
        return np.clip(np.mean([m.predict(X) for m in self.models], axis=0), 0, None)


@dataclass
class EnsembleModel:
    name: str = "ensemble"
    weight_nb: float = WEIGHT_NB
    nb: NegBinModel | None = None
    gbm: GBMModel | None = None

    def fit(self, d: pd.DataFrame) -> EnsembleModel:
        self.nb = NegBinModel().fit(d)
        self.gbm = GBMModel().fit(d)
        return self

    def predict(self, d: pd.DataFrame) -> np.ndarray:
        return self.weight_nb * self.nb.predict(d) + (1 - self.weight_nb) * self.gbm.predict(d)


# Terra-only model for 2001 to mid-2002, before Aqua: learns VIIRS from Terra detections alone.
TERRA_COLS = ["T", "lT", "lT_prev", "lT_next", "month", "iso_week", "cloud", "precip", "rh", "fwi", "dc"]


@dataclass
class TerraModel:
    name: str = "terra"
    weight_nb: float = WEIGHT_NB
    nb: NegBinModel | None = None
    gbm: GBMModel | None = None

    def fit(self, d: pd.DataFrame) -> TerraModel:
        self.nb = NegBinModel(cols=("lT",)).fit(d)
        self.gbm = GBMModel(cols=tuple(TERRA_COLS)).fit(d)
        return self

    def predict(self, d: pd.DataFrame) -> np.ndarray:
        return self.weight_nb * self.nb.predict(d) + (1 - self.weight_nb) * self.gbm.predict(d)


@dataclass
class TerraFactor:
    """Baseline for the Terra-only years: one factor V / Terra."""
    name: str = "terra_factor"
    k: float = 1.0

    def fit(self, d: pd.DataFrame) -> TerraFactor:
        self.k = d["V"].sum() / max(d["T"].sum(), 1)
        return self

    def predict(self, d: pd.DataFrame) -> np.ndarray:
        return self.k * d["T"].to_numpy()


MODELS = {"prd_4.4x": PRDFactor, "naive": NaiveFactor, "monthly": MonthlyFactors, "negbin": NegBinModel,
          "gbm": GBMModel, "ensemble": EnsembleModel}


# ------------------------------------------------------------------- conformal bands


def _cq(r: np.ndarray | pd.Series, level: float, upper: bool) -> float:
    """Split-conformal quantile with the finite-sample correction ceil((n+1)p)/n."""
    r = np.sort(np.asarray(r, dtype=float))
    n = len(r)
    p = level if upper else 1 - level
    k = int(np.ceil((n + 1) * p)) if upper else int(np.floor((n + 1) * p))
    k = min(max(k, 1), n)
    return float(r[k - 1])


def _bin(pred: np.ndarray, edges=(1, 5, 20, 80, 300)) -> np.ndarray:
    return np.digitize(pred, edges)


@dataclass
class ConformalBands:
    """80% bands from held-out log errors, by activity bin and peak vs off-season.

    Residual r = log1p(observed) - log1p(predicted). Bounds: expm1(log1p(pred) + q10/q90).
    """
    q: dict = field(default_factory=dict)
    q_all: tuple = (0.0, 0.0)

    def fit(self, pred: np.ndarray, obs: np.ndarray, month: np.ndarray, lo=0.10, hi=0.90) -> ConformalBands:
        r = np.log1p(obs) - np.log1p(pred)
        key = list(zip(_bin(pred), np.isin(month, PEAK), strict=True))
        df = pd.DataFrame({"r": r, "k": key})
        self.q = {k: (_cq(g, hi, False), _cq(g, hi, True)) for k, g in df.groupby("k")["r"] if len(g) >= 20}
        self.q_all = (_cq(r, hi, False), _cq(r, hi, True))
        return self

    def bounds(self, pred: np.ndarray, month: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        keys = zip(_bin(pred), np.isin(month, PEAK), strict=True)
        q = np.array([self.q.get(k, self.q_all) for k in keys]).reshape(-1, 2)
        lp = np.log1p(pred)
        lo = np.clip(np.expm1(lp + q[:, 0]), 0, None)
        hi = np.expm1(lp + q[:, 1])
        return np.minimum(lo, pred), np.maximum(hi, pred)


@dataclass
class AnnualBands:
    """80% band for annual totals from held-out annual log errors (per unit)."""
    q: dict = field(default_factory=dict)

    def fit(self, frame: pd.DataFrame, unit: str) -> AnnualBands:
        r = np.log(frame["obs"] + 1) - np.log(frame["pred"] + 1)
        for u, g in r.groupby(frame[unit]):
            self.q[u] = (_cq(g, 0.90, False), _cq(g, 0.90, True))
        return self

    def bounds(self, unit: str, pred: float) -> tuple[float, float]:
        lo, hi = self.q.get(unit, (-0.3, 0.3))
        return min(np.expm1(np.log1p(pred) + lo), pred), max(np.expm1(np.log1p(pred) + hi), pred)


# ----------------------------------------------------------------------- validation


def _metrics(nat: pd.DataFrame, pred_col: str) -> dict:
    """Metrics for one held-out year on the national weekly series."""
    err = (nat[pred_col] - nat["V"]).abs()
    off = nat["month"].isin(OFF_SEASON)
    peak_true = int(nat.loc[nat["V"].idxmax(), "iso_week"])
    peak_pred = int(nat.loc[nat[pred_col].idxmax(), "iso_week"])
    return {
        "mae_week": float(err.mean()),
        "mae_week_offseason": float(err[off].mean()),
        "total_true": float(nat["V"].sum()),
        "total_pred": float(nat[pred_col].sum()),
        "total_pct_err": float(100 * (nat[pred_col].sum() - nat["V"].sum()) / nat["V"].sum()),
        "peak_week_err_days": 7 * abs(peak_pred - peak_true),
    }


def loyo_predictions(feat: pd.DataFrame, years=OVERLAP_YEARS) -> pd.DataFrame:
    train_all = training_rows(feat)
    out = []
    for y in years:
        tr, te = train_all[train_all["iso_year"] != y], train_all[train_all["iso_year"] == y].copy()
        for name, cls in MODELS.items():
            te[name] = cls().fit(tr).predict(te)
        out.append(te)
        print(f"  LOYO {y}: " + ", ".join(f"{n}={np.abs(te[n] - te['V']).mean():.2f}" for n in MODELS))
    return pd.concat(out, ignore_index=True)


def loyo_validate(P: pd.DataFrame, years=OVERLAP_YEARS) -> dict:
    rows, region_rows = [], []
    for y in years:
        te = P[P["iso_year"] == y]
        nat = te.groupby(["iso_week", "month"], as_index=False)[["V", *MODELS]].sum()
        for name in MODELS:
            rows.append({"year": y, "model": name, **_metrics(nat, name)})
        reg = te.groupby(["region_id", "iso_week"], as_index=False)[["V", *MODELS]].sum()
        for name in MODELS:
            g = reg.assign(e=(reg[name] - reg["V"]).abs()).groupby("region_id")["e"].mean()
            for r, v in g.items():
                region_rows.append({"year": y, "model": name, "region_id": r, "mae_week": float(v)})
    df = pd.DataFrame(rows)

    piv_true = df[df.model == "naive"].set_index("year")["total_true"]
    direction = {}
    for name in MODELS:
        p = df[df.model == name].set_index("year")["total_pred"]
        same = np.sign(p.diff().dropna()) == np.sign(piv_true.diff().dropna())
        direction[name] = float(same.mean())

    summary = df.groupby("model").agg(
        mae_week=("mae_week", "mean"), mae_week_offseason=("mae_week_offseason", "mean"),
        abs_total_pct_err=("total_pct_err", lambda s: s.abs().mean()),
        peak_week_err_days=("peak_week_err_days", "mean"),
    )
    summary["direction_match"] = pd.Series(direction)
    naive = summary.loc["naive", "mae_week"]
    summary["mae_vs_naive_pct"] = 100 * (summary["mae_week"] - naive) / naive
    summary["mae_vs_prd_factor_pct"] = 100 * (summary["mae_week"] / summary.loc["prd_4.4x", "mae_week"] - 1)
    off_naive = summary.loc["naive", "mae_week_offseason"]
    summary["offseason_vs_naive_pct"] = 100 * (summary["mae_week_offseason"] - off_naive) / off_naive
    off_beats = {}
    for name in MODELS:
        a = df[df.model == name].set_index("year")["mae_week_offseason"]
        b = df[df.model == "naive"].set_index("year")["mae_week_offseason"]
        off_beats[name] = int((a < b).sum())
    summary["offseason_years_beating_naive"] = pd.Series(off_beats)
    summary = summary.loc[[m for m in MODELS]]
    return {
        "years": list(years),
        "summary": summary.reset_index().round(3).to_dict(orient="records"),
        "per_year": df.round(2).to_dict(orient="records"),
        "per_region": pd.DataFrame(region_rows).groupby(["model", "region_id"])["mae_week"].mean()
        .round(2).reset_index().to_dict(orient="records"),
    }


def _national(P: pd.DataFrame, col: str) -> pd.DataFrame:
    return P.groupby(["iso_year", "iso_week", "month"], as_index=False)[["V", col]].sum()


def interval_coverage(P: pd.DataFrame, col: str = SHIPPED) -> dict:
    """Nested leave-one-year-out: calibrate bands on 12 years' held-out errors, test on the 13th."""
    hits = {"region_week": [], "national_week": [], "national_year": [], "region_year": []}
    widths = []
    nat = _national(P, col)
    reg_y = P.groupby(["region_id", "iso_year"], as_index=False)[["V", col]].sum().rename(
        columns={"V": "obs", col: "pred"})
    nat_y = nat.groupby("iso_year", as_index=False)[["V", col]].sum().rename(columns={"V": "obs", col: "pred"})
    for y in sorted(P["iso_year"].unique()):
        cal, te = P[P.iso_year != y], P[P.iso_year == y]
        b = ConformalBands().fit(cal[col].to_numpy(), cal["V"].to_numpy(), cal["month"].to_numpy())
        lo, hi = b.bounds(te[col].to_numpy(), te["month"].to_numpy())
        hits["region_week"] += list((te["V"].to_numpy() >= lo) & (te["V"].to_numpy() <= hi))
        ncal, nte = nat[nat.iso_year != y], nat[nat.iso_year == y]
        nb_ = ConformalBands().fit(ncal[col].to_numpy(), ncal["V"].to_numpy(), ncal["month"].to_numpy())
        lo, hi = nb_.bounds(nte[col].to_numpy(), nte["month"].to_numpy())
        hits["national_week"] += list((nte["V"].to_numpy() >= lo) & (nte["V"].to_numpy() <= hi))
        widths += list((hi - lo) / np.maximum(nte[col].to_numpy(), 1))
        ab = AnnualBands().fit(nat_y[nat_y.iso_year != y].assign(u="bgd"), "u")
        r = nat_y[nat_y.iso_year == y].iloc[0]
        lo1, hi1 = ab.bounds("bgd", r.pred)
        hits["national_year"].append(lo1 <= r.obs <= hi1)
        rb = AnnualBands().fit(reg_y[reg_y.iso_year != y], "region_id")
        for rr in reg_y[reg_y.iso_year == y].itertuples():
            lo1, hi1 = rb.bounds(rr.region_id, rr.pred)
            hits["region_year"].append(lo1 <= rr.obs <= hi1)
    out = {k: round(float(np.mean(v)), 3) for k, v in hits.items()}
    out["target"] = 0.8
    out["median_relative_width_national_week"] = round(float(np.median(widths)), 2)
    return out


# --------------------------------------------------------------------------- output


def predict_with_interval(model, feat: pd.DataFrame, P: pd.DataFrame, col: str = SHIPPED) -> dict[str, pd.DataFrame]:
    """Point estimate + conformal 80% interval for every region-week and national-week with MODIS,
    plus annual totals of the weeks that will be shown as estimates."""
    d = feat[feat["M"].notna()].reset_index(drop=True)
    d["est"] = model.predict(d)
    reg_b = ConformalBands().fit(P[col].to_numpy(), P["V"].to_numpy(), P["month"].to_numpy())
    reg = d[["region_id", "iso_year", "iso_week", "est"]].copy()
    reg["lo80"], reg["hi80"] = reg_b.bounds(d["est"].to_numpy(), d["month"].to_numpy())

    natP = _national(P, col)
    nat_b = ConformalBands().fit(natP[col].to_numpy(), natP["V"].to_numpy(), natP["month"].to_numpy())
    nat = d.groupby(["iso_year", "iso_week", "month"], as_index=False)["est"].sum()
    nat["lo80"], nat["hi80"] = nat_b.bounds(nat["est"].to_numpy(), nat["month"].to_numpy())
    nat = nat.drop(columns="month")

    # Annual totals of estimated weeks (no S-NPP that week).
    est_rows = d["V"].isna()
    reg_y = P.groupby(["region_id", "iso_year"], as_index=False)[["V", col]].sum().rename(
        columns={"V": "obs", col: "pred"})
    nat_y = natP.groupby("iso_year", as_index=False)[["V", col]].sum().rename(columns={"V": "obs", col: "pred"})
    rb = AnnualBands().fit(reg_y, "region_id")
    nb_ = AnnualBands().fit(nat_y.assign(u="bgd"), "u")
    annual = []
    for (r, y), g in d[est_rows].groupby(["region_id", "iso_year"]):
        lo, hi = rb.bounds(r, g["est"].sum())
        annual.append({"unit_id": r, "iso_year": y, "est": g["est"].sum(), "lo80": lo, "hi80": hi})
    for y, g in d[est_rows].groupby("iso_year"):
        lo, hi = nb_.bounds("bgd", g["est"].sum())
        annual.append({"unit_id": "bgd", "iso_year": y, "est": g["est"].sum(), "lo80": lo, "hi80": hi})
    return {"region": reg, "national": nat, "annual": pd.DataFrame(annual)}


def disaggregate_to_districts(reg_est: pd.DataFrame, dfeat: pd.DataFrame) -> pd.DataFrame:
    """Share each region-week estimate among its districts.

    Weight = district MODIS count that week; if the region had no MODIS detections,
    weight = the district's share of the region's S-NPP detections in that calendar
    month over the overlap years (equal shares if the region never burned that month).
    """
    d = dfeat[dfeat["M"].notna()][["district_id", "region_id", "iso_year", "iso_week", "month", "M"]].copy()
    ov = dfeat[dfeat["iso_year"].isin(OVERLAP_YEARS) & dfeat["V"].notna()]
    clim = ov.groupby(["district_id", "region_id", "month"], as_index=False)["V"].sum()
    clim["clim_share"] = clim["V"] / clim.groupby(["region_id", "month"])["V"].transform("sum")
    d = d.merge(clim[["district_id", "month", "clim_share"]], on=["district_id", "month"], how="left")
    n_d = d.groupby("region_id")["district_id"].transform("nunique")
    d["clim_share"] = d["clim_share"].fillna(1.0 / n_d)
    m_tot = d.groupby(["region_id", "iso_year", "iso_week"])["M"].transform("sum")
    d["share"] = np.where(m_tot > 0, d["M"] / m_tot.where(m_tot > 0, 1), d["clim_share"])
    d = d.merge(reg_est, on=["region_id", "iso_year", "iso_week"], how="inner")
    for c in ("est", "lo80", "hi80"):
        d[c] = d[c] * d["share"]
    return d[["district_id", "region_id", "iso_year", "iso_week", "est", "lo80", "hi80"]]


def main() -> None:
    dw = pd.read_parquet(PROCESSED / "district_week.parquet")
    feat = build_features(dw, "region_id")
    dfeat = build_features(dw, "district_id")
    feat.to_parquet(PROCESSED / "features_region.parquet", index=False)
    dfeat.to_parquet(PROCESSED / "features_district.parquet", index=False)

    print("leave-one-year-out validation (region-week MAE):")
    P = loyo_predictions(feat)
    P.to_parquet(PROCESSED / "loyo_predictions.parquet", index=False)
    val = loyo_validate(P)
    val["chosen_model"] = SHIPPED
    val["interval_coverage"] = interval_coverage(P)

    train = training_rows(feat)
    model = EnsembleModel().fit(train)
    naive = NaiveFactor().fit(train)
    monthly = MonthlyFactors().fit(train)
    imp = dict(zip(model.gbm.cols, model.gbm.model.feature_importances_.tolist(), strict=False))
    val["final_fit"] = {"negbin": model.nb.summary, "naive_k": round(naive.k, 3),
                        "monthly_k": {int(k): round(v, 3) for k, v in monthly.k.items()},
                        "gbm_feature_importance": imp, "ensemble_weight_negbin": model.weight_nb,
                        "train_years": [min(OVERLAP_YEARS), max(OVERLAP_YEARS)], "level": "region-week"}
    with open(PROCESSED / "model.pkl", "wb") as f:
        pickle.dump({"shipped": model, "negbin": model.nb, "naive": naive, "monthly": monthly}, f)
    # (the Terra-only model is refit each run; it is only used for 2001 to mid-2002)

    # Terra-only years: validate the Terra model the same way, then use it before Aqua.
    terra_rows = []
    for y in OVERLAP_YEARS:
        tr, te = train[train.iso_year != y], train[train.iso_year == y].copy()
        te["terra"] = TerraModel().fit(tr).predict(te)
        te["terra_factor"] = TerraFactor().fit(tr).predict(te)
        terra_rows.append(te)
    PT = pd.concat(terra_rows, ignore_index=True)
    nat_t = PT.groupby(["iso_year", "iso_week", "month"], as_index=False)[["V", "terra", "terra_factor"]].sum()
    tv = {}
    for c in ("terra", "terra_factor"):
        tot = nat_t.groupby("iso_year")[["V", c]].sum()
        tv[c] = {"mae_week": round(float((nat_t[c] - nat_t["V"]).abs().mean()), 2),
                 "abs_total_pct_err": round(float((tot[c] / tot["V"] - 1).abs().mean() * 100), 2)}
    val["terra_only"] = {**tv, "note": "Used for 2001 to ISO 2002-W26, before Aqua MODIS; lower confidence."}
    print("terra-only validation:", tv)
    terra = TerraModel().fit(train)

    rec = feat[feat["iso_year"] >= RECORD_FIRST_YEAR]
    yw = rec["iso_year"] * 100 + rec["iso_week"]
    pre_aqua = yw < AQUA_START[0] * 100 + AQUA_START[1]
    est_main = predict_with_interval(model, rec[~pre_aqua], P)
    est_terra = predict_with_interval(terra, rec[pre_aqua], PT, col="terra")
    est = {k: pd.concat([est_terra[k], est_main[k]], ignore_index=True) for k in ("region", "national")}
    # 2002 is split between the two models: add the two partial-year annual sums (conservative bounds).
    est["annual"] = pd.concat([est_terra["annual"], est_main["annual"]]).groupby(
        ["unit_id", "iso_year"], as_index=False)[["est", "lo80", "hi80"]].sum()
    est["district"] = disaggregate_to_districts(est["region"], dfeat[dfeat["iso_year"] >= RECORD_FIRST_YEAR])
    for lvl, frame in est.items():
        frame.to_parquet(PROCESSED / f"estimates_{lvl}.parquet", index=False)

    (PROCESSED / "validation.json").write_text(json.dumps(val, indent=1))
    (WEB_DATA / "validation.json").write_text(json.dumps(val, separators=(",", ":")))
    print(pd.DataFrame(val["summary"]).to_string(index=False))
    print("interval coverage:", val["interval_coverage"])


if __name__ == "__main__":
    # Import through the package so pickled model classes resolve to pipeline.harmonise.
    from pipeline import harmonise

    harmonise.main()
