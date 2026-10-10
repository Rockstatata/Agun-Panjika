import { scaleLinear } from "d3-scale";
import { area, line } from "d3-shape";
import { useState } from "react";
import { useFmt } from "../i18n";
import type { AnnualRow, SeriesKey } from "../lib/series";
import { useWidth } from "../lib/useWidth";
import { useTooltip } from "./Tooltip";

export const SERIES_STYLE: Record<SeriesKey, { color: string; dash?: string; width: number }> = {
  modis: { color: "var(--modis)", width: 2 },
  viirs: { color: "var(--viirs)", width: 2 },
  naive: { color: "var(--naive)", dash: "5 4", width: 2 },
  harm: { color: "var(--accent)", width: 3 },
};

interface Props {
  rows: AnnualRow[];
  series: SeriesKey[];
  labels: Record<SeriesKey, string>;
  from: number;
  to: number;
  marker?: { year: number; label: string };
}

/** Annual totals for the selected series; the harmonised series carries its 80% band. */
export function AnnualChart({ rows, series, labels, from, to, marker }: Props) {
  const { num, year: fy, lang } = useFmt();
  const [activeYear,setActiveYear] = useState<number | null>(null);
  const tip = useTooltip();
  const [ref, width] = useWidth<HTMLDivElement>();
  const height = width < 500 ? 240 : 300;
  const m = { l: 52, r: 14, t: 14, b: 26 };
  const data = rows.filter((r) => r.y >= from && r.y <= to);
  const vals = data.flatMap((r) => series.flatMap((k) => (k === "harm" ? [r.hi] : r[k] !== undefined ? [r[k] as number] : [])));
  const x = scaleLinear().domain([from, Math.max(to, from + 1)]).range([m.l, width - m.r]);
  const y = scaleLinear().domain([0, Math.max(1, ...vals) * 1.05]).range([height - m.b, m.t]).nice();
  const path = (k: SeriesKey) =>
    line<AnnualRow>()
      .defined((r) => r[k] !== undefined)
      .x((r) => x(r.y))
      .y((r) => y(r[k] as number))(data) ?? "";
  const band =
    area<AnnualRow>()
      .defined((r) => r.src !== "observed")
      .x((r) => x(r.y))
      .y0((r) => y(r.lo))
      .y1((r) => y(r.hi))(data) ?? "";
  const step = Math.ceil((to - from + 1) / (width < 500 ? 6 : 12));
  const ticks = data.filter((r) => (r.y - from) % step === 0).map((r) => r.y);

  return (
    <div ref={ref}>
      <svg
        width={width}
        height={height}
        role="img"
        tabIndex={0}
        onKeyDown={e=>{
          if(e.key==='Escape'){tip.hide();setActiveYear(null);return}
          if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;
          e.preventDefault();const i=Math.max(0,data.findIndex(d=>d.y===(activeYear??from)));const row=data[Math.max(0,Math.min(data.length-1,i+(e.key==='ArrowRight'?1:-1)))];
          if(!row)return;setActiveYear(row.y);const r=e.currentTarget.getBoundingClientRect();
          tip.show(r.left+x(row.y),r.top+m.t,<div><strong>{fy(row.y)}</strong>{series.map(k=><div key={k}>{labels[k]}: {row[k]===undefined?'—':num(row[k] as number)}{k==='harm'&&row.src!=='observed'?` (${num(row.lo)}–${num(row.hi)})`:''}</div>)}</div>);
        }}
        onBlur={()=>{tip.hide();setActiveYear(null)}}
        aria-label={series.map((k) => labels[k]).join(", ")}
        onMouseLeave={() => tip.hide()}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const yr = Math.round(x.invert(e.clientX - r.left));
          const row = data.find((d) => d.y === yr);
          if (!row) return;
          setActiveYear(row.y);
          tip.show(
            e.clientX,
            e.clientY,
            <div>
              <div className="font-semibold">{fy(row.y)}</div>
              {series.map((k) =>
                row[k] !== undefined ? (
                  <div key={k}>
                    {labels[k]}: {num(row[k] as number)}
                    {k === "harm" && row.src !== "observed" && ` (${num(row.lo)}–${num(row.hi)})`}
                  </div>
                ) : null,
              )}
            </div>,
          );
        }}
      >
        {y.ticks(5).map((v) => (
          <g key={v}>
            <line x1={m.l} x2={width - m.r} y1={y(v)} y2={y(v)} stroke="var(--grid)" />
            <text x={m.l - 6} y={y(v) + 4} fontSize={11} textAnchor="end" fill="var(--muted)">
              {num(v)}
            </text>
          </g>
        ))}
        {ticks.map((v) => (
          <text key={v} x={x(v)} y={height - 6} fontSize={11} textAnchor="middle" fill="var(--muted)">
            {fy(v)}
          </text>
        ))}
        {from <= 2012 && to >= 2012 && (
          <g>
            <line x1={x(2011.5)} x2={x(2011.5)} y1={m.t} y2={height - m.b} stroke="var(--grid)" strokeWidth={2} strokeDasharray="2 3" />
            <text x={x(2011.5) + 4} y={m.t + 10} fontSize={10} fill="var(--muted)">
              VIIRS →
            </text>
          </g>
        )}
        {marker && marker.year >= from && marker.year <= to + 1 && (
          <g>
            <line x1={x(marker.year)} x2={x(marker.year)} y1={m.t} y2={height - m.b} stroke="var(--ink)" strokeWidth={1.5} />
            <text x={x(marker.year) - 4} y={m.t + 10} fontSize={10} textAnchor="end" fill="var(--ink)">
              {marker.label}
            </text>
          </g>
        )}
        {series.includes("harm") && <path d={band} fill="var(--band)" />}
        {activeYear!==null && <line x1={x(activeYear)} x2={x(activeYear)} y1={m.t} y2={height-m.b} stroke="var(--muted)" strokeDasharray="3 4" pointerEvents="none"/>}
        {series.map((k) => (
          <path key={k} d={path(k)} fill="none" stroke={SERIES_STYLE[k].color} strokeWidth={SERIES_STYLE[k].width} strokeDasharray={SERIES_STYLE[k].dash} />
        ))}
        {series.map((k) =>
          data.map((r) =>
            r[k] !== undefined ? (
              <circle key={`${k}${r.y}`} cx={x(r.y)} cy={y(r[k] as number)} r={k === "harm" ? 3 : 2.2} fill={SERIES_STYLE[k].color} />
            ) : null,
          ),
        )}
      </svg>
      <div className="chart-provenance"><span>≈ {lang==='bn'?'অনুমান ও ৮০% অনিশ্চয়তা':'Estimates and 80% uncertainty'}</span><span>{lang==='bn'?'তীরচিহ্নে বছর দেখুন':'Use arrow keys to inspect years'}</span></div>
      <details className="mt-3"><summary className="text-sm text-muted cursor-pointer">{lang==='bn'?'বার্ষিক তথ্য সারণি':'Annual data table'}</summary><div className="overflow-x-auto"><table className="data-table"><thead><tr><th scope="col">{lang==='bn'?'বছর':'Year'}</th>{series.map(k=><th scope="col" key={k}>{labels[k]}</th>)}<th scope="col">{lang==='bn'?'উৎস':'Source'}</th></tr></thead><tbody>{data.map(r=><tr key={r.y}><th scope="row">{fy(r.y)}</th>{series.map(k=><td key={k}>{r[k]===undefined?'—':num(r[k] as number)}</td>)}<td>{r.src==='observed'?(lang==='bn'?'পর্যবেক্ষিত':'Observed'):(lang==='bn'?'অনুমান/সমন্বিত':'Estimated/bridged')}</td></tr>)}</tbody></table></div></details>
    </div>
  );
}
