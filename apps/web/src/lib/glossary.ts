import data from '../data/glossary.json';
import type { GlossRef } from '../types';

export type GlossaryEntry = {
  glossId: string;
  label: string;
  gloss: string;
};

export const GLOSSARY: Record<string, GlossaryEntry> = data.codes as Record<
  string,
  GlossaryEntry
>;

export const GLOSS_REFS: GlossRef[] = Object.entries(GLOSSARY).map(([code, entry]) => ({
  code,
  gloss_id: entry.glossId,
}));

export function glossFor(code: string): GlossaryEntry | undefined {
  return GLOSSARY[code];
}

export const GLOSSARY_VERSION: string = data.version;
