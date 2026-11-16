import { describe, expect, it } from 'vitest';
import { parseEobText, looksLikeBill } from './parse';
import { SAMPLE_BILL_TEXT } from './sample';

describe('the local bill parser', () => {
  it('reads the sample bill exactly', () => {
    const extraction = parseEobText(SAMPLE_BILL_TEXT);
    expect(extraction.private.patient_name).toBe('Alex Rivera');
    expect(extraction.private.member_id).toBe('XYC 8842 1170');
    expect(extraction.private.account_number).toBe('000-4471-002');
    expect(extraction.claim_number).toBe('CLM-2026-1002-8841');
    expect(extraction.private.provider_name).toBe('Riverside Outpatient Clinic');
    expect(extraction.private.provider_phone).toBe('(555) 014-2280');
    expect(extraction.lines).toHaveLength(5);
    expect(extraction.lines[0]).toMatchObject({
      line: 1,
      date: '2026-10-02',
      code: '99213',
      billed_cents: 18000,
      patient_cents: 2600,
    });
    expect(extraction.printed_amount_due_cents).toBe(14600);
    expect(extraction.printed_total_billed_cents).toBe(77000);
    expect(extraction.printed_total_patient_cents).toBe(11000);
  });

  it('keeps the deliberate arithmetic mismatch', () => {
    const extraction = parseEobText(SAMPLE_BILL_TEXT);
    const sum = extraction.lines.reduce((a, l) => a + l.patient_cents, 0);
    expect(sum).toBe(11000);
    expect(extraction.printed_amount_due_cents - sum).toBe(3600);
  });

  it('reads a differently shaped bill', () => {
    const text = [
      'NORTHSIDE IMAGING',
      '9 Depot Road, Fairview',
      'Billing office: 555-019-7700',
      '',
      'Patient: Dana Whitfield',
      'Member ID: QWE 1180 4422',
      'Account number: 990-221-778',
      'Claim number: CLM-2026-11-0091',
      '',
      'Line  Date        Code    Description            Billed      Allowed     Plan paid   You owe',
      '1     2026-11-03  70450   CT scan, head           $420.00     $300.00     $240.00     $60.00',
      '2     2026-11-03  70450   CT scan, head           $420.00     $300.00     $240.00     $60.00',
      '',
      'Total billed:                          $840.00',
      'Total patient responsibility:          $120.00',
      '',
      'Amount due from patient:               $120.00',
    ].join('\n');
    const extraction = parseEobText(text);
    expect(extraction.private.patient_name).toBe('Dana Whitfield');
    expect(extraction.private.provider_phone).toBe('555-019-7700');
    expect(extraction.lines).toHaveLength(2);
    expect(extraction.lines[0].code).toBe('70450');
    expect(extraction.printed_amount_due_cents).toBe(12000);
    // No mismatch here: the parser must not invent one.
    const sum = extraction.lines.reduce((a, l) => a + l.patient_cents, 0);
    expect(sum).toBe(12000);
  });

  it('detects bill-shaped text', () => {
    expect(looksLikeBill(SAMPLE_BILL_TEXT)).toBe(true);
    expect(looksLikeBill('hello world')).toBe(false);
  });

  it('leaves what it cannot read blank instead of guessing', () => {
    const extraction = parseEobText('just some words\nno table here');
    expect(extraction.lines).toHaveLength(0);
    expect(extraction.private.patient_name).toBe('');
    expect(extraction.printed_amount_due_cents).toBe(0);
  });
});
