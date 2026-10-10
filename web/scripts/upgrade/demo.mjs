import { chromium } from 'playwright';import assert from 'node:assert/strict';
const browser=await chromium.launch();const page=await browser.newPage();const base=process.argv[2];
const hash='/home?r=d_rangamati&y=2024&w=17&s=harm%2Cviirs&kilns=1';await page.goto(`${base}/?lang=en&theme=dark#${hash}`);await page.getByRole('button',{name:'Start demo',exact:true}).waitFor();
const before=await page.evaluate(()=>location.hash);await page.getByRole('button',{name:'Start demo',exact:true}).click();
for(let i=0;i<6;i++){await page.locator('.demo-tour').waitFor();await page.getByRole('button',{name:/^Next/}).click()}
await page.getByRole('button',{name:'Finish',exact:false}).click();await page.getByRole('button',{name:'Start demo',exact:true}).waitFor();assert.equal(await page.evaluate(()=>location.hash),before);
await page.getByRole('button',{name:'Start demo',exact:true}).click();await page.keyboard.press('Escape');await page.getByRole('button',{name:'Start demo',exact:true}).waitFor();assert.equal(await page.evaluate(()=>location.hash),before);
console.log('PASS: seven guided steps, Finish and Escape restore original region/year/week/sensors/kiln filters');await browser.close();
