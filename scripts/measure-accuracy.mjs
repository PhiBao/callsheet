import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = process.env.CHROME_PATH || 'google-chrome';
const PROFILE = process.env.PROFILE_DIR || '.chrome-profile';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173/';
const root = path.resolve(import.meta.dirname, '..');
const flags = [
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--enable-blink-features=LanguageModelAPI,BuiltInAIAPIsEnabled',
  '--enable-features=BuiltInAIAPIsEnabled,BuiltInAIEagerInit,ModelExecutionFeaturePromptAPI,OptimizationGuideModelExecution,AIPromptAPIMultimodalInput,AIPromptAPIStructuredOutput',
  '--disable-features=Translate,BackForwardCache',
];

const expected = JSON.parse(fs.readFileSync(path.join(root, 'fixtures/bills/expected.json'), 'utf8'));

const ctx = await chromium.launchPersistentContext(PROFILE, {
  executablePath: CHROME,
  headless: true,
  args: flags,
});
const page = ctx.pages()[0] || (await ctx.newPage());
await page.goto(`${BASE}?v=${Date.now()}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

const digits = (s) => String(s ?? '').replace(/\D/g, '');
const norm = (s) => String(s ?? '').trim().toLowerCase();

let total = 0;
let correct = 0;
const rows = [];

for (const bill of expected.bills) {
  const text = fs.readFileSync(path.join(root, bill.file), 'utf8');
  let extraction;
  let ms = 0;
  try {
    const out = await page.evaluate(async (doc) => {
      const mod = await import('/src/lib/ai.ts');
      const client = mod.getClient();
      const read = await client.readBill(doc);
      return { extraction: read.extraction, ms: read.elapsed_ms, source: read.source };
    }, text);
    extraction = out.extraction;
    ms = out.ms;
  } catch (e) {
    rows.push({ bill: bill.name, error: String(e).slice(0, 160) });
    total += 8;
    continue;
  }

  const checks = {
    patient: norm(extraction.private.patient_name) === norm(bill.patient_name),
    member: norm(extraction.private.member_id) === norm(bill.member_id),
    phone: digits(extraction.private.provider_phone) === digits(bill.provider_phone),
    line_count: extraction.lines.length === bill.lines,
    amount_due: extraction.printed_amount_due_cents === bill.printed_amount_due_cents,
    line_amounts:
      extraction.lines.length === bill.lines &&
      extraction.lines.every((l, i) => l.patient_cents === bill.line_patient_cents[i]),
    line_codes:
      extraction.lines.length === bill.lines &&
      extraction.lines.every((l, i) => l.code === bill.codes[i]),
    line_dates:
      extraction.lines.length === bill.lines &&
      extraction.lines.every((l, i) => l.date === '2026-10-02' || /^\d{4}-\d{2}-\d{2}$/.test(l.date)),
  };
  const passed = Object.values(checks).filter(Boolean).length;
  total += Object.keys(checks).length;
  correct += passed;
  rows.push({
    bill: bill.name,
    ms,
    passed,
    of: Object.keys(checks).length,
    failed: Object.entries(checks)
      .filter(([, v]) => !v)
      .map(([k]) => k),
    got: {
      patient: extraction.private.patient_name,
      member: extraction.private.member_id,
      phone: extraction.private.provider_phone,
      lines: extraction.lines.length,
      due: extraction.printed_amount_due_cents,
      codes: extraction.lines.map((l) => l.code),
      amounts: extraction.lines.map((l) => l.patient_cents),
    },
  });
  console.log(bill.name, JSON.stringify(rows[rows.length - 1]));
}

console.log('\nSUMMARY');
for (const r of rows) console.log(JSON.stringify(r));
console.log(`field accuracy ${correct}/${total} = ${((correct / total) * 100).toFixed(1)}%`);
await ctx.close();
process.exit(0);
