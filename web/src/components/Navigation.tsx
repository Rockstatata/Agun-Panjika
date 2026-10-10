import { useEffect, useRef } from "react";
import { useFmt } from "../i18n";
import type { Route } from "../lib/router";

const PRIMARY: {route: Route; en: string; bn: string; icon: string}[] = [
  {route:"home",en:"Overview",bn:"সারসংক্ষেপ",icon:"M3 10 10 3l7 7M5 9v8h10V9"},
  {route:"map",en:"Explore",bn:"অনুসন্ধান",icon:"M3 5l4-2 6 2 4-2v12l-4 2-6-2-4 2zM7 3v12M13 5v12"},
  {route:"sensors",en:"Compare",bn:"তুলনা",icon:"M3 16 7 9l3 4 4-8 3 5M3 18h14"},
  {route:"outlook",en:"Outlook",bn:"পূর্বাভাস",icon:"M10 2 2 17h16zM10 8v4M10 14.5v.5"},
];
export function Navigation({route,go,mobile=false}:{route:Route;go:(route:Route)=>void;mobile?:boolean}) {
 const {lang}=useFmt();
 return <nav className={mobile ? "primary-mobile" : "primary-desktop"} aria-label={lang==='bn'?'প্রধান মেনু':'Primary navigation'}>{PRIMARY.map(n=><button key={n.route} type="button" onClick={()=>go(n.route)} aria-current={route===n.route || n.route==='map' && ['panjika','borders'].includes(route) ? 'page':undefined}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true"><path d={n.icon}/></svg><span>{lang==='bn'?n.bn:n.en}</span></button>)}</nav>;
}
export function MoreNavigation({route,go}:{route:Route;go:(route:Route,p?:Record<string,string|undefined>)=>void}) {
 const {lang,t}=useFmt(); const ref=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{if(ref.current)ref.current.open=false},[route]);
 const destinations:{route:Route;label:string;section?:string}[]=[{route:'panjika',label:t('nav.panjika')},{route:'map',label:t('nav.map')},{route:'borders',label:t('nav.borders')},{route:'method',label:t('nav.method')},{route:'method',label:lang==='bn'?'ডাউনলোড':'Downloads',section:'downloads'},{route:'sensors',label:lang==='bn'?'বৈজ্ঞানিক যাচাই':'Scientific validation',section:'validation'}];
 return <details ref={ref} className="more-menu" onKeyDown={e=>{if(e.key==='Escape'&&ref.current){ref.current.open=false;ref.current.querySelector('summary')?.focus()}}}><summary className="btn">{lang==='bn'?'আরও':'More'} <span aria-hidden="true">⌄</span></summary><div className="more-panel">{destinations.map((n,i)=><button type="button" key={i} onClick={()=>{go(n.route,n.section?{section:n.section}:undefined);if(ref.current)ref.current.open=false}}>{n.label}<span aria-hidden="true">↗</span></button>)}</div></details>;
}
