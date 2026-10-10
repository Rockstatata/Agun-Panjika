import { scaleLinear } from "d3-scale";
import { AlertList, DangerChart, OutlookCard } from "../components/Outlook";
import { RegionPicker } from "../components/RegionPicker";
import { useFmt } from "../i18n";
import { dataUrl, loadFireWeather, loadForecast, loadRegion, useAsync } from "../lib/data";
import type { ForecastSkill, Manifest } from "../lib/types";
import { useWidth } from "../lib/useWidth";

export function OutlookScreen({ manifest, params, setParams }: { manifest: Manifest; params: URLSearchParams; setParams: (p: Record<string, string | number | undefined>) => void }) {
  const { t, num, lang } = useFmt();
  const regionId = params.get("r") ?? "bgd";
  const { data: fc, error } = useAsync(loadForecast, []);
  const { data: fw } = useAsync(loadFireWeather, []);
  const { data: doc } = useAsync(() => loadRegion(regionId), [regionId]);
  const fwRegion = regionId.startsWith("d_") ? "bgd" : regionId;
  const name = (id: string) => {
    if (id === "bgd") return lang === "bn" ? manifest.country.name_bn : manifest.country.name_en;
    const r = manifest.regions.find((x) => x.id === id);
    return r ? (lang === "bn" ? r.name_bn : r.name_en) : id;
  };
  const units = ["bgd", ...manifest.regions.map((r) => r.id)];
  // Normal January-May total from the cumulative normals at ISO week 22.
  const sw = 21;
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{t("outlook.title")}</h1>
        <p className="mt-1 max-w-2xl text-muted">{t("outlook.intro")}</p>
      </div>
      {error && <p role="alert">{t("app.error", { msg: error.message })}</p>}

      {fc && (
        <section aria-labelledby="ol-h" className="flex flex-col gap-3">
          <h2 id="ol-h" className="text-lg font-semibold">
            {t("outlook.twoWeek")}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {units.map((u) => (
              <OutlookCard key={u} o={fc.products.next2.outlook[u]} name={name(u)} />
            ))}
          </div>
          <p className="text-xs text-muted">{t("outlook.notForecast")}</p>
        </section>
      )}

      <section className="card flex flex-col gap-3 p-3 sm:p-5" aria-labelledby="dg-h">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="dg-h" className="text-lg font-semibold">
              {t("outlook.danger")}
            </h2>
            <p className="text-sm text-muted">{t("outlook.dangerIntro")}</p>
          </div>
          <div className="min-w-[200px]">
            <RegionPicker manifest={manifest} value={regionId.startsWith("d_") ? "bgd" : regionId} onChange={(r) => setParams({ r })} id="ol-region" districts={false} />
          </div>
        </div>
        {fw && <DangerChart doc={fw} region={fwRegion} />}
      </section>

      {fc && (
        <section className="card p-3 sm:p-5" aria-labelledby="al-h">
          <h2 id="al-h" className="text-lg font-semibold">
            {t("outlook.alerts")}
          </h2>
          <p className="mb-2 text-sm text-muted">{t("outlook.alertsIntro")}</p>
          <AlertList items={fc.alerts.items} />
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-grid pt-3">
            <span className="text-sm font-semibold">{t("outlook.feeds")}:</span>
            <a className="btn" href={dataUrl("alerts.rss")} target="_blank" rel="noreferrer">
              RSS
            </a>
            <a className="btn" href={dataUrl("alerts_cap.xml")} target="_blank" rel="noreferrer">
              CAP 1.2
            </a>
            <a className="btn" href={dataUrl("forecast.json")} target="_blank" rel="noreferrer">
              JSON
            </a>
          </div>
          <p className="mt-2 text-xs text-muted">{t("outlook.feedsIntro")}</p>
        </section>
      )}

      {doc && (
        <section className="card p-3 sm:p-5" aria-labelledby="ss-h">
          <h2 id="ss-h" className="text-lg font-semibold">
            {t("outlook.season")} · {name(regionId)}
          </h2>
          <p className="mt-1">
            {t("outlook.seasonNormal", {
              lo: num(doc.normals.p25[sw] ?? 0),
              hi: num(doc.normals.p75[sw] ?? 0),
              mid: num(doc.normals.p50[sw] ?? 0),
            })}
          </p>
          <p className="mt-1 text-sm text-muted">{t("outlook.seasonNoSkill")}</p>
        </section>
      )}

      {fc && <SkillSection s={fc.products.next2.skill} years={fc.hindcast_years} />}
    </div>
  );
}

function SkillSection({ s }: { s: ForecastSkill; years: [number, number] }) {
  const { t, num, num2 } = useFmt();
  const [ref, width] = useWidth<HTMLDivElement>();
  const size = Math.min(width, 280);
  const m = 34;
  const x = scaleLinear().domain([0, 1]).range([m, size - 10]);
  const y = scaleLinear().domain([0, 1]).range([size - m, 10]);
  return (
    <section className="card p-3 sm:p-5" aria-labelledby="sk-h">
      <h2 id="sk-h" className="text-lg font-semibold">
        {t("outlook.skillTitle")}
      </h2>
      <p className="mb-3 text-sm text-muted">
        {t("outlook.skillIntro")}
      </p>
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col" />
                <th scope="col">{t("outlook.floor")}</th>
                <th scope="col">{t("outlook.ceiling")}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">{t("outlook.bss")}</th>
                <td>{num2(s.bss_fire_only)}</td>
                <td>{num2(s.bss_full)}</td>
              </tr>
              <tr>
                <th scope="row">{t("outlook.auc")}</th>
                <td>{num2(s.auc_fire_only)}</td>
                <td>{num2(s.auc_full)}</td>
              </tr>
              <tr>
                <th scope="row">{t("outlook.countErr")}</th>
                <td>{num(s.mae_fire_only)}</td>
                <td>{num(s.mae_full)}</td>
              </tr>
              <tr>
                <th scope="row">{t("outlook.climErr")}</th>
                <td colSpan={2}>{num(s.mae_clim)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div ref={ref} className="min-w-[200px]">
          <div className="mb-1 text-xs font-semibold">{t("outlook.reliability")}</div>
          <svg width={size} height={size} role="img" aria-label={t("outlook.reliability")}>
            {[0, 0.25, 0.5, 0.75, 1].map((v) => (
              <g key={v}>
                <line x1={x(0)} x2={x(1)} y1={y(v)} y2={y(v)} stroke="var(--grid)" />
                <text x={m - 4} y={y(v) + 4} fontSize={10} textAnchor="end" fill="var(--muted)">
                  {Math.round(v * 100)}
                </text>
                <text x={x(v)} y={size - m + 14} fontSize={10} textAnchor="middle" fill="var(--muted)">
                  {Math.round(v * 100)}
                </text>
              </g>
            ))}
            <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="var(--muted)" strokeDasharray="4 3" />
            {s.reliability.map((r, i) => (
              <circle key={i} cx={x(r.p)} cy={y(r.obs)} r={Math.max(3, Math.min(10, Math.sqrt(r.n) / 4))} fill="var(--accent)" opacity={0.85} />
            ))}
            <text x={(x(0) + x(1)) / 2} y={size - 4} fontSize={10} textAnchor="middle" fill="var(--muted)">
              {t("outlook.predicted")} (%)
            </text>
          </svg>
        </div>
      </div>
    </section>
  );
}
