import { describe, it, expect } from 'vitest';
import { CATALOG } from '../catalog.js';
import { LANGUAGES } from '../languages.js';

/** Every language's wording for the Disk Map "last scan" feature really uses the
 * values it is given: a translation that dropped the drive, the time or a
 * count would read fine and say nothing. */
describe('diskMapQolV3 in every language', () => {
  const FUNCTIONS = [
    ['lastScan.title', ['@@C:@@']],
    ['lastScan.scanned', ['@@3h@@']],
    ['growth.comparedWith', ['@@2d@@']],
    ['setting.usage', ['@@4@@', '@@18 MB@@']],
    ['setting.deleteFailed', ['@@EBUSY@@']],
    ['auto.label', ['@@D:@@']]
  ];
  const get = (node, path) => path.split('.').reduce((current, key) => current?.[key], node);

  it('has the namespace in all 40 languages', () => {
    expect(LANGUAGES).toHaveLength(40);
    for (const { code } of LANGUAGES) expect(CATALOG[code].diskMapQolV3, code).toBeTruthy();
  });

  it.each(FUNCTIONS)('puts every argument of %s into the sentence', (path, args) => {
    for (const { code } of LANGUAGES) {
      const fn = get(CATALOG[code].diskMapQolV3, path);
      expect(typeof fn, `${code}.${path}`).toBe('function');
      const text = fn(...args);
      for (const arg of args) expect(text, `${code}.${path}`).toContain(arg);
    }
  });

  it('keeps the units and the numbers that make the help text honest', () => {
    for (const { code } of LANGUAGES) {
      const { setting, growth } = CATALOG[code].diskMapQolV3;
      expect(setting.description, code).toContain('25 MB');
      expect(growth.nothing, code).toMatch(/1 MB/);
    }
  });
});
