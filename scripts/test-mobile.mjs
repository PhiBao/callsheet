import { chromium } from 'playwright';

const CHROME = process.env.CHROME_PATH || 'google-chrome';
const PROFILE = process.env.PROFILE_DIR || '.chrome-profile';
const BASE = process.env.BASE_URL || 'https://callsheet-hybrid.web.app/';
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
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = ctx.pages()[0] || (await ctx.newPage());
await page.goto(`${BASE}?v=${Date.now()}`, { waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: /Read it on this computer/i }).waitFor({ timeout: 60000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/opencode/mobile-1-idle.png', fullPage: true });

await page.getByRole('button', { name: /Read it on this computer/i }).click();
await page.waitForSelector('text=Check the read', { timeout: 180000 });
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/opencode/mobile-2-review.png', fullPage: true });

await page.getByRole('button', { name: /seal the packet/i }).click();
await page.waitForSelector('text=Prove the fence', { timeout: 240000 });
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/opencode/mobile-3-sheet.png', fullPage: true });

const overflow = await page.evaluate(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
}));
console.log('horizontal overflow check', JSON.stringify(overflow));
await ctx.close();
process.exit(0);
