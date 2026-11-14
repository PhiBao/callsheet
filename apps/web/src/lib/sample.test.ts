import { describe, expect, it } from 'vitest';
import { SAMPLE_EXTRACTION, SAMPLE_EXPECTED } from './sample';

describe('the synthetic sample bill', () => {
  it('has the deliberate arithmetic mismatch', () => {
    const sum = SAMPLE_EXTRACTION.lines.reduce((a, l) => a + l.patient_cents, 0);
    expect(sum).toBe(SAMPLE_EXPECTED.lineSumCents);
    expect(SAMPLE_EXTRACTION.printed_amount_due_cents).toBe(SAMPLE_EXPECTED.printedDueCents);
    expect(SAMPLE_EXTRACTION.printed_amount_due_cents - sum).toBe(
      SAMPLE_EXPECTED.differenceCents,
    );
  });

  it('has the duplicate visit on the same date', () => {
    const dupes = SAMPLE_EXTRACTION.lines.filter(
      (l) =>
        l.code === SAMPLE_EXPECTED.duplicateCode && l.date === SAMPLE_EXPECTED.duplicateDate,
    );
    expect(dupes).toHaveLength(2);
  });

  it('has the private fields the product is meant to keep', () => {
    expect(SAMPLE_EXTRACTION.private.patient_name).toBe('Alex Rivera');
    expect(SAMPLE_EXTRACTION.private.member_id).toBe('XYC 8842 1170');
    expect(SAMPLE_EXTRACTION.private.provider_phone).toBe('(555) 014-2280');
  });
});
