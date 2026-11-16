export type BillLine = {
  line: number;
  date: string;
  code: string;
  description: string;
  billed_cents: number;
  allowed_cents: number;
  plan_paid_cents: number;
  patient_cents: number;
};

export type PrivateFields = {
  patient_name: string;
  member_id: string;
  account_number: string;
  provider_name: string;
  provider_phone: string;
  service_address: string;
};

export type Extraction = {
  private: PrivateFields;
  lines: BillLine[];
  printed_amount_due_cents: number;
  printed_total_billed_cents: number | null;
  printed_total_patient_cents: number | null;
  claim_number: string | null;
};

export type SealedLine = {
  date: string;
  code: string;
  description: string;
  billed_cents: number;
  allowed_cents: number;
  plan_paid_cents: number;
  patient_cents: number;
};

export type Check = {
  id: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  line_numbers: number[];
  numbers_cents: number[];
};

export type GlossRef = { code: string; gloss_id: string };

export type SealedPacket = {
  lines: SealedLine[];
  printed_amount_due_cents: number;
  printed_total_billed_cents: number | null;
  printed_total_patient_cents: number | null;
  checks: Check[];
  glossary: GlossRef[];
};

export type DraftSentence = { text: string; citation: string | null };

export type CloudDraft = { sentences: DraftSentence[] };

export type Dropped = { text: string; reason: string };

export type Verdict = {
  ok: boolean;
  accepted: DraftSentence[];
  dropped: Dropped[];
};

export type CallSheet = {
  heading: string;
  questions: string[];
  phone: string;
  disclaimer: string;
};

export type InferenceSource =
  | 'ON_DEVICE'
  | 'IN_CLOUD'
  | 'LOCAL_ON_DEVICE'
  | 'LOCAL_CLOUD'
  | 'CAPTURED_ON_DEVICE'
  | 'FIXTURE_PARSE';

export type ReadResult = {
  extraction: Extraction;
  source: InferenceSource;
  elapsed_ms: number;
};

export type ScriptResult = {
  draft: CloudDraft;
  source: InferenceSource;
  elapsed_ms: number;
  note?: string;
};
