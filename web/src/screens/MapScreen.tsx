import { RequestStatus } from "../components/RequestStatus";
import maplibregl, { type GeoJSONSource, type Map as MLMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { LevelIcon } from "../components/LevelBadge";
import { RegionPicker } from "../components/RegionPicker";
import { useFmt } from "../i18n";
import { loadDistrictYear, loadGeo, loadPoints, useAsync } from "../lib/data";
import { isoWeekStart } from "../lib/series";
import { LEVEL_FROM_CODE, type Level, type Manifest } from "../lib/types";
import { boundsOf, contains } from "../lib/mapSpatial";

const LEVELS: Level[] = ["below", "normal", "above", "extreme", "quiet"];

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888";
}

function isDark() {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr) return attr === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Follows the app theme (data-theme attribute) and the system setting, so the basemap matches. */
function useDark(): boolean {
  const [dark, setDark] = useState(isDark);
  useEffect(() => {
    const update = () => setDark(isDark());
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", update);
    return () => {
      mo.disconnect();
      mq.removeEventListener("change", update);
    };
  }, []);
  return dark;
}

const STYLE = (dark: boolean) => `https://tiles.openfreemap.org/styles/${dark ? "dark" : "positron"}`;

export default function MapScreen({ manifest, params, setParams }: { manifest: Manifest; params: URLSearchParams; setParams: (p: Record<string, string | number | undefined>) => void }) {
  const { t, num, date, year: fy, lang } = useFmt();
  const years = manifest.years.filter((y) => y >= 2001);
  const year = Number(params.get("y")) || manifest.data_through.iso_year;
  const { data: dy,error:dyError,loading:dyLoading,retry:retrydy } = useAsync(() => loadDistrictYear(year), [year]);
  const { data: pts,error:ptsError,loading:ptsLoading,retry:retrypts } = useAsync(() => loadPoints(year), [year]);
  const { data: geo,error:geoError,loading:geoLoading,retry:retrygeo } = useAsync(loadGeo, []);
  const maxWeek = useMemo(() => {
    if (!dy) return 52;
    return Math.max(...Object.values(dy.districts).map((d) => d.pct.length));
  }, [dy]);
  const defaultWeek = year === manifest.data_through.iso_year ? manifest.data_through.iso_week : maxWeek;
  const week = Math.max(1,Math.min(Number(params.get("w")) || defaultWeek, maxWeek));
  const region = params.get("r") ?? "bgd";
  const selectedAreas = useMemo(()=>geo?.features.filter(f=>region==='bgd'||region===`d_${f.properties?.district_id}`||manifest.districts.some(d=>d.district_id===f.properties?.district_id&&d.region_id===region))??[],[geo,region,manifest]);
  const [showDistricts,setShowDistricts]=useState(true);
  const [showPoints,setShowPoints]=useState(true);
  const [mapError,setMapError]=useState<string|null>(null);
  const [mapAttempt,setMapAttempt]=useState(0);
  const hideKilns = params.get("kilns") !== "1";
  const setHideKilns = (fn: (v: boolean) => boolean) => setParams({ kilns: fn(hideKilns) ? "0" : "1" });
  const [table, setTable] = useState(false);
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const dark = useDark();
  const dname = (id: string) => {
    const d = manifest.districts.find((x) => x.district_id === id);
    return d ? (lang === "bn" ? d.name_bn : d.name_en) : id;
  };

  // District values for the chosen year and week.
  const districtState = useMemo(() => {
    const out: Record<string, { level: Level; pct: number; harm: number }> = {};
    if (!dy) return out;
    for (const [id, d] of Object.entries(dy.districts)) {
      const wi = Math.min(week, d.pct.length) - 1;
      out[id] = { level: LEVEL_FROM_CODE[d.lv[wi]] ?? "quiet", pct: d.pct[wi], harm: d.harm[week - 1] ?? 0 };
    }
    return out;
  }, [dy, week]);

  const weekPoints = useMemo(() => {
    const kept: GeoJSON.Feature[] = [];
    let removed = 0;
    if (!pts) return { fc: { type: "FeatureCollection", features: kept } as GeoJSON.FeatureCollection, kept: 0, removed };
    const a = pts.pts;
    for (let i = 0; i < a.length; i += pts.stride) {
      if (a[i + 2] !== week) continue;
      if(region!=='bgd'&&!selectedAreas.some(f=>contains(f,a[i],a[i+1])))continue;
      const status = a[i + 3];
      if (status === 2) removed++;
      if (status === 0) continue;
      if(status===2&&hideKilns)continue;
      kept.push({ type: "Feature", properties: { status, lon:a[i],lat:a[i+1],week }, geometry: { type: "Point", coordinates: [a[i], a[i + 1]] } });
    }
    return { fc: { type: "FeatureCollection", features: kept } as GeoJSON.FeatureCollection, kept: kept.filter(f=>f.properties?.status===1).length, removed };
  }, [pts, week,region,selectedAreas,hideKilns]);

  // Create the map once.
  useEffect(() => {
    if (!mapDiv.current || mapRef.current) return;
    const [w, s, e, n] = manifest.country.bbox;
    let map:MLMap;
    try { map = new maplibregl.Map({
      container: mapDiv.current,
      style: STYLE(dark),
      bounds: [
        [w, s],
        [e, n],
      ],
      fitBoundsOptions: { padding: 10 },
      attributionControl: { compact: true },
      cooperativeGestures: window.innerWidth < 640,
    }); } catch(error) {setMapError((error as Error).message);return;}
    setMapError(null);
    map.on('error',()=>setMapError(lang==='bn'?'বেসম্যাপ লোড হয়নি। জেলা সারণি ব্যবহার করুন।':'Basemap could not load. The district table remains available.'));
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    // React StrictMode mounts twice: readiness must belong to this map instance.
    setReady(false);
    map.on("load", () => mapRef.current === map && setReady(true));
    mapRef.current = map;
    return () => {
      setReady(false);
      map.remove();
      mapRef.current = null;
    };
  }, [manifest, dark,mapAttempt]);

  // Add / update sources and layers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !geo) return;
    const fc: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: geo.features.map((f) => {
        const id = (f.properties as { district_id: string }).district_id;
        const st = districtState[id];
        return { ...f, properties: { ...f.properties, level: st?.level ?? "quiet", pct: st?.pct ?? 0, harm: st?.harm ?? 0, name: dname(id) } };
      }),
    };
    const colors = LEVELS.flatMap((l) => [l, cssVar(`--level-${l}`)]);
    if (!map.getSource("districts")) {
      map.addSource("districts", { type: "geojson", data: fc });
      map.addLayer({
        id: "district-fill",
        type: "fill",
        source: "districts",
        paint: {
          "fill-color": ["match", ["get", "level"], ...colors, "#888"] as unknown as string,
          "fill-opacity": ["match", ["get", "level"], "quiet", 0.08, "normal", 0.25, 0.45] as unknown as number,
        },
      });
      map.addLayer({ id: "district-line", type: "line", source: "districts", paint: { "line-color": cssVar("--muted"), "line-width": 0.6 } });
      map.addSource("points", { type: "geojson", data: weekPoints.fc,cluster:true,clusterRadius:35,clusterMaxZoom:9 });
      map.addLayer({id:'point-clusters',type:'circle',source:'points',filter:['has','point_count'],paint:{'circle-color':cssVar('--accent'),'circle-radius':['step',['get','point_count'],14,50,20,200,26],'circle-opacity':.8,'circle-stroke-color':cssVar('--paper'),'circle-stroke-width':2}});
      map.addLayer({id:'cluster-count',type:'symbol',source:'points',filter:['has','point_count'],layout:{'text-field':['number-format',['get','point_count'],{locale:lang}],'text-size':12,'text-font':['Noto Sans Regular']},paint:{'text-color':cssVar('--paper')}});
      map.addLayer({
        id: "points-static",
        type: "circle",
        source: "points",
        filter: ["all",["!",["has","point_count"]],["==", ["get", "status"], 2]],
        paint: { "circle-radius": 4, "circle-color": "#5b7a8c", "circle-stroke-color": "#ffffff", "circle-stroke-width": 1 },
      });
      map.addLayer({
        id: "points-fire",
        type: "circle",
        source: "points",
        filter: ["all",["!",["has","point_count"]],["==", ["get", "status"], 1]],
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 2.2, 10, 5],
          "circle-color": cssVar("--ramp-4"),
          "circle-stroke-color": cssVar("--ramp-5"),
          "circle-stroke-width": 0.5,
          "circle-opacity": 0.9,
        },
      });
      map.on("mouseenter", "district-fill", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "district-fill", () => (map.getCanvas().style.cursor = ""));
    } else {
      (map.getSource("districts") as GeoJSONSource).setData(fc);
      (map.getSource("points") as GeoJSONSource).setData(weekPoints.fc);
    }
    map.setLayoutProperty("points-static", "visibility", hideKilns ? "none" : "visible");
    map.setLayoutProperty('district-fill','visibility',showDistricts?'visible':'none');
    for(const id of ['points-fire','point-clusters','cluster-count'])map.setLayoutProperty(id,'visibility',showPoints?'visible':'none');
    if(!showPoints)map.setLayoutProperty('points-static','visibility','none');
    map.setLayoutProperty('cluster-count','text-field',['number-format',['get','point_count'],{locale:lang}]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, geo, districtState, weekPoints, hideKilns, lang,showPoints,showDistricts]);

  useEffect(()=>{
    const map=mapRef.current;if(!map||!ready)return;
    const bounds=boundsOf(selectedAreas);if(bounds)map.fitBounds(bounds,{padding:40,maxZoom:9,duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:650});
  },[ready,selectedAreas]);
  useEffect(()=>{
    const map=mapRef.current;if(!map||!ready)return;
    const click=(e:maplibregl.MapMouseEvent)=>{
      const layers=['points-fire','points-static','point-clusters','district-fill'].filter(id=>map.getLayer(id));
      const f=map.queryRenderedFeatures(e.point,{layers})[0];if(!f)return;
      if(f.properties?.cluster){const coordinates=(f.geometry as GeoJSON.Point).coordinates;void (map.getSource('points') as GeoJSONSource).getClusterExpansionZoom(f.properties.cluster_id).then(zoom=>map.easeTo({center:[coordinates[0],coordinates[1]],zoom,duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:500}));return;}
      const box=document.createElement('div');const p=f.properties??{};
      const isPoint=f.geometry.type==='Point';const title=document.createElement('strong');title.textContent=isPoint?`${Number(p.lon).toFixed(3)}° E, ${Number(p.lat).toFixed(3)}° N`:dname(p.district_id);box.append(title);
      const info=document.createElement('p');info.textContent=isPoint?`${sensorName} · W${num(week)} · ${p.status===2?(lang==='bn'?'স্থির উৎস':'Static source'):(lang==='bn'?'শনাক্ত আগুন':'Retained detection')}`:`${t(`level.${p.level}`)} · ${t('map.count',{n:num(p.harm)})}`;box.append(info);
      if(!isPoint){const button=document.createElement('button');button.className='btn';button.textContent=lang==='bn'?'জেলা নির্বাচন':'Select district';button.onclick=()=>setParams({r:`d_${p.district_id}`});box.append(button)}
      new maplibregl.Popup().setLngLat(e.lngLat).setDOMContent(box).addTo(map);
    };
    map.on('click',click);return()=>{map.off('click',click)};
  },[ready,lang,week,pts,setParams]);

  const weekEnd = new Date(isoWeekStart(year, week).getTime() + 6 * 86400000);
  const sensorName = pts ? { snpp: "VIIRS S-NPP", noaa20: "VIIRS NOAA-20", modis: "MODIS", noaa21: "VIIRS NOAA-21" }[pts.sensor] ?? pts.sensor : "";
  const ranked = Object.entries(districtState).sort((a, b) => b[1].harm - a[1].harm);

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-2xl font-bold sm:text-3xl">{t("map.title")}</h1>
      <RegionPicker manifest={manifest} value={region} onChange={r=>setParams({r})} id="map-region"/>
      <RequestStatus error={dyError} loading={dyLoading} retry={retrydy}/>
      <RequestStatus error={ptsError} loading={ptsLoading} retry={retrypts}/>
      <RequestStatus error={geoError} loading={geoLoading} retry={retrygeo}/>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_3fr]">
        <label className="flex flex-col gap-1">
          <span className="eyebrow">{t("map.year")}</span>
          <select className="select" value={year} onChange={(e) => setParams({ y: e.target.value })}>
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
            {t("map.week")} {num(week)}: {date(isoWeekStart(year, week))} – {date(weekEnd)}
          </span>
          <input type="range" min={1} max={maxWeek} value={week} onChange={(e) => setParams({ w: e.target.value })} className="mt-2 w-full accent-[var(--accent)]" aria-valuetext={date(weekEnd)} />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="chip" aria-pressed={showDistricts} onClick={()=>setShowDistricts(v=>!v)}>{lang==='bn'?'জেলার স্তর':'District layer'}</button>
        <button type="button" className="chip" aria-pressed={showPoints} onClick={()=>setShowPoints(v=>!v)}>{lang==='bn'?'অগ্নি শনাক্তকরণ':'Hotspot layer'}</button>
        <button type="button" className="chip" aria-pressed={hideKilns} onClick={() => setHideKilns((v) => !v)}>
          {t("map.kiln")}
        </button>
        <button type="button" className="chip" aria-pressed={table} onClick={() => setTable((v) => !v)}>
          {t("map.tableView")}
        </button>
      </div>
      <div className="card relative overflow-hidden" style={{ height: "min(70vh, 560px)" }}>
        {/* maplibre sets position: relative on its container, so size it with height, not inset */}
        <div ref={mapDiv} style={{ width: "100%", height: "100%" }} aria-label={t("map.title")} role="region" />
        {!ready && !mapError && <div className="absolute inset-0 grid place-items-center text-muted">{t("map.loadingMap")}</div>}
        {mapError && <div className="absolute bottom-3 left-3 right-3 rounded-lg bg-[var(--card)] p-3 text-sm" role="status">{mapError} <button type="button" className="btn ml-2" onClick={()=>setMapAttempt(n=>n+1)}>{lang==='bn'?'আবার চেষ্টা':'Retry map'}</button></div>}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
        <span>{t("map.colour")}:</span>
        {LEVELS.map((l) => (
          <span key={l} className="inline-flex items-center gap-1">
            <LevelIcon level={l} size={14} /> {t(`level.${l}`)}
          </span>
        ))}
      </div>
      <div className="text-sm text-muted">
        {t("map.dots")} · {t("map.sensor", { sensor: sensorName })} · {weekPoints.kept ? t("map.count", { n: num(weekPoints.kept) }) : t("map.noDots")}
        {weekPoints.removed > 0 && <> · {t("map.removed", { n: num(weekPoints.removed) })}</>}
      </div>
      <p className="text-xs text-muted">{lang==='bn'?'সংরক্ষিত সাপ্তাহিক পর্যবেক্ষণ। VIIRS: মাঝারি/উচ্চ আস্থা; MODIS: ≥৩০। প্রতিটি বিন্দুর আস্থা ও সময় এই রপ্তানিতে নেই।':'Archived weekly observations. VIIRS: nominal/high confidence; MODIS: ≥30. Individual confidence and acquisition times are not present in this export.'}</p>
      {(table || mapError) && (
        <div tabIndex={0} className="card overflow-x-auto p-3">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">{t("map.district")}</th>
                <th scope="col">{t("map.count", { n: "" }).trim()}</th>
                <th scope="col">{t("map.pct")}</th>
                <th scope="col">{t("home.area")}</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map(([id, s]) => (
                <tr key={id}>
                  <th scope="row">{dname(id)}</th>
                  <td>{num(s.harm)}</td>
                  <td>{s.level === "quiet" ? "—" : num(s.pct)}</td>
                  <td>{t(`level.${s.level}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
