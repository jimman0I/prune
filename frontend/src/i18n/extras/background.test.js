import { describe, it, expect } from 'vitest';
import { CATALOG } from '../catalog.js';
import { LANGUAGES } from '../languages.js';

/** Every language's wording for the background-run settings really uses the
 * values it is given: a translation that dropped the time, a size or an error
 * would read fine and say nothing. Counts are never printed here, so no
 * language needs a plural form. */
describe('backgroundV3 in every language', () => {
  const FUNCTIONS = [
    ['task.nextRun', ['@@Mon 02:00@@']],
    ['task.taskFailed', ['@@2147942402@@']],
    ['task.saveFailed', ['@@EACCES@@']],
    ['task.loadFailed', ['@@timed out@@']],
    ['last.clean', ['@@3h@@', '@@1.2 GB@@', '@@0 B@@']],
    ['last.errors', ['@@3h@@', '@@1.2 GB@@', '@@0 B@@']]
  ];
  const get = (node, path) => path.split('.').reduce((current, key) => current?.[key], node);

  it('has the namespace in all 40 languages', () => {
    expect(LANGUAGES).toHaveLength(40);
    for (const { code } of LANGUAGES) expect(CATALOG[code].backgroundV3, code).toBeTruthy();
  });

  it.each(FUNCTIONS)('puts every argument of %s into the sentence', (path, args) => {
    for (const { code } of LANGUAGES) {
      const fn = get(CATALOG[code].backgroundV3, path);
      expect(typeof fn, `${code}.${path}`).toBe('function');
      const text = fn(...args);
      for (const arg of args) expect(text, `${code}.${path}`).toContain(arg);
    }
  });

  it('keeps the command the task runs, untranslated, in the explanation', () => {
    for (const { code } of LANGUAGES) {
      expect(CATALOG[code].backgroundV3.task.detail, code).toContain('prune-cli clean --preset recommended');
    }
  });

  it('names the launcher file where it is missing', () => {
    for (const { code } of LANGUAGES) expect(CATALOG[code].backgroundV3.task.cliMissing, code).toContain('prune-cli.cmd');
  });
});
