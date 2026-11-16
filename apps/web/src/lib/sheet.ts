import type { Extraction, SealedPacket, Verdict } from '../types';
import { glossFor } from './glossary';

export type Sheet = {
  heading: string;
  opener: string;
  questions: string[];
  writeDown: { label: string; value: string }[];
  phone: string;
  disclaimer: string;
};

/**
 * Assemble the finished sheet locally. The opener and the write-this-down
 * section are filled from the private fields, after the cloud draft has been
 * fenced. The cloud never sees them.
 */
export function buildSheet(
  packet: SealedPacket,
  verdict: Verdict,
  extraction: Extraction,
): Sheet {
  const priv = extraction.private;
  const account = priv.account_number || '—';
  const claim = extraction.claim_number || account;
  const opener = `I'm calling about claim ${claim} for ${priv.patient_name || 'the patient'}. My account number is ${account}.`;

  const priority = (text: string): number => {
    const lower = text.toLowerCase();
    if (
      packet.checks.some((c) => c.id === 'total-mismatch') &&
      /amount due|difference|add up/i.test(lower)
    ) {
      return 0;
    }
    if (
      packet.checks.some((c) => c.id.startsWith('duplicate-')) &&
      /more than one|twice|duplicate|multiple lines/i.test(lower)
    ) {
      return 1;
    }
    return 2;
  };

  const questions = [...verdict.accepted]
    .sort((a, b) => priority(a.text) - priority(b.text))
    .map((sentence) => {
      // The gloss is appended here, on the device, from the authored corpus.
      // The cloud only supplies the citation id.
      const gloss = sentence.citation?.startsWith('g-')
        ? glossFor(sentence.citation.slice(2))
        : undefined;
      return gloss ? `${sentence.text} ${gloss.gloss}` : sentence.text;
    });

  return {
    heading: 'Call the billing office',
    opener,
    questions,
    writeDown: [
      { label: 'Rep I speak with', value: '' },
      { label: 'Reference number', value: '' },
      { label: 'They say they will', value: '' },
      { label: 'I call back on', value: '' },
    ],
    phone: priv.provider_phone || '—',
    disclaimer: 'A reading aid, not medical, legal, or financial advice. It does not tell you to pay or not to pay.',
  };
}

export function sheetToText(sheet: Sheet): string {
  const lines = [
    `Callsheet — ${sheet.heading}`,
    '',
    sheet.opener,
    `Billing office: ${sheet.phone}`,
    '',
    'Questions to ask:',
    ...sheet.questions.map((q, i) => `${i + 1}. ${q}`),
    '',
    'Write this down:',
    ...sheet.writeDown.map((w) => `${w.label}: ${w.value}`),
    '',
    sheet.disclaimer,
  ];
  return lines.join('\n');
}
