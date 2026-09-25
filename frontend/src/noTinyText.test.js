import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';

/** No text below 10 px anywhere in the interface.
 *
 * The 9 px letters and badges were the last text the Electron window could
 * not make legible (browser zoom was removed with the menu). Read from the
 * sources because jsdom applies no stylesheet: a class is all there is to
 * check. */
describe('smallest text', () => {
  it('no component draws text under 10 px', () => {
    const offenders = [];
    for (const name of readdirSync('src/components').filter((f) => f.endsWith('.jsx') && !f.includes('.test.'))) {
      const source = readFileSync(`src/components/${name}`, 'utf8');
      for (const m of source.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) {
        if (Number(m[1]) < 10) offenders.push(`${name}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
