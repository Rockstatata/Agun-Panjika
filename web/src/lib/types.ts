// Data contract shared with pipeline/export.py (see pipeline/schema/region.schema.json).

export type Src = "observed" | "estimated" | "bridged";
export type Level = "below" | "normal" | "above" | "extreme" | "quiet";

export interface Week {
  y: number;
  w: number;
  modis?: number;
  viirs?: number;
  n20?: number;
  naive?: number;
  harm: number;
  lo?: number;
  hi?: number;
  src: Src;
}

export interface YearSeason {
  pct: number[]; // per ISO week, index 0 = week 1
  lv: string; // level code per week: b n a e q
  b10: number[]; // years of the last 10 this year beat, per week
  n10: number; // how many of the last 10 years exist
}

export interface RegionDoc {
  region: { id: string; name_en: string; name_bn: string };
  updated_utc: string;
  weeks: Week[];
  annual: { y: number; harm: number; lo: number; hi: number; all?: number }[];
  rain?: Record<string, (number | null)[]>;
  season: { year: number; to_week: number; cum: number; pct: number; level: Level; beat_last10: number; n_last10: number };
  seasons: Record<string, YearSeason>;
  normals: { p10: number[]; p25: number[]; p50: number[]; p75: number[]; p90: number[] };
  handover: { snpp_end_utc: string };
  static_removed: number;
}

export interface DistrictMeta {
  district_id: string;
  name_en: string;
  name_bn: string;
  region_id: string;
}

export interface Manifest {
  country: { iso3: string; name_en: string; name_bn: string; bbox: [number, number, number, number] };
  regions: { id: string; name_en: string; name_bn: string }[];
  districts: DistrictMeta[];
  updated_utc: string;
  data_through: { iso_year: number; iso_week: number; by_sensor: Record<string, string> };
  model_version: string;
  naive_factor: number;
  baseline_years: [number, number];
  handover: { snpp_end_utc: string; bridge_overlap_years: [number, number] };
  validation_headline: Record<string, { mae_week: number; mae_week_offseason: number; abs_total_pct_err: number; mae_vs_naive_pct: number }>;
  chosen_model?: string;
  years: number[];
}

export interface ValidationSummary {
  model: string;
  mae_week: number;
  mae_week_offseason: number;
  abs_total_pct_err: number;
  peak_week_err_days: number;
  direction_match: number;
  mae_vs_naive_pct: number;
  offseason_years_beating_naive: number;
}

export interface ValidationDoc {
  years: number[];
  summary: ValidationSummary[];
  per_year: {
    year: number;
    model: string;
    mae_week: number;
    mae_week_offseason: number;
    total_true: number;
    total_pred: number;
    total_pct_err: number;
    peak_week_err_days: number;
  }[];
  per_region: { model: string; region_id: string; mae_week: number }[];
  chosen_model: string;
  interval_coverage?: { region_week: number; national_week: number; national_year: number; region_year: number; target: number };
  final_fit: {
    negbin: { beta_logM: number; gamma_logF: number; alpha: number; n_intercepts: number };
    naive_k: number;
    monthly_k: Record<string, number>;
    train_years: [number, number];
  };
}

export interface BridgeDoc {
  snpp_end_utc: string;
  overlap_years: [number, number];
  noaa20_to_snpp_monthly: Record<string, number>;
  national_totals: { snpp: number; noaa20: number };
  loyo_mean: Record<string, number>;
}

export interface DistrictYear {
  year: number;
  districts: Record<string, { harm: (number | null)[]; pct: number[]; lv: string }>;
}

export interface PointsYear {
  year: number;
  sensor: string;
  stride: number;
  pts: number[];
}

export const LEVEL_FROM_CODE: Record<string, Level> = { b: "below", n: "normal", a: "above", e: "extreme", q: "quiet" };

// Early warning (pipeline/forecast.py, fireweather.py)
export type OutlookLevel = "low" | "normal" | "elevated" | "high";
export interface Outlook {
  active: boolean;
  issue_year?: number;
  issue_week: number;
  p_above?: number;
  level?: OutlookLevel;
  expected?: number;
  lo80?: number;
  hi80?: number;
  normal_median?: number;
  normal_q75?: number;
  drivers?: { fire_last4_vs_normal: number; fwi_now_anom: number | null; fwi_next2_anom: number | null; drought_code_anom: number | null };
}
export interface ForecastSkill {
  n: number;
  base_rate: number;
  bss_full: number;
  bss_fire_only: number;
  auc_full: number;
  auc_fire_only: number;
  mae_full: number;
  mae_fire_only: number;
  mae_clim: number;
  mae_persist: number;
  reliability: { p: number; obs: number; n: number }[];
  has_skill: boolean;
  feature_importance: Record<string, number>;
}
export interface Alert {
  district_id: string;
  name_en: string;
  name_bn: string;
  iso_year: number;
  iso_week: number;
  count: number;
  normal: number;
  q90: number;
}
export interface ForecastDoc {
  generated_utc: string;
  hindcast_years: [number, number];
  products: Record<"next2" | "rest", { skill: ForecastSkill; outlook: Record<string, Outlook> }>;
  alerts: { rule: string; latest_week: number; items: Alert[]; per_year_counts: Record<string, number> };
}
export type DangerClass = "low" | "moderate" | "high" | "very_high" | "extreme";
export interface FireWeatherDoc {
  generated_utc: string;
  classes: { max: number; name: DangerClass }[];
  regions: Record<string, { d: string; fwi: number; p50: number; p90: number; cls: DangerClass; fc: boolean }[]>;
}

// Partner cross-check (pipeline/partner.py)
export interface PartnerDoc {
  products: Record<string, string>;
  annual: { y: number; ba_km2: number; harm: number; stitched: number; modis: number }[];
  monthly_climatology: { m: number; ba_km2: number; harm: number }[];
  jump_2012: { harmonised: number; stitched: number; modis_only: number };
  corr_log_annual: { harmonised: number; modis_only: number; stitched: number };
  corr_log_annual_estimated_years: number;
  corr_seasonal_cycle: number;
}

// Borderless views (pipeline/neighbours.py)
export interface NeighboursDoc {
  units: Record<string, { area: "hills" | "igp"; name_en: string; name_bn: string; weeks: [number, number, number, string][] }>;
  dhaka_aod?: [number, number, number][];
}

// Union / upazila calendars for the CHT districts (pipeline/local.py)
export interface LocalUnit {
  name_en: string;
  name_bn: string | null;
  upazila_id?: string;
  total_2012_2025: number;
  years: Record<string, (number | null)[]>;
}
export interface LocalDoc {
  district_id: string;
  levels: { upazila: Record<string, LocalUnit>; union: Record<string, LocalUnit> };
}
