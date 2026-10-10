import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import i18n, { useFmt } from "./i18n";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { loadManifest, useAsync } from "./lib/data";
import { useRoute, type Route } from "./lib/router";
const Home=lazy(()=>import('./screens/Home').then(m=>({default:m.Home})));
const Borders=lazy(()=>import('./screens/Borders').then(m=>({default:m.Borders})));
const Method=lazy(()=>import('./screens/Method').then(m=>({default:m.Method})));
const OutlookScreen=lazy(()=>import('./screens/OutlookScreen').then(m=>({default:m.OutlookScreen})));
const Panjika=lazy(()=>import('./screens/Panjika').then(m=>({default:m.Panjika})));
const Sensors=lazy(()=>import('./screens/Sensors').then(m=>({default:m.Sensors})));

const MapScreen = lazy(() => import("./screens/MapScreen"));

const NAV: { route: Route; icon: ReactNode }[] = [
  { route: "home", icon: <path d="M10 2c1.5 4.5 6.5 6.5 6.5 12a6.5 6.5 0 0 1-13 0c0-3.5 2-5 3-8 .7 2 1.5 3 2.2 3.6C9.3 7 10 5 10 2z" /> },
  { route: "outlook", icon: <path d="M10 2 2 17h16zM10 8v4M10 14.5v.5" /> },
  { route: "panjika", icon: <path d="M3 4h14v13H3zM3 8h14M7 2v4M13 2v4M6 11h2M9 11h2M12 11h2M6 14h2M9 14h2" /> },
  { route: "sensors", icon: <path d="M3 16 7 9l3 4 4-8 3 5M3 18h14" /> },
  { route: "map", icon: <path d="M3 5l4-2 6 2 4-2v12l-4 2-6-2-4 2zM7 3v12M13 5v12" /> },
  { route: "borders", icon: <path d="M3 10a7 7 0 1 0 14 0 7 7 0 1 0-14 0M3 10h14M10 3c2.5 2.5 2.5 11.5 0 14M10 3c-2.5 2.5-2.5 11.5 0 14" /> },
  { route: "method", icon: <path d="M4 3h9l3 3v11H4zM7 8h6M7 11h6M7 14h4" /> },
];

function useTheme() {
  const [theme, setTheme] = useState<string | null>(() => document.documentElement.getAttribute("data-theme"));
  const [systemDark,setSystemDark]=useState(()=>window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(()=>{const mq=window.matchMedia('(prefers-color-scheme: dark)');const update=()=>setSystemDark(mq.matches);mq.addEventListener('change',update);return()=>mq.removeEventListener('change',update)},[]);
  useEffect(() => {
    if (theme) document.documentElement.setAttribute("data-theme", theme);
    try {
      if (theme) localStorage.setItem("ap-theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);
  const dark = theme ? theme === "dark" : systemDark;
  return { dark, toggle: () => setTheme(dark ? "light" : "dark") };
}

export default function App() {
  const { t, lang } = useFmt();
  const { route, params, go, setParams } = useRoute();
  const { data: manifest, error } = useAsync(loadManifest, []);
  const theme = useTheme();
  const switchLang = () => i18n.changeLanguage(lang === "bn" ? "en" : "bn");
  // Keep the region / year when moving between screens.
  const carry = { r: params.get("r") ?? undefined };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  return (
    <div className="min-h-screen pb-20 lg:pb-8">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-[var(--card)] focus:p-2">
        {t("app.skip")}
      </a>
      <header className="no-print sticky top-0 z-30 border-b border-grid bg-[var(--paper)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <button type="button" onClick={() => go("home", carry)} className="flex items-center gap-2 text-left">
            <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
              <path d="M16 2c2 6 9 9 9 17a9 9 0 0 1-18 0c0-5 3-7 4-11 1 3 2 4 3 5 1-4 2-7 2-11z" fill="var(--accent)" />
            </svg>
            <span className="leading-tight">
              <span className="block text-lg font-bold">{t("app.title")}</span>
              <span className="block text-xs text-muted">{lang === "bn" ? "Agun Panjika · Fire Almanac" : "আগুন পঞ্জিকা · Fire Almanac"}</span>
            </span>
          </button>
          <nav className="hidden gap-1 lg:flex" aria-label="Main">
            {NAV.map((n) => (
              <button
                key={n.route}
                type="button"
                onClick={() => go(n.route, carry)}
                aria-current={route === n.route ? "page" : undefined}
                className={`rounded-lg px-2.5 py-2 text-sm font-medium ${route === n.route ? "bg-[var(--ink)] text-[var(--paper)]" : "text-muted hover:text-[var(--ink)]"}`}
              >
                {t(`nav.${n.route}`)}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <button type="button" className="btn px-3" onClick={switchLang} aria-label={t("app.languageLabel")} lang={lang === "bn" ? "en" : "bn"}>
              {t("app.language")}
            </button>
            <button type="button" className="btn px-2.5" onClick={theme.toggle} aria-label={`${t("app.theme")}: ${theme.dark ? t("app.themeLight") : t("app.themeDark")}`}>
              <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
                {theme.dark ? (
                  <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <circle cx="10" cy="10" r="3.5" />
                    <path d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M4 4l1.4 1.4M14.6 14.6 16 16M4 16l1.4-1.4M14.6 5.4 16 4" />
                  </g>
                ) : (
                  <path d="M15.5 12.5A6.5 6.5 0 0 1 7.5 4.5a6.5 6.5 0 1 0 8 8z" fill="currentColor" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-5xl px-4 py-5">
        {error && <p role="alert">{t("app.error", { msg: error.message })}</p>}
        {!manifest && !error && <p className="text-muted">{t("app.loading")}</p>}
        {manifest && (
          <ErrorBoundary key={route} fallback={(e) => <p role="alert">{t("app.error", { msg: e.message })}</p>}>
            <Suspense fallback={<p className="text-muted" role="status">{t('app.loading')}</p>}>
            {route === "home" && <Home manifest={manifest} params={params} setParams={setParams} go={go} />}
            {route === "outlook" && <OutlookScreen manifest={manifest} params={params} setParams={setParams} />}
            {route === "borders" && <Borders />}
            {route === "panjika" && <Panjika manifest={manifest} params={params} setParams={setParams} />}
            {route === "sensors" && <Sensors manifest={manifest} params={params} setParams={setParams} />}
            {route === "map" && (
              <Suspense fallback={<p className="text-muted">{t("map.loadingMap")}</p>}>
                <MapScreen manifest={manifest} params={params} setParams={setParams} />
              </Suspense>
            )}
            {route === "method" && <Method manifest={manifest} />}
            </Suspense>
            <footer className="no-print mt-10 border-t border-grid pt-4 text-xs text-muted">
              <p className="italic">{t("app.tagline")}</p>
              <p className="mt-1">
                NASA FIRMS MODIS C6.1 · VIIRS 375 m (S-NPP, NOAA-20, NOAA-21) · NASA POWER · ESA Fire_cci · {t("app.dataThrough", { date: Object.values(manifest.data_through.by_sensor).sort().pop() ?? "" })} · KUETaguns, NASA Space Apps 2026
              </p>
            </footer>
          </ErrorBoundary>
        )}
      </main>

      <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-grid bg-[var(--paper)] lg:hidden" aria-label="Main">
        <div className="grid grid-cols-7">
          {NAV.map((n) => (
            <button
              key={n.route}
              type="button"
              onClick={() => go(n.route, carry)}
              aria-current={route === n.route ? "page" : undefined}
              className="flex flex-col items-center gap-0.5 px-0.5 py-2 text-[10px] leading-tight"
              style={{ color: route === n.route ? "var(--accent)" : "var(--muted)" }}
            >
              <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
                {n.icon}
              </svg>
              {t(`nav.${n.route}`)}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
