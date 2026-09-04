import { describe, it, expect } from 'vitest';
import { TILE_COLORS, TILE_INK, tileColor } from './programTileColor.js';
import { PALETTE } from './fileTypeColors.js';

/** Relative luminance and contrast, written independently of the module's
 * own copy so the assertion is a real check rather than the code agreeing
 * with itself. WCAG 2.1 formula. */
function contrast(a, b) {
  const lum = (hex) => {
    const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const [r, g, bl] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (hi + 0.05) / (lo + 0.05);
}

describe('TILE_COLORS', () => {
  it('is legible: every colour clears AA against the ink', () => {
    // The tile letter is 9px bold, which is NOT "large text" under WCAG,
    // so the bar is 4.5:1 rather than 3:1. The tile this replaced was
    // white on coral at 2.51:1 and had been since it was written.
    for (const color of TILE_COLORS) {
      expect(contrast(color, TILE_INK), `${color} on ${TILE_INK}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('takes its hues from the palette the disk map already uses', () => {
    // Not a second palette. That one was tuned for a dark ground and for
    // being told apart from each other, which is exactly this problem.
    for (const color of TILE_COLORS) expect(PALETTE).toContain(color);
  });

  it('drops the palette entries that are not legible rather than using them', () => {
    // One swatch (the purple) lands at 4.37:1, just under. Excluding it
    // is why this list is derived rather than copied -- if the disk map's
    // palette changes, this re-filters instead of silently going dim.
    expect(TILE_COLORS.length).toBeGreaterThanOrEqual(8);
    expect(TILE_COLORS.length).toBeLessThanOrEqual(PALETTE.length);
  });

  it('has no duplicates', () => {
    expect(new Set(TILE_COLORS).size).toBe(TILE_COLORS.length);
  });
});

describe('tileColor', () => {
  it('gives one program the same colour every time', () => {
    // The whole point of hashing rather than assigning by position: the
    // list is filtered and re-sorted constantly, and a tile that changed
    // colour when you typed in the search box would be worse than one
    // colour for everything.
    expect(tileColor('Microsoft Visual C++ 2013 Redistributable (x64)'))
      .toBe(tileColor('Microsoft Visual C++ 2013 Redistributable (x64)'));
  });

  it('separates the programs that were a wall of identical tiles', () => {
    // These five all reduce to the same letter and the same publisher.
    // Colour is the only thing left that can tell them apart at a glance.
    const runtimes = [
      'Microsoft Windows Desktop Runtime - 9.0.19 (x64)',
      'Microsoft Windows Desktop Runtime - 8.0.30 (x64)',
      'Microsoft Windows Desktop Runtime - 8.0.30 (x86)',
      'Microsoft Windows Desktop Runtime - 6.0.36 (x64)',
      'Microsoft Windows Desktop Runtime - 5.0.16 (x64)'
    ];
    expect(new Set(runtimes.map(tileColor)).size).toBeGreaterThan(1);
  });

  it('ignores case and surrounding space', () => {
    expect(tileColor(' Discord ')).toBe(tileColor('discord'));
  });

  it('always returns a colour from the tile palette', () => {
    for (const name of ['', null, undefined, 'x', '7-Zip', '日本語のプログラム']) {
      expect(TILE_COLORS).toContain(tileColor(name));
    }
  });

  it('spreads names that differ only at the end', () => {
    // Program names cluster hard -- version suffixes on a shared prefix
    // are most of this list. A sum-of-characters hash would put them all
    // in adjacent slots; this must not.
    const names = Array.from({ length: 12 }, (_, i) => `Microsoft Visual C++ 20${10 + i} Redistributable`);
    expect(new Set(names.map(tileColor)).size).toBeGreaterThanOrEqual(5);
  });
});
