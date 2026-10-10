import { chromium } from 'playwright';import assert from 'node:assert/strict';
const base=process.argv[2];const browser=await chromium.launch();
const page=await browser.newPage();page.on('response',r=>{if(r.status()>=400)console.log('HTTP:',r.status(),r.url())});page.on('console',msg=>console.log('Console:',msg.type(),msg.text()));await page.goto(`${base}/?lang=en#/map?r=bgd&y=2024&w=14`);await page.locator('#map-region').waitFor();await page.waitForTimeout(3500);
assert.ok(await page.locator('.maplibregl-canvas').count());
await page.waitForTimeout(2000);
const rendered=await page.evaluate(()=>{
 const div=document.querySelector('.maplibregl-map');let f=div[Object.keys(div).find(k=>k.startsWith('__reactFiber'))];
 for(;f;f=f.return)for(let h=f.memoizedState;h;h=h.next){const m=h.memoizedState?.current;if(m?.queryRenderedFeatures)return {features:m.queryRenderedFeatures({layers:['points-fire','point-clusters']}).length,data:m.getSource('points')?._data?.features?.length,first:m.getSource('points')?._data?.features?.[0],sourceFeatures:m.querySourceFeatures('points').slice(0,2),sourceLoaded:m.isSourceLoaded('points'),layers:m.getStyle().layers.filter(l=>l.source==='points'),center:m.getCenter(),zoom:m.getZoom()}}
 return null;
});
assert.ok(rendered?.features>0,JSON.stringify(rendered));
const layer=page.getByRole('button',{name:'Hotspot layer',exact:true});await layer.click();assert.equal(await layer.getAttribute('aria-pressed'),'false');await layer.click();
await page.locator('#map-region').selectOption('d_band arban'.replace(' ',''));await page.waitForURL(/r=d_bandarban/);
await page.getByRole('button',{name:'District table',exact:true}).click();await page.locator('main table').waitFor();assert.equal(await page.locator('main tbody tr').count(),64);
const fallback=await browser.newPage();const errors=[];fallback.on('pageerror',e=>errors.push(e.message));
await fallback.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='webgl'||type==='webgl2')return null;return original.call(this,type,...args)}});
await fallback.goto(`${base}/?lang=en#/map?y=2024&w=14`);await fallback.locator('main table').waitFor();assert.equal(errors.length,0);
console.log('PASS: region focus, layer visibility, 64-district table, graceful WebGL-disabled fallback');await browser.close();
