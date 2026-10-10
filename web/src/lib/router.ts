import { useCallback, useEffect, useState } from "react";
export type Route = "home" | "outlook" | "panjika" | "sensors" | "map" | "borders" | "method";
const ROUTES: Route[] = ["home", "outlook", "panjika", "sensors", "map", "borders", "method"];
const SHARED = ['r','y','w','s','kilns','from','to'] as const;
type Params = Record<string, string | number | undefined>;
function parse(): { route: Route; params: URLSearchParams } {
 const [path,qs]=location.hash.replace(/^#\/?/,'').split('?');
 return {route:ROUTES.includes(path as Route)?path as Route:'home',params:new URLSearchParams(qs??'')};
}
function persist(p:URLSearchParams) {
 try {localStorage.setItem('ap-filters-v1',JSON.stringify(Object.fromEntries(SHARED.flatMap(k=>p.has(k)?[[k,p.get(k)]]:[]))))}catch{/* blocked storage does not block navigation */}
}
function initial() {
 const state=parse();
 if(!location.hash)try {
  const saved=JSON.parse(localStorage.getItem('ap-filters-v1')??'{}');
  for(const k of SHARED)if(typeof saved[k]==='string')state.params.set(k,saved[k]);
 }catch{/* malformed storage is ignored */}
 return state;
}
/** URL is the shared state. Explicit deep links take precedence over saved filters. */
export function useRoute() {
 const [state,setState]=useState(initial);
 useEffect(()=>{const on=()=>setState(parse());window.addEventListener('hashchange',on);window.addEventListener('popstate',on);return()=>{window.removeEventListener('hashchange',on);window.removeEventListener('popstate',on)}},[]);
 useEffect(()=>persist(state.params),[state.params]);
 const go=useCallback((route:Route,params?:Params)=>{
  const p=new URLSearchParams();
  for(const k of SHARED)if(state.params.has(k))p.set(k,state.params.get(k)!);
  Object.entries(params??{}).forEach(([k,v])=>v===undefined?p.delete(k):p.set(k,String(v)));
  const qs=p.toString();location.hash=`/${route}${qs?`?${qs}`:''}`;
 },[state.params]);
 const setParams=useCallback((params:Params)=>{
  const cur=parse();
  if(!location.hash)for(const [k,v] of state.params)cur.params.set(k,v);
  Object.entries(params).forEach(([k,v])=>v===undefined?cur.params.delete(k):cur.params.set(k,String(v)));
  const qs=cur.params.toString(); const next=`#/${cur.route}${qs?`?${qs}`:''}`;
  if(next!==location.hash)history.pushState(null,'',next);
  setState({route:cur.route,params:new URLSearchParams(cur.params)});
 },[state.params]);
 return {...state,go,setParams};
}
