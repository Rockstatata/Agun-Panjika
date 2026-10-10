import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [base, output = 'test-results/upgrade'] = process.argv.slice(2);
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/?lang=en#/outlook?r=bgd`);
  await page.locator('#ol-h').waitFor();
  await page.locator('#dg-h').waitFor();
  await page.locator('#al-h').waitFor();
  await page.locator('#sk-h').waitFor();
  const region = await page.locator('#ol-region option').nth(1).getAttribute('value');
  await page.locator('#ol-region').selectOption(region);
  await page.waitForURL(new RegExp(`r=${region}`));
  await page.locator('#ss-h').waitFor();
  for (const name of ['alerts.rss', 'alerts_cap.xml', 'forecast.json', 'fireweather.json']) {
    const response = await page.request.get(`${base}/data/${name}`);
    assert.equal(response.status(), 200);
    const original = await fs.readFile(fileURLToPath(new URL(`../../public/data/${name}`, import.meta.url)));
    assert.deepEqual(await response.body(), original, `${name} scientific bytes changed`);
  }
  await page.goto(`${base}/?lang=en#/borders`);
  const years = page.locator('main select');
  await years.waitFor();
  await years.selectOption('2024');
  const before = await page.locator('main svg').last().locator('path').first().getAttribute('d');
  await years.selectOption('2023');
  const after = await page.locator('main svg').last().locator('path').first().getAttribute('d');
  assert.notEqual(before, after);
  await page.goto(`${base}/?lang=en#/method`);
  await page.locator('main').getByText('NOAA-20', { exact: false }).first().waitFor();
  await page.locator('main').getByText(/uncertainty/i).first().waitFor();
  const fallback = await browser.newPage();
  await fallback.route('https://tiles.openfreemap.org/**', route => route.abort());
  await fallback.goto(`${base}/?lang=en#/map?y=2024&w=14`);
  await fallback.getByRole('button', { name: 'Retry map', exact: true }).waitFor();
  assert.equal(await fallback.locator('main tbody tr').count(), 64);
  await fallback.unroute('https://tiles.openfreemap.org/**');
  await fallback.getByRole('button', { name: 'Retry map', exact: true }).click();
  await fallback.waitForFunction(() => !document.querySelector('main [role=status]'));
  assert.equal(errors.length, 0, JSON.stringify(errors));
  await fs.writeFile(path.join(output, 'scientific.json'), JSON.stringify({
    outlookWeatherAlertSkillSections: true, regionSelection: true, rssCapWeatherForecastByteParity: true,
    bordersYearInteraction: true, continuityAndUncertainty: true, tileFailureTable: true,
    tileRetry: true, pageErrors: errors,
  }, null, 2));
  console.log('PASS: outlook/weather/alerts/feeds, borders timeline, continuity, tile failure and retry');
} finally {
  await browser.close();
}
