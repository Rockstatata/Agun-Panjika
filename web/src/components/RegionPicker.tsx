import { useFmt } from "../i18n";
import type { Manifest } from "../lib/types";

export function RegionPicker({ manifest, value, onChange, id = "region", districts = true }: { manifest: Manifest; value: string; onChange: (id: string) => void; id?: string; districts?: boolean }) {
  const { t, lang } = useFmt();
  const name = (r: { name_en: string; name_bn: string }) => (lang === "bn" ? r.name_bn : r.name_en);
  return (
    <label className="flex flex-col gap-1" htmlFor={id}>
      <span className="eyebrow">{t("home.area")}</span>
      <select id={id} className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="bgd">{name(manifest.country)}</option>
        <optgroup label={t("home.regions")}>
          {manifest.regions.map((r) => (
            <option key={r.id} value={r.id}>
              {name(r)}
            </option>
          ))}
        </optgroup>
        {districts && (
          <optgroup label={t("home.districts")}>
            {[...manifest.districts]
              .sort((a, b) => name(a).localeCompare(name(b)))
              .map((d) => (
                <option key={d.district_id} value={`d_${d.district_id}`}>
                  {name(d)}
                </option>
              ))}
          </optgroup>
        )}
      </select>
    </label>
  );
}
