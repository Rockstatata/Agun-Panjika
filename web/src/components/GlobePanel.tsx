import { lazy, Suspense, useMemo, useState } from "react";
import { useFmt } from "../i18n";
import { loadGeo, loadPoints, loadRegion, useAsync } from "../lib/data";
import { containsPoint, focusOf, hotspots, selectedFeatures } from "../lib/spatial";
import type { Manifest } from "../lib/types";
import "./Globe.css";
const EarthCanvas=lazy(()=>import('./EarthCanvas'));
const loadLand=async()=>{const r=await fetch(`${import.meta.env.BASE_URL}geo/land.json`);if(!r.ok)throw new Error(`Basemap: HTTP ${r.status}`);return r.json() as Promise<GeoJSON.FeatureCollection>};
export function GlobePanel({manifest,params,setParams}:{manifest:Manifest;params:URLSearchParams;setParams:(p:Record<string,string|number|undefined>)=>void}) {
 const {lang,num,year:fy}=useFmt();const y=Number(params.get('y'))||manifest.data_through.iso_year;
 const region=params.get('r')??'bgd';const [flat,setFlat]=useState(false);
 const {data:doc}=useAsync(()=>loadRegion(region),[region]);
 const maxWeek=doc?.seasons[String(y)]?.pct.length??52;
 const w=Math.max(1,Math.min(maxWeek,Number(params.get('w'))||(y===doc?.season.year?doc.season.to_week:maxWeek)));
 const {data:pts,error:pointsError}=useAsync(()=>loadPoints(y),[y]);const {data:geo,error:geoError}=useAsync(loadGeo,[]);const {data:land,error:landError}=useAsync(loadLand,[]);
 const areas=useMemo(()=>geo?selectedFeatures(geo,region,manifest):[],[geo,region,manifest]);const focus=useMemo(()=>focusOf(areas),[areas]);
 const points=useMemo(()=>pts?hotspots(pts,w,params.get('kilns')==='1').filter(p=>region==='bgd'||areas.some(f=>containsPoint(f,p.lon,p.lat))):[],[pts,w,params,region,areas]);
 const error=pointsError||geoError||landError;
 return <section className="globe-panel no-print" aria-label={lang==='bn'?'উপগ্রহ পর্যবেক্ষণ':'Satellite observations'}><div className="globe-topline"><span>NASA FIRMS / {pts?.sensor.toUpperCase()??'…'}</span><button type="button" onClick={()=>setFlat(v=>!v)} aria-pressed={flat}>{flat?(lang==='bn'?'পৃথিবী':'Globe'):(lang==='bn'?'২ডি মানচিত্র':'2D map')}</button></div>
  {error?<p className="globe-message" role="status">{lang==='bn'?'এই সময়ের অবস্থান তথ্য পাওয়া যাচ্ছে না।':'Geographic data unavailable for this period.'} {error.message}</p>:land&&geo&&pts?<Suspense fallback={<p className="globe-message">{lang==='bn'?'পৃথিবী প্রস্তুত হচ্ছে…':'Preparing Earth…'}</p>}><EarthCanvas land={land} areas={areas} points={points} focus={focus} flat={flat} onSelect={p=>{const district=geo.features.find(f=>containsPoint(f,p.lon,p.lat));if(district)setParams({r:`d_${district.properties?.district_id}`})}}/></Suspense>:<p className="globe-message" role="status">{lang==='bn'?'পর্যবেক্ষণ লোড হচ্ছে…':'Loading observations…'}</p>}
  <div className="globe-provenance"><span><i/> {num(points.length)} {lang==='bn'?'পর্যবেক্ষণ':'observations'}</span><span>{fy(y)} / W{num(w)}</span></div>
  {pts&&points.length===0&&<p className="globe-note">{lang==='bn'?'নির্বাচিত সপ্তাহ ও অঞ্চলে সংরক্ষিত অবস্থান নেই।':'No retained coordinates in the selected region and week.'}</p>}
  <p className="globe-note">{lang==='bn'?'সাপ্তাহিক সংরক্ষিত শনাক্তকরণ; সরাসরি সম্প্রচার নয়।':'Archived weekly detections; not a live feed.'} Natural Earth · geoBoundaries</p>
 </section>;
}
