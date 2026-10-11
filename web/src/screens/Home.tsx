import { RequestStatus } from "../components/RequestStatus";
import { useMemo, useRef } from "react";
import { CalendarHeatmap } from "../components/CalendarHeatmap";
import { LevelBadge, LevelIcon } from "../components/LevelBadge";
import { RegionPicker } from "../components/RegionPicker";
import { SeasonChart } from "../components/SeasonChart";
import { ShareButton } from "../components/ShareButton";
import { GlobePanel } from "../components/GlobePanel";
import { SectionHeader } from "../components/SectionHeader";
import { useFmt } from "../i18n";
import { AlertList, OutlookCard } from "../components/Outlook";
import { loadForecast, loadRegion, useAsync } from "../lib/data";
import type { Route } from "../lib/router";
import { byYear, isoWeekStart, LEVEL_COLOR, seasonAt } from "../lib/series";
import type { Manifest, RegionDoc } from "../lib/types";

interface Props {
  manifest: Manifest;
  params: URLSearchParams;
  setParams: (p: Record<string, string | number | undefined>) => void;
  go: (r: Route, p?: Record<string, string | number | undefined>) => void;
}

export function Home({ manifest, params, setParams, go }: Props) {
  const { t, lang, num, year: fy } = useFmt();
  const regionId = params.get("r") ?? "bgd";
  const { data: doc, error,loading,retry } = useAsync(() => loadRegion(regionId), [regionId]);
  if (error) return <RequestStatus error={error} retry={retry}/>;
  return (
    <div className="flex flex-col gap-4">
      <div className="home-geospatial">
      <section className="mission-hero no-print">
        <SectionHeader eyebrow={lang === "bn" ? "বাংলাদেশের অগ্নি পর্যবেক্ষণ" : "BANGLADESH FIRE OBSERVATORY"} title={t("home.question")}>
          <p>{lang === "bn" ? "দুটি উপগ্রহ। একটি নিরবচ্ছিন্ন রেকর্ড। আগুনের মৌসুম বুঝুন, তথ্য দিয়ে।" : "Two satellite instruments. One continuous record. Understand the fire season through the evidence."}</p>
        </SectionHeader>
        <div className="mission-facts">
          <div><strong>{fy(manifest.years[0])}–{fy(manifest.years[manifest.years.length - 1])}</strong><span>{lang === "bn" ? "সমন্বিত অগ্নি রেকর্ড" : "Harmonized fire record"}</span></div>
          <div><strong>{num(manifest.districts.length)}</strong><span>{lang === "bn" ? "জেলা পর্যবেক্ষণে" : "Districts in view"}</span></div>
          <div><strong>MODIS + VIIRS</strong><span>NASA FIRMS · {manifest.model_version}</span></div>
        </div>
      </section>
      <GlobePanel manifest={manifest} params={params} setParams={setParams} />
      </div>
      {doc ? (
        <SeasonView manifest={manifest} doc={doc} params={params} setParams={setParams} go={go} />
      ) : (
        <RequestStatus loading={loading}/>
      )}
    </div>
  );
}

function SeasonView({ manifest, doc, params, setParams, go }: Props & { doc: RegionDoc }) {
  const { t, num, ordinal, date, year: fy, lang } = useFmt();
  const cardRef = useRef<HTMLDivElement>(null);
  const years = useMemo(() => Object.keys(doc.seasons).map(Number).sort((a, b) => a - b), [doc]);
  const year = Number(params.get("y")) || doc.season.year;
  const maxWeek = doc.seasons[String(year)]?.pct.length ?? 52;
  const defWeek = year === doc.season.year ? doc.season.to_week : maxWeek;
  const week = Math.min(Number(params.get("w")) || defWeek, maxWeek);
  const s = seasonAt(doc, year, week);
  const areaName = lang === "bn" ? doc.region.name_bn : doc.region.name_en;
  const weekEnd = new Date(isoWeekStart(year, week).getTime() + 6 * 86400000);
  const [b0, b1] = manifest.baseline_years;
  const hasYear = byYear(doc).has(year);
  const { data: fc,error:forecastError,loading:forecastLoading,retry:retryForecast } = useAsync(loadForecast, []);
  const isLive = year === doc.season.year;
  const alerts = (fc?.alerts.items ?? []).filter((a) =>
    doc.region.id === "bgd"
      ? true
      : doc.region.id.startsWith("d_")
        ? `d_${a.district_id}` === doc.region.id
        : manifest.districts.find((d) => d.district_id === a.district_id)?.region_id === doc.region.id,
  );

  return (
    <>
      <div className="print-only">
        <h1 className="text-xl font-bold">
          {t("report.title")}: {areaName}, {fy(year)}
        </h1>
        <p className="text-xs">{t("app.tagline")}</p>
      </div>
      <div className="no-print grid grid-cols-2 gap-3 sm:grid-cols-[2fr_1fr_2fr]">
        <div className="col-span-2 sm:col-span-1">
          <RegionPicker manifest={manifest} value={doc.region.id} onChange={(r) => setParams({ r })} />
        </div>
        <label className="flex flex-col gap-1">
          <span className="eyebrow">{t("home.year")}</span>
          <select className="select" value={year} onChange={(e) => setParams({ y: e.target.value, w: undefined })}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y < 2012 ? "≈ " : ""}
                {fy(y)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="eyebrow">
            {t("home.week")}: {date(weekEnd)}
          </span>
          <input
            type="range"
            min={1}
            max={maxWeek}
            value={week}
            onChange={(e) => setParams({ w: e.target.value })}
            aria-valuetext={date(weekEnd)}
            className="mt-2 w-full accent-[var(--accent)]"
          />
        </label>
      </div>

      {s && hasYear && (
        <div ref={cardRef} className="card flex flex-col gap-4 p-4 sm:p-6" style={{ borderTop: `5px solid ${LEVEL_COLOR[s.level]}` }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="eyebrow">
                {areaName} · {fy(year)}
              </div>
              <h2 className="mt-1 flex items-center gap-2 text-xl font-bold leading-snug sm:text-2xl">
                <LevelIcon level={s.level} size={26} />
                <span>{s.level === "quiet" ? t("home.headlineQuiet") : t("home.headline", { level: t(`levelShort.${s.level}`) })}</span>
              </h2>
            </div>
            <div className="hidden sm:block">
              <LevelBadge level={s.level} />
            </div>
          </div>

          {s.level !== "quiet" && (
            <p className="text-lg">
              <strong>{t("home.percentile", { pct: ordinal(s.pct), from: fy(b0), to: fy(b1) })}</strong>
              {s.n10 > 0 && <> · {t("home.beat10", { n: num(s.beat10), m: num(s.n10) })}</>}
            </p>
          )}

          <div className="grid gap-1 text-sm text-muted">
            <span>{t("home.cum", { n: num(s.cum), date: date(weekEnd) })}</span>
            <span>{t("home.normalRange", { lo: num(s.normal.p25), hi: num(s.normal.p75) })}</span>
          </div>

          <SeasonChart doc={doc} series="harm" year={year} week={week} />

          <div>
            <div className="eyebrow mb-1">{t("home.row")}</div>
            <CalendarHeatmap doc={doc} years={[year]} highlightYear={year} markWeek={week} showTotals={false} cell={undefined} label={t("home.row")} />
            <p className="mt-1 text-xs text-muted">{t("home.rowHint")}</p>
          </div>

          <ul className="grid gap-1 text-xs text-muted">
            {year < 2012 && <li>≈ {t("home.estimatedNote")}</li>}
            {year < 2003 && <li>≈ {t("home.terraNote")}</li>}
            {doc.static_removed > 0 && <li>{t("home.kilnNote", { n: num(doc.static_removed) })}</li>}
            <li>{t("home.descriptive")}</li>
          </ul>
          <div className="text-xs text-muted">{t("app.title")} · {t("app.tagline")}</div>
        </div>
      )}

      {isLive&&<RequestStatus error={forecastError} loading={forecastLoading} retry={retryForecast}/>}
      {isLive && fc && (
        <div className="grid gap-3 sm:grid-cols-2">
          <OutlookCard o={fc.products.next2.outlook[doc.region.id]} name={areaName} />
          <div className="card p-4">
            <div className="eyebrow mb-1">{t("outlook.alerts")}</div>
            <AlertList items={alerts.slice(0, 6)} />
          </div>
        </div>
      )}

      <div className="no-print flex flex-wrap gap-2">
        <ShareButton target={cardRef} filename={`agun-panjika-${doc.region.id}-${year}-w${week}.png`} title={t("home.shareTitle", { area: areaName })} />
        <button type="button" className="btn" onClick={() => window.print()}>
          {t("report.print")}
        </button>
        {isLive && (
          <button type="button" className="btn" onClick={() => go("outlook", { r: doc.region.id })}>
            {t("outlook.title")} →
          </button>
        )}
        <button type="button" className="btn" onClick={() => go("panjika", { r: doc.region.id, y: year })}>
          {t("home.openCalendar")} →
        </button>
      </div>
    </>
  );
}
