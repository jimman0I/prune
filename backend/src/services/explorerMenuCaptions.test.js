import { describe, it, expect } from 'vitest';
import { LANGUAGES as BACKEND_LANGUAGES } from './languages.js';
import { CAPTIONS, captionsFor } from './explorerMenuCaptions.js';

/** The menu captions are written into the registry, so they have to exist for
 * every language Prune is offered in (the frontend's list is the one people
 * choose from) and be safe to write as a menu caption. */
const frontendCodes = async () => {
  const mod = await import(new URL('../../../frontend/src/i18n/languages.js', import.meta.url).href);
  return mod.LANGUAGES.map((l) => l.code);
};

describe('the Explorer menu captions', () => {
  it('has every language the frontend offers, and nothing else', async () => {
    const codes = await frontendCodes();
    expect(codes).toHaveLength(40);
    expect(Object.keys(CAPTIONS).sort()).toEqual([...codes].sort());
  });

  it('agrees with the backend\'s own list of languages', () => {
    expect(Object.keys(CAPTIONS).sort()).toEqual(BACKEND_LANGUAGES.map((l) => l.code).sort());
  });

  it('says the English words exactly', () => {
    expect(CAPTIONS.en).toEqual({ shred: 'Shred with Prune', find: 'Find in Prune (uninstall)' });
  });

  it('has a caption for both entries in every language, and names Prune in each', () => {
    for (const [code, caption] of Object.entries(CAPTIONS)) {
      expect(Object.keys(caption).sort(), code).toEqual(['find', 'shred']);
      for (const text of Object.values(caption)) {
        expect(typeof text, code).toBe('string');
        expect(text.trim(), code).toBe(text);
        expect(text, code).toContain('Prune');
        expect(text.length, code).toBeGreaterThan(8);
        expect(text.length, code).toBeLessThanOrEqual(60);
      }
    }
  });

  it('writes nothing a registry argument or a menu would misread', () => {
    for (const [code, caption] of Object.entries(CAPTIONS)) {
      for (const text of Object.values(caption)) {
        expect(text, code).not.toMatch(/["&%\\\u0000-\u001f]/);
      }
    }
  });

  it('gives the two entries different words in every language', () => {
    for (const [code, caption] of Object.entries(CAPTIONS)) expect(caption.shred, code).not.toBe(caption.find);
  });

  it('falls back to English for a language it does not have', () => {
    for (const bad of ['xx', '', null, undefined, 42, 'constructor', '__proto__']) expect(captionsFor(bad)).toBe(CAPTIONS.en);
    expect(captionsFor('el')).toBe(CAPTIONS.el);
  });
});
