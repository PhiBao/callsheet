import sampleText from '../data/sample-bill.txt?raw';
import type { Extraction } from '../types';

export const SAMPLE_BILL_TEXT = sampleText;

/**
 * The same document, pre-parsed. Used only for the first paint and for the
 * local parser fallback. The submission path reads the text with the model.
 */
export const SAMPLE_EXTRACTION: Extraction = {
  private: {
    patient_name: 'Alex Rivera',
    member_id: 'XYC 8842 1170',
    account_number: '000-4471-002',
    provider_name: 'Riverside Outpatient Clinic',
    provider_phone: '(555) 014-2280',
    service_address: '1200 Harbor Boulevard, Springfield',
  },
  lines: [
    {
      line: 1,
      date: '2026-10-02',
      code: '99213',
      description: 'Office visit, established',
      billed_cents: 18000,
      allowed_cents: 12800,
      plan_paid_cents: 10200,
      patient_cents: 2600,
    },
    {
      line: 2,
      date: '2026-10-02',
      code: '99213',
      description: 'Office visit, established',
      billed_cents: 18000,
      allowed_cents: 12800,
      plan_paid_cents: 10200,
      patient_cents: 2600,
    },
    {
      line: 3,
      date: '2026-10-02',
      code: '85025',
      description: 'Complete blood count',
      billed_cents: 9000,
      allowed_cents: 6200,
      plan_paid_cents: 4900,
      patient_cents: 1300,
    },
    {
      line: 4,
      date: '2026-10-02',
      code: '80053',
      description: 'Metabolic panel',
      billed_cents: 12000,
      allowed_cents: 8400,
      plan_paid_cents: 6700,
      patient_cents: 1700,
    },
    {
      line: 5,
      date: '2026-10-02',
      code: '71046',
      description: 'Chest X-ray, 2 views',
      billed_cents: 20000,
      allowed_cents: 14000,
      plan_paid_cents: 11200,
      patient_cents: 2800,
    },
  ],
  printed_amount_due_cents: 14600,
  printed_total_billed_cents: 77000,
  printed_total_patient_cents: 11000,
  claim_number: 'CLM-2026-1002-8841',
};

export const SAMPLE_EXPECTED = {
  duplicateCode: '99213',
  duplicateDate: '2026-10-02',
  printedDueCents: 14600,
  lineSumCents: 11000,
  differenceCents: 3600,
};
