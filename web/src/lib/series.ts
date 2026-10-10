import { quantile } from "d3-array";
import type { Level, RegionDoc, Src, Week } from "./types";
import { LEVEL_FROM_CODE } from "./types";

/** Monday of an ISO week (UTC). */
export function isoWeekStart(y: number, w: number): Date {
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const dow = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - dow + 1 + (w - 1) * 7);
  return monday;
}

export function isoWeekOf(d: Date): { y: number; w: number } {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  const w = Math.ceil(((t.getTime() - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return { y, w };
}

/** Week rows grouped by year, 53 slots each (index = week - 1). */
export function byYear(doc: RegionDoc): Map<number, (Week | undefined)[]> {
  const m = new Map<number, (Week | undefined)[]>();
  for (const wk of doc.weeks) {
    if (!m.has(wk.y)) m.set(wk.y, new Array(53).fill(undefined));
    m.get(wk.y)![wk.w - 1] = wk;
  }
  return m;
}

export type SeriesKey = "modis" | "viirs" | "naive" | "harm";

export interface AnnualRow {
  y: number;
  modis?: number;
  viirs?: number;
  naive?: number;
  harm: number;
  lo: number;
  hi: number;
  all?: number;
  src: Src | "mixed";
  complete: boolean;
}

/** Annual totals. The harmonised interval comes from the pipeline's summed simulation draws. */
export function annual(doc: RegionDoc): AnnualRow[] {
  const out: AnnualRow[] = [];
  const ann = new Map((doc.annual ?? []).map((a) => [a.y, a]));
  for (const [y, weeks] of byYear(doc)) {
    const ws = weeks.filter(Boolean) as Week[];
    const sum = (k: keyof Week) => (ws.some((w) => w[k] !== undefined) ? ws.reduce((s, w) => s + ((w[k] as number) ?? 0), 0) : undefined);
    const srcs = new Set(ws.map((w) => w.src));
    // S-NPP data begin 19 Jan 2012: count a VIIRS year if at least 48 weeks were observed.
    const fullViirs = ws.filter((w) => w.viirs !== undefined).length >= 48;
    out.push({
      y,
      modis: sum("modis"),
      viirs: fullViirs ? sum("viirs") : undefined,
      naive: sum("naive"),
      harm: ws.reduce((s, w) => s + w.harm, 0),
      lo: ann.get(y)?.lo ?? ws.reduce((s, w) => s + (w.lo ?? w.harm), 0),
      hi: ann.get(y)?.hi ?? ws.reduce((s, w) => s + (w.hi ?? w.harm), 0),
      all: ann.get(y)?.all,
      src: srcs.size === 1 ? [...srcs][0] : "mixed",
      complete: ws.length >= 52,
    });
  }
  return out.sort((a, b) => a.y - b.y);
}

export function cumulative(weeks: (Week | undefined)[], upTo = 53): number[] {
  const out: number[] = [];
  let c = 0;
  for (let i = 0; i < Math.min(upTo, weeks.length); i++) {
    if (!weeks[i]) break;
    c += weeks[i]!.harm;
    out.push(c);
  }
  return out;
}

export interface SeasonState {
  year: number;
  week: number;
  cum: number;
  pct: number;
  level: Level;
  beat10: number;
  n10: number;
  normal: { p10: number; p25: number; p50: number; p75: number; p90: number };
}

export function seasonAt(doc: RegionDoc, year: number, week: number): SeasonState | undefined {
  const s = doc.seasons[String(year)];
  if (!s) return undefined;
  const wi = Math.min(week, s.pct.length) - 1;
  if (wi < 0) return undefined;
  const weeks = byYear(doc).get(year) ?? [];
  const cum = cumulative(weeks, wi + 1);
  const n = doc.normals;
  return {
    year,
    week: wi + 1,
    cum: cum[cum.length - 1] ?? 0,
    pct: s.pct[wi],
    level: LEVEL_FROM_CODE[s.lv[wi]] ?? "normal",
    beat10: s.b10[wi],
    n10: s.n10,
    normal: { p10: n.p10[wi], p25: n.p25[wi], p50: n.p50[wi], p75: n.p75[wi], p90: n.p90[wi] },
  };
}

/** Colour thresholds for weekly harmonised values: quantiles of non-zero weeks, so every region uses its full ramp. */
export function rampThresholds(doc: RegionDoc): number[] {
  const vals = doc.weeks.map((w) => w.harm).filter((v) => v >= 0.5).sort((a, b) => a - b);
  if (!vals.length) return [1, 2, 3, 4];
  const qs = [0.35, 0.6, 0.8, 0.93].map((p) => quantile(vals, p) ?? 1);
  // Keep thresholds strictly increasing.
  for (let i = 1; i < qs.length; i++) if (qs[i] <= qs[i - 1]) qs[i] = qs[i - 1] + 1;
  return qs.map((q) => Math.round(q * 10) / 10);
}

export const RAMP = ["var(--ramp-1)", "var(--ramp-2)", "var(--ramp-3)", "var(--ramp-4)", "var(--ramp-5)"];

export function rampColor(v: number | undefined | null, th: number[]): string {
  if (v === undefined || v === null) return "transparent";
  if (v < 0.5) return "var(--zero)";
  let i = 0;
  while (i < th.length && v >= th[i]) i++;
  return RAMP[i];
}

export const LEVEL_COLOR: Record<Level, string> = {
  below: "var(--level-below)",
  normal: "var(--level-normal)",
  above: "var(--level-above)",
  extreme: "var(--level-extreme)",
  quiet: "var(--level-quiet)",
};

/** ISO week (1-based) of the first Thursday of each month, for month labels on week axes. */
export function monthStartWeeks(year = 2021): number[] {
  return Array.from({ length: 12 }, (_, m) => isoWeekOf(new Date(Date.UTC(year, m, 4))).w);
}

export function handoverWeek(doc: { handover: { snpp_end_utc: string } }): { y: number; w: number } {
  return isoWeekOf(new Date(doc.handover.snpp_end_utc));
}
