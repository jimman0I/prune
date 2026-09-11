import { describe, it, expect } from 'vitest';
import { CATALOG } from './catalog.js';
import { LANGUAGES } from './languages.js';

/** The property that keeps 40 languages from silently drifting apart: no
 * screen may end up with a real translation in most of the catalog and a
 * hole -- or worse, a stray English string nobody meant to ship -- in one
 * language because a key was added after that language's block was
 * written. Mirrors what installerLanguages.test.cjs already checks for
 * the installer's own strings, one level up: here it's whole screens of
 * UI text, not three lines. */

/** Every dotted path to a leaf value in an object, e.g. "nav.dashboard". */
function paths(node, prefix = '') {
  if (typeof node !== 'object' || node === null) return [prefix];
  return Object.entries(node).flatMap(([key, value]) => paths(value, prefix ? `${prefix}.${key}` : key));
}

function get(node, path) {
  return path.split('.').reduce((current, key) => current?.[key], node);
}

describe('CATALOG', () => {
  it('has exactly the languages.js list, no more and no fewer', () => {
    const catalogCodes = Object.keys(CATALOG).sort();
    const listedCodes = LANGUAGES.map((l) => l.code).sort();
    expect(catalogCodes).toEqual(listedCodes);
  });

  it('gives every language every key English has, and nothing extra', () => {
    const englishPaths = paths(CATALOG.en).sort();
    const problems = [];
    for (const code of Object.keys(CATALOG)) {
      if (code === 'en') continue;
      const ownPaths = paths(CATALOG[code]).sort();
      for (const path of englishPaths) if (!ownPaths.includes(path)) problems.push(`${code} is missing ${path}`);
      for (const path of ownPaths) if (!englishPaths.includes(path)) problems.push(`${code} has an extra ${path}`);
    }
    expect(problems).toEqual([]);
  });

  it('matches English\'s type at every key -- a function where English has one, a string where it has one', () => {
    const problems = [];
    for (const path of paths(CATALOG.en)) {
      const englishType = typeof get(CATALOG.en, path);
      for (const code of Object.keys(CATALOG)) {
        if (code === 'en') continue;
        const actual = typeof get(CATALOG[code], path);
        if (actual !== englishType) problems.push(`${code}.${path} is ${actual}, English is ${englishType}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('leaves no value blank', () => {
    const problems = [];
    for (const code of Object.keys(CATALOG)) {
      for (const path of paths(CATALOG[code])) {
        const value = get(CATALOG[code], path);
        if (typeof value === 'string' && value.trim() === '') problems.push(`${code}.${path} is blank`);
      }
    }
    expect(problems).toEqual([]);
  });
});
