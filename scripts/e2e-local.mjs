import { chromium } from 'playwright';

const CHROME = process.env.CHROME_PATH || 'google-chrome';
const PROFILE = process.env.PROFILE_DIR || '.chrome-profile';
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
});
const page = ctx.pages()[0] || await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send('Network.clearBrowserCache');
page.on('console', (m) => {
  if (m.type() === 'error' || m.text().includes('callsheet')) {
    console.log('[console]', m.type(), m.text().slice(0, 500));
  }
});
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 400)));

await page.goto(`${process.env.BASE_URL || 'http://127.0.0.1:5173/'}?v=${Date.now()}`, { waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: /Read it on this computer/i }).waitFor({ timeout: 60000 });
console.log('loaded');

const readButton = page.getByRole('button', { name: /Read it on this computer/i });
await readButton.click();
console.log('clicked read');

try {
  await page.waitForSelector('text=Write the questions', { timeout: 180000 });
  console.log('packet ready');
} catch (e) {
  console.log('packet timeout');
  console.log((await page.locator('body').innerText()).slice(0, 2000));
  await page.screenshot({ path: '/tmp/opencode/callsheet-read-fail.png', fullPage: true });
  await ctx.close();
  process.exit(1);
}

await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/opencode/callsheet-review.png', fullPage: true });
console.log('review screenshot');

await page.getByRole('button', { name: /Write the questions/i }).click();
console.log('clicked write');
await page.waitForTimeout(10000);
console.log('after 10s buttons', JSON.stringify(await page.locator('button').allInnerTexts()));
console.log('after 10s fence', (await page.locator('body').innerText()).includes('Citation fence'));
await page.waitForSelector('text=Citation fence', { timeout: 180000 });
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/opencode/callsheet-done.png', fullPage: true });
console.log('done screenshot');

const prove = page.getByRole('button', { name: /Prove the fence/i });
if (await prove.count()) {
  await prove.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/opencode/callsheet-fence.png', fullPage: true });
  console.log('fence screenshot');
}

console.log((await page.locator('body').innerText()).slice(0, 2600));

await ctx.close();
process.exit(0);
