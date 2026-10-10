import { useFmt } from "../i18n";
import { isoWeekStart } from "../lib/series";
import type { Week } from "../lib/types";

/** Tooltip body for one week: dates, value, interval, and whether it is observed or estimated. */
export function WeekTip({ wk, y, w }: { wk?: Week; y: number; w: number }) {
  const { t, num, date, year } = useFmt();
  const start = isoWeekStart(y, w);
  const end = new Date(start.getTime() + 6 * 86400000);
  return (
    <div>
      <div className="font-semibold">
        {t("calendar.cellTip", { w: num(w), y: year(y) })}
      </div>
      <div style={{ opacity: 0.8 }}>
        {date(start)} – {date(end)}
      </div>
      {wk ? (
        <>
          <div className="mt-1 text-base font-semibold">
            {num(wk.harm)} <span className="text-xs font-normal">{t("units.detections")}</span>
          </div>
          {wk.src === "estimated" && wk.lo !== undefined && (
            <div>{t("calendar.interval", { lo: num(wk.lo), hi: num(wk.hi ?? wk.harm) })}</div>
          )}
          <div style={{ opacity: 0.8 }}>{t(`calendar.${wk.src}`)}</div>
        </>
      ) : (
        <div>—</div>
      )}
    </div>
  );
}
