import { describe, it, expect } from 'vitest';
import { resolveInitialTheme, nextTheme, THEMES } from './theme.js';

/** Which theme the app opens in.
 *
 * Three inputs in priority order: what the user last chose, what the
 * operating system says it prefers, and the app's own default. Kept as a
 * pure function because the interesting part is the precedence, and that
 * should be testable without a DOM, a storage backend or a media query.
 */

describe('resolveInitialTheme', () => {
  it('uses the stored choice above everything else', () => {
    // Someone who picked light on a machine set to dark meant it.
    expect(resolveInitialTheme({ stored: 'light', prefersDark: true })).toBe('light');
    expect(resolveInitialTheme({ stored: 'dark', prefersDark: false })).toBe('dark');
  });

  it('follows the system when nothing has been chosen', () => {
    expect(resolveInitialTheme({ stored: null, prefersDark: false })).toBe('light');
    expect(resolveInitialTheme({ stored: null, prefersDark: true })).toBe('dark');
  });

  it('falls back to dark when the system has no opinion', () => {
    // Prune's own default, and the theme every screen was designed
    // against first.
    expect(resolveInitialTheme({ stored: null, prefersDark: undefined })).toBe('dark');
    expect(resolveInitialTheme({})).toBe('dark');
  });

  it('ignores a stored value that is not a theme', () => {
    // localStorage is editable by hand and survives upgrades. A stale or
    // typo'd value must not put the app in a state with no stylesheet.
    for (const junk of ['solarized', '', 'DARK', null, undefined, '{}']) {
      expect(resolveInitialTheme({ stored: junk, prefersDark: true })).toBe('dark');
    }
  });
});

describe('nextTheme', () => {
  it('alternates', () => {
    expect(nextTheme('dark')).toBe('light');
    expect(nextTheme('light')).toBe('dark');
  });

  it('treats anything unrecognised as dark, so the toggle still works', () => {
    expect(nextTheme('nonsense')).toBe('light');
  });
});

describe('THEMES', () => {
  it('is the whole set, so nothing else has to hardcode the list', () => {
    expect(THEMES).toEqual(['dark', 'light']);
  });
});
