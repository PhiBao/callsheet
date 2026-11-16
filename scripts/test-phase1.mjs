import { chromium } from 'playwright';

const CHROME = process.env.CHROME_PATH || 'google-chrome';
const PROFILE = process.env.PROFILE_DIR || '.chrome-profile';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173/';
const flags = [
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--enable-blink-features=LanguageModelAPI,BuiltInAIAPIsEnabled',
  '--enable-features=BuiltInAIAPIsEnabled,BuiltInAIEagerInit,ModelExecutionFeaturePromptAPI,OptimizationGuideModelExecution,AIPromptAPIMultimodalInput,AIPromptAPIStructuredOutput',
  '--disable-features=Translate,BackForwardCache',
];

const bill = `NORTHSIDE IMAGING
9 Depot Road, Fairview
Billing office: 555-019-7700

Patient: Dana Whitfield
Member ID: QWE 1180 4422
Account number: 990-221-778
Claim number: CLM-2026-11-0091

Line  Date        Code    Description            Billed      Allowed     Plan paid   You owe
1     2026-11-03  70450   CT scan, head           $420.00     $300.00     $240.00     $60.00
2     2026-11-03  70450   CT scan, head           $420.00     $300.00     $240.00     $60.00

Total billed:                          $840.00
Total patient responsibility:          $120.00

Amount due from patient:               $120.00`;

const ctx = await chromium.launchPersistentContext(PROFILE, {
  executablePath: CHROME,
  headless: true,
  args: flags,
  recordVideo: { dir: '/tmp/opencode/video', size: { width: 1440, height: 900 } },
});
const page = ctx.pages()[0] || (await ctx.newPage());
await page.setViewportSize({ width: 1440, height: 900 });
page.on('console', (m) => {
  if (m.type() === 'error') console.log('[console]', m.text().slice(0, 300));
});
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));

await page.goto(`${BASE}?v=${Date.now()}`, { waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: /Read it on this computer/i }).waitFor({ timeout: 60000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: '/tmp/opencode/phase1-initial.png', fullPage: true });
console.log('initial screenshot');

await page.getByRole('tab', { name: /Paste text/i }).click();
await page.locator('#paste-area').fill(bill);
await page.waitForTimeout(600);
await page.screenshot({ path: '/tmp/opencode/phase1-paste.png', fullPage: true });
console.log('paste screenshot');

await page.getByRole('button', { name: /Read it on this computer/i }).click();
await page.waitForSelector('text=Check the read', { timeout: 180000 });
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/opencode/phase1-review.png', fullPage: true });
console.log('review screenshot');

await page.getByRole('button', { name: /Looks right — seal the packet/i }).click();
await page.waitForSelector('text=Prove the fence', { timeout: 240000 });
await page.waitForTimeout(1000);
await page.screenshot({ path: '/tmp/opencode/phase1-sheet.png', fullPage: true });
console.log('sheet screenshot');

const text = await page.locator('body').innerText();
console.log('has Dana:', text.includes('Dana Whitfield'));
console.log('has 70450:', text.includes('70450'));
console.log('has write source:', text.includes('WRITE SOURCE'));
console.log('tail', text.slice(-900));

const video = page.video();
await ctx.close();
console.log('VIDEO', await video.path());
process.exit(0);
