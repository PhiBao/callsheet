import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = process.env.CHROME_PATH || 'google-chrome';
const root = path.resolve(import.meta.dirname, '..');
const dir = '/tmp/opencode/video/cards';
fs.mkdirSync(dir, { recursive: true });

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const ctx = await browser.newContext({
  viewport: { width: 1600, height: 1200 },
  recordVideo: { dir, size: { width: 1600, height: 1200 } },
});

for (const [name, ms] of [
  ['title', 8000],
  ['end', 6000],
]) {
  const page = await ctx.newPage();
  await page.goto(`file://${path.join(root, 'docs/video', `${name}.html`)}`);
  await page.waitForTimeout(ms);
  const video = page.video();
  await page.close();
  const src = await video.path();
  const dest = path.join(dir, `card-${name}.webm`);
  fs.renameSync(src, dest);
  console.log(dest);
}

await browser.close();
process.exit(0);
