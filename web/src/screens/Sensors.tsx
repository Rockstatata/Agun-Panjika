import { scaleBand, scaleLinear } from "d3-scale";
import { useMemo, useState } from "react";
import { AnnualChart, SERIES_STYLE } from "../components/AnnualChart";
import { RegionPicker } from "../components/RegionPicker";
import { Sonify } from "../components/Sonify";
import { useTooltip } from "../components/Tooltip";
import { useFmt } from "../i18n";
import { loadBridge, loadRegion, loadValidation, useAsync } from "../lib/data";
import { annual, isoWeekStart, type SeriesKey } from "../lib/series";
import type { Manifest, RegionDoc, ValidationDoc } from "../lib/types";
import { useWidth } from "../lib/useWidth";

const ALL: SeriesKey[] = ["modis", "viirs", "naive", "harm"];

export function Sensors({ manifest, params, setParams }: { manifest: Manifest; params: URLSearchParams; setParams: (p: Record<string, string | number | undefined>) => void }) {
  const { t, num, num1, year: fy } = useFmt();
  const regionId = params.get("r") ?? "bgd";
  const { data: doc } = useAsync(() => loadRegion(regionId), [regionId]);
  const { data: val } = useAsync(loadValidation, []);
  const [on, setOn] = useState<SeriesKey[]>(["modis", "viirs"]);
  const [withKilns, setWithKilns] = useState(false);
  const rows = useMemo(() => {
    const r = doc ? annual(doc).filter((x) => x.complete) : [];
    // "Include kilns": the same record without the static-source filter (no band; bands are for the filtered record).
    return withKilns ? r.map((x) => ({ ...x, harm: x.all ?? x.harm, lo: x.all ?? x.harm, hi: x.all ?? x.harm })) : r;
  }, [doc, withKilns]);
  const years = rows.map((r) => r.y);
  const [range, setRange] = useState<[number, number] | null>(null);
  const [from, to] = range ?? [years[0] ?? 2003, years[years.length - 1] ?? 2024];
  const k = manifest.naive_factor;
  const labels: Record<SeriesKey, string> = {
    modis: t("sensors.rawModis"),
    viirs: t("sensors.rawViirs"),
    naive: t("sensors.naive", { k: num1(k) }),
    harm: t("sensors.harmonised"),
  };
  const r2011 = rows.find((r) => r.y === 2011);
  const r2012 = rows.find((r) => r.y === 2012);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{t("sensors.title")}</h1>
        <p className="mt-1 max-w-2xl text-muted">{t("sensors.intro")}</p>
      </div>

      <section className="card flex flex-col gap-3 p-3 sm:p-5" aria-labelledby="annual-h">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="annual-h" className="text-lg font-semibold">
            {t("sensors.annual")}
          </h2>
          <div className="min-w-[200px]">
            <RegionPicker manifest={manifest} value={regionId} onChange={(r) => setParams({ r })} id="sensor-region" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("sensors.annual")}>
          {ALL.map((s) => (
            <button
              key={s}
              type="button"
              className="chip"
              aria-pressed={on.includes(s)}
              onClick={() => setOn((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]))}
            >
              <span className="inline-block h-1 w-4 rounded" style={{ background: SERIES_STYLE[s].color }} />
              {labels[s]}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={withKilns} onChange={(e) => setWithKilns(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
          {t("sensors.withKilns")}
        </label>
        {doc && <AnnualChart rows={rows} series={ALL.filter((s) => on.includes(s))} labels={labels} from={from} to={to} />}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="eyebrow">{t("sensors.range")}</span>
          <select className="select" value={from} onChange={(e) => setRange([Number(e.target.value), to])} aria-label="from">
            {years.filter((y) => y < to).map((y) => (
              <option key={y} value={y}>
                {fy(y)}
              </option>
            ))}
          </select>
          –
          <select className="select" value={to} onChange={(e) => setRange([from, Number(e.target.value)])} aria-label="to">
            {years.filter((y) => y > from).map((y) => (
              <option key={y} value={y}>
                {fy(y)}
              </option>
            ))}
          </select>
        </div>
        {doc && <Sonify doc={doc} />}
        {r2011?.modis !== undefined && r2012?.viirs !== undefined && (
          <p className="text-sm text-muted">{t("sensors.jump", { a: num(r2011.modis), b: num(r2012.viirs) })}</p>
        )}
      </section>

      {doc && <RatioBars doc={doc} k={k} />}
      {val && <ValidationSection val={val} />}
      <BridgeSection />
    </div>
  );
}

function RatioBars({ doc, k }: { doc: RegionDoc; k: number }) {
  const { t, num1 } = useFmt();
  const tip = useTooltip();
  const [ref, width] = useWidth<HTMLDivElement>();
  const months = t("calendar.months").split(",");
  const ratios = useMemo(() => {
    const v = new Array(12).fill(0);
    const m = new Array(12).fill(0);
    for (const w of doc.weeks) {
      if (w.y < 2012 || w.y > 2024 || w.viirs === undefined || w.modis === undefined) continue;
      const mo = new Date(isoWeekStart(w.y, w.w).getTime() + 3 * 86400000).getUTCMonth();
      v[mo] += w.viirs;
      m[mo] += w.modis;
    }
    return v.map((vv, i) => ({ i, r: m[i] >= 5 ? vv / m[i] : null, v: vv, m: m[i] }));
  }, [doc]);
  const height = 220;
  const mg = { l: 36, r: 10, t: 16, b: 24 };
  const x = scaleBand<number>().domain(ratios.map((d) => d.i)).range([mg.l, width - mg.r]).padding(0.2);
  const y = scaleLinear()
    .domain([0, Math.max(k, ...ratios.map((d) => d.r ?? 0)) * 1.1])
    .range([height - mg.b, mg.t])
    .nice();
  return (
    <section className="card p-3 sm:p-5" aria-labelledby="ratio-h">
      <h2 id="ratio-h" className="text-lg font-semibold">
        {t("sensors.ratioTitle")}
      </h2>
      <p className="mb-2 text-sm text-muted">{t("sensors.ratioIntro")}</p>
      <div ref={ref}>
        <svg width={width} height={height} role="img" aria-label={ratios.map((d) => `${months[d.i]} ${d.r ? d.r.toFixed(1) : "–"}x`).join(", ")} onMouseLeave={() => tip.hide()}>
          {y.ticks(4).map((v) => (
            <g key={v}>
              <line x1={mg.l} x2={width - mg.r} y1={y(v)} y2={y(v)} stroke="var(--grid)" />
              <text x={mg.l - 6} y={y(v) + 4} fontSize={10} textAnchor="end" fill="var(--muted)">
                {v}×
              </text>
            </g>
          ))}
          {ratios.map((d) => (
            <g key={d.i}>
              {d.r !== null && (
                <rect
                  x={x(d.i)}
                  y={y(d.r)}
                  width={x.bandwidth()}
                  height={y(0) - y(d.r)}
                  fill={d.r > k * 1.5 ? "var(--ramp-4)" : "var(--ramp-2)"}
                  rx={2}
                  onMouseMove={(e) => tip.show(e.clientX, e.clientY, <div>{months[d.i]}: {num1(d.r!)}× ({Math.round(d.v)} / {Math.round(d.m)})</div>)}
                />
              )}
              {d.r !== null && width > 420 && (
                <text x={(x(d.i) ?? 0) + x.bandwidth() / 2} y={y(d.r) - 4} fontSize={10} textAnchor="middle" fill="var(--ink)">
                  {num1(d.r)}
                </text>
              )}
              <text x={(x(d.i) ?? 0) + x.bandwidth() / 2} y={height - 6} fontSize={10} textAnchor="middle" fill="var(--muted)">
                {months[d.i]}
              </text>
            </g>
          ))}
          <line x1={mg.l} x2={width - mg.r} y1={y(k)} y2={y(k)} stroke="var(--ink)" strokeDasharray="5 4" />
          <text x={width - mg.r} y={y(k) - 4} fontSize={10} textAnchor="end" fill="var(--ink)">
            {t("sensors.naive", { k: num1(k) })}
          </text>
        </svg>
      </div>
    </section>
  );
}

function ValidationSection({ val }: { val: ValidationDoc }) {
  const { t, num, num1, year: fy } = useFmt();
  const order = ["naive", "monthly", "negbin", "gbm", "ensemble"];
  const rows = order.map((m) => val.summary.find((s) => s.model === m)!).filter(Boolean);
  const nb2022 = val.per_year.find((r) => r.model === val.chosen_model && r.year === 2022);
  const nv2022 = val.per_year.find((r) => r.model === "naive" && r.year === 2022);
  const [ref, width] = useWidth<HTMLDivElement>();
  const per = val.years.map((y) => ({
    y,
    naive: val.per_year.find((r) => r.model === "naive" && r.year === y)?.mae_week ?? 0,
    ours: val.per_year.find((r) => r.model === val.chosen_model && r.year === y)?.mae_week ?? 0,
  }));
  const h = 170;
  const mg = { l: 32, r: 8, t: 8, b: 22 };
  const x = scaleBand<number>().domain(val.years).range([mg.l, width - mg.r]).padding(0.25);
  const yS = scaleLinear().domain([0, Math.max(...per.map((p) => Math.max(p.naive, p.ours))) * 1.1]).range([h - mg.b, mg.t]).nice();
  const bw = x.bandwidth() / 2;
  return (
    <section className="card p-3 sm:p-5" aria-labelledby="val-h">
      <h2 id="val-h" className="text-lg font-semibold">
        {t("sensors.validationTitle")}
      </h2>
      <p className="mb-3 text-sm text-muted">{t("sensors.validationIntro")}</p>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">{t("sensors.model")}</th>
              <th scope="col">{t("sensors.maeWeek")}</th>
              <th scope="col">{t("sensors.vsNaive")}</th>
              <th scope="col">{t("sensors.maeOff")}</th>
              <th scope="col">{t("sensors.totalErr")}</th>
              <th scope="col">{t("sensors.peakErr")}</th>
              <th scope="col">{t("sensors.direction")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.model} style={r.model === val.chosen_model ? { fontWeight: 700 } : undefined}>
                <th scope="row">{t(`sensors.models.${r.model}`)}</th>
                <td>{num1(r.mae_week)}</td>
                <td>{r.model === "naive" ? "—" : `${r.mae_vs_naive_pct > 0 ? "+" : ""}${num(r.mae_vs_naive_pct)}%`}</td>
                <td>{num1(r.mae_week_offseason)}</td>
                <td>{num1(r.abs_total_pct_err)}%</td>
                <td>{t("sensors.days", { n: num1(r.peak_week_err_days) })}</td>
                <td>{num(r.direction_match * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 className="mt-4 text-sm font-semibold">{t("sensors.perYear")}</h3>
      <div ref={ref}>
        <svg width={width} height={h} role="img" aria-label={t("sensors.perYear")}>
          {yS.ticks(4).map((v) => (
            <g key={v}>
              <line x1={mg.l} x2={width - mg.r} y1={yS(v)} y2={yS(v)} stroke="var(--grid)" />
              <text x={mg.l - 4} y={yS(v) + 4} fontSize={10} textAnchor="end" fill="var(--muted)">
                {num(v)}
              </text>
            </g>
          ))}
          {per.map((p) => (
            <g key={p.y}>
              <rect x={x(p.y)} y={yS(p.naive)} width={bw} height={yS(0) - yS(p.naive)} fill="var(--naive)" />
              <rect x={(x(p.y) ?? 0) + bw} y={yS(p.ours)} width={bw} height={yS(0) - yS(p.ours)} fill="var(--accent)" />
              <text x={(x(p.y) ?? 0) + bw} y={h - 6} fontSize={9} textAnchor="middle" fill="var(--muted)">
                {width < 500 ? `'${String(p.y).slice(2)}` : fy(p.y)}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="flex gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3" style={{ background: "var(--naive)" }} />
          {t("sensors.models.naive")}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3" style={{ background: "var(--accent)" }} />
          {t(`sensors.models.${val.chosen_model}`)}
        </span>
      </div>
      {nb2022 && <p className="mt-3 text-sm">{t("sensors.case2022", { pred: num(nb2022.total_pred), naive: num(nv2022?.total_pred ?? 0), true: num(nb2022.total_true) })}</p>}
    </section>
  );
}

function BridgeSection() {
  const { t, num, num1, num2, date, year: fy } = useFmt();
  const { data: b } = useAsync(loadBridge, []);
  if (!b) return null;
  const end = new Date(b.snpp_end_utc);
  const diff = (100 * (b.national_totals.noaa20 - b.national_totals.snpp)) / b.national_totals.snpp;
  const months = t("calendar.months").split(",");
  return (
    <section className="card p-3 sm:p-5" aria-labelledby="bridge-h">
      <h2 id="bridge-h" className="text-lg font-semibold">
        {t("sensors.bridgeTitle")}
      </h2>
      <p className="mt-1 text-sm">
        {t("sensors.bridgeIntro", {
          date: `${date(end)} ${fy(end.getUTCFullYear())}`,
          from: fy(b.overlap_years[0]),
          to: fy(b.overlap_years[1]),
          n20: num(b.national_totals.noaa20),
          snpp: num(b.national_totals.snpp),
          diff: num1(diff),
        })}
      </p>
      <div className="mt-3 grid grid-cols-4 gap-2 text-center text-sm sm:grid-cols-12">
        {Object.entries(b.noaa20_to_snpp_monthly).map(([m, f]) => (
          <div key={m} className="rounded-lg border border-grid p-1.5">
            <div className="text-xs text-muted">{months[Number(m) - 1]}</div>
            <div className="font-semibold">×{num2(f)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
