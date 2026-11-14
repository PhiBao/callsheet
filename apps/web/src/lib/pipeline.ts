import type { Client } from './ai';
import type { Rules } from './rules';
import { sha256Hex } from './rules';
import type {
  CloudDraft,
  Extraction,
  GlossRef,
  InferenceSource,
  ReadResult,
  SealedPacket,
  Verdict,
} from '../types';

export type SealedRun = {
  read: ReadResult;
  packet: SealedPacket;
  packetHash: string;
};

export async function readAndSeal(
  client: Client,
  rules: Rules,
  documentText: string,
  glossary: GlossRef[],
): Promise<SealedRun> {
  const read = await client.readBill(documentText);
  const packet = rules.seal(read.extraction, glossary);
  const packetHash = await sha256Hex(JSON.stringify(packet));
  return { read, packet, packetHash };
}

export type ScriptRun = {
  draft: CloudDraft;
  verdict: Verdict;
  source: InferenceSource;
  elapsed_ms: number;
  note?: string;
};

export async function writeAndVerify(
  client: Client,
  rules: Rules,
  packet: SealedPacket,
  extraction: Extraction,
): Promise<ScriptRun> {
  const script = await client.writeScript(packet);
  const verdict = rules.verify(packet, extraction, script.draft);
  return {
    draft: script.draft,
    verdict,
    source: script.source,
    elapsed_ms: script.elapsed_ms,
    note: script.note,
  };
}
