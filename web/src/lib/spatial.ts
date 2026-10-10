import type { Manifest, PointsYear } from "./types";

export interface Hotspot { lon: number; lat: number; week: number; status: number }
type Area = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;

function inRing(lon:number,lat:number,ring:GeoJSON.Position[]) {
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
  const [xi,yi]=ring[i], [xj,yj]=ring[j];
  if((yi>lat)!==(yj>lat) && lon<(xj-xi)*(lat-yi)/(yj-yi)+xi)inside=!inside;
 }
 return inside;
}
export function containsPoint(f:GeoJSON.Feature,lon:number,lat:number) {
 if(!f.geometry || !['Polygon','MultiPolygon'].includes(f.geometry.type))return false;
 const g=(f as Area).geometry;
 const polygons=g.type==='Polygon'?[g.coordinates]:g.coordinates;
 return polygons.some(rings=>inRing(lon,lat,rings[0])&&!rings.slice(1).some(r=>inRing(lon,lat,r)));
}
export function selectedFeatures(geo:GeoJSON.FeatureCollection,region:string,manifest:Manifest) {
 if(region==='bgd')return geo.features;
 const districts=region.startsWith('d_')?[region.slice(2)]:manifest.districts.filter(d=>d.region_id===region).map(d=>d.district_id);
 const ids=new Set(districts);return geo.features.filter(f=>ids.has(f.properties?.district_id));
}
export function hotspots(points:PointsYear,week:number,includeStatic=false):Hotspot[] {
 const out:Hotspot[]=[];
 for(let i=0;i<points.pts.length;i+=points.stride) {
  const [lon,lat,w,status]=points.pts.slice(i,i+4);
  if(w===week && (status===1 || includeStatic && status===2) && Number.isFinite(lon)&&Number.isFinite(lat))out.push({lon,lat,week:w,status});
 }
 return out;
}
export function focusOf(features:GeoJSON.Feature[]):[number,number] {
 const coords:GeoJSON.Position[]=[];
 for(const f of features) {
  if(f.geometry?.type==='Polygon')coords.push(...f.geometry.coordinates[0]);
  else if(f.geometry?.type==='MultiPolygon')for(const p of f.geometry.coordinates)coords.push(...p[0]);
 }
 if(!coords.length)return [90.35,23.65];
 let w=180,e=-180,s=90,n=-90;
 for(const [x,y] of coords){w=Math.min(w,x);e=Math.max(e,x);s=Math.min(s,y);n=Math.max(n,y)}
 return [(w+e)/2,(s+n)/2];
}
