import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useFmt } from "../i18n";
import { byYear, handoverWeek, isoWeekStart, monthStartWeeks, rampColor, rampThresholds, RAMP } from "../lib/series";
import type { RegionDoc } from "../lib/types";
import { useTooltip } from "./Tooltip";
import { WeekTip } from "./WeekCell";

interface Props {
  doc: RegionDoc;
  series?: "harm"; // component contract: charts take the region doc + a series prop
  years?: number[]; // rows to draw (default: all, newest at the bottom)
  highlightYear?: number;
  onSelectYear?: (y: number) => void;
  onSelectWeek?: (y: number, w: number) => void;
  markWeek?: number; // outline this week in the highlighted year
  cell?: number;
  showTotals?: boolean;
  label?: string;
}

const GAP = 1;

export function CalendarHeatmap({ doc, years, highlightYear, onSelectYear, onSelectWeek, markWeek, cell, showTotals = true, label }: Props) {
  const { t, num, year: fy } = useFmt();
  const tip = useTooltip();
  const svgRef = useRef<SVGSVGElement>(null);
  const gridId = useId().replace(/:/g, "");
  const grid = useMemo(() => byYear(doc), [doc]);
  const th = useMemo(() => rampThresholds(doc), [doc]);
  const rows = years ?? [...grid.keys()].sort((a, b) => a - b);
  const narrow = typeof window !== "undefined" && window.innerWidth < 640;
  const c = cell ?? (narrow ? 10 : 14);
  const step = c + GAP;
  const left = 44;
  const top = 18;
  const totW = showTotals ? 64 : 0;
  const width = left + 53 * step + totW + 4;
  const height = top + rows.length * step + 4;
  const mWeeks = monthStartWeeks();
  const months = t("calendar.months").split(",");
  const ho = handoverWeek(doc);
  const totals = rows.map((y) => (grid.get(y) ?? []).reduce((s, w) => s + (w?.harm ?? 0), 0));
  const maxTot = Math.max(1, ...totals);
  const [focus, setFocus] = useState<[number, number]>([rows.length - 1, (markWeek ?? 1) - 1]);
  useEffect(()=>{setFocus([Math.max(0,rows.indexOf(highlightYear??rows[rows.length-1])),Math.max(0,Math.min(52,(markWeek??1)-1))])},[doc,highlightYear,markWeek]);

  const showTipFor = (ri: number, wi: number) => {
    const el = svgRef.current?.querySelector<SVGRectElement>(`[data-k="${ri}-${wi}"]`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const y = rows[ri];
    tip.show(r.right, r.bottom, <WeekTip wk={grid.get(y)?.[wi]} y={y} w={wi + 1} />);
  };

  const onKey = (e: KeyboardEvent) => {
    let [ri, wi] = focus;
    if (e.key === "ArrowRight") wi = Math.min(52, wi + 1);
    else if (e.key === "ArrowLeft") wi = Math.max(0, wi - 1);
    else if (e.key === "ArrowDown") ri = Math.min(rows.length - 1, ri + 1);
    else if (e.key === "ArrowUp") ri = Math.max(0, ri - 1);
    else if (e.key === "Enter" || e.key === " ") {
      if(onSelectWeek) onSelectWeek(rows[ri], wi + 1); else onSelectYear?.(rows[ri]);
      e.preventDefault();
      return;
    } else if (e.key === "Escape") {
      tip.hide();
      return;
    } else return;
    e.preventDefault();
    setFocus([ri, wi]);
    requestAnimationFrame(() => showTipFor(ri, wi));
  };

  return (
    <div tabIndex={0} className="overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        role="grid"
        aria-rowcount={rows.length}
        aria-colcount={53}
        aria-activedescendant={grid.get(rows[focus[0]])?.[focus[1]] ? `${gridId}-${focus[0]}-${focus[1]}` : undefined}
        aria-label={label ?? t("calendar.title")}
        tabIndex={0}
        onKeyDown={onKey}
        onFocus={() => showTipFor(focus[0], focus[1])}
        onBlur={() => tip.hide()}
        onMouseLeave={() => tip.hide()}
        style={{ display: "block" }}
      >
        {/* month labels */}
        {mWeeks.map((w, i) => (
          <text key={i} x={left + (w - 1) * step} y={11} fontSize={10} fill="var(--muted)">
            {months[i]}
          </text>
        ))}
        {rows.map((y, ri) => {
          const weeks = grid.get(y) ?? [];
          const est = weeks.some((w) => w?.src === "estimated" && w.harm > 0) && y < 2012;
          const hl = highlightYear === y;
          const ry = top + ri * step;
          return (
            <g key={y} role="row" aria-rowindex={ri + 1}>
              <text
                x={left - 6}
                y={ry + c - 1}
                fontSize={Math.min(11, c)}
                textAnchor="end"
                fill={hl ? "var(--ink)" : "var(--muted)"}
                fontWeight={hl ? 700 : 400}
                style={{ cursor: onSelectYear ? "pointer" : "default" }}
                onClick={() => onSelectYear?.(y)}
              >
                {est ? "≈" : ""}
                {fy(y)}
              </text>
              {weeks.map((wk, wi) =>
                wk ? (
                  <rect
                    key={wi}
                    data-k={`${ri}-${wi}`}
                    id={`${gridId}-${ri}-${wi}`}
                    role="gridcell"
                    aria-colindex={wi + 1}
                    aria-selected={hl && markWeek === wi + 1}
                    aria-label={`${fy(y)} W${wi + 1}: ${num(wk.harm)}`}
                    x={left + wi * step}
                    y={ry}
                    width={c}
                    height={c}
                    rx={2.5}
                    fill={rampColor(wk.harm, th)}
                    opacity={highlightYear && !hl ? 0.55 : 1}
                    stroke={focus[0] === ri && focus[1] === wi ? "var(--ink)" : "none"}
                    strokeWidth={1.5}
                    onMouseEnter={(e) => tip.show(e.clientX, e.clientY, <WeekTip wk={wk} y={y} w={wi + 1} />)}
                    onMouseMove={(e) => tip.show(e.clientX, e.clientY, <WeekTip wk={wk} y={y} w={wi + 1} />)}
                    onClick={() => {
                      setFocus([ri, wi]);
                      if(onSelectWeek) onSelectWeek(y, wi + 1); else onSelectYear?.(y);
                    }}
                  />
                ) : null,
              )}
              {hl && (
                <rect
                  x={left - 1.5}
                  y={ry - 1.5}
                  width={53 * step + 2}
                  height={c + 3}
                  fill="none"
                  stroke="var(--ink)"
                  strokeWidth={1.5}
                  rx={3}
                  pointerEvents="none"
                />
              )}
              {hl && markWeek && weeks[markWeek - 1] && (
                <rect
                  x={left + (markWeek - 1) * step - 1}
                  y={ry - 1}
                  width={c + 2}
                  height={c + 2}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  pointerEvents="none"
                />
              )}
              {y === ho.y && (
                <g pointerEvents="none">
                  <line x1={left + (ho.w - 1) * step - 1} x2={left + (ho.w - 1) * step - 1} y1={ry - 3} y2={ry + c + 3} stroke="var(--ink)" strokeWidth={2} />
                </g>
              )}
              {showTotals && (
                <g>
                  <rect
                    x={left + 53 * step + 6}
                    y={ry + 1}
                    height={c - 2}
                    width={Math.max(1, ((totW - 12) * totals[ri]) / maxTot)}
                    fill={hl ? "var(--accent)" : "var(--muted)"}
                    opacity={0.6}
                  />
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function CalendarLegend({ doc }: { doc: RegionDoc }) {
  const { t, num } = useFmt();
  const th = rampThresholds(doc);
  const ho = handoverWeek(doc);
  const hasHandover = doc.weeks.some((w) => w.y === ho.y);
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-sm" style={{ background: "var(--zero)", border: "1px solid var(--grid)" }} />
        {t("calendar.none")}
      </span>
      <span className="inline-flex items-center gap-1">
        {t("calendar.legendLow")}
        {RAMP.map((c, i) => (
          <span
            key={i}
            title={i === 0 ? `< ${num(th[0])}` : i < th.length ? `${num(th[i - 1])}–${num(th[i])}` : `≥ ${num(th[th.length - 1])}`}
            className="inline-block h-3 w-4 rounded-sm"
            style={{ background: c }}
          />
        ))}
        {t("calendar.legendHigh")}
      </span>
      <span>≈ {t("calendar.estimated")}</span>
      {doc.weeks.some((w) => w.y < 2003) && <span>{t("calendar.terra")}</span>}
      {hasHandover && (
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-0.5" style={{ background: "var(--ink)" }} /> {t("calendar.handover")}
        </span>
      )}
    </div>
  );
}

/** Accessible table version: year rows, month columns (sum of weeks starting that month). */
export function CalendarTable({ doc }: { doc: RegionDoc }) {
  const { t, num, year } = useFmt();
  const months = t("calendar.months").split(",");
  const rows = [...byYear(doc).entries()].sort((a, b) => a[0] - b[0]);
  return (
    <div tabIndex={0} className="overflow-x-auto">
      <table className="data-table">
        <caption className="sr-only">{t("calendar.title")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("map.year")}</th>
            {months.map((m) => (
              <th key={m} scope="col">
                {m}
              </th>
            ))}
            <th scope="col">{t("calendar.total")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([y, weeks]) => {
            const byM = new Array(12).fill(0);
            weeks.forEach((wk, wi) => {
              if (wk) byM[isoWeekStart(y, wi + 1).getUTCMonth()] += wk.harm;
            });
            return (
              <tr key={y}>
                <th scope="row">
                  {y < 2012 ? "≈" : ""}
                  {year(y)}
                </th>
                {byM.map((v, i) => (
                  <td key={i}>{num(v)}</td>
                ))}
                <td className="font-semibold">{num(byM.reduce((a, b) => a + b, 0))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
