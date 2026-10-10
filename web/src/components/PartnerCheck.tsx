import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import { useFmt } from "../i18n";
import type { PartnerDoc } from "../lib/types";
import { useWidth } from "../lib/useWidth";
import { useTooltip } from "./Tooltip";

/** Annual burned area (ESA) against our harmonised record and the raw stitched record, each scaled to its own 2012-2024 mean. */
export function PartnerCheck({ doc }: { doc: PartnerDoc }) {
  const { t, num, num2, year: fy } = useFmt();
  const tip = useTooltip();
  const [ref, width] = useWidth<HTMLDivElement>();
  const rows = doc.annual;
  const norm = (k: "ba_km2" | "harm" | "stitched") => {
    const base = rows.filter((r) => r.y >= 2012);
    const mean = base.reduce((s, r) => s + r[k], 0) / Math.max(base.length, 1);
    return rows.map((r) => ({ y: r.y, v: r[k] / mean }));
  };
  const S = { ba: norm("ba_km2"), harm: norm("harm"), stitched: norm("stitched") };
  const height = 240;
  const m = { l: 40, r: 12, t: 12, b: 26 };
  const x = scaleLinear()
    .domain([rows[0].y, rows[rows.length - 1].y])
    .range([m.l, width - m.r]);
  const y = scaleLinear()
    .domain([0, Math.max(...Object.values(S).flat().map((r) => r.v)) * 1.05])
    .range([height - m.b, m.t])
    .nice();
  const ln = (a: { y: number; v: number }[]) =>
    line<{ y: number; v: number }>()
      .x((r) => x(r.y))
      .y((r) => y(r.v))(a) ?? "";
  const items = [
    { k: "ba", label: "ESA burned area", color: "#3f7f9f", dash: undefined, w: 2.5 },
    { k: "harm", label: t("method2.jumpH"), color: "var(--accent)", dash: undefined, w: 2.5 },
    { k: "stitched", label: t("method2.jumpS"), color: "var(--naive)", dash: "5 4", w: 2 },
  ] as const;
  return (
    <section className="card p-4 sm:p-6">
      <h2 className="text-lg font-semibold">{t("method2.partner")}</h2>
      <p className="mt-1 text-sm">{t("method2.partnerIntro")}</p>
      <div className="mt-3 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
        <Stat label={`${t("method2.jump")}: ${t("method2.jumpH")}`} value={`×${num2(doc.jump_2012.harmonised)}`} good />
        <Stat label={`${t("method2.jump")}: ${t("method2.jumpS")}`} value={`×${num2(doc.jump_2012.stitched)}`} />
        <Stat label={`${t("method2.corr")} ${t("method2.corrEst")}`} value={num2(doc.corr_log_annual_estimated_years)} good />
        <Stat label={t("method2.seasonal")} value={num2(doc.corr_seasonal_cycle)} good />
      </div>
      <div ref={ref} className="mt-3">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={t("method2.partner")}
          onMouseLeave={() => tip.hide()}
          onMouseMove={(e) => {
            const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const yr = Math.round(x.invert(e.clientX - r.left));
            const row = rows.find((q) => q.y === yr);
            if (!row) return;
            tip.show(
              e.clientX,
              e.clientY,
              <div>
                <div className="font-semibold">{fy(yr)}</div>
                <div>ESA: {num(row.ba_km2)} km²</div>
                <div>
                  {t("method2.jumpH")}: {num(row.harm)}
                </div>
                <div>
                  {t("method2.jumpS")}: {num(row.stitched)}
                </div>
              </div>,
            );
          }}
        >
          {y.ticks(4).map((v) => (
            <g key={v}>
              <line x1={m.l} x2={width - m.r} y1={y(v)} y2={y(v)} stroke="var(--grid)" />
              <text x={m.l - 6} y={y(v) + 4} fontSize={10} textAnchor="end" fill="var(--muted)">
                {v.toFixed(1)}
              </text>
            </g>
          ))}
          {x.ticks(width < 500 ? 5 : 10).map((v) => (
            <text key={v} x={x(v)} y={height - 6} fontSize={10} textAnchor="middle" fill="var(--muted)">
              {fy(v)}
            </text>
          ))}
          <line x1={x(2011.5)} x2={x(2011.5)} y1={m.t} y2={height - m.b} stroke="var(--grid)" strokeWidth={2} strokeDasharray="2 3" />
          {items.map((it) => (
            <path key={it.k} d={ln(S[it.k])} fill="none" stroke={it.color} strokeWidth={it.w} strokeDasharray={it.dash} />
          ))}
        </svg>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {items.map((it) => (
          <span key={it.k} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-1 w-4 rounded" style={{ background: it.color }} />
            {it.label}
          </span>
        ))}
        <span>(÷ 2012–2024 mean)</span>
      </div>
    </section>
  );
}

function Stat({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="rounded-lg border border-grid p-2">
      <div className="text-xl font-bold" style={{ color: good ? "var(--accent)" : "var(--muted)" }}>
        {value}
      </div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
