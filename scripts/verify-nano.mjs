import { chromium } from 'playwright';

/**
 * Checks that this Chrome can run the built-in model, and runs a tiny prompt.
 * Usage:
 *   CHROME_PATH=/path/to/chrome PROFILE_DIR=.chrome-profile node scripts/verify-nano.mjs
 * The profile must be persistent so the 4 GB model is downloaded once.
 */
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
  ignoreDefaultArgs: ['--disable-component-update', '--disable-background-networking'],
  args: flags,
});
const page = ctx.pages()[0] || (await ctx.newPage());
await page.goto('about:blank');
const result = await page.evaluate(async () => {
  const lm = window.LanguageModel;
  if (!lm) return { ok: false, reason: 'LanguageModel is not exposed in this browser.' };
  const availability = await lm.availability();
  if (availability === 'unavailable') {
    return { ok: false, reason: 'This device reports the model as unavailable.', availability };
  }
  const timeout = (ms, tag) =>
    new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout ${tag}`)), ms));
  try {
    const session = await Promise.race([
      lm.create({
        monitor(m) {
          m.addEventListener('downloadprogress', (e) => {
            process.stdout.write(`\rdownload ${Math.round(Number(e.loaded) * 100)}%   `);
          });
        },
      }),
      timeout(900000, 'create'),
    ]);
    const text = await Promise.race([
      session.prompt('Reply with the single word: ready'),
      timeout(120000, 'prompt'),
    ]);
    session.destroy?.();
    return { ok: true, availability, response: String(text).trim() };
  } catch (e) {
    return { ok: false, reason: String(e), availability };
  }
});
console.log(JSON.stringify(result, null, 2));
await ctx.close();
process.exit(result.ok ? 0 : 1);
