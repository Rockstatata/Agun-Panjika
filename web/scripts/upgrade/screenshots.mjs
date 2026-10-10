import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const [base = 'http://127.0.0.1:4182', out = '../docs/screenshots/soft-earth'] = process.argv.slice(2);
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch();
try {
  for (const [name, width, height] of [['desktop', 1440, 1080], ['mobile', 390, 1100]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    await page.goto(`${base}/?lang=en&theme=light#/home?r=bgd&y=2024&w=14`);
    await page.locator('.earth-realistic[data-ready="true"]').waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(out, `${name}.png`) });
    await page.close();
  }
} finally { await browser.close(); }
