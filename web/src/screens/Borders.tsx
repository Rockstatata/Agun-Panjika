import { RequestStatus } from "../components/RequestStatus";
import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import { useMemo, useState } from "react";
import { useTooltip } from "../components/Tooltip";
import { useFmt } from "../i18n";
import { loadNeighbours, useAsync } from "../lib/data";
import { monthStartWeeks } from "../lib/series";
import type { NeighboursDoc } from "../lib/types";
import { useWidth } from "../lib/useWidth";

const COLORS = ["var(--accent)", "#3f7f9f", "#7a8f3a", "#8a5aa8", "#b08a2e"];

export function Borders() {
  const { t } = useFmt();
  const { data, error,loading,retry } = useAsync(loadNeighbours, []);
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{t("borders.title")}</h1>
        <p className="mt-1 max-w-2xl text-muted">{t("borders.intro")}</p>
      </div>
      <RequestStatus error={error} loading={loading} retry={retry}/>
      {data && <Hills doc={data} />}
      {data && <Upwind doc={data} />}
    </div>
  );
}

function annualOf(weeks: [number, number, number, string][]) {
  const m = new Map<number, { v: number; est: boolean; n: number }>();
  for (const [y, , v, s] of weeks) {
    const r = m.get(y) ?? { v: 0, est: false, n: 0 };
    r.v += v;
    r.n += 1;
    r.est ||= s === "e";
    m.set(y, r);
  }
  return [...m.entries()].filter(([, r]) => r.n >= 52).map(([y, r]) => ({ y, ...r })).sort((a, b) => a.y - b.y);
}

function Hills({ doc }: { doc: NeighboursDoc }) {
  const { t, num, year: fy, lang } = useFmt();
  const tip = useTooltip();
  const [ref, width] = useWidth<HTMLDivElement>();
  const units = ["cht", "mizoram", "tripura", "chin"].filter((u) => doc.units[u]);
  const series = units.map((u) => ({ u, rows: annualOf(doc.units[u].weeks) }));
  const all = series.flatMap((s) => s.rows);
  if (!all.length) return null;
  const height = 280;
  const m = { l: 52, r: 12, t: 12, b: 26 };
  const y0 = Math.min(...all.map((r) => r.y));
  const y1 = Math.max(...all.map((r) => r.y));
  const x = scaleLinear().domain([y0, y1]).range([m.l, width - m.r]);
  const y = scaleLinear().domain([0, Math.max(...all.map((r) => r.v)) * 1.05]).range([height - m.b, m.t]).nice();
  const nm = (u: string) => (lang === "bn" ? doc.units[u].name_bn : doc.units[u].name_en);
  return (
    <section className="card p-3 sm:p-5" aria-labelledby="hills-h">
      <h2 id="hills-h" className="text-lg font-semibold">
        {t("borders.hills")}
      </h2>
      <p className="mb-2 text-sm text-muted">{t("borders.hillsIntro")}</p>
      <div ref={ref}>
        <svg width={width} height={height} role="img" aria-label={t("borders.perYear")} onMouseLeave={() => tip.hide()}
          onMouseMove={(e) => {
            const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const yr = Math.round(x.invert(e.clientX - r.left));
            tip.show(e.clientX, e.clientY, (
              <div>
                <div className="font-semibold">{fy(yr)}</div>
                {series.map((s) => {
                  const row = s.rows.find((q) => q.y === yr);
                  return row ? <div key={s.u}>{nm(s.u)}: {row.est ? "≈" : ""}{num(row.v)}</div> : null;
                })}
              </div>
            ));
          }}>
          {y.ticks(5).map((v) => (
            <g key={v}>
              <line x1={m.l} x2={width - m.r} y1={y(v)} y2={y(v)} stroke="var(--grid)" />
              <text x={m.l - 6} y={y(v) + 4} fontSize={10} textAnchor="end" fill="var(--muted)">{num(v)}</text>
            </g>
          ))}
          {x.ticks(width < 500 ? 5 : 10).map((v) => (
            <text key={v} x={x(v)} y={height - 6} fontSize={10} textAnchor="middle" fill="var(--muted)">{fy(v)}</text>
          ))}
          <line x1={x(2011.5)} x2={x(2011.5)} y1={m.t} y2={height - m.b} stroke="var(--grid)" strokeDasharray="2 3" strokeWidth={2} />
          {series.map((s, i) => (
            <g key={s.u}>
              <path d={line<(typeof s.rows)[number]>().x((r) => x(r.y)).y((r) => y(r.v))(s.rows.filter((r) => r.y <= 2012)) ?? ""}
                fill="none" stroke={COLORS[i]} strokeWidth={2} strokeDasharray="4 3" />
              <path d={line<(typeof s.rows)[number]>().x((r) => x(r.y)).y((r) => y(r.v))(s.rows.filter((r) => r.y >= 2012)) ?? ""}
                fill="none" stroke={COLORS[i]} strokeWidth={s.u === "cht" ? 3 : 2} />
            </g>
          ))}
        </svg>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {series.map((s, i) => (
          <span key={s.u} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-1 w-4 rounded" style={{ background: COLORS[i] }} />
            {nm(s.u)}
          </span>
        ))}
        <span>- - - ≈ MODIS</span>
      </div>
    </section>
  );
}

function Upwind({ doc }: { doc: NeighboursDoc }) {
  const { t, num, num2, year: fy, lang } = useFmt();
  const tip = useTooltip();
  const [ref, width] = useWidth<HTMLDivElement>();
  const units = Object.keys(doc.units).filter((u) => doc.units[u].area === "igp");
  const years = useMemo(() => {
    const ys = new Set<number>();
    units.forEach((u) => doc.units[u].weeks.forEach(([y]) => ys.add(y)));
    return [...ys].filter((y) => y >= 2012).sort((a, b) => a - b);
  }, [doc, units]);
  const [yr, setYr] = useState<number | null>(null);
  const year = yr ?? years[years.length - 2] ?? years[years.length - 1];
  if (!units.length || !year) return null;
  const weekly = units.map((u) => {
    const arr = new Array(53).fill(null) as (number | null)[];
    doc.units[u].weeks.forEach(([y, w, v]) => {
      if (y === year) arr[w - 1] = v;
    });
    return { u, arr };
  });
  const total = new Array(53).fill(0).map((_, i) => weekly.reduce((s, q) => s + (q.arr[i] ?? 0), 0));
  const aod = new Array(53).fill(null) as (number | null)[];
  (doc.dhaka_aod ?? []).forEach(([y, w, v]) => {
    if (y === year) aod[w - 1] = v;
  });
  const height = 260;
  const m = { l: 52, r: 40, t: 12, b: 26 };
  const x = scaleLinear().domain([1, 53]).range([m.l, width - m.r]);
  const yL = scaleLinear().domain([0, Math.max(1, ...total) * 1.05]).range([height - m.b, m.t]).nice();
  const yR = scaleLinear().domain([0, Math.max(1.5, ...aod.map((v) => v ?? 0)) * 1.05]).range([height - m.b, m.t]).nice();
  const months = t("calendar.months").split(",");
  const nm = (u: string) => (lang === "bn" ? doc.units[u].name_bn : doc.units[u].name_en);
  const idx = Array.from({ length: 53 }, (_, i) => i);
  return (
    <section className="card p-3 sm:p-5" aria-labelledby="igp-h">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="igp-h" className="text-lg font-semibold">{t("borders.igp")}</h2>
          <p className="text-sm text-muted">{t("borders.igpIntro")}</p>
        </div>
        <label className="flex flex-col gap-1">
          <span className="eyebrow">{t("borders.year")}</span>
          <select className="select" value={year} onChange={(e) => setYr(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{fy(y)}</option>)}
          </select>
        </label>
      </div>
      <div ref={ref} className="mt-2">
        <svg width={width} height={height} role="img" aria-label={t("borders.weekly")} onMouseLeave={() => tip.hide()}
          onMouseMove={(e) => {
            const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const wi = Math.round(x.invert(e.clientX - r.left)) - 1;
            if (wi < 0 || wi > 52) return;
            tip.show(e.clientX, e.clientY, (
              <div>
                <div className="font-semibold">W{num(wi + 1)} {fy(year)}</div>
                {weekly.map((q) => q.arr[wi] !== null ? <div key={q.u}>{nm(q.u)}: {num(q.arr[wi] ?? 0)}</div> : null)}
                {aod[wi] !== null && <div>AOD: {num2(aod[wi] ?? 0)}</div>}
              </div>
            ));
          }}>
          {yL.ticks(4).map((v) => (
            <g key={v}>
              <line x1={m.l} x2={width - m.r} y1={yL(v)} y2={yL(v)} stroke="var(--grid)" />
              <text x={m.l - 6} y={yL(v) + 4} fontSize={10} textAnchor="end" fill="var(--muted)">{num(v)}</text>
            </g>
          ))}
          {yR.ticks(4).map((v) => (
            <text key={v} x={width - m.r + 6} y={yR(v) + 4} fontSize={10} fill="#3f7f9f">{v.toFixed(1)}</text>
          ))}
          {monthStartWeeks().map((w, i) => (i % (width < 500 ? 2 : 1) === 0 ? (
            <text key={i} x={x(w)} y={height - 6} fontSize={10} fill="var(--muted)">{months[i]}</text>
          ) : null))}
          {weekly.map((q, i) => (
            <path key={q.u} d={line<number>().defined((wi) => q.arr[wi] !== null).x((wi) => x(wi + 1)).y((wi) => yL(q.arr[wi] ?? 0))(idx) ?? ""}
              fill="none" stroke={COLORS[(i + 1) % COLORS.length]} strokeWidth={2} />
          ))}
          <path d={line<number>().defined((wi) => aod[wi] !== null).x((wi) => x(wi + 1)).y((wi) => yR(aod[wi] ?? 0))(idx) ?? ""}
            fill="none" stroke="#3f7f9f" strokeWidth={1.5} strokeDasharray="3 2" />
        </svg>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {weekly.map((q, i) => (
          <span key={q.u} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-1 w-4 rounded" style={{ background: COLORS[(i + 1) % COLORS.length] }} />
            {nm(q.u)}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0 w-4 border-t-2 border-dashed" style={{ borderColor: "#3f7f9f" }} />
          {t("borders.aod")}
        </span>
      </div>
      <p className="mt-2 text-xs text-muted">{t("borders.caution")}</p>
    </section>
  );
}
