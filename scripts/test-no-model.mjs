import { chromium } from 'playwright';

const CHROME = process.env.CHROME_PATH || 'google-chrome';
const PROFILE = process.env.PROFILE_DIR || '.chrome-profile';
const BASE = process.env.BASE_URL || 'https://callsheet-hybrid.web.app/';
const flags = ['--no-sandbox', '--disable-dev-shm-usage'];
if (process.env.NO_AI !== '1') {
  flags.push(
    '--enable-blink-features=LanguageModelAPI,BuiltInAIAPIsEnabled',
    '--enable-features=BuiltInAIAPIsEnabled,BuiltInAIEagerInit,ModelExecutionFeaturePromptAPI,OptimizationGuideModelExecution,AIPromptAPIMultimodalInput,AIPromptAPIStructuredOutput',
    '--disable-features=Translate,BackForwardCache',
  );
}

// A browser with no on-device model at all: the judge-laptop case.
const ctx = await chromium.launchPersistentContext(PROFILE, {
  executablePath: CHROME,
  headless: true,
  args: flags,
});
const page = ctx.pages()[0] || (await ctx.newPage());
await page.goto(`${BASE}?v=${Date.now()}`, { waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: /Read it on this computer/i }).waitFor({ timeout: 60000 });
await page.waitForTimeout(1500);

const pill = await page.locator('.masthead-meta .pill').nth(1).innerText();
console.log('model pill:', pill);

await page.getByRole('button', { name: /Read it on this computer/i }).click();
await page.waitForTimeout(30000);
const errorText = await page.locator('.error').first().innerText().catch(() => '(no error)');
console.log('error banner:', errorText.split('\n')[0]);

const parserButton = page.getByRole('button', { name: /Re-read with the local parser/i });
console.log('parser fallback offered:', await parserButton.count());
if (await parserButton.count()) {
  await parserButton.first().click();
  await page.waitForSelector('text=Call the billing office', { timeout: 60000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/opencode/no-model-fallback.png', fullPage: true });
  const text = await page.locator('body').innerText();
  console.log('sheet reached without the model:', text.includes('Amount due from patient'));
  console.log('read source:', text.includes('local/parse') ? 'local/parse' : '(see receipt)');
}
await ctx.close();
process.exit(0);
