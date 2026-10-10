import { useEffect, useState } from "react";
import type { BridgeDoc, DistrictYear, Manifest, PointsYear, RegionDoc, ValidationDoc } from "./types";

const BASE = `${import.meta.env.BASE_URL}data/`;
const cache = new Map<string, Promise<unknown>>();

export function fetchJson<T>(path: string): Promise<T> {
  if (!cache.has(path)) {
    const p = fetch(BASE + path).then((r) => {
      if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
      return r.json();
    });
    p.catch(() => cache.delete(path));
    cache.set(path, p);
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
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): { data: T | undefined; error: Error | undefined } {
  const [state, setState] = useState<{ data: T | undefined; error: Error | undefined }>({ data: undefined, error: undefined });
  useEffect(() => {
    let live = true;
    setState((s) => ({ data: s.data, error: undefined }));
    fn().then(
      (data) => live && setState({ data, error: undefined }),
      (error: Error) => live && setState({ data: undefined, error }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

export const loadForecast = () => fetchJson<import("./types").ForecastDoc>("forecast.json");
export const loadFireWeather = () => fetchJson<import("./types").FireWeatherDoc>("fireweather.json");
export const loadPartner = () => fetchJson<import("./types").PartnerDoc>("partner.json");
export const loadNeighbours = () => fetchJson<import("./types").NeighboursDoc>("neighbours.json");
export const loadLocal = (district: string) => fetchJson<import("./types").LocalDoc>(`local/${district}.json`);
