import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/** The indeterminate progress segment under reduced motion.
 *
 * With its animation off it used to sit still at its inline 35% width, which
 * reads as "35% done". It is now drawn full width and faint: working, no
 * number. jsdom applies no stylesheet, so the rule is read from the CSS. */
const css = readFileSync('src/index.css', 'utf8');

// The body of every prefers-reduced-motion block that mentions the class.
const blocks = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g)]
  .map((m) => m[1])
  .filter((body) => body.includes('.scan-indeterminate'));

describe('.scan-indeterminate with reduced motion', () => {
  it('has such a rule', () => {
    expect(blocks.length).toBe(1);
  });

  it('stops the animation, drawn full width (over its inline width) and faint, not parked at 35%', () => {
    const rule = /\.scan-indeterminate\s*\{([^}]*)\}/.exec(blocks[0])[1];
    expect(rule).toMatch(/animation:\s*none/);
    expect(rule).toMatch(/width:\s*100%\s*!important/);
    const opacity = Number(/opacity:\s*([\d.]+)/.exec(rule)[1]);
    expect(opacity).toBeGreaterThan(0);
    expect(opacity).toBeLessThan(0.6);
  });
});
