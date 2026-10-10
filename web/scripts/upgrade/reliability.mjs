import { chromium } from 'playwright';import assert from 'node:assert/strict';
// Block the production worker so Playwright can intercept the intended failing requests.
const browser=await chromium.launch();const base=process.argv[2];const page=await browser.newPage({serviceWorkers:'block'});
await page.route('**/data/region/d_band arban.json'.replace(' ',''),async r=>{await new Promise(resolve=>setTimeout(resolve,900));await r.continue()});
await page.goto(`${base}/?lang=en#/home?r=bgd&y=2024&w=14`);await page.locator('#region').waitFor();
await page.locator('#region').selectOption('d_band arban'.replace(' ',''));await page.waitForTimeout(150);assert.equal(await page.getByText('2,487 VIIRS-equivalent fire detections',{exact:false}).count(),0);await page.locator('[role=status]').first().waitFor();
await page.evaluate(()=>{location.hash='/home?r=d_rangamati&y=2024&w=14'});await page.locator('#region').waitFor();await page.waitForTimeout(1100);assert.equal(await page.locator('#region').inputValue(),'d_rangamati');
const fail=await browser.newPage({serviceWorkers:'block'});let broken=true;await fail.route('**/data/manifest.json',r=>broken?r.fulfill({status:503,body:'unavailable'}):r.continue());
await fail.goto(`${base}/?lang=en#/home`);await fail.getByRole('alert').waitFor();broken=false;await fail.getByRole('button',{name:'Retry',exact:true}).click();await fail.locator('main h1').first().waitFor();
const invalid=await browser.newPage({serviceWorkers:'block'});await invalid.route('**/data/national.json',r=>r.fulfill({status:200,contentType:'application/json',body:'{broken'}));await invalid.goto(`${base}/?lang=en#/home`);await invalid.getByRole('alert').filter({hasText:'invalid JSON'}).waitFor();
console.log('PASS: stale selection hidden, rapid region changes resolve correctly, manifest retry, invalid JSON explicitly reported');await browser.close();
