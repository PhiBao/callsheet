import type {
  CloudDraft,
  DraftSentence,
  Extraction,
  InferenceSource,
  ReadResult,
  ScriptResult,
  SealedPacket,
} from '../types';

export type ClientKind = 'firebase' | 'local';

export type RemoteSettings = {
  cloudModel: string;
  writeEnabled: boolean;
  glossaryVersion: string;
};

export const DEFAULT_REMOTE: RemoteSettings = {
  cloudModel: 'gemini-3.5-flash-lite',
  writeEnabled: true,
  glossaryVersion: '',
};

export type ReceiptInput = {
  packetHash: string;
  readSource: InferenceSource;
  scriptSource: InferenceSource;
  checkIds: string[];
  accepted: number;
  dropped: number;
  glossaryVersion: string;
};

export type Client = {
  kind: ClientKind;
  label: string;
  settings(): Promise<RemoteSettings>;
  readBill(documentText: string): Promise<ReadResult>;
  writeScript(packet: SealedPacket): Promise<ScriptResult>;
  recordReceipt(input: ReceiptInput): Promise<string | null>;
};

const EXTRACTION_PROMPT = `You read a medical bill or explanation of benefits and return one JSON object.
Fields: patient_name, member_id, account_number, provider_name, provider_phone, service_address, claim_number,
printed_amount_due, printed_total_billed, printed_total_patient,
lines: an array of { line, date, code, description, billed, allowed, plan_paid, patient }.
provider_phone is the billing office phone number printed on the document.
Use dollar amounts as numbers with two decimals. Use an empty string or 0 when a field is absent.
Never invent a value that is not on the document.`;

const SCRIPT_PROMPT = `You write short questions for a billing office.
Use only the dollar amounts, codes, dates, and gloss ids in the packet below.
Never mention the patient name, member id, account number, phone number, or address.
Every sentence must be a question or a request that a person can read aloud on a phone call.
If you explain a code, set citation to that code's gloss id. Do not write the gloss text; it is
appended on the device. Otherwise set citation to the string null.
Return JSON with a sentences array of { text, citation }. A citation is only a gloss id from the
packet, or null.`;

const EXTRACTION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    patient_name: { type: 'string' },
    member_id: { type: 'string' },
    account_number: { type: 'string' },
    provider_name: { type: 'string' },
    provider_phone: { type: 'string' },
    service_address: { type: 'string' },
    claim_number: { type: 'string' },
    printed_amount_due: { type: 'number' },
    printed_total_billed: { type: 'number' },
    printed_total_patient: { type: 'number' },
    lines: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          line: { type: 'number' },
          date: { type: 'string' },
          code: { type: 'string' },
          description: { type: 'string' },
          billed: { type: 'number' },
          allowed: { type: 'number' },
          plan_paid: { type: 'number' },
          patient: { type: 'number' },
        },
      },
    },
  },
} as const;

function dollarsToCents(value: unknown): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function parseJsonObject<T>(text: string): T {
  const trimmed = text.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('The model did not return a JSON object.');
  }
  return JSON.parse(trimmed.slice(start, end + 1)) as T;
}

function toExtraction(raw: Record<string, unknown>): Extraction {
  const linesRaw = Array.isArray(raw.lines) ? raw.lines : [];
  return {
    private: {
      patient_name: String(raw.patient_name ?? ''),
      member_id: String(raw.member_id ?? ''),
      account_number: String(raw.account_number ?? ''),
      provider_name: String(raw.provider_name ?? ''),
      provider_phone: String(raw.provider_phone ?? ''),
      service_address: String(raw.service_address ?? ''),
    },    lines: linesRaw.map((item, index) => {
      const line = item as Record<string, unknown>;
      return {
        line: Number(line.line ?? index + 1),
        date: String(line.date ?? ''),
        code: String(line.code ?? '').replace(/[^0-9A-Za-z]/g, ''),
        description: String(line.description ?? ''),
        billed_cents: dollarsToCents(line.billed),
        allowed_cents: dollarsToCents(line.allowed),
        plan_paid_cents: dollarsToCents(line.plan_paid),
        patient_cents: dollarsToCents(line.patient),
      };
    }),
    printed_amount_due_cents: dollarsToCents(raw.printed_amount_due),
    printed_total_billed_cents: raw.printed_total_billed
      ? dollarsToCents(raw.printed_total_billed)
      : null,
    printed_total_patient_cents: raw.printed_total_patient
      ? dollarsToCents(raw.printed_total_patient)
      : null,
    claim_number: raw.claim_number ? String(raw.claim_number) : null,
  };
}

function normalizeSource(value: unknown): InferenceSource {
  return value === 'on_device' ? 'ON_DEVICE' : 'IN_CLOUD';
}

/**
 * A deterministic safety net for the one private field the call sheet needs.
 * If the model misses the billing-office number, the document text still has
 * it, and the number never goes to the cloud.
 */
function recoverPhone(text: string): string {
  const match = text.match(/\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/);
  return match ? match[0].trim() : '';
}

/**
 * Deterministic safety net for the few labelled totals. The model reads the
 * lines; a labelled amount on one line is a parsing job, not a judgement call.
 * These values stay local and are part of the packet.
 */
function recoverMoney(text: string, labels: RegExp[]): number | null {
  for (const label of labels) {
    const line = text.split('\n').find((l) => label.test(l));
    if (!line) continue;
    const match = line.match(/\$?\s*([\d,]+\.\d{2})/);
    if (!match) continue;
    const value = Number(match[1].replace(/,/g, ''));
    if (Number.isFinite(value)) return Math.round(value * 100);
  }
  return null;
}

/** Labels for the amount the patient actually owes, most specific first. */
const AMOUNT_DUE_LABELS = [
  /amount due from patient/i,
  /amount due/i,
  /total due/i,
  /balance due/i,
  /you owe/i,
  /amount you owe/i,
  /patient owes/i,
];

const TOTAL_BILLED_LABELS = [/total billed/i, /total charges/i, /total amount billed/i];
const TOTAL_PATIENT_LABELS = [/total patient responsibility/i, /total you owe/i];

function repairExtraction(extraction: Extraction, text: string): Extraction {
  if (!extraction.private.provider_phone) {
    extraction.private.provider_phone = recoverPhone(text);
  }
  if (extraction.printed_amount_due_cents === 0) {
    const value = recoverMoney(text, AMOUNT_DUE_LABELS);
    if (value != null) extraction.printed_amount_due_cents = value;
  }
  if (!extraction.printed_total_billed_cents) {
    const value = recoverMoney(text, TOTAL_BILLED_LABELS);
    if (value != null) extraction.printed_total_billed_cents = value;
  }
  if (!extraction.printed_total_patient_cents) {
    const value = recoverMoney(text, TOTAL_PATIENT_LABELS);
    if (value != null) extraction.printed_total_patient_cents = value;
  }
  return extraction;
}

export function templateDraft(packet: SealedPacket): CloudDraft {
  const sentences: DraftSentence[] = [];
  const total = packet.checks.find((c) => c.id === 'total-mismatch');
  if (total) {
    sentences.push({
      text: `${total.message} Please walk me through the difference.`,
      citation: null,
    });
  }
  for (const check of packet.checks.filter((c) => c.id.startsWith('duplicate-'))) {
    sentences.push({
      text: `${check.message} Was the same service billed twice?`,
      citation: null,
    });
  }
  for (const ref of packet.glossary) {
    sentences.push({
      text: `What was code ${ref.code} for?`,
      citation: ref.gloss_id,
    });
  }
  sentences.push({
    text: 'Please send the itemized bill and the matching explanation of benefits, so I can compare the two.',
    citation: null,
  });
  return { sentences };
}

/* ------------------------------------------------------------------ */
/* Local development client: raw Chrome Prompt API, no Firebase.       */
/* This is not the submission path. The hosted build uses Firebase.    */
/* ------------------------------------------------------------------ */

class LocalClient implements Client {
  kind: ClientKind = 'local';
  label = 'Local development · raw Chrome Prompt API';

  async settings(): Promise<RemoteSettings> {
    return DEFAULT_REMOTE;
  }

  async readBill(documentText: string): Promise<ReadResult> {
    const started = performance.now();
    const lm = window.LanguageModel;
    if (!lm) {
      throw new Error(
        'This browser does not expose the Chrome Prompt API. Use desktop Chrome 139 or newer.',
      );
    }
    const availability = await lm.availability();
    if (availability === 'unavailable') {
      throw new Error(
        'This device cannot run the on-device model. The bill was not uploaded and no cloud fallback was attempted.',
      );
    }
    const session = await lm.create({
      initialPrompts: [{ role: 'system', content: EXTRACTION_PROMPT }],
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }],
    });
    try {
      const text = await session.prompt(documentText, {
        responseConstraint: EXTRACTION_JSON_SCHEMA,
      });
      const raw = parseJsonObject<Record<string, unknown>>(text);
      const extraction = repairExtraction(toExtraction(raw), documentText);
      return {
        extraction,
        source: 'LOCAL_ON_DEVICE',
        elapsed_ms: Math.round(performance.now() - started),
      };
    } finally {
      session.destroy?.();
    }
  }

  async writeScript(packet: SealedPacket): Promise<ScriptResult> {
    const started = performance.now();
    return {
      draft: templateDraft(packet),
      source: 'LOCAL_CLOUD',
      elapsed_ms: Math.round(performance.now() - started),
      note: 'Template questions. Add Firebase configuration to run the cloud writing step.',
    };
  }

  async recordReceipt(): Promise<string | null> {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Firebase client: the submission path.                               */
/* ------------------------------------------------------------------ */

class FirebaseClient implements Client {
  kind: ClientKind = 'firebase';
  label = 'Firebase AI Logic · hybrid';
  private ready: Promise<{
    ai: any;
    app: any;
    db: any;
    InferenceMode: any;
    InferenceModeValue: any;
    getGenerativeModel: any;
    Schema: any;
    GoogleAIBackend: any;
    firestore: any;
    auth: any;
  }> | null = null;

  constructor(private config: Record<string, string>) {}

  private remoteSettings: Promise<RemoteSettings> | null = null;

  /**
   * Remote Config holds the cloud model, the glossary version, and a kill
   * switch for the writing step. A failure here must never break the product,
   * so the defaults stand.
   */
  async settings(): Promise<RemoteSettings> {
    if (!this.remoteSettings) {
      this.remoteSettings = (async () => {
        try {
          const { getRemoteConfig, fetchAndActivate, getString } = await import(
            'firebase/remote-config'
          );
          const { app } = await this.init();
          const rc = getRemoteConfig(app);
          await fetchAndActivate(rc);
          return {
            cloudModel: getString(rc, 'cloud_model') || DEFAULT_REMOTE.cloudModel,
            writeEnabled: getString(rc, 'write_enabled') !== 'false',
            glossaryVersion: getString(rc, 'glossary_version') || '',
          };
        } catch {
          return DEFAULT_REMOTE;
        }
      })();
    }
    return this.remoteSettings;
  }

  private async init() {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      const [{ initializeApp }, aiMod, appCheckMod, authMod, firestoreMod] =
        await Promise.all([
          import('firebase/app'),
          import('firebase/ai'),
          import('firebase/app-check'),
          import('firebase/auth'),
          import('firebase/firestore'),
        ]);

      const app = initializeApp(this.config);
      const siteKey = import.meta.env.VITE_APP_CHECK_SITE_KEY as string | undefined;
      const debugToken = import.meta.env.VITE_APP_CHECK_DEBUG_TOKEN as string | undefined;
      if (debugToken) {
        await seedDebugToken(debugToken);
        (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      }
      if (siteKey) {
        appCheckMod.initializeAppCheck(app, {
          provider: new appCheckMod.ReCaptchaEnterpriseProvider(siteKey),
          isTokenAutoRefreshEnabled: !debugToken,
        });
      } else if (import.meta.env.DEV) {
        // Local only. A debug token never goes to the hosted build.
        (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
        appCheckMod.initializeAppCheck(app, {
          provider: new appCheckMod.ReCaptchaEnterpriseProvider('debug'),
          isTokenAutoRefreshEnabled: false,
        });
      }

      try {
        await authMod.signInAnonymously(authMod.getAuth(app));
      } catch {
        // The receipt is public and append-only, so an account is not needed.
        // Identity Platform is not enabled on this project.
      }

      const ai = aiMod.getAI(app, { backend: new aiMod.GoogleAIBackend() });
      return {
        ai,
        app,
        db: firestoreMod.getFirestore(app),
        InferenceMode: aiMod.InferenceMode,
        InferenceModeValue: aiMod.InferenceMode,
        getGenerativeModel: aiMod.getGenerativeModel,
        Schema: aiMod.Schema,
        GoogleAIBackend: aiMod.GoogleAIBackend,
        firestore: firestoreMod,
        auth: authMod,
      };
    })();
    return this.ready;
  }

  async readBill(documentText: string): Promise<ReadResult> {
    const started = performance.now();
    const { ai, InferenceMode, getGenerativeModel } = await this.init();
    const model = getGenerativeModel(ai, {
      mode: InferenceMode.ONLY_ON_DEVICE,
      onDeviceParams: {
        promptOptions: { responseConstraint: EXTRACTION_JSON_SCHEMA },
      },
    });
    const result = await model.generateContent(`${EXTRACTION_PROMPT}\n\nDocument:\n${documentText}`);
    const raw = parseJsonObject<Record<string, unknown>>(result.response.text());
    const extraction = repairExtraction(toExtraction(raw), documentText);
    return {
      extraction,
      source: normalizeSource(result.response.inferenceSource),
      elapsed_ms: Math.round(performance.now() - started),
    };
  }

  async writeScript(packet: SealedPacket): Promise<ScriptResult> {
    const started = performance.now();
    const settings = await this.settings();
    if (!settings.writeEnabled) {
      return {
        draft: templateDraft(packet),
        source: 'LOCAL_CLOUD',
        elapsed_ms: Math.round(performance.now() - started),
        note: 'Cloud writing is off in Remote Config. The deterministic questions were used.',
      };
    }
    const { ai, InferenceMode, getGenerativeModel, Schema } = await this.init();
    const sentenceSchema = Schema.object({
      properties: {
        text: Schema.string(),
        citation: Schema.string(),
      },
    });
    const schema = Schema.object({
      properties: {
        sentences: Schema.array({ items: sentenceSchema }),
      },
    });
    const model = getGenerativeModel(ai, {
      mode: InferenceMode.ONLY_IN_CLOUD,
      inCloudParams: {
        model: settings.cloudModel,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: schema,
          temperature: 0.2,
        },
      },
    });
    const prompt = `${SCRIPT_PROMPT}\n\nPacket:\n${JSON.stringify(packet)}`;
    const result = await model.generateContent(prompt);
    const raw = parseJsonObject<CloudDraft>(result.response.text());
    return {
      draft: raw,
      source: normalizeSource(result.response.inferenceSource),
      elapsed_ms: Math.round(performance.now() - started),
    };
  }

  async recordReceipt(input: ReceiptInput): Promise<string | null> {
    try {
      const { db, firestore } = await this.init();
      const ref = await firestore.addDoc(firestore.collection(db, 'receipts'), {
        ...input,
        checkIds: input.checkIds,
        createdAt: firestore.serverTimestamp(),
      });
      return ref.id;
    } catch {
      return null;
    }
  }
}

/**
 * Put a registered App Check debug token where the SDK looks for it. Used only
 * when a debug token is supplied at build time. The rules allow debug tokens
 * in submissions; the shipped build does not carry one.
 */
async function seedDebugToken(token: string): Promise<void> {
  await new Promise<void>((resolve) => {
    try {
      const request = indexedDB.open('firebase-app-check-database', 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('firebase-app-check-store')) {
          request.result.createObjectStore('firebase-app-check-store');
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('firebase-app-check-store', 'readwrite');
        tx.objectStore('firebase-app-check-store').put({
          compositeKey: 'debug-token',
          value: token,
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      };
      request.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

function firebaseConfig(): Record<string, string> | null {  const raw = import.meta.env.VITE_FIREBASE_CONFIG as string | undefined;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    if (!parsed.apiKey || !parsed.projectId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getClient(): Client {
  const config = firebaseConfig();
  if (config) return new FirebaseClient(config);
  return new LocalClient();
}

export type { Extraction };
