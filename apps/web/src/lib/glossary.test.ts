import { describe, expect, it } from 'vitest';
import { GLOSSARY, GLOSS_REFS } from './glossary';

describe('the authored glossary', () => {
  it('covers exactly the demo codes', () => {
    expect(Object.keys(GLOSSARY).sort()).toEqual(['71046', '80053', '85025', '99213']);
    expect(GLOSS_REFS).toHaveLength(4);
  });

  it('keeps bare digits out of the gloss text', () => {
    // A gloss like "about 30 minutes" would be read by the fence as $30.00 and
    // dropped. The gloss explains the code in words, not in numbers.
    for (const entry of Object.values(GLOSSARY)) {
      expect(entry.gloss).not.toMatch(/\d/);
    }
  });

  it('uses a stable gloss id per code', () => {
    for (const [code, entry] of Object.entries(GLOSSARY)) {
      expect(entry.glossId).toBe(`g-${code}`);
    }
  });
});
