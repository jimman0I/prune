import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';

/** No text below 11 px anywhere in the interface.
 *
 * The 9 px letters and badges were the last text the Electron window could
 * not make legible (browser zoom was removed with the menu), and the 10 and
 * 10.5 px labels that replaced them measured as undersized on every screen.
 * 11 px is the floor. Read from the sources because jsdom applies no
 * stylesheet: a class is all there is to check. */
const FLOOR = 11;

describe('smallest text', () => {
  it('no component draws text under 11 px', () => {
    const offenders = [];
    for (const name of readdirSync('src/components').filter((f) => f.endsWith('.jsx') && !f.includes('.test.'))) {
      const source = readFileSync(`src/components/${name}`, 'utf8');
      for (const m of source.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) {
        if (Number(m[1]) < FLOOR) offenders.push(`${name}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no stylesheet or inline style sets a font size under 11 px', () => {
    const offenders = [];
    const css = readFileSync('src/index.css', 'utf8');
    for (const m of css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) {
      if (Number(m[1]) < FLOOR) offenders.push(`index.css: ${m[0]}`);
    }
    for (const name of readdirSync('src/components').filter((f) => f.endsWith('.jsx') && !f.includes('.test.'))) {
      const source = readFileSync(`src/components/${name}`, 'utf8');
      for (const m of source.matchAll(/fontSize:\s*['"]?(\d+(?:\.\d+)?)(?:px)?['"]?/g)) {
        if (Number(m[1]) < FLOOR) offenders.push(`${name}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
