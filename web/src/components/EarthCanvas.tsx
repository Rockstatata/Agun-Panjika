import { geoDistance, geoGraticule10, geoMercator, geoOrthographic, geoPath } from "d3-geo";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFmt } from "../i18n";
import type { Hotspot } from "../lib/spatial";
import { useWidth } from "../lib/useWidth";

interface Props { land:GeoJSON.FeatureCollection; areas:GeoJSON.Feature[]; points:Hotspot[]; focus:[number,number]; onSelect:(p:Hotspot)=>void; flat:boolean }

/** Orthographic Canvas rendering: a geographic sphere without a WebGL dependency. */
export default function EarthCanvas({land,areas,points,focus,onSelect,flat}:Props) {
 const {lang,num}=useFmt(); const [ref,width]=useWidth<HTMLDivElement>(480);const canvas=useRef<HTMLCanvasElement>(null);
 const [center,setCenter]=useState<[number,number]>(focus);const [zoom,setZoom]=useState(1);
 const drag=useRef<{x:number;y:number;center:[number,number];moved:boolean}|null>(null);
 const hit=useRef<{x:number;y:number;p:Hotspot}[]>([]);const frame=useRef(0);
 const [selected,setSelected]=useState<Hotspot|null>(null);const [failed,setFailed]=useState(false);
 useEffect(()=>{setCenter(focus);setSelected(null)},[focus[0],focus[1]]);
 useEffect(()=>()=>cancelAnimationFrame(frame.current),[]);
 const height=width<400?300:360;
 const projection=useMemo(()=>flat ? geoMercator().center(center).scale(width*2.8*zoom).translate([width/2,height/2]).clipExtent([[0,0],[width,height]]) : geoOrthographic().rotate([-center[0],-center[1]]).scale(Math.min(width,height)*.44*zoom).translate([width/2,height/2]).clipAngle(90),[center,width,height,zoom,flat]);
 useEffect(()=>{
  const el=canvas.current;const ctx=el?.getContext('2d');if(!el||!ctx){setFailed(true);return}
  const dpr=Math.min(devicePixelRatio||1,2);el.width=width*dpr;el.height=height*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,width,height);
  const path=geoPath(projection,ctx);
  if(!flat){
   const r=Math.min(width,height)*.44*zoom;const gradient=ctx.createRadialGradient(width*.38,height*.25,0,width/2,height/2,r);
   gradient.addColorStop(0,'#203b52');gradient.addColorStop(.8,'#0d2237');gradient.addColorStop(1,'#06101f');
   ctx.beginPath();path({type:'Sphere'});ctx.fillStyle=gradient;ctx.fill();
   ctx.shadowColor='#6ed8f0';ctx.shadowBlur=14;ctx.strokeStyle='#4b8a9f';ctx.lineWidth=1;ctx.stroke();ctx.shadowBlur=0;
  }
  ctx.beginPath();path(land);ctx.fillStyle='#203f4d';ctx.fill();ctx.strokeStyle='#548392';ctx.lineWidth=.6;ctx.stroke();
  ctx.beginPath();path(geoGraticule10());ctx.strokeStyle='#6ed8f024';ctx.lineWidth=.6;ctx.stroke();
  ctx.beginPath();path({type:'FeatureCollection',features:areas});ctx.strokeStyle='#6ed8f0';ctx.lineWidth=1.2;ctx.stroke();
  hit.current=[];const bins=new Map<string,{x:number;y:number;n:number;static:boolean}>();
  for(const p of points){
   if(!flat&&geoDistance([p.lon,p.lat],center)>Math.PI/2)continue;
   const xy=projection([p.lon,p.lat]);if(!xy)continue;const [x,y]=xy;
   if(x<0||x>width||y<0||y>height)continue;
   hit.current.push({x,y,p});const key=`${Math.round(x/4)},${Math.round(y/4)},${p.status}`;const b=bins.get(key);
   if(b)b.n++;else bins.set(key,{x,y,n:1,static:p.status===2});
  }
  for(const b of bins.values()){
   ctx.beginPath();ctx.arc(b.x,b.y,Math.min(5,1.8+Math.log2(b.n)*.5),0,Math.PI*2);ctx.fillStyle=b.static?'#6ed8f0':'#ff9b54';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=5;ctx.fill();
  }
  ctx.shadowBlur=0;
  const xy=projection(focus);if(xy&&(flat||geoDistance(focus,center)<Math.PI/2)){
   ctx.beginPath();ctx.arc(xy[0],xy[1],10,0,Math.PI*2);ctx.strokeStyle='#6ed8f0';ctx.lineWidth=1;ctx.stroke();
   ctx.fillStyle='#d3f6fc';ctx.font='10px Inter, sans-serif';ctx.fillText('BANGLADESH',Math.min(width-85,xy[0]+15),xy[1]-12);
  }
 },[projection,width,height,land,areas,points,center,focus,zoom,flat]);
 const nearest=(x:number,y:number)=>{let best:Hotspot|null=null;let dist=10;for(const h of hit.current){const d=Math.hypot(h.x-x,h.y-y);if(d<dist){dist=d;best=h.p}}return best};
 const rotate=(dx:number,dy:number)=>setCenter(c=>[c[0]+dx,Math.max(-80,Math.min(80,c[1]+dy))]);
 return <div ref={ref} className="earth-renderer">
  {failed?<p role="alert">{lang==='bn'?'চিত্র প্রদর্শন সম্ভব নয়। নিচের তথ্য ও মানচিত্র ব্যবহার করুন।':'Canvas unavailable. Use the observation details and the Explore map.'}</p>:<canvas ref={canvas} style={{width:'100%',height,touchAction:'none'}} tabIndex={0} role="img" aria-label={lang==='bn'?'পৃথিবী: তীরচিহ্ন দিয়ে ঘোরান, + বা − দিয়ে জুম করুন':'Earth: drag to rotate, arrow keys to turn, + or − to zoom'}
   onKeyDown={e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-'].includes(e.key))e.preventDefault();if(e.key==='ArrowLeft')rotate(-8,0);if(e.key==='ArrowRight')rotate(8,0);if(e.key==='ArrowUp')rotate(0,8);if(e.key==='ArrowDown')rotate(0,-8);if(e.key==='+')setZoom(z=>Math.min(8,z*1.2));if(e.key==='-')setZoom(z=>Math.max(.7,z/1.2))}}
   onPointerDown={e=>{drag.current={x:e.clientX,y:e.clientY,center,moved:false};e.currentTarget.setPointerCapture(e.pointerId)}}
   onPointerMove={e=>{const d=drag.current;if(d){const dx=e.clientX-d.x,dy=e.clientY-d.y;d.moved ||= Math.abs(dx)+Math.abs(dy)>5;cancelAnimationFrame(frame.current);frame.current=requestAnimationFrame(()=>setCenter([d.center[0]-dx*.35/zoom,Math.max(-80,Math.min(80,d.center[1]+dy*.35/zoom))]))}else {const r=e.currentTarget.getBoundingClientRect();setSelected(nearest(e.clientX-r.left,e.clientY-r.top))}}}
   onPointerUp={e=>{const d=drag.current;drag.current=null;if(d&&!d.moved){const r=e.currentTarget.getBoundingClientRect();const p=nearest(e.clientX-r.left,e.clientY-r.top);setSelected(p);if(p)onSelect(p)}}}
   onPointerCancel={()=>{drag.current=null;cancelAnimationFrame(frame.current)}} onPointerLeave={()=>!drag.current&&setSelected(null)}/>
  }
  <div className="earth-tools"><button type="button" onClick={()=>setZoom(z=>Math.min(8,z*1.4))} aria-label={lang==='bn'?'জুম বাড়ান':'Zoom in'}>+</button><button type="button" onClick={()=>setZoom(z=>Math.max(.7,z/1.4))} aria-label={lang==='bn'?'জুম কমান':'Zoom out'}>−</button><button type="button" onClick={()=>{setCenter(focus);setZoom(flat?1:4)}}>{lang==='bn'?'কেন্দ্র':'Focus'}</button><button type="button" onClick={()=>{setCenter(focus);setZoom(1)}}>{lang==='bn'?'পৃথিবী':'Earth'}</button></div>
  <p className="earth-detail" aria-live="polite">{selected?`${selected.lon.toFixed(3)}° E · ${selected.lat.toFixed(3)}° N · ${lang==='bn'?'সপ্তাহ':'Week'} ${num(selected.week)} · ${selected.status===2?(lang==='bn'?'স্থির উৎস':'Static source'):(lang==='bn'?'শনাক্ত আগুন':'Retained detection')}`:lang==='bn'?'টেনে ঘোরান · আগুনে ক্লিক করে জেলা নির্বাচন করুন':'Drag to rotate · Select a detection to explore its district'}</p>
 </div>;
}
