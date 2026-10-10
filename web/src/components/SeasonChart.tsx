import { scaleLinear } from "d3-scale";
import { area, line } from "d3-shape";
import { useMemo } from "react";
import { useFmt } from "../i18n";
import { byYear, cumulative, monthStartWeeks } from "../lib/series";
import type { RegionDoc } from "../lib/types";
import { useWidth } from "../lib/useWidth";
import { useTooltip } from "./Tooltip";

/** Cumulative activity this season against the normal range (p10–p90, p25–p75, median). */
export function SeasonChart({ doc, year, week }: { doc: RegionDoc; series?: "harm"; year: number; week: number }) {
  const { t, num, year: fy } = useFmt();
  const tip = useTooltip();
  const [ref, width] = useWidth<HTMLDivElement>();
  const height = 200;
  const m = { l: 44, r: 12, t: 10, b: 24 };
  const n = doc.normals;
  const cum = useMemo(() => cumulative(byYear(doc).get(year) ?? []), [doc, year]);
  const shown = cum.slice(0, week);
  const yMax = Math.max(1, ...n.p90.filter((v) => v != null), ...cum) * 1.05;
  const x = scaleLinear().domain([1, 53]).range([m.l, width - m.r]);
  const y = scaleLinear().domain([0, yMax]).range([height - m.b, m.t]).nice();
  const idx = Array.from({ length: n.p50.length }, (_, i) => i);
  const band = (lo: number[], hi: number[]) =>
    area<number>()
      .x((i) => x(i + 1))
      .y0((i) => y(lo[i] ?? 0))
      .y1((i) => y(hi[i] ?? 0))(idx) ?? "";
  const med = line<number>().x((i) => x(i + 1)).y((i) => y(n.p50[i] ?? 0))(idx) ?? "";
  const cur = line<number>().x((_, i) => x(i + 1)).y((v) => y(v))(shown) ?? "";
  const months = t("calendar.months").split(",");
  const mw = monthStartWeeks();

  return (
    <div ref={ref}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`${t("home.chartTitle")}: ${fy(year)}, ${num(shown[shown.length - 1] ?? 0)}`}
        onMouseLeave={() => tip.hide()}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const wi = Math.round(x.invert(e.clientX - r.left)) - 1;
          if (wi < 0 || wi >= idx.length) return;
          tip.show(
            e.clientX,
            e.clientY,
            <div>
              <div className="font-semibold">W{num(wi + 1)}</div>
              {shown[wi] !== undefined && (
                <div>
                  {t("home.thisYear")}: {num(shown[wi])}
                </div>
              )}
              <div>
                {t("home.median")}: {num(n.p50[wi] ?? 0)}
              </div>
              <div style={{ opacity: 0.8 }}>
                25–75%: {num(n.p25[wi] ?? 0)}–{num(n.p75[wi] ?? 0)}
              </div>
            </div>,
          );
        }}
      >
        {y.ticks(4).map((v) => (
          <g key={v}>
            <line x1={m.l} x2={width - m.r} y1={y(v)} y2={y(v)} stroke="var(--grid)" />
            <text x={m.l - 6} y={y(v) + 4} fontSize={10} textAnchor="end" fill="var(--muted)">
              {num(v)}
            </text>
          </g>
        ))}
        {mw.map((w, i) =>
          i % (width < 420 ? 2 : 1) === 0 ? (
            <text key={i} x={x(w)} y={height - 6} fontSize={10} fill="var(--muted)">
              {months[i]}
            </text>
          ) : null,
        )}
        <path d={band(n.p10, n.p90)} fill="var(--band)" opacity={0.55} />
        <path d={band(n.p25, n.p75)} fill="var(--band)" />
        <path d={med} fill="none" stroke="var(--muted)" strokeDasharray="4 3" strokeWidth={1.5} />
        <path d={cur} fill="none" stroke="var(--accent)" strokeWidth={2.5} />
        {shown.length > 0 && <circle cx={x(shown.length)} cy={y(shown[shown.length - 1])} r={4} fill="var(--accent)" />}
      </svg>
      {doc.rain?.[String(year)] && <RainStrip rain={doc.rain[String(year)]} week={week} width={width} x={x} />}
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {doc.rain?.[String(year)] && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-1.5" style={{ background: "#3f7f9f" }} />
            {t("home.rain")}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4" style={{ background: "var(--accent)" }} />
          {t("home.thisYear")} ({fy(year)})
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0 w-4 border-t-2 border-dashed" style={{ borderColor: "var(--muted)" }} />
          {t("home.median")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-4" style={{ background: "var(--band)" }} />
          {t("home.normalBand")}
        </span>
      </div>
    </div>
  );
}

/** Weekly rainfall (NASA POWER) under the season chart: dry spells before big fire weeks show as gaps. */
function RainStrip({ rain, week, width, x }: { rain: (number | null)[]; week: number; width: number; x: (v: number) => number }) {
  const { t, num } = useFmt();
  const tip = useTooltip();
  const h = 46;
  const max = Math.max(60, ...rain.map((v) => v ?? 0));
  const bw = Math.max(1, (x(2) - x(1)) * 0.7);
  return (
    <svg width={width} height={h} role="img" aria-label={t("home.rain")} onMouseLeave={() => tip.hide()}>
      {rain.map((v, i) =>
        v === null ? null : (
          <rect
            key={i}
            x={x(i + 1) - bw / 2}
            y={h - 14 - ((h - 16) * v) / max}
            width={bw}
            height={((h - 16) * v) / max}
            fill="#3f7f9f"
            opacity={i + 1 <= week ? 0.85 : 0.3}
            onMouseMove={(e) => tip.show(e.clientX, e.clientY, <div>W{num(i + 1)}: {num(v)} mm</div>)}
          />
        ),
      )}
      <line x1={x(1)} x2={x(53)} y1={h - 14} y2={h - 14} stroke="var(--grid)" />
      <text x={x(1)} y={h - 2} fontSize={10} fill="var(--muted)">
        {t("home.rainAxis", { mm: num(max) })}
      </text>
    </svg>
  );
}
