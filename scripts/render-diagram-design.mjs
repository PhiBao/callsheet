import { chromium } from 'playwright';
import path from 'node:path';

const CHROME = process.env.CHROME_PATH || 'google-chrome';
const root = path.resolve(import.meta.dirname, '..');
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });

for (const [name, width, height] of [
  ['boundary', 1440, 1100],
  ['sequence', 1440, 1000],
]) {
  const file = path.join(root, 'docs/diagrams/src', `${name}.html`);
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  await page.goto(`file://${file}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  const shot = path.join(root, 'docs/diagrams', `callsheet-${name}.png`);
  await page.screenshot({ path: shot, fullPage: true });
  console.log(shot);
  await page.close();
}
await browser.close();
process.exit(0);
