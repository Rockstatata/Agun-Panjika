import { useMemo, useState } from "react";
import { CalendarHeatmap, CalendarLegend, CalendarTable } from "../components/CalendarHeatmap";
import { RegionPicker } from "../components/RegionPicker";
import { useFmt } from "../i18n";
import { WeekTip } from "../components/WeekCell";
import { loadLocal, loadRegion, useAsync } from "../lib/data";
import type { LocalDoc, Manifest, RegionDoc, Week } from "../lib/types";

const LOCAL_DISTRICTS = ["rangamati", "khagrachhari", "bandarban"];

/** Calendar-ready document for one upazila or union (the calendar only reads weeks and handover). */
function localDoc(region: RegionDoc, years: Record<string, (number | null)[]>, name_en: string, name_bn: string): RegionDoc {
  const weeks: Week[] = [];
  for (const [y, arr] of Object.entries(years)) {
    arr.forEach((v, i) => {
      if (v !== null) weeks.push({ y: Number(y), w: i + 1, harm: v, src: Number(y) < 2012 ? "estimated" : "observed" });
    });
  }
  weeks.sort((a, b) => a.y - b.y || a.w - b.w);
  return { ...region, region: { id: name_en, name_en, name_bn }, weeks };
}

export function Panjika({ manifest, params, setParams }: { manifest: Manifest; params: URLSearchParams; setParams: (p: Record<string, string | number | undefined>) => void }) {
  const { t, lang, num, year:fy } = useFmt();
  const regionId = params.get("r") ?? "bgd";
  const level = (params.get("lv") as "upazila" | "union") ?? "upazila";
  const unitId = params.get("u") ?? "";
  const hl = Number(params.get("y")) || undefined;
  const [table, setTable] = useState(false);
  const { data: doc, error } = useAsync(() => loadRegion(regionId), [regionId]);
  const localId = regionId.replace(/^d_/, "");
  const hasLocal = LOCAL_DISTRICTS.includes(localId);
  const { data: local } = useAsync<LocalDoc | undefined>(() => (hasLocal ? loadLocal(localId) : Promise.resolve(undefined)), [localId]);
  const units = useMemo(() => {
    if (!local) return [];
    const lvl = local.levels[level] ?? {};
    return Object.entries(lvl)
      .map(([id, u]) => {
        const parent = "upazila_id" in u && u.upazila_id ? local.levels.upazila[u.upazila_id] : undefined;
        const parentName = parent ? (lang === "bn" && parent.name_bn ? parent.name_bn : parent.name_en) : "";
        const name = lang === "bn" && u.name_bn ? u.name_bn : u.name_en;
        return { id, label: parentName ? `${parentName} · ${name}` : name, total: u.total_2012_2025, u };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [local, level, lang]);
  const unit = units.find((x) => x.id === unitId);
  const shown = useMemo(
    () => (doc && unit ? localDoc(doc, unit.u.years, unit.u.name_en, unit.u.name_bn ?? unit.u.name_en) : doc),
    [doc, unit],
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{t("calendar.title")}</h1>
        <p className="mt-1 max-w-2xl text-muted">{t("calendar.intro")}</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px]">
          <RegionPicker manifest={manifest} value={regionId} onChange={(r) => setParams({ r, u: undefined })} />
        </div>
        {hasLocal && local && (
          <>
            <label className="flex flex-col gap-1">
              <span className="eyebrow">{t("local.level")}</span>
              <select className="select" value={level} onChange={(e) => setParams({ lv: e.target.value, u: undefined })}>
                <option value="upazila">{t("local.upazila")}</option>
                <option value="union">{t("local.union")}</option>
              </select>
            </label>
            <label className="flex min-w-[220px] flex-col gap-1">
              <span className="eyebrow">{t(`local.${level}`)}</span>
              <select className="select" value={unitId} onChange={(e) => setParams({ u: e.target.value || undefined })}>
                <option value="">{t("local.whole")}</option>
                {units.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label} ({num(x.total)})
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <button type="button" className="chip" aria-pressed={table} onClick={() => setTable((v) => !v)}>
          {table ? t("calendar.chartView") : t("calendar.tableView")}
        </button>
        {doc && <label className="flex flex-col gap-1"><span className="eyebrow">{t("home.year")}</span><select className="select" value={hl ?? doc.season.year} onChange={e=>setParams({y:e.target.value,w:undefined})}>{[...new Set(doc.weeks.map(w=>w.y))].map(y=><option key={y} value={y}>{y<2012?'≈ ':''}{fy(y)}</option>)}</select></label>}
      </div>
      {hasLocal && <p className="text-xs text-muted">{t("local.note")}</p>}
      {error && <p role="alert">{t("app.error", { msg: error.message })}</p>}
      {shown && doc && (
        <div className="card p-3 sm:p-5">
          {unit && <h2 className="mb-2 text-lg font-semibold">{unit.label}</h2>}
          {table ? (
            <CalendarTable doc={shown} />
          ) : (
            <>
              <CalendarHeatmap
                doc={shown}
                series="harm"
                highlightYear={hl ?? doc.season.year}
                onSelectYear={(y) => setParams({ y: hl === y ? undefined : y })}
                markWeek={Number(params.get("w")) || undefined}
                onSelectWeek={(y,w) => setParams({ y,w })}
              />
              <div className="mt-3">
                <CalendarLegend doc={shown} />
              </div>
              {params.has("w") && <div className="calendar-selection rounded-xl border border-grid p-4 mt-3" aria-live="polite"><WeekTip wk={shown.weeks.find(w=>w.y===(hl??doc.season.year)&&w.w===Number(params.get("w")))} y={hl??doc.season.year} w={Number(params.get("w"))}/></div>}
              <p className="mt-2 text-xs text-muted">
                {t("calendar.highlight")} · {t("calendar.keyboard")}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
