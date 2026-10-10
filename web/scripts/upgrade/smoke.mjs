import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const [base = 'http://127.0.0.1:5270', out = 'baseline', mode = 'smoke'] = process.argv.slice(2);
await fs.mkdir(out, {recursive:true});
const browser = await chromium.launch({headless:true});
const results = [];
for (const config of (mode==='integration' ? [{width:1440,theme:'dark',lang:'en'}] : [
  {width:1440,theme:'light',lang:'en'}, {width:1440,theme:'dark',lang:'en'},
  {width:390,theme:'light',lang:'en'}, {width:360,theme:'dark',lang:'bn'},
  ...(mode === 'final' ? [{width:768,theme:'light',lang:'bn'},{width:1280,theme:'dark',lang:'en'}] : [])
])) {
 const context = await browser.newContext({viewport:{width:config.width,height:960},reducedMotion:'reduce'});
 const page = await context.newPage();
 const errors = []; const consoleErrors=[]; page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
 for (const route of ['home','panjika','sensors','map','outlook','borders','method']) {
  consoleErrors.length=0;
  await page.goto(`${base}/?theme=${config.theme}&lang=${config.lang}#/${route}?r=bgd&y=2024&w=14`);
  await page.locator('main h1').first().waitFor();
  await page.waitForTimeout(route === 'map' ? 3500 : 750);
  const overflow = await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  const alerts = await page.locator('main [role="alert"]').allTextContents();
  const screenshot = `${config.width}-${config.theme}-${config.lang}-${route}.png`;
  await page.screenshot({path:`${out}/${screenshot}`,fullPage:true});
  let axe = [];
  if (mode==='final') axe=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}));
  results.push({...config,route,overflow,alerts,errors:[...errors],consoleErrors:[...consoleErrors],screenshot,axe});
 }
 await context.close();
}
await browser.close();
await fs.writeFile(`${out}/results.json`,JSON.stringify(results,null,2));
console.log(JSON.stringify({screens:results.length,overflows:results.filter(r=>r.overflow).map(r=>[r.width,r.lang,r.route]),errors:results.filter(r=>r.errors.length||r.alerts.length),axe:results.filter(r=>r.axe.length)},null,2));
if(mode!=='baseline') assert.equal(results.filter(r=>r.overflow||r.errors.length||r.alerts.length).length,0);

if(mode==='final') assert.equal(results.filter(r=>r.axe.length).length,0,'WCAG violations');

if(mode==='final') assert.equal(results.filter(r=>r.consoleErrors.length).length,0,'Browser console errors');
