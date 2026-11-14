import { chromium } from 'playwright';
import path from 'node:path';

const CHROME = process.env.CHROME_PATH || 'google-chrome';
const root = path.resolve(import.meta.dirname, '..');
const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox'],
});

for (const [name, width, height] of [
  ['where-the-bill-goes', 1200, 820],
  ['read-seal-write-verify', 1200, 920],
]) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(`file://${path.join(root, 'docs/diagrams', `${name}.svg`)}`);
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(root, 'docs/diagrams', `${name}.png`),
    clip: { x: 0, y: 0, width, height },
  });
  console.log(`${name}.png`);
  await page.close();
}

await browser.close();
process.exit(0);
