import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Guards the app's motion restraint against being quietly re-added.
 *
 * Apple's HIG, Motion: "In apps, generally avoid adding motion to UI
 * interactions that occur frequently." and Accessibility: "Tightening
 * animation springs to reduce bounce effects". Buttons and nav items are the
 * most frequent interactions in the app, so they get a press state
 * ("Always include a press state for a custom button", HIG, Buttons) and
 * nothing on hover beyond colour -- with primary's 1px lift as the one
 * exception -- and no overshoot curve anywhere.
 *
 * These read the source because the properties in question (a hover
 * transform, a bezier) are not observable in jsdom, which does no CSS
 * cascade for pseudo-classes. */

const read = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');
const css = read('src/index.css').split('\r\n').join('\n');

/** The declaration block for an exact selector. */
function rule(selector) {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no rule for ${selector}`);
  return css.slice(start, css.indexOf('}', start));
}

describe('button motion', () => {
  it('has no overshoot curve anywhere in the stylesheet', () => {
    expect(css).not.toMatch(/cubic-bezier\(\s*0?\.34\s*,\s*1\.56/);
    // Any control point above 1 on the y axis is an overshoot.
    for (const [, y1, y2] of css.matchAll(/cubic-bezier\(\s*[-\d.]+\s*,\s*([-\d.]+)\s*,\s*[-\d.]+\s*,\s*([-\d.]+)\s*\)/g)) {
      expect(Number(y1)).toBeLessThanOrEqual(1);
      expect(Number(y2)).toBeLessThanOrEqual(1);
    }
  });

  it('presses in quickly with the app easing on all three button classes', () => {
    for (const cls of ['.btn-primary', '.btn-ghost', '.btn-danger']) {
      expect(rule(cls)).toMatch(/transform 120ms var\(--ease-out-expo\)/);
    }
  });

  it('keeps a press state on all three, gated so a disabled button never moves', () => {
    for (const cls of ['.btn-primary', '.btn-ghost', '.btn-danger']) {
      expect(rule(`${cls}:active:not(:disabled)`)).toMatch(/transform:\s*scale\(0\.98\)/);
    }
  });

  it('does not scale on hover: ghost and danger have colour only', () => {
    expect(rule('.btn-ghost:hover:not(:disabled)')).not.toMatch(/transform/);
    expect(rule('.btn-danger:hover:not(:disabled)')).not.toMatch(/transform/);
  });

  it('gives primary at most a 1px lift on hover, never a scale', () => {
    const hover = rule('.btn-primary:hover:not(:disabled)');
    expect(hover).toMatch(/transform:\s*translateY\(-1px\)/);
    expect(hover).not.toMatch(/scale/);
  });

  it('still switches the remaining button motion off under reduced motion', () => {
    const block = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce) {\n  .skeleton-shimmer'));
    for (const selector of [
      '.btn-primary:hover:not(:disabled)', '.btn-primary:active:not(:disabled)',
      '.btn-ghost:active:not(:disabled)', '.btn-danger:active:not(:disabled)'
    ]) {
      expect(block).toContain(selector);
    }
  });
});

describe('nav motion', () => {
  const nav = read('src/components/NavRail.jsx');

  it('has no hover motion: only a tap, and the sliding indicator stays', () => {
    expect(nav).not.toContain('whileHover');
    expect(nav).toMatch(/whileTap=\{\{ scale: 0\.96 \}\}/);
    expect(nav).toContain('layoutId="nav-active"');
  });

  it('does not use a spring on the nav buttons', () => {
    const button = nav.slice(nav.indexOf('<motion.button'), nav.indexOf('onClick={() => onNavigate'));
    expect(button).not.toMatch(/type:\s*'spring'/);
  });
});
