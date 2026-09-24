// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** The pre-paint script in index.html, actually executed.
 *
 * It is a classic inline script because it has to run before the
 * stylesheet, which means it cannot import lib/theme.js and mirrors it by
 * hand. Two copies of one rule drift, so this runs the real script text
 * against each stored value and asserts the same answers resolveInitialTheme
 * gives -- in particular that a stored 'system' (the Settings choice that
 * means "follow Windows") does not stick the page on a palette. */

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];

const boot = ({ stored, osLight }) => {
  window.localStorage.clear();
  if (stored !== undefined) window.localStorage.setItem('prune.theme', stored);
  window.matchMedia = (query) => ({ matches: query.includes('light') ? osLight : !osLight });
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.style.colorScheme = '';
  new Function(script)();
  return document.documentElement.getAttribute('data-theme');
};

describe('the pre-paint theme script', () => {
  beforeEach(() => window.localStorage.clear());

  it('follows Windows when the stored choice is System', () => {
    expect(boot({ stored: 'system', osLight: true })).toBe('light');
    expect(boot({ stored: 'system', osLight: false })).toBe('dark');
  });

  it('follows Windows when nothing is stored', () => {
    expect(boot({ osLight: true })).toBe('light');
  });

  it('lets an explicit Light or Dark beat Windows', () => {
    expect(boot({ stored: 'dark', osLight: true })).toBe('dark');
    expect(boot({ stored: 'light', osLight: false })).toBe('light');
  });

  it('ignores a junk stored value', () => {
    expect(boot({ stored: 'solarized', osLight: true })).toBe('light');
  });

  it('sets colorScheme with it', () => {
    boot({ stored: 'light', osLight: false });
    expect(document.documentElement.style.colorScheme).toBe('light');
  });
});
