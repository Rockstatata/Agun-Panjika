import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

const [preview = 'http://127.0.0.1:4175', original = 'http://127.0.0.1:4176', output = 'test-results/upgrade'] = process.argv.slice(2);
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch();
const samples = [];
try {
  for (const [version, base] of [['original', original], ['preview', preview]]) {
    for (let run = 0; run < 3; run++) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
      const page = await context.newPage();
      await page.addInitScript(() => {
        window.__lcp = 0;
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) window.__lcp = entry.startTime;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      });
      await page.goto(`${base}/?lang=en&theme=dark#/home?r=bgd&y=2024&w=14`);
      await page.getByRole('button', { name: 'Print report', exact: true }).waitFor();
      if (version === 'preview') await page.locator('.earth-renderer canvas').waitFor();
      await page.waitForTimeout(1500);
      samples.push({ version, run, ...await page.evaluate(() => ({
        firstContentfulPaintMs: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
        largestContentfulPaintMs: window.__lcp,
        domContentLoadedMs: performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd,
        scriptDecodedBytes: performance.getEntriesByType('resource').filter(r => r.initiatorType === 'script').reduce((total, r) => total + r.decodedBodySize, 0),
      })) });
      await context.close();
    }
  }
} finally {
  await browser.close();
}
const assets = path.resolve(import.meta.dirname, '../../dist/assets');
const files = await fs.readdir(assets);
const bundles = [];
for (const name of files.filter(name => name.endsWith('.js') || name.endsWith('.css'))) {
  const bytes = await fs.readFile(path.join(assets, name));
  bundles.push({ name, bytes: bytes.length, gzipBytes: zlib.gzipSync(bytes).length });
}
await fs.writeFile(path.join(output, 'performance.json'), JSON.stringify({
  method: 'Three fresh Chromium contexts per production build; localhost, unthrottled. Browser paint timings are environment samples, not Lighthouse scores or mobile guarantees.',
  samples, bundles,
}, null, 2));
console.log(JSON.stringify(samples, null, 2));
