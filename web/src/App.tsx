import { lazy, Suspense, useEffect, useState } from "react";
import i18n, { useFmt } from "./i18n";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ConnectionStatus, RequestStatus } from "./components/RequestStatus";
import { loadManifest, useAsync } from "./lib/data";
import { DemoTour } from "./components/DemoTour";
import { Navigation, MoreNavigation } from "./components/Navigation";
import { useRoute } from "./lib/router";
const Home=lazy(()=>import('./screens/Home').then(m=>({default:m.Home})));
const Borders=lazy(()=>import('./screens/Borders').then(m=>({default:m.Borders})));
const Method=lazy(()=>import('./screens/Method').then(m=>({default:m.Method})));
const OutlookScreen=lazy(()=>import('./screens/OutlookScreen').then(m=>({default:m.OutlookScreen})));
const Panjika=lazy(()=>import('./screens/Panjika').then(m=>({default:m.Panjika})));
const Sensors=lazy(()=>import('./screens/Sensors').then(m=>({default:m.Sensors})));

const MapScreen = lazy(() => import("./screens/MapScreen"));

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
  const { data: manifest, error, loading,retry } = useAsync(loadManifest, []);
  const [online,setOnline]=useState(navigator.onLine);
  const [screenAttempt,setScreenAttempt]=useState(0);
  useEffect(()=>{const update=()=>setOnline(navigator.onLine);window.addEventListener('online',update);window.addEventListener('offline',update);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update)}},[]);
  const theme = useTheme();
  const switchLang = () => i18n.changeLanguage(lang === "bn" ? "en" : "bn");
  useEffect(()=>{
    const section=params.get('section');if(!section||!['downloads','validation'].includes(section))return;
    const main=document.getElementById('main');if(!main)return;
    const focusSection=()=>{const target=document.getElementById(section);if(!target)return false;target.scrollIntoView({block:'start'});return true};
    if(focusSection())return;
    const observer=new MutationObserver(()=>{if(focusSection())observer.disconnect()});observer.observe(main,{childList:true,subtree:true});
    const timeout=window.setTimeout(()=>observer.disconnect(),5000);return()=>{observer.disconnect();clearTimeout(timeout)};
  },[route,params]);
  // Keep the region / year when moving between screens.
  const carry = {r:params.get("r")??undefined};
  useEffect(() => {
    const url = new URL(location.href);
    url.searchParams.set("lang", lang);
    url.searchParams.set("theme", theme.dark ? "dark" : "light");
    history.replaceState(null, "", url);
  }, [lang, theme.dark]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  return (
    <div className={`min-h-screen pb-20 lg:pb-8 app-route-${route}`}>
      <a href="#main" onClick={(e) => { e.preventDefault(); document.getElementById("main")?.focus(); }} className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-[var(--card)] focus:p-2">
        {t("app.skip")}
      </a>
      <header className="app-header no-print sticky top-0 z-30 border-b border-grid backdrop-blur">
        <div className="app-header-inner mx-auto flex items-center justify-between gap-3 px-4 py-3">
          <button type="button" onClick={() => go("home", carry)} className="flex items-center gap-2 text-left">
            <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
              <defs><linearGradient id="brand-flame" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#e65c35" /><stop offset="1" stopColor="#ffbc67" /></linearGradient></defs>
              <path d="M16 2c2 6 9 9 9 17a9 9 0 0 1-18 0c0-5 3-7 4-11 1 3 2 4 3 5 1-4 2-7 2-11z" fill="url(#brand-flame)" />
              <path d="M16 16c0 4-4 5-4 9a4 4 0 0 0 8 0c0-3-2-5-4-9Z" fill="#fff9ed" />
            </svg>
            <span className="leading-tight">
              <span className="block text-lg font-bold">{t("app.title")}</span>
              <span className="block text-xs text-muted">{lang === "bn" ? "Agun Panjika · Fire Almanac" : "আগুন পঞ্জিকা · Fire Almanac"}</span>
            </span>
          </button>
          <Navigation route={route} go={go} />
          <div className="flex items-center gap-1">
            <MoreNavigation route={route} go={go} />
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

      <div className="mission-status no-print"><span>NASA SPACE APPS 2026 <span aria-hidden="true">/</span> KUETaguns</span><span>{lang === "bn" ? "উৎস: NASA FIRMS" : "SOURCE: NASA FIRMS"} · {manifest?.updated_utc.slice(0, 10) ?? "…"}</span></div>
      <main id="main" tabIndex={-1} className="app-main mx-auto px-4 py-5">
        {!online&&<ConnectionStatus/>}
        <RequestStatus error={error} loading={loading} retry={retry}/>
        {manifest&&<DemoTour go={go} route={route}/>}
        {manifest && (
          <ErrorBoundary key={`${route}-${screenAttempt}`} fallback={(e) => <RequestStatus error={e} retry={()=>setScreenAttempt(n=>n+1)}/> }>
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

      <Navigation route={route} go={go} mobile />
    </div>
  );
}
