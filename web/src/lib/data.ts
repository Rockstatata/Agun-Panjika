import { useCallback, useEffect, useRef, useState } from "react";
import type { BridgeDoc, DistrictYear, Manifest, PointsYear, RegionDoc, ValidationDoc } from "./types";

const BASE = `${import.meta.env.BASE_URL}data/`;
const cache = new Map<string, Promise<unknown>>();

function validateJson(path:string,value:unknown) {
  if(!value||typeof value!=='object')throw new Error(`${path}: invalid data contract`);
  const doc=value as Record<string,unknown>;
  const required=path==='manifest.json'?['country','regions','districts','data_through','years']:path==='national.json'||path.startsWith('region/')?['region','weeks','seasons','normals','season']:path.startsWith('points/')?['year','stride','pts']:path.startsWith('districts/')?['year','districts']:[];
  if(required.some(k=>doc[k]===undefined))throw new Error(`${path}: missing required scientific metadata`);
  if((path==='national.json'||path.startsWith('region/'))&&!Array.isArray(doc.weeks))throw new Error(`${path}: invalid weekly series`);
  if(path.startsWith('points/')&&(!Array.isArray(doc.pts)||typeof doc.stride!=='number'||doc.stride<4))throw new Error(`${path}: invalid coordinate data`);
  return value;
}

export function fetchJson<T>(path: string): Promise<T> {
  if (!cache.has(path)) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    const p = fetch(BASE + path, { signal: controller.signal }).then(async (r) => {
      if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
      let value:unknown;
      try { value=await r.json(); } catch { throw new Error(`${path}: invalid JSON`); }
      return validateJson(path,value);
    }).finally(() => window.clearTimeout(timeout));
    p.catch(() => {if(cache.get(path)===p)cache.delete(path)});
    cache.set(path, p);
    if(cache.size>48)cache.delete(cache.keys().next().value!);
  }
  return cache.get(path) as Promise<T>;
}

export const dataUrl = (path: string) => BASE + path;

export const loadManifest = () => fetchJson<Manifest>("manifest.json");
export const loadRegion = (id: string) => fetchJson<RegionDoc>(id === "bgd" ? "national.json" : `region/${id}.json`);
export const loadValidation = () => fetchJson<ValidationDoc>("validation.json");
export const loadBridge = () => fetchJson<BridgeDoc>("bridge.json");
export const loadDistrictYear = (y: number) => fetchJson<DistrictYear>(`districts/${y}.json`);
export const loadPoints = (y: number) => fetchJson<PointsYear>(`points/${y}.json`);
export const loadGeo = () => fetchJson<GeoJSON.FeatureCollection>("districts.geojson");
export const loadStaticCells = () =>
  fetchJson<{ lat: number; lon: number; n: number; months: number; years: number; peak_share: number }[]>("static_cells.json");

/** Small hook: run an async loader whenever deps change; returns {data, error}. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): { data: T | undefined; error: Error | undefined; loading: boolean; retry: () => void } {
  const key=JSON.stringify(deps);
  const loader=useRef(fn);loader.current=fn;
  const [attempt,setAttempt]=useState(0);
  const [state, setState] = useState<{ key:string; attempt:number; data: T | undefined; error: Error | undefined; loading:boolean }>({ key,attempt,data: undefined, error: undefined,loading:true });
  const retry=useCallback(()=>setAttempt(n=>n+1),[]);
  useEffect(() => {
    let live = true;
    setState({ key,attempt,data:undefined,error:undefined,loading:true });
    const run=loader.current;
    Promise.resolve().then(run).then(
      (data) => live && setState({ key,attempt,data, error: undefined,loading:false }),
      (error: unknown) => live && setState({ key,attempt,data: undefined, error:error instanceof Error?error:new Error(String(error)),loading:false }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key,attempt]);
  // Hide the previous selection in the render BEFORE the new effect executes.
  return state.key===key&&state.attempt===attempt ? {...state,retry} : {data:undefined,error:undefined,loading:true,retry};
}

export const loadForecast = () => fetchJson<import("./types").ForecastDoc>("forecast.json");
export const loadFireWeather = () => fetchJson<import("./types").FireWeatherDoc>("fireweather.json");
export const loadPartner = () => fetchJson<import("./types").PartnerDoc>("partner.json");
export const loadNeighbours = () => fetchJson<import("./types").NeighboursDoc>("neighbours.json");
export const loadLocal = (district: string) => fetchJson<import("./types").LocalDoc>(`local/${district}.json`);
