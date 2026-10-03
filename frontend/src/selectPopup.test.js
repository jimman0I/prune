import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** jsdom evaluates no CSS, so this reads the stylesheet itself. The open list
 * of a native select is drawn by Windows; with a translucent select
 * background it is painted white under light text. Every dropdown in the app
 * relies on this one rule rather than carrying its own. */
const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

describe('native select lists', () => {
  it('give the options an opaque, themed background and the theme text colour', () => {
    const rule = css.match(/select option\s*\{([^}]*)\}/);
    expect(rule, 'expected a `select option` rule in index.css').toBeTruthy();
    expect(rule[1]).toMatch(/background-color:\s*var\(--bg-panel\)/);
    expect(rule[1]).toMatch(/color:\s*var\(--text-primary\)/);
  });

  it('follow the light and dark theme for the popup itself', () => {
    expect(css).toMatch(/select\s*\{\s*color-scheme:\s*dark;\s*\}/);
    expect(css).toMatch(/:root\[data-theme='light'\]\s+select\s*\{\s*color-scheme:\s*light;\s*\}/);
  });
});
