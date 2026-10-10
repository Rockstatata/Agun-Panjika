import i18n from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";
import bn from "./bn.json";
import en from "./en.json";

function initialLang(): "en" | "bn" {
  try {
    const q = new URLSearchParams(location.search).get("lang");
    if (q === "bn" || q === "en") return q;
    const s = localStorage.getItem("ap-lang");
    if (s === "bn" || s === "en") return s;
  } catch {
    /* storage blocked */
  }
  return navigator.language?.startsWith("bn") ? "bn" : "en";
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, bn: { translation: bn } },
  lng: initialLang(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

document.documentElement.lang = i18n.language;
i18n.on("languageChanged", (l) => {
  document.documentElement.lang = l;
  try {
    localStorage.setItem("ap-lang", l);
  } catch {
    /* ignore */
  }
});

export default i18n;

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_BN = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];

/** Formatting helpers that follow the current language (Bangla digits in bn). */
export function useFmt() {
  const { t, i18n: inst } = useTranslation();
  const bnLang = inst.language === "bn";
  const locale = bnLang ? "bn-BD" : "en-US";
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const year = (y: number) => (bnLang ? new Intl.NumberFormat("bn-BD", { useGrouping: false }).format(y) : String(y));
  const ordinal = (n: number) => {
    const r = Math.round(n);
    if (bnLang) return `${nf.format(r)}তম`;
    const s = r % 100 >= 11 && r % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[r % 10] ?? "th";
    return `${r}${s}`;
  };
  const date = (d: Date) => {
    const m = (bnLang ? MONTHS_BN : MONTHS_EN)[d.getUTCMonth()];
    return bnLang ? `${nf.format(d.getUTCDate())} ${m}` : `${d.getUTCDate()} ${m}`;
  };
  return { t, lang: inst.language as "en" | "bn", num: (n: number) => nf.format(n), num1: (n: number) => nf1.format(n), num2: (n: number) => nf2.format(n), year, ordinal, date };
}
