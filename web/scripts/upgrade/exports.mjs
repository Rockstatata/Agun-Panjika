import { chromium } from 'playwright';
import { PerspectiveCamera, Vector3 } from 'three';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [base, output = 'test-results/upgrade'] = process.argv.slice(2);
const out = path.resolve(output);
const publicData = fileURLToPath(new URL('../../public/data/', import.meta.url));
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await context.newPage();
  const errors = [];
  const consoleErrors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.goto(`${base}/?lang=en&theme=dark#/method?r=bgd&y=2024&w=14`);
  await page.locator('#downloads').waitFor();
  for (const name of ['harmonised.csv', 'harmonised_districts.csv']) {
    const event = page.waitForEvent('download');
    await page.locator(`a[href$="/${name}"]`).click();
    const download = await event;
    const downloaded = await fs.readFile(await download.path());
    const original = await fs.readFile(path.join(publicData, 'download', name));
    assert.deepEqual(downloaded, original, `${name}: exported scientific bytes changed`);
    await download.saveAs(path.join(out, name));
  }
  await page.getByRole('button', { name: 'Copy citation', exact: true }).click();
  await page.getByRole('button', { name: 'Copied', exact: true }).waitFor();
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /NASA FIRMS MODIS C6.1/);

  await page.goto(`${base}/?lang=en&theme=dark#/home?r=bgd&y=2024&w=14`);
  await page.getByRole('button', { name: 'Share card', exact: true }).waitFor();
  await page.locator('.earth-renderer canvas').waitFor();
  const downloadEvent = page.waitForEvent('download', { timeout: 30000 });
  await page.getByRole('button', { name: 'Share card', exact: true }).click();
  const image = await downloadEvent;
  const png = await fs.readFile(await image.path());
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(png.length > 10000);
  await image.saveAs(path.join(out, 'shared-card.png'));
  await page.evaluate(() => { window.print = () => { window.__printCalled = true; }; });
  await page.getByRole('button', { name: 'Print report', exact: true }).click();
  assert.equal(await page.evaluate(() => window.__printCalled), true);
  await page.emulateMedia({ media: 'print' });
  await page.locator('.print-only').waitFor({ state: 'visible' });
  assert.equal(await page.locator('header').isVisible(), false);
  assert.equal(await page.locator('.globe-panel').isVisible(), false);
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).color), 'rgb(23, 35, 53)');
  await page.pdf({ path: path.join(out, 'report.pdf'), printBackground: true });
  await page.emulateMedia({ media: 'screen' });

  // Check accurate geographic projection and the real point -> district interaction.
  await page.getByRole('button', { name: 'Focus', exact: true }).click();
  const geo = await (await context.request.get(`${base}/data/districts.geojson`)).json();
  const pointDoc = await (await context.request.get(`${base}/data/points/2024.json`)).json();
  const coords = geo.features.flatMap(f => f.geometry.type === 'Polygon'
    ? f.geometry.coordinates[0] : f.geometry.coordinates.flatMap(p => p[0]));
  const center = [
    (Math.min(...coords.map(p => p[0])) + Math.max(...coords.map(p => p[0]))) / 2,
    (Math.min(...coords.map(p => p[1])) + Math.max(...coords.map(p => p[1]))) / 2,
  ];
  const canvas = page.locator('.earth-renderer canvas');
  const box = await canvas.boundingBox();
  const position = (lon, lat, radius=1) => {const phi=lat*Math.PI/180,theta=lon*Math.PI/180;return new Vector3(Math.cos(phi)*Math.cos(theta),Math.sin(phi),-Math.cos(phi)*Math.sin(theta)).multiplyScalar(radius);};
  const camera = new PerspectiveCamera(40, box.width/box.height, .01, 30);
  camera.position.copy(position(...center,1.3));camera.lookAt(0,0,0);camera.updateMatrixWorld();
  let point;
  for (let i = 0; i < pointDoc.pts.length; i += pointDoc.stride) {
    const p = pointDoc.pts.slice(i, i + 4);
    if (p[2] === 14 && p[3] === 1) { point = p; break; }
  }
  assert.ok(point);
  const projectedVector = position(point[0],point[1],1.007).project(camera);
  const projected = [(projectedVector.x+1)/2*box.width,(1-projectedVector.y)/2*box.height];
  await canvas.click({ position: { x: projected[0], y: projected[1] } });
  await page.waitForURL(/r=d_/);

  await page.goto(`${base}/?lang=en#/panjika?r=d_rangamati&y=2024&w=14`);
  await page.getByRole('combobox', { name: /^Level/ }).selectOption('union');
  const units = page.getByRole('combobox', { name: /^Union/ });
  await units.locator('option').nth(1).waitFor({ state: 'attached' });
  const unitId = await units.locator('option').nth(1).getAttribute('value');
  await units.selectOption(unitId);
  await page.waitForURL(/u=/);
  await page.locator('main [role=grid]').waitFor();
  await page.getByRole('button', { name: 'Table view', exact: true }).click();
  assert.ok(await page.locator('main tbody tr').count() > 10);

  await page.goto(`${base}/?lang=en#/sensors?r=bgd&y=2024&w=14`);
  const audio = page.getByRole('button', { name: /Raw stitched/ });
  await audio.click();
  assert.equal(await audio.getAttribute('aria-pressed'), 'true');
  await audio.click();
  assert.equal(await audio.getAttribute('aria-pressed'), 'false');
  await page.locator('.primary-desktop').getByRole('button', { name: 'Overview', exact: true }).click();
  await page.locator('main h1').first().waitFor();
  await page.getByRole('button', { name: /Theme:/ }).click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  await page.getByRole('button', { name: 'Switch to Bangla', exact: true }).click();
  assert.equal(await page.locator('html').getAttribute('lang'), 'bn');
  await page.reload();
  await page.locator('main h1').first().waitFor();
  assert.equal(await page.locator('html').getAttribute('lang'), 'bn');
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  assert.equal(errors.length, 0, JSON.stringify(errors));
  assert.equal(consoleErrors.length, 0, JSON.stringify(consoleErrors));
  const denied = await context.newPage();
  await denied.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: {
      writeText: () => Promise.reject(new Error('Clipboard permission denied')),
    } });
  });
  await denied.goto(`${base}/?lang=en#/method`);
  await denied.getByRole('button', { name: 'Copy citation', exact: true }).click();
  await denied.getByRole('alert').filter({ hasText: 'Clipboard permission denied' }).waitFor();
  const shareFailure = await context.newPage();
  await shareFailure.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: () => true });
    Object.defineProperty(navigator, 'share', { value: () => Promise.reject(new Error('Share unavailable')) });
  });
  await shareFailure.goto(`${base}/?lang=en#/home?r=bgd&y=2024&w=14`);
  await shareFailure.getByRole('button', { name: 'Share card', exact: true }).click();
  await shareFailure.getByRole('alert').filter({ hasText: 'Share unavailable' }).waitFor();
  await fs.writeFile(path.join(out, 'exports.json'), JSON.stringify({
    csvByteParity: true, pngSignature: true, clipboard: true, printPdf: true,
    realPointDistrictSelection: true, localUnionTable: true, audioStartStop: true,
    languageThemePersistence: true, clipboardFailureVisible: true, shareFailureVisible: true,
    pageErrors: errors, consoleErrors,
    nativeOperatingSystemShare: 'Skipped: headless Chromium has no native share sheet',
  }, null, 2));
  console.log('PASS: CSV bytes, PNG, citation, print/PDF, real geographic click, local calendar, audio, language/theme persistence');
} finally {
  await browser.close();
}
