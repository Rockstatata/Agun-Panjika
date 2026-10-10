import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useFmt } from "../i18n";
import { loadGeo, loadPoints, loadRegion, useAsync } from "../lib/data";
import { containsPoint, focusOf, hotspots, selectedFeatures } from "../lib/spatial";
import { seasonAt } from "../lib/series";
import type { Route } from "../lib/router";
import type { Manifest } from "../lib/types";
import { RegionPicker } from "./RegionPicker";
import { ObservatoryIcon } from "./ObservatoryIcon";
import "./Globe.css";
const EarthCanvas = lazy(() => import('./EarthCanvas'));
const Earth3D = lazy(() => import('./Earth3D'));
const loadLand = async () => {
  const r = await fetch(`${import.meta.env.BASE_URL}geo/land.json`);
  if (!r.ok) throw new Error(`Basemap: HTTP ${r.status}`);
  return r.json() as Promise<GeoJSON.FeatureCollection>;
};
export function GlobePanel({ manifest, params, setParams, go }: {
  manifest: Manifest; params: URLSearchParams;
  setParams: (p: Record<string, string | number | undefined>) => void;
  go: (r: Route, p?: Record<string, string | number | undefined>) => void;
}) {
  const { lang, num, year: fy, t, ordinal } = useFmt();
  const bn = lang === 'bn';
  const y = Number(params.get('y')) || manifest.data_through.iso_year;
  const region = params.get('r') ?? 'bgd';
  const [flat, setFlat] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [satellite, setSatellite] = useState(false);
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(() => window.innerWidth >= 640);
  useEffect(() => {
    const query = window.matchMedia('(min-width:640px)');
    const change = () => setFiltersOpen(query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  const { data: doc } = useAsync(() => loadRegion(region), [region]);
  const maxWeek = doc?.seasons[String(y)]?.pct.length ?? 52;
  const w = Math.max(1, Math.min(maxWeek, Number(params.get('w')) || (y === doc?.season.year ? doc.season.to_week : maxWeek)));
  const { data: pts, error: pointsError } = useAsync(() => loadPoints(y), [y]);
  const { data: geo, error: geoError } = useAsync(loadGeo, []);
  const { data: land, error: landError } = useAsync(loadLand, []);
  const areas = useMemo(() => geo ? selectedFeatures(geo, region, manifest) : [], [geo, region, manifest]);
  const focus = useMemo(() => focusOf(areas), [areas]);
  const includeStatic = params.get('kilns') === '1';
  const points = useMemo(() => pts ? hotspots(pts, w, includeStatic).filter(p => region === 'bgd' || areas.some(f => containsPoint(f, p.lon, p.lat))) : [], [pts, w, includeStatic, region, areas]);
  const locations = useMemo(() => [{ ...manifest.country, id: 'bgd' }, ...manifest.regions, ...manifest.districts.map(d => ({ ...d, id: `d_${d.district_id}` }))], [manifest]);
  const matches = search.trim() ? locations.filter(r => `${r.name_en} ${r.name_bn}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).slice(0, 8) : [];
  const error = pointsError || geoError || landError;
  const s = doc && seasonAt(doc, y, w);
  const areaName = locations.find(r => r.id === region);
  const name = areaName ? (bn ? areaName.name_bn : areaName.name_en) : region;
  const years = doc ? Object.keys(doc.seasons).map(Number).sort((a, b) => b - a) : [...manifest.years].reverse();
  const visiblePoints = useMemo(() => satellite ? [] : points, [satellite, points]);
  const onSelect = (p: { lon: number; lat: number }) => {
    const district = geo?.features.find(f => containsPoint(f, p.lon, p.lat));
    if (district) setParams({ r: `d_${district.properties?.district_id}` });
  };
  return <section className="observatory no-print" aria-label={bn ? 'উপগ্রহ পর্যবেক্ষণ' : 'Satellite observations'}>
    <div className="observatory-hero">
      <p className="eyebrow">{bn ? 'পৃথিবীর তথ্য, নিরাপদ আগামী' : 'EARTH INSIGHTS. A SAFER TOMORROW.'}</p>
      <h1>{bn ? 'আজকে দেখুন।' : 'See Today.'}<br /><span>{bn ? 'আগামীকে' : 'Understand'}<br />{bn ? 'বুঝুন।' : 'Tomorrow.'}</span></h1>
      <p className="hero-description">{bn ? 'উপগ্রহের চোখে আগুনের অবস্থান দেখুন, মৌসুমি ধরন বুঝুন। তথ্যভিত্তিক সিদ্ধান্তে গড়ুন আরও নিরাপদ বাংলাদেশ।' : 'Explore satellite observations of fire, understand seasonal patterns, and make informed decisions for a safer Bangladesh.'}</p>
      <button className="btn btn-primary hero-cta" onClick={() => go('map', { r: region, y, w })}>{bn ? 'আগুনের মানচিত্র দেখুন' : 'Explore Fire Map'} <span aria-hidden="true">→</span></button>
    </div>
    <div className="observatory-stats">
      <article className="observation-card"><div className="stat-title"><span className="stat-icon" aria-hidden="true"><ObservatoryIcon kind="fire" /></span><div><h2>{bn ? 'নির্বাচিত সপ্তাহের আগুন' : 'Weekly Fire Activity'}</h2><p>{name} · {fy(y)} / W{num(w)}</p></div></div><div className="stat-value">{pts && geo ? num(points.length) : '…'}<span>{bn ? 'সংরক্ষিত অবস্থান' : 'archived detections'}</span></div><p>{bn ? 'প্রদর্শিত অবস্থান; সমন্বিত মোট নয়' : 'Mapped coordinates · not harmonized totals'}</p></article>
      <article className="observation-card"><div className="stat-title"><span className="stat-icon" aria-hidden="true"><ObservatoryIcon kind="calendar" /></span><h2>{bn ? 'মৌসুমের অবস্থা' : 'Season Status'}</h2></div><strong className="season-level">{s ? t(`levelShort.${s.level}`) : '…'}</strong><p>{s ? (bn ? `${ordinal(s.pct)} পার্সেন্টাইল · সপ্তাহ ${num(w)} পর্যন্ত` : `${ordinal(s.pct)} percentile · through week ${num(w)}`) : (bn ? 'মৌসুম লোড হচ্ছে…' : 'Loading season…')}</p>{s && <div className="percentile-track" aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, s.pct))}%` }} /></div>}</article>
      <article className="observation-card"><div className="stat-title"><span className="stat-icon satellite-icon" aria-hidden="true"><ObservatoryIcon kind="satellite" /></span><h2>{bn ? 'উপগ্রহের তথ্য' : 'Satellite Record'}</h2></div><p className="source-instruments">MODIS + VIIRS · NOAA-20/21</p><p>{bn ? 'হালনাগাদ' : 'Updated'}: {manifest.updated_utc.slice(0, 10)}</p></article>
    </div>
    <div className="observatory-world globe-panel">
      <div className="globe-topline"><span>{bn ? 'বাংলাদেশ ও দক্ষিণ এশিয়া' : 'BANGLADESH & SOUTH ASIA'}</span><button type="button" onClick={() => setFlat(v => !v)} aria-pressed={flat}>{flat ? (bn ? 'পৃথিবী' : 'Globe') : (bn ? '২ডি মানচিত্র' : '2D map')}</button></div>
      {error ? <p className="globe-message" role="status">{bn ? 'এই সময়ের অবস্থান তথ্য পাওয়া যাচ্ছে না।' : 'Geographic data unavailable for this period.'} {error.message}</p> : land && geo && pts ? <Suspense fallback={<p className="globe-message" role="status">{bn ? 'পৃথিবী প্রস্তুত হচ্ছে…' : 'Preparing Earth…'}</p>}>{flat || unavailable ? <EarthCanvas land={land} areas={areas} points={visiblePoints} focus={focus} flat onSelect={onSelect} /> : <Earth3D areas={areas} points={visiblePoints} focus={focus} onSelect={onSelect} onUnavailable={() => setUnavailable(true)} />}</Suspense> : <p className="globe-message" role="status">{bn ? 'পর্যবেক্ষণ লোড হচ্ছে…' : 'Loading observations…'}</p>}
      <div className="globe-provenance"><span>{num(points.length)} {bn ? 'পর্যবেক্ষণ' : 'observations'} · {pts?.sensor.toUpperCase() ?? 'NASA FIRMS'}</span><span>{fy(y)} / W{num(w)}</span></div>
      {unavailable && <p className="globe-note" role="status">{bn ? 'এই যন্ত্রে ৩ডি দৃশ্য পাওয়া যাচ্ছে না। ২ডি মানচিত্র দেখানো হচ্ছে।' : '3D imagery is unavailable on this device. Showing the interactive 2D map.'}</p>}
      <p className="globe-note">{bn ? 'স্থির পৃথিবী ও মেঘের চিত্র' : 'Static Earth & cloud imagery'}: <a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noreferrer">Solar System Scope</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a></p>
      {pts && points.length === 0 && <p className="globe-note">{bn ? 'নির্বাচিত সপ্তাহ ও অঞ্চলে সংরক্ষিত অবস্থান নেই।' : 'No retained coordinates in the selected region and week.'}</p>}
      <p className="globe-note">{bn ? 'সংরক্ষিত সাপ্তাহিক তথ্য; সরাসরি সম্প্রচার নয়।' : 'Archived weekly detections; not a live feed.'} · geoBoundaries</p>
    </div>
    <details className="observatory-controls" open={filtersOpen} onToggle={e => setFiltersOpen(e.currentTarget.open)}>
      <summary>{bn ? 'অঞ্চল ও সময় নির্বাচন' : 'Explore this view'}<span aria-hidden="true">⌄</span></summary>
      <div className="observatory-filter-body">
        <div className="location-search"><label className="sr-only" htmlFor="earth-search">{bn ? 'অঞ্চল খুঁজুন' : 'Search location'}</label><input id="earth-search" type="search" placeholder={bn ? 'জেলা বা অঞ্চল খুঁজুন' : 'Search a district or region'} value={search} onChange={e => setSearch(e.target.value)} aria-controls={search ? 'earth-search-results' : undefined} />{search && <div id="earth-search-results" className="location-results"><p>{bn ? 'মিল পাওয়া অঞ্চল' : 'Matching locations'}</p>{matches.length ? matches.map(r => <button key={r.id} onClick={() => { setParams({ r: r.id }); setSearch(''); }}>{bn ? r.name_bn : r.name_en}<small>{r.id === 'bgd' ? (bn ? '\u09a6\u09c7\u09b6' : 'Country') : r.id.startsWith('d_') ? (bn ? '\u099c\u09c7\u09b2\u09be' : 'District') : (bn ? '\u0985\u099e\u09cd\u099a\u09b2' : 'Region')}</small></button>) : <p role="status">{bn ? 'কোনো অঞ্চল পাওয়া যায়নি' : 'No matching location'}</p>}</div>}</div>
        <div className="earth-mode" aria-label={bn ? 'মানচিত্রের ধরন' : 'Map mode'}><button aria-pressed={!satellite} onClick={() => setSatellite(false)}>{bn ? 'আগুন' : 'Hotspots'}</button><button aria-pressed={satellite} onClick={() => setSatellite(true)}>{bn ? 'উপগ্রহ দৃশ্য' : 'Satellite View'}</button></div>
        <div className="observation-card"><RegionPicker id="earth-region" manifest={manifest} value={region} onChange={r => setParams({ r })} /></div>
        <div className="observation-card period-controls"><label htmlFor="earth-year">{bn ? 'সময়' : 'Time period'}</label><select id="earth-year" className="select" value={y} onChange={e => setParams({ y: e.target.value, w: undefined })}>{years.map(year => <option key={year} value={year}>{fy(year)}</option>)}</select><label htmlFor="earth-week">{bn ? 'সপ্তাহ' : 'Week'} {num(w)} <span>/ {num(maxWeek)}</span></label><input id="earth-week" type="range" min={1} max={maxWeek} value={w} onChange={e => setParams({ w: e.target.value })} /></div>
        <div className="observation-card earth-legend"><h2>{bn ? 'শনাক্তকরণের ধরন' : 'Detection categories'}</h2><p><i className="retained-dot" />{bn ? 'সংরক্ষিত আগুন' : 'Retained fire detection'}</p><p><i className="static-dot" />{bn ? 'স্থির উৎস' : 'Static source / kiln'}</p><label><input type="checkbox" checked={includeStatic} onChange={e => setParams({ kilns: e.target.checked ? '1' : undefined })} />{bn ? 'স্থির উৎস দেখান' : 'Include static sources'}</label><p className="legend-note">{bn ? 'বিন্দুর রং উৎসের ধরন বোঝায়, আগুনের তীব্রতা নয়।' : 'Colors show source category, not fire intensity.'}</p></div>
      </div>
    </details>
  </section>;
}
