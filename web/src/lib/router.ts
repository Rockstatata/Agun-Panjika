import { useCallback, useEffect, useState } from "react";

export type Route = "home" | "outlook" | "panjika" | "sensors" | "map" | "borders" | "method";
const ROUTES: Route[] = ["home", "outlook", "panjika", "sensors", "map", "borders", "method"];

function parse(): { route: Route; params: URLSearchParams } {
  const h = location.hash.replace(/^#\/?/, "");
  const [path, qs] = h.split("?");
  const route = (ROUTES as string[]).includes(path) ? (path as Route) : "home";
  return { route, params: new URLSearchParams(qs ?? "") };
}

/** Hash router so the app works on GitHub Pages without server rewrites; params make views shareable. */
export function useRoute() {
  const [state, setState] = useState(parse);
  useEffect(() => {
    const on = () => setState(parse());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const go = useCallback((route: Route, params?: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    Object.entries(params ?? {}).forEach(([k, v]) => v !== undefined && p.set(k, String(v)));
    const qs = p.toString();
    location.hash = `/${route}${qs ? `?${qs}` : ""}`;
  }, []);
  /** Update params of the current route without adding history entries. */
  const setParams = useCallback((params: Record<string, string | number | undefined>) => {
    const cur = parse();
    Object.entries(params).forEach(([k, v]) => (v === undefined ? cur.params.delete(k) : cur.params.set(k, String(v))));
    const qs = cur.params.toString();
    history.replaceState(null, "", `#/${cur.route}${qs ? `?${qs}` : ""}`);
    setState({ route: cur.route, params: new URLSearchParams(cur.params) });
  }, []);
  return { ...state, go, setParams };
}
