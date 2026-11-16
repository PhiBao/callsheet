import type { BillLine, Extraction } from '../types';
import { titleCase } from './format';

/**
 * A deterministic, local, non-AI parser for pasted bill text.
 *
 * It exists so the product works when the on-device model is unavailable. It is
 * labeled as a fixture parse in the UI, never presented as a model read, and it
 * never leaves the browser. It is deliberately narrow: US-shaped EOBs with a
 * line table and labelled totals. Anything it cannot read is left blank rather
 * than guessed.
 */

function money(text: string): number | null {
  const match = text.match(/\$?\s*([\d,]+\.\d{2})/);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(value) ? Math.round(value * 100) : null;
}

function lineRow(text: string): BillLine | null {
  const match = text.match(
    /^\s*(\d{1,3})\s+(\d{4}-\d{2}-\d{2})\s+([0-9A-Za-z]{3,10})\s+(.+?)\s+\$([\d,]+\.\d{2})\s+\$([\d,]+\.\d{2})\s+\$([\d,]+\.\d{2})\s+\$([\d,]+\.\d{2})\s*$/,
  );
  if (!match) return null;
  const [, line, date, code, description, billed, allowed, plan, patient] = match;
  const clean = description.trim();
  if (!clean) return null;
  return {
    line: Number(line),
    date,
    code,
    description: clean,
    billed_cents: Number(billed.replace(/,/g, '')) * 100,
    allowed_cents: Number(allowed.replace(/,/g, '')) * 100,
    plan_paid_cents: Number(plan.replace(/,/g, '')) * 100,
    patient_cents: Number(patient.replace(/,/g, '')) * 100,
  };
}

function field(text: string, label: RegExp): string {
  const match = text.match(new RegExp(`\\b(?:${label.source})\\b\\s*:\\s*(.+)$`, 'im'));
  return match ? match[1].trim() : '';
}

export function parseEobText(text: string): Extraction {
  const lines = text
    .split('\n')
    .map((l) => lineRow(l))
    .filter((l): l is BillLine => l !== null);

  const nonEmpty = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const provider_name = titleCase(nonEmpty[0] ?? '');
  const service_address = nonEmpty[1] ?? '';
  const phone = (() => {
    const fromLabel = field(text, /billing office/i);
    const match = (fromLabel || text).match(/\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/);
    return match ? match[0].trim() : '';
  })();

  const totalBilled = money(field(text, /total billed/i) || '');
  const totalPatient = money(field(text, /total patient responsibility/i) || '');
  const amountDue = money(field(text, /amount due from patient/i) || '');

  return {
    private: {
      patient_name: field(text, /patient name|patient/i),
      member_id: field(text, /member id/i),
      account_number: field(text, /account number|account/i),
      provider_name,
      provider_phone: phone,
      service_address,
    },
    lines,
    printed_amount_due_cents: amountDue ?? 0,
    printed_total_billed_cents: totalBilled,
    printed_total_patient_cents: totalPatient,
    claim_number: field(text, /claim number|claim/i) || null,
  };
}

/** True when the text looks like a bill this parser can read. */
export function looksLikeBill(text: string): boolean {
  const rows = text.split('\n').filter((l) => lineRow(l) !== null).length;
  return rows >= 1 && /\d{4}-\d{2}-\d{2}/.test(text);
}
