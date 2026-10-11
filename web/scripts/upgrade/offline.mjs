import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

// Requires npm run preview: Vite enables the existing service worker only in production.
const [base, output = 'test-results/upgrade'] = process.argv.slice(2);
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const home = `${base}/?lang=en&theme=dark#/home?r=bgd&y=2024&w=14`;
  await page.goto(home);
  await page.locator('.earth-renderer canvas').waitFor();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.locator('.earth-renderer canvas').waitFor();
  assert.equal(await page.evaluate(() => !!navigator.serviceWorker.controller), true);
  await page.goto(`${base}/?lang=en&theme=dark#/panjika?r=bgd&y=2024&w=14`);
  await page.getByRole('grid').waitFor();
  await page.goto(home);
  await page.locator('.earth-renderer canvas').waitFor();
  await page.waitForFunction(async () => {
    const cache = await caches.open('agun-panjika-v1');
    const urls = (await cache.keys()).map(request => request.url);
    return urls.some(url => url.endsWith('/data/national.json')) &&
      urls.some(url => url.endsWith('/geo/land.json')) &&
      urls.some(url => url.endsWith('/data/points/2024.json'));
  });
  const before = await page.locator('.globe-provenance').innerText();
  await context.setOffline(true);
  await page.reload();
  await page.locator('.earth-renderer canvas').waitFor();
  await page.locator('.offline-status').waitFor();
  assert.equal(await page.locator('.globe-provenance').innerText(), before);
  await page.screenshot({ path: path.join(output, 'offline-home.png'), fullPage: true });
  await page.goto(`${base}/?lang=en&theme=dark#/panjika?r=bgd&y=2024&w=14`);
  await page.getByRole('grid').waitFor();
  await page.locator('.offline-status').waitFor();
  assert.equal(errors.length, 0, JSON.stringify(errors));
  await fs.writeFile(path.join(output, 'offline.json'), JSON.stringify({
    serviceWorkerControlled: true, cachedHomeReload: true, cachedCalendar: true,
    archivedObservationParity: true, offlineNotice: true, pageErrors: errors,
    limitations: 'Previously visited same-origin resources only; external map tiles and fonts are not cached.',
  }, null, 2));
  console.log('PASS: production service worker, offline reload, cached globe data and calendar, publication notice');
} finally {
  await browser.close();
}
