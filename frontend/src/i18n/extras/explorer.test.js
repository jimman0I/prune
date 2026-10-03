import { describe, it, expect } from 'vitest';
import { CATALOG } from '../catalog.js';
import { LANGUAGES } from '../languages.js';

/** The right-click menu and drop-a-program wording is complete in every
 * language, with the same keys as English, and every function-valued key really
 * uses the values it is given: a translation that dropped the file name, the
 * error or one of the two menu captions would read fine and say nothing. */
describe('explorerV3 in every language', () => {
  const get = (node, path) => path.split('.').reduce((current, key) => current?.[key], node);
  const leaves = (node, prefix = '') => Object.entries(node).flatMap(([key, value]) => (
    value !== null && typeof value === 'object' ? leaves(value, `${prefix}${key}.`) : [`${prefix}${key}`]
  ));
  const EN_PATHS = leaves(CATALOG.en.explorerV3);

  const FUNCTIONS = [
    ['menu.description', ['@@Shred me@@', '@@Find me@@']],
    ['menu.saveFailed', ['@@EACCES@@']],
    ['menu.loadFailed', ['@@timed out@@']],
    ['find.unmatched', ['@@coolapp.exe@@']],
    ['find.failed', ['@@timed out@@']]
  ];

  it('has the namespace in all 40 languages', () => {
    expect(LANGUAGES).toHaveLength(40);
    for (const { code } of LANGUAGES) expect(CATALOG[code].explorerV3, code).toBeTruthy();
  });

  it('has exactly the keys English has, as strings or functions in the same places', () => {
    expect(EN_PATHS.length).toBe(22);
    for (const { code } of LANGUAGES) {
      expect(leaves(CATALOG[code].explorerV3).sort(), code).toEqual([...EN_PATHS].sort());
      for (const path of EN_PATHS) {
        const english = get(CATALOG.en.explorerV3, path);
        const own = get(CATALOG[code].explorerV3, path);
        expect(typeof own, `${code}.${path}`).toBe(typeof english);
        if (typeof own === 'string') expect(own.trim().length, `${code}.${path}`).toBeGreaterThan(2);
      }
    }
  });

  it.each(FUNCTIONS)('puts every argument of %s into the sentence', (path, args) => {
    for (const { code } of LANGUAGES) {
      const fn = get(CATALOG[code].explorerV3, path);
      expect(typeof fn, `${code}.${path}`).toBe('function');
      const text = fn(...args);
      for (const arg of args) expect(text, `${code}.${path}`).toContain(arg);
    }
  });

  it('never leaves a placeholder or a template fragment in the text', () => {
    for (const { code } of LANGUAGES) {
      for (const path of EN_PATHS) {
        const value = get(CATALOG[code].explorerV3, path);
        const text = typeof value === 'function' ? value('X', 'Y') : value;
        expect(text, `${code}.${path}`).not.toMatch(/\{[ab]\}|\$\{|undefined/);
      }
    }
  });

  it('names Prune where the sentence is about Prune, and keeps the file types untranslated', () => {
    for (const { code } of LANGUAGES) {
      const t = CATALOG[code].explorerV3;
      expect(t.menu.title, code).toContain('Prune');
      expect(t.find.title, code).toContain('Prune');
      expect(t.drop.notProgram, code).toMatch(/\.exe/);
      expect(t.drop.notProgram, code).toMatch(/\.lnk/);
    }
  });

  it('uses the same Find wording as the menu entry the registry holds', async () => {
    const { CAPTIONS } = await import(new URL('../../../../backend/src/services/explorerMenuCaptions.js', import.meta.url).href);
    for (const { code } of LANGUAGES) {
      expect(CAPTIONS[code].find.startsWith(CATALOG[code].explorerV3.find.title), code).toBe(true);
    }
  });
});
