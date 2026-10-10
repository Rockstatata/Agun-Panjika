import { RequestStatus } from "../components/RequestStatus";
import { useState } from "react";
import { useFmt } from "../i18n";
import { PartnerCheck } from "../components/PartnerCheck";
import { dataUrl, loadBridge, loadPartner, loadValidation, useAsync } from "../lib/data";
import type { Manifest } from "../lib/types";

const CITATION = (year: string, date: string) =>
  `KUETaguns (${year}). Agun Panjika: harmonised MODIS and VIIRS fire record for Bangladesh, 2003 to present. NASA Space Apps Challenge 2026. Data: NASA FIRMS MODIS C6.1 and VIIRS 375 m (S-NPP, NOAA-20), accessed ${date}.`;

const SOURCES = [
  ["NASA FIRMS: MODIS C6.1, VIIRS 375 m S-NPP and NOAA-20 country files", "https://firms.modaps.eosdis.nasa.gov/country/"],
  ["NASA Earthdata: Suomi NPP observations cease 2 November 2026", "https://www.earthdata.nasa.gov/data/alerts-outages/suomi-npp-observations-cease-november-2-2026"],
  ["NASA Earthdata: Transition from MODIS to VIIRS", "https://www.earthdata.nasa.gov/data/alerts-outages/transition-from-modis-viirs"],
  ["geoBoundaries gbOpen BGD ADM2/ADM3", "https://www.geoboundaries.org/"],
  ["Farukh, Islam & Hayasaka 2023, Atmosphere 14(1):97", "https://www.mdpi.com/2073-4433/14/1/97"],
  ["Zheng et al. 2026, Remote Sensing 18:1650 (prior MODIS/VIIRS fusion)", "https://mdpi-res.com/d_attachment/remotesensing/remotesensing-18-01650/article_deploy/remotesensing-18-01650.pdf"],
  ["ESA Fire_cci burned area: Sentinel-3 SYN v1.1 and harmonised MRBA v6.0 grids (CEDA)", "https://data.ceda.ac.uk/neodc/esacci/fire/data/burned_area"],
  ["NASA POWER daily weather and aerosol (MERRA-2, GEOS-IT, CERES)", "https://power.larc.nasa.gov/"],
  ["FIRMS India and Myanmar country files (cross-border and upwind views)", "https://firms.modaps.eosdis.nasa.gov/country/"],
  ["Open-Meteo 16-day weather forecast (fire-weather outlook)", "https://open-meteo.com/"],
  ["Van Wagner 1987, Canadian Forest Fire Weather Index System", "https://cfs.nrcan.gc.ca/publications?id=19927"],
];

export function Method({ manifest }: { manifest: Manifest }) {
  const { t, num, num1, lang } = useFmt();
  const { data: val,error:valError,loading:valLoading,retry:retryValidation } = useAsync(loadValidation, []);
  const { data: partner,error:partnerError,loading:partnerLoading,retry:retryPartner } = useAsync(loadPartner, []);
  const { data: bridge,error:bridgeError,loading:bridgeLoading,retry:retryBridge } = useAsync(loadBridge, []);
  const cov = val?.interval_coverage;
  type Score = Record<string, { abs_total: number }>;
  const b = bridge as unknown as { noaa20?: { loyo_score?: Score }; noaa21?: { loyo_score?: Score } } | undefined;
  const [copied, setCopied] = useState(false);
  const [copyError,setCopyError]=useState<Error|undefined>();
  const cite = CITATION("2026", manifest.updated_utc.slice(0, 10));
  const nb = val?.final_fit.negbin;
  const s = Object.fromEntries((val?.summary ?? []).map((r) => [r.model, r]));
  const chosen = val?.chosen_model ?? "negbin";
  const en = lang === "en";

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{t("method.title")}</h1>
        <p className="mt-1 text-muted">{t("method.intro")}</p>
      </div>

      <RequestStatus error={valError} loading={valLoading} retry={retryValidation}/>
      <RequestStatus error={partnerError} loading={partnerLoading} retry={retryPartner}/>
      <RequestStatus error={bridgeError} loading={bridgeLoading} retry={retryBridge}/>
      <section className="card flex flex-col gap-3 p-4 sm:p-6">
        <ol className="flex list-decimal flex-col gap-3 pl-5">
          <li>
            <strong>{en ? "Clean." : "পরিষ্কার।"}</strong>{" "}
            {en
              ? "Every FIRMS detection over Bangladesh since 2000 (MODIS C6.1 Terra + Aqua, VIIRS 375 m S-NPP and NOAA-20). Exact duplicates dropped; VIIRS nominal/high and MODIS confidence ≥ 30 kept. FIRMS type 2 (static land source) and 3 (offshore) dropped, then ~400 m cells with detections in 4+ months across 3+ years, mostly outside March–April, are flagged as brick kilns or industry."
              : "২০০০ সাল থেকে বাংলাদেশে FIRMS-এর প্রতিটি শনাক্তকরণ। হুবহু পুনরাবৃত্তি বাদ; VIIRS-এর মাঝারি/উচ্চ এবং MODIS-এর ৩০ বা বেশি আস্থা রাখা হয়েছে। FIRMS টাইপ ২ ও ৩ বাদ, এরপর যে ~৪০০ মিটার ঘরে ৩+ বছরে ৪+ মাসে শনাক্তকরণ, মূলত মার্চ–এপ্রিলের বাইরে, সেগুলো ইটভাটা বা শিল্প হিসেবে চিহ্নিত।"}
          </li>
          <li>
            <strong>{en ? "Aggregate." : "একত্র।"}</strong>{" "}
            {en
              ? "Detections are tagged to districts (geoBoundaries) and counted per ISO week for five regions: Rangamati, Khagrachhari, Bandarban, Chattogram & Cox's Bazar, and the rest of Bangladesh."
              : "শনাক্তকরণগুলো জেলায় ভাগ করে পাঁচটি অঞ্চলে ISO সপ্তাহ অনুযায়ী গোনা হয়েছে: রাঙামাটি, খাগড়াছড়ি, বান্দরবান, চট্টগ্রাম ও কক্সবাজার, এবং বাকি বাংলাদেশ।"}
          </li>
          <li>
            <strong>{en ? "Harmonise." : "সমন্বয়।"}</strong>{" "}
            {en
              ? "Two models learn VIIRS S-NPP weekly counts from MODIS on the 13 years both flew (2012–2024), and we average them: a negative binomial regression with a separate intercept for each region and month, and gradient-boosted trees that also see the Aqua/Terra split, small-fire and night counts, how many districts burned, and the neighbouring weeks:"
              : "যে ১৩ বছর দুটি সেন্সর একসঙ্গে উড়েছে (২০১২–২০২৪), সেখানে দুটি মডেল MODIS থেকে VIIRS S-NPP-এর সাপ্তাহিক গণনা শেখে, আর আমরা দুটির গড় নিই: অঞ্চল ও মাসভিত্তিক ইন্টারসেপ্টসহ নেগেটিভ বাইনোমিয়াল রিগ্রেশন, এবং গ্রেডিয়েন্ট-বুস্টেড ট্রি, যা Aqua/Terra ভাগ, ছোট ও রাতের আগুন, কতগুলো জেলায় আগুন, আর পাশের সপ্তাহগুলোও দেখে:"}
            <pre tabIndex={0} className="mt-2 overflow-x-auto rounded-lg bg-[var(--zero)] p-3 text-xs">
              V̂ = ½ · NegBin[log μ = a(region, month) + β·log(M+1) + γ·log(F+1)] + ½ · GBM(MODIS features)
            </pre>
            {nb && (
              <span className="text-sm text-muted">
                β = {num1(Math.round(nb.beta_logM * 100) / 100)}, γ = {num1(Math.round(nb.gamma_logF * 100) / 100)}, α = {num1(Math.round(nb.alpha * 100) / 100)}, {num(nb.n_intercepts)}{" "}
                {en ? "NB intercepts (quiet monsoon months pooled per region)" : "ইন্টারসেপ্ট"}
              </span>
            )}
          </li>
          <li>
            <strong>{en ? "Validate." : "যাচাই।"}</strong>{" "}
            {s[chosen] && s.naive && (en
              ? `Leave-one-year-out over 2012–2024. Weekly error ${num1(s[chosen].mae_week)} vs ${num1(s.naive.mae_week)} for the single ×${num1(manifest.naive_factor)} factor (${num(s[chosen].mae_vs_naive_pct)}%); off-season error ${num1(s[chosen].mae_week_offseason)} vs ${num1(s.naive.mae_week_offseason)}; season-total error ${num1(s[chosen].abs_total_pct_err)}% vs ${num1(s.naive.abs_total_pct_err)}%; peak week within ${num1(s[chosen].peak_week_err_days)} days; trend direction right in ${num(s[chosen].direction_match * 100)}% of years vs ${num(s.naive.direction_match * 100)}%.`
              : `২০১২–২০২৪ সালে এক বছর বাদ রেখে পরীক্ষা। সাপ্তাহিক ভুল ${num1(s[chosen].mae_week)}, একক গুণকে ${num1(s.naive.mae_week)} (${num(s[chosen].mae_vs_naive_pct)}%); অফ-সিজনে ${num1(s[chosen].mae_week_offseason)} বনাম ${num1(s.naive.mae_week_offseason)}; মৌসুমের মোটে ${num1(s[chosen].abs_total_pct_err)}% বনাম ${num1(s.naive.abs_total_pct_err)}%; প্রবণতার দিক ঠিক ${num(s[chosen].direction_match * 100)}% বছরে।`)}
          </li>
          <li>
            <strong>{en ? "Bridge." : "সেতু।"}</strong>{" "}
            {en
              ? "After S-NPP stops on 2 November 2026 the series continues on the average of NOAA-20 and NOAA-21, which already sit on the S-NPP scale (see below). Outlooks, fire weather and alerts run on the same record."
              : "২ নভেম্বর ২০২৬-এ S-NPP বন্ধ হওয়ার পর সিরিজ NOAA-20 ও NOAA-21-এর গড়ে চলবে, যা আগে থেকেই S-NPP মাপে (নিচে দেখুন)। পূর্বাভাস, আগুনের আবহাওয়া ও সতর্কতা একই রেকর্ডে চলে।"}
          </li>
          <li>
            <strong>{en ? "Normal and alert." : "স্বাভাবিক ও সতর্কতা।"}</strong>{" "}
            {en
              ? `For each area and week, this year's cumulative activity since 1 January is ranked against ${manifest.baseline_years[0]}–${manifest.baseline_years[1]}: below normal under the 25th percentile, normal 25th–75th, above normal 75th–90th, extreme over 90th.`
              : `প্রতিটি এলাকা ও সপ্তাহে ১ জানুয়ারি থেকে এ বছরের মোট আগুনকে ${manifest.baseline_years[0]}–${manifest.baseline_years[1]} সালের সঙ্গে তুলনা করা হয়: ২৫ পার্সেন্টাইলের নিচে কম, ২৫–৭৫ স্বাভাবিক, ৭৫–৯০ বেশি, ৯০-এর ওপরে অনেক বেশি।`}
          </li>
        </ol>
      </section>

      {partner && <PartnerCheck doc={partner} />}

      <section className="card flex flex-col gap-3 p-4 sm:p-6">
        {cov && (
          <div>
            <h2 className="text-lg font-semibold">{t("method2.coverage")}</h2>
            <p className="mt-1 text-sm">
              {t("method2.coverageText", { w: num(cov.national_week * 100), y: num(cov.national_year * 100) })}
            </p>
          </div>
        )}
        {b?.noaa20?.loyo_score && (
          <div>
            <h2 className="text-lg font-semibold">{t("method2.bridge")}</h2>
            <p className="mt-1 text-sm">
              {t("method2.bridgeText", {
                e20: num1(b.noaa20.loyo_score.identity?.abs_total ?? 0),
                e21: num1(b.noaa21?.loyo_score?.identity?.abs_total ?? 0),
              })}
            </p>
          </div>
        )}
        <div>
          <h2 className="text-lg font-semibold">{t("method2.fwi")}</h2>
          <p className="mt-1 text-sm">{t("method2.fwiText")}</p>
        </div>
      </section>

      <section className="card p-4 sm:p-6">
        <h2 className="text-lg font-semibold">{t("method.limits")}</h2>
        <p className="mt-1 text-sm">{t("method.limitsText")}</p>
      </section>

      <section id="downloads" className="card flex flex-col gap-3 p-4 sm:p-6">
        <div className="flex flex-wrap gap-2">
          <a className="btn btn-primary" href={dataUrl("download/harmonised.csv")} download>
            {t("method.download")}
          </a>
          <a className="btn" href={dataUrl("download/harmonised_districts.csv")} download>
            {t("method.downloadDistricts")}
          </a>
          <a className="btn" href={dataUrl("validation.json")} download>
            validation.json
          </a>
        </div>
        <h2 className="mt-2 text-lg font-semibold">{t("method.citation")}</h2>
        <p className="rounded-lg bg-[var(--zero)] p-3 text-sm">{cite}</p>
        <div>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setCopyError(undefined);
              if(!navigator.clipboard){setCopyError(new Error(lang==='bn'?'ক্লিপবোর্ড পাওয়া যায়নি। লেখাটি নির্বাচন করে কপি করুন।':'Clipboard unavailable. Select and copy the citation text.'));return;}
              navigator.clipboard.writeText(cite).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }).catch(e=>setCopyError(e instanceof Error?e:new Error(String(e))));
            }}
          >
            {copied ? t("method.copied") : t("method.copy")}
          </button>
        </div>
      </section>

      <RequestStatus error={copyError}/>
      <section className="card p-4 sm:p-6">
        <h2 className="text-lg font-semibold">{t("method.sources")}</h2>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm">
          {SOURCES.map(([label, href]) => (
            <li key={label}>
              <a href={href} target="_blank" rel="noreferrer" className="underline decoration-[var(--grid)] underline-offset-2">
                {label}
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">
          {t("app.dataThrough", { date: Object.values(manifest.data_through.by_sensor).sort().pop() ?? "" })} · {manifest.model_version}
        </p>
      </section>
    </div>
  );
}
