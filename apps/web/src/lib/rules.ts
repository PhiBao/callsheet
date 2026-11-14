import type {
  Check,
  CloudDraft,
  Extraction,
  GlossRef,
  SealedPacket,
  Verdict,
} from '../types';

export type Rules = {
  seal(extraction: Extraction, glossary: GlossRef[]): SealedPacket;
  checks(extraction: Extraction): Check[];
  verify(packet: SealedPacket, extraction: Extraction, draft: CloudDraft): Verdict;
};

type WasmModule = {
  seal_json(extraction: string, glossary: string): string;
  checks_json(extraction: string): string;
  verify_json(packet: string, extraction: string, draft: string): string;
};

let modulePromise: Promise<WasmModule> | null = null;

async function loadWasm(): Promise<WasmModule> {
  if (modulePromise) return modulePromise;
  modulePromise = (async () => {
    const mod = await import('../wasm/callsheet_rules.js');
    await mod.default();
    return mod as unknown as WasmModule;
  })();
  return modulePromise;
}

/**
 * The browser uses the same Rust crate the tests exercise. If the WASM bundle
 * is missing, the app fails loudly instead of silently using a second copy of
 * the rules.
 */
export async function loadRules(): Promise<Rules> {
  const wasm = await loadWasm();
  return {
    seal: (extraction, glossary) =>
      JSON.parse(wasm.seal_json(JSON.stringify(extraction), JSON.stringify(glossary))) as SealedPacket,
    checks: (extraction) =>
      JSON.parse(wasm.checks_json(JSON.stringify(extraction))) as Check[],
    verify: (packet, extraction, draft) =>
      JSON.parse(
        wasm.verify_json(
          JSON.stringify(packet),
          JSON.stringify(extraction),
          JSON.stringify(draft),
        ),
      ) as Verdict,
  };
}

export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
