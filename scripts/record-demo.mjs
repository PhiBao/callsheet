import { chromium } from 'playwright';
import path from 'node:path';

const CHROME = process.env.CHROME_PATH || 'google-chrome';
const PROFILE = process.env.PROFILE_DIR || '.chrome-profile';
const BASE = process.env.BASE_URL || 'https://callsheet-hybrid.web.app/';
const OUT = process.env.VIDEO_DIR || '/tmp/opencode/video';
const flags = [
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--enable-blink-features=LanguageModelAPI,BuiltInAIAPIsEnabled',
  '--enable-features=BuiltInAIAPIsEnabled,BuiltInAIEagerInit,ModelExecutionFeaturePromptAPI,OptimizationGuideModelExecution,AIPromptAPIMultimodalInput,AIPromptAPIStructuredOutput',
  '--disable-features=Translate,BackForwardCache',
];

const ctx = await chromium.launchPersistentContext(PROFILE, {
  executablePath: CHROME,
  headless: true,
  args: flags,
  recordVideo: { dir: OUT, size: { width: 1600, height: 1200 } },
});
const page = ctx.pages()[0] || (await ctx.newPage());
await page.setViewportSize({ width: 1600, height: 1200 });
const video = page.video();

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
const read = page.getByRole('button', { name: /Read it on this computer/i });
await read.waitFor({ timeout: 60000 });
await page.waitForTimeout(3500);
console.log('title shown');

await read.click();
try {
  await page.waitForSelector('text=Check the read', { timeout: 300000 });
} catch (e) {
  console.log('read did not reach review');
  console.log('error:', await page.locator('.error').first().innerText().catch(() => '(none)'));
  console.log((await page.locator('body').innerText()).slice(0, 600));
  await page.screenshot({ path: '/tmp/opencode/video/fail-read.png', fullPage: true });
  await ctx.close();
  process.exit(1);
}
await page.waitForTimeout(3500);
console.log('review shown');

await page.getByRole('button', { name: /seal the packet/i }).click();
await page.waitForSelector('text=Prove the fence', { timeout: 240000 });
await page.waitForTimeout(5000);
console.log('sheet shown');

await page.getByRole('button', { name: /Prove the fence/i }).click();
await page.waitForTimeout(7000);
console.log('fence shown');

await ctx.close();
const videoPath = await video.path();
console.log('VIDEO', videoPath);
process.exit(0);
