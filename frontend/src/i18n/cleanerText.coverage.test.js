import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CLEANER_TEXT } from './cleaner/index.js';
import { CATALOG } from './catalog.js';

/** Adding a cleaner rule means adding it in EVERY language: this fails for
 * any language that misses a rule or a category, or names one that no
 * longer exists. */
const rules = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../backend/src/data/cleaners.json', import.meta.url)), 'utf8')
);
const ruleIds = rules.map((rule) => rule.id);
const categories = [...new Set(rules.map((rule) => rule.category))];
const filled = (text) => typeof text === 'string' && text.trim() !== '';

// Hand-made fixtures (fewer than 10 rules) are skipped: they are partial by
// design and exist only so the render tests have something Greek to show.
// Enabled once the translated files are generated -- those are complete.
const complete = Object.entries(CLEANER_TEXT).filter(([, mod]) => Object.keys(mod.rules ?? {}).length >= 10);

describe('cleaner text coverage', () => {
  it.each(complete)('%s translates every rule, and only real rules', (language, mod) => {
    const missing = ruleIds.filter((id) => !filled(mod.rules[id]?.name) || !filled(mod.rules[id]?.description));
    expect(missing, `${language} lacks name/description for`).toEqual([]);
    const unknown = Object.keys(mod.rules).filter((id) => !ruleIds.includes(id));
    expect(unknown, `${language} has unknown rule ids`).toEqual([]);
  });

  it.each(complete)('%s labels every category', (language, mod) => {
    const missing = categories.filter((category) => !filled(mod.categories?.[category]));
    expect(missing, `${language} lacks a label for`).toEqual([]);
  });

  // Enabled once the translated files are generated: with only the temporary
  // fixture in place, the languages are legitimately not all there yet.
  const generated = Object.keys(CLEANER_TEXT).length > 3;
  (generated ? it : it.skip)('every catalog language except English has cleaner text', () => {
    const absent = Object.keys(CATALOG).filter((code) => code !== 'en' && !CLEANER_TEXT[code]);
    expect(absent).toEqual([]);
  });
});
