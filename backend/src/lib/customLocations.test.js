import { describe, it, expect, afterEach } from 'vitest';
import { validateCustomLocation, normalizeCustomLocations, customLocationsRule, CUSTOM_RULE_ID, MAX_CUSTOM_LOCATIONS } from './customLocations.js';

/** "Custom locations": files, folders and patterns the user adds themselves.
 * They become one Deep Clean rule of their own -- never ticked by default --
 * and, because nobody curated them, every file is also kept out of the
 * protected places at scan and clean time. This is the first line: what may
 * even be saved. */

const saved = { ...process.env };
afterEach(() => { process.env = { ...saved }; });

describe('validateCustomLocation', () => {
  it.each([
    'D:\\Games\\Cache',
    'D:\\Games\\Cache\\*.tmp',
    'C:\\Users\\me\\Downloads\\old\\*',
    '%LOCALAPPDATA%\\MyApp\\logs',
    '~\\Scratch',
    '\\\\server\\share\\scratch\\*.bak'
  ])('accepts %s', (path) => {
    process.env.LOCALAPPDATA = 'C:\\Users\\me\\AppData\\Local';
    expect(validateCustomLocation(path)).toEqual({ ok: true, path });
  });

  it('trims, and swaps / for \\ so one spelling is stored', () => {
    expect(validateCustomLocation('  D:/Games/Cache/  ')).toEqual({ ok: true, path: 'D:\\Games\\Cache' });
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['relative\\folder', 'relative'],
    ['Cache', 'relative'],
    ['.\\here', 'relative'],
    ['D:\\Games\\..\\..\\Windows', 'climb'],
    ['C:\\', 'protected'],
    ['C:', 'protected'],
    ['C:\\Windows', 'protected'],
    ['C:\\Windows\\System32\\*.dll', 'protected'],
    ['C:\\Program Files\\Something', 'protected'],
    ['C:\\Users', 'protected'],
    ['C:\\Users\\me', 'protected'],
    ['C:\\*', 'wildcard'],
    ['D:\\*', 'wildcard'],
    ['D:\\Games\\*', 'wildcard']
  ])('refuses %j as %s', (path, reason) => {
    const result = validateCustomLocation(path);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe(reason);
  });

  it('refuses an absurdly long path', () => {
    expect(validateCustomLocation(`D:\\${'a'.repeat(600)}`)).toEqual({ ok: false, reason: 'long' });
  });

  it('refuses a non-string', () => {
    for (const bad of [null, undefined, 5, {}, ['D:\\x']]) expect(validateCustomLocation(bad).ok).toBe(false);
  });

  it('a variable that is not set leaves nothing absolute, so it is refused rather than guessed at', () => {
    delete process.env.LOCALAPPDATA;
    expect(validateCustomLocation('%LOCALAPPDATA%\\x').ok).toBe(false);
  });
});

describe('normalizeCustomLocations', () => {
  it('keeps the valid ones in order, drops the rest, and removes case-insensitive duplicates', () => {
    expect(normalizeCustomLocations(['D:\\A', 'nope', 'd:\\a', 'D:/B/', 'C:\\Windows', ''])).toEqual(['D:\\A', 'D:\\B']);
  });

  it('is empty for anything that is not a list', () => {
    for (const bad of [undefined, null, 'D:\\A', 5, {}]) expect(normalizeCustomLocations(bad)).toEqual([]);
  });

  it('caps the list', () => {
    const many = Array.from({ length: MAX_CUSTOM_LOCATIONS + 20 }, (_, i) => `D:\\Dir${i}`);
    expect(normalizeCustomLocations(many)).toHaveLength(MAX_CUSTOM_LOCATIONS);
  });
});

describe('customLocationsRule', () => {
  it('is nothing when there are no locations', () => {
    expect(customLocationsRule([])).toBeNull();
  });

  it('is one rule, not ticked by default, not safe, protected from the system places', () => {
    const rule = customLocationsRule(['D:\\A', 'D:\\B\\*.tmp']);
    expect(rule).toMatchObject({
      id: CUSTOM_RULE_ID, category: 'Custom', name: 'Custom locations', recommended: false, is_safe: false, custom: true
    });
    expect(rule.actions).toEqual([{ type: 'delete', paths: ['D:\\A', 'D:\\B\\*.tmp'], userDefined: true }]);
  });

  it('is never marked as one that is asked about each time or loses data: the person chose each item', () => {
    const rule = customLocationsRule(['D:\\A']);
    expect(rule.risky).toBeUndefined();
    expect(rule.confirmEveryTime).toBeUndefined();
  });
});
