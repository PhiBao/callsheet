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
  ignoreDefaultArgs: ['--disable-component-update', '--disable-background-networking'],
  args: flags,
});
const page = ctx.pages()[0] || (await ctx.newPage());
const cdp = await ctx.newCDPSession(page);
await cdp.send('Network.clearBrowserCache');
const logs = [];
page.on('console', (m) => logs.push(`[console ${m.type()}] ${m.text().slice(0, 500)}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${String(e).slice(0, 500)}`));
page.on('requestfailed', (r) => {
  const u = r.url();
  if (/google|firebase|recaptcha|gstatic/i.test(u)) {
    logs.push(`[requestfailed] ${r.failure()?.errorText} ${u.slice(0, 220)}`);
  }
});
page.on('response', (r) => {
  const u = r.url();
  if (r.status() >= 400 && /google|firebase|recaptcha|gstatic/i.test(u)) {
    logs.push(`[response ${r.status()}] ${u.slice(0, 220)}`);
    r.text()
      .then((body) => logs.push(`[body ${r.status()}] ${body.replace(/\s+/g, ' ').slice(0, 900)}`))
      .catch(() => {});
  }
});

await page.goto(`${BASE}?v=${Date.now()}`, { waitUntil: 'networkidle' });
console.log('loaded');
await page.getByRole('button', { name: /Read it on this computer/i }).click();
await page.waitForSelector('text=Write the questions', { timeout: 180000 });
console.log('read done');
await page.getByRole('button', { name: /Write the questions/i }).click();
console.log('write clicked');
await page.waitForTimeout(90000);
const text = await page.locator('body').innerText();
console.log('--- page tail ---');
console.log(text.slice(-1800));
console.log('--- logs ---');
console.log(logs.join('\n').slice(0, 8000));
await page.screenshot({ path: '/tmp/opencode/callsheet-write-diagnose.png', fullPage: true });
await ctx.close();
process.exit(0);
