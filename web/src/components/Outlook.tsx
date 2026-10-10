import { scaleLinear, scaleTime } from "d3-scale";
import { area, line } from "d3-shape";
import { useFmt } from "../i18n";
import type { Alert, DangerClass, FireWeatherDoc, Outlook, OutlookLevel } from "../lib/types";
import { useWidth } from "../lib/useWidth";
import { useTooltip } from "./Tooltip";

export const OUTLOOK_COLOR: Record<OutlookLevel, string> = {
  low: "var(--level-below)",
  normal: "var(--level-normal)",
  elevated: "var(--level-above)",
  high: "var(--level-extreme)",
};

export const DANGER_COLOR: Record<DangerClass, string> = {
  low: "#6a9f6a",
  moderate: "#d9b23c",
  high: "#e8822f",
  very_high: "#c8401a",
  extreme: "#7a1d0c",
};

/** An outlook is only meaningful when the normal for the fortnight is more than a handful of fires. */
export const outlookMeaningful = (o?: Outlook) => !!o?.active && (o.normal_q75 ?? 0) >= 10;

export function OutlookCard({ o, name, compact = false }: { o?: Outlook; name: string; compact?: boolean }) {
  const { t, num, num1, year } = useFmt();
  if (!o || !o.active) return null;
  const meaningful = outlookMeaningful(o);
  const p = Math.round((o.p_above ?? 0) * 100);
  const lvl = o.level ?? "normal";
  return (
    <div className={`card flex flex-col gap-2 ${compact ? "p-3" : "p-4"}`} style={{ borderLeft: `5px solid ${meaningful ? OUTLOOK_COLOR[lvl] : "var(--grid)"}` }}>
      <div className="flex items-baseline justify-between gap-2">
        <div className="eyebrow">
          {name} · {t("outlook.twoWeek")}
        </div>
        {meaningful && (
          <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ color: OUTLOOK_COLOR[lvl], border: `1.5px solid ${OUTLOOK_COLOR[lvl]}` }}>
            {t(`outlook.levels.${lvl}`)}
          </span>
        )}
      </div>
      {meaningful ? (
        <>
          <div className="text-lg font-semibold leading-snug">{t("outlook.chance", { p: num(p) })}</div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--zero)]" role="img" aria-label={`${p}%`}>
            <div className="h-full rounded-full" style={{ width: `${p}%`, background: OUTLOOK_COLOR[lvl] }} />
          </div>
          <div className="text-sm text-muted">
            {t("outlook.expected", { n: num(o.expected ?? 0), lo: num(o.lo80 ?? 0), hi: num(o.hi80 ?? 0) })}
            <br />
            {t("outlook.normalIs", { n: num(o.normal_median ?? 0) })}
          </div>
          {!compact && o.drivers && (
            <div className="text-xs text-muted">
              <span className="font-semibold">{t("outlook.drivers")}:</span>{" "}
              {t("outlook.driverFire", { r: num1(Math.exp(o.drivers.fire_last4_vs_normal)) })}
              {o.drivers.fwi_next2_anom !== null && (
                <>
                  {" · "}
                  {t("outlook.driverFwi", { d: `${o.drivers.fwi_next2_anom > 0 ? "+" : ""}${o.drivers.fwi_next2_anom}` })}
                </>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="text-sm text-muted">{t("outlook.quiet")}</div>
      )}
      {!compact && (
        <div className="text-xs text-muted">{t("outlook.issued", { w: num(o.issue_week), y: year(o.issue_year ?? 0) })}</div>
      )}
    </div>
  );
}

export function DangerChart({ doc, region }: { doc: FireWeatherDoc; region: string }) {
  const { t, num1, date } = useFmt();
  const tip = useTooltip();
  const [ref, width] = useWidth<HTMLDivElement>();
  const rows = (doc.regions[region] ?? []).map((r) => ({ ...r, date: new Date(`${r.d}T00:00:00Z`) }));
  if (!rows.length) return null;
  const height = 200;
  const m = { l: 34, r: 10, t: 10, b: 24 };
  const x = scaleTime()
    .domain([rows[0].date, rows[rows.length - 1].date])
    .range([m.l, width - m.r]);
  const yMax = Math.max(12, ...rows.map((r) => Math.max(r.fwi, r.p90))) * 1.1;
  const y = scaleLinear().domain([0, yMax]).range([height - m.b, m.t]).nice();
  const band = area<(typeof rows)[number]>()
    .x((r) => x(r.date))
    .y0((r) => y(r.p50))
    .y1((r) => y(r.p90))(rows) ?? "";
  const obs = rows.filter((r) => !r.fc);
  const fc = rows.filter((r) => r.fc);
  const ln = line<(typeof rows)[number]>()
    .x((r) => x(r.date))
    .y((r) => y(r.fwi));
  const firstFc = fc[0]?.date;
  const thresholds = doc.classes.filter((c) => c.max < yMax);
  return (
    <div ref={ref}>
      <svg width={width} height={height} role="img" aria-label={t("outlook.danger")} onMouseLeave={() => tip.hide()}>
        {thresholds.map((c, i) => (
          <rect
            key={c.name}
            x={m.l}
            width={width - m.l - m.r}
            y={y(c.max)}
            height={y(i === 0 ? 0 : thresholds[i - 1].max) - y(c.max)}
            fill={DANGER_COLOR[c.name]}
            opacity={0.07}
          />
        ))}
        {y.ticks(4).map((v) => (
          <g key={v}>
            <line x1={m.l} x2={width - m.r} y1={y(v)} y2={y(v)} stroke="var(--grid)" />
            <text x={m.l - 5} y={y(v) + 4} fontSize={10} textAnchor="end" fill="var(--muted)">
              {v}
            </text>
          </g>
        ))}
        {x.ticks(width < 500 ? 4 : 7).map((d) => (
          <text key={+d} x={x(d)} y={height - 6} fontSize={10} textAnchor="middle" fill="var(--muted)">
            {date(d)}
          </text>
        ))}
        <path d={band} fill="var(--band)" />
        <path d={ln(obs) ?? ""} fill="none" stroke="var(--ink)" strokeWidth={2} />
        <path d={ln([...obs.slice(-1), ...fc]) ?? ""} fill="none" stroke="var(--accent)" strokeWidth={2} strokeDasharray="5 4" />
        {firstFc && (
          <g>
            <line x1={x(firstFc)} x2={x(firstFc)} y1={m.t} y2={height - m.b} stroke="var(--muted)" strokeDasharray="2 3" />
            <text x={x(firstFc) + 4} y={m.t + 10} fontSize={10} fill="var(--muted)">
              {t("outlook.forecast")} →
            </text>
          </g>
        )}
        {rows.map((r) => (
          <rect
            key={r.d}
            x={x(r.date) - 4}
            y={m.t}
            width={8}
            height={height - m.t - m.b}
            fill="transparent"
            onMouseMove={(e) =>
              tip.show(
                e.clientX,
                e.clientY,
                <div>
                  <div className="font-semibold">
                    {date(r.date)} · {r.fc ? t("outlook.forecast") : t("outlook.observed")}
                  </div>
                  <div>
                    FWI {num1(r.fwi)} · {t(`outlook.classes.${r.cls}`)}
                  </div>
                  <div style={{ opacity: 0.8 }}>
                    {t("outlook.normalBand")}: {num1(r.p50)}–{num1(r.p90)}
                  </div>
                </div>,
              )
            }
          />
        ))}
      </svg>
      <div className="mt-2 flex gap-1 overflow-x-auto pb-1" aria-label={t("outlook.forecast")}>
        {fc.map((r) => (
          <div key={r.d} className="flex min-w-[42px] flex-col items-center rounded-md border border-grid px-1 py-1 text-[10px]">
            <span className="text-muted">{date(r.date)}</span>
            <span className="mt-0.5 h-2.5 w-6 rounded-sm" style={{ background: DANGER_COLOR[r.cls] }} title={t(`outlook.classes.${r.cls}`)} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
        {(["low", "moderate", "high", "very_high", "extreme"] as DangerClass[]).map((c) => (
          <span key={c} className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-3 rounded-sm" style={{ background: DANGER_COLOR[c] }} />
            {t(`outlook.classes.${c}`)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function AlertList({ items }: { items: Alert[] }) {
  const { t, num, lang, year } = useFmt();
  if (!items.length) return <p className="text-sm text-muted">{t("outlook.noAlerts")}</p>;
  return (
    <ul className="flex flex-col divide-y divide-[var(--grid)]">
      {items.map((a) => (
        <li key={`${a.district_id}-${a.iso_year}-${a.iso_week}`} className="flex items-baseline justify-between gap-3 py-2 text-sm">
          <span className="font-semibold">{lang === "bn" ? a.name_bn : a.name_en}</span>
          <span className="text-muted">
            W{num(a.iso_week)} {year(a.iso_year)} · {t("outlook.alertRow", { n: num(a.count), normal: num(a.normal) })}
          </span>
        </li>
      ))}
    </ul>
  );
}
