import { describe, it, expect } from 'vitest';
import { pickLogoFile, pickExtensionIcon } from './packageIcons.js';

describe('pickLogoFile', () => {
  // The manifest names "Assets\PaintAppList.png" and that exact file is
  // NOT on disk -- Windows ships only the scaled and target-size variants
  // beside it. Treating the declared name as a path to open finds nothing
  // for a large share of Store apps.
  it('finds a variant when the declared file is not there', () => {
    const names = [
      'PaintAppList.scale-200.png',
      'PaintAppList.targetsize-16.png',
      'PaintAppList.targetsize-32.png'
    ];
    expect(pickLogoFile('Assets\\PaintAppList.png', names)).toBe('PaintAppList.targetsize-32.png');
  });

  it('prefers the exact file when it really exists', () => {
    const names = ['Square44x44Logo.png', 'Square44x44Logo.scale-200.png'];
    expect(pickLogoFile('Assets\\Square44x44Logo.png', names)).toBe('Square44x44Logo.png');
  });

  it('prefers an unplated variant at the same size', () => {
    // Unplated drops the coloured tile behind the glyph, which suits a
    // list row rather than a Start menu tile.
    const names = ['App.targetsize-32.png', 'App.targetsize-32_altform-unplated.png'];
    expect(pickLogoFile('Assets\\App.png', names)).toBe('App.targetsize-32_altform-unplated.png');
  });

  it('falls back to any variant rather than giving up', () => {
    expect(pickLogoFile('Assets\\App.png', ['App.scale-400.png'])).toBe('App.scale-400.png');
  });

  it('does not match a different logo that shares a prefix', () => {
    // "AppList" must not satisfy a request for "App".
    expect(pickLogoFile('Assets\\App.png', ['AppList.targetsize-32.png'])).toBeNull();
  });

  it('returns null when there is nothing to pick from', () => {
    expect(pickLogoFile('Assets\\App.png', [])).toBeNull();
    expect(pickLogoFile('', ['App.png'])).toBeNull();
    expect(pickLogoFile(null, null)).toBeNull();
  });
});

describe('pickExtensionIcon', () => {
  it('picks the size closest to 48', () => {
    expect(pickExtensionIcon({ 16: 'a.png', 48: 'b.png', 128: 'c.png' })).toBe('b.png');
  });

  it('copes with an extension that declares only one size', () => {
    expect(pickExtensionIcon({ 128: 'only.png' })).toBe('only.png');
    expect(pickExtensionIcon({ 16: 'tiny.png' })).toBe('tiny.png');
  });

  it('prefers the larger of two equally distant sizes', () => {
    // 32 and 64 are both 16 away from 48; the bigger one scales down
    // better than the smaller one scales up.
    expect(pickExtensionIcon({ 32: 'small.png', 64: 'big.png' })).toBe('big.png');
  });

  it('ignores junk entries', () => {
    expect(pickExtensionIcon({ notasize: 'x.png', 48: 'good.png' })).toBe('good.png');
    expect(pickExtensionIcon({ 48: '' })).toBeNull();
    expect(pickExtensionIcon({})).toBeNull();
    expect(pickExtensionIcon(null)).toBeNull();
  });
});
