import { describe, it, expect } from 'vitest';
import { SETTINGS_TAB_STORAGE_KEY, readStoredSettingsTab, writeStoredSettingsTab } from './settingsTab.js';

const VALID_TABS = ['general', 'uninstall', 'cleanup', 'about'];

function fakeStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => { store[key] = value; }
  };
}

describe('readStoredSettingsTab', () => {
  it('returns a stored value that is one of the real tabs', () => {
    const storage = fakeStorage({ [SETTINGS_TAB_STORAGE_KEY]: 'cleanup' });
    expect(readStoredSettingsTab(storage, VALID_TABS)).toBe('cleanup');
  });

  it('treats a stored value that is not a real tab as absent', () => {
    // localStorage is editable by hand and survives upgrades -- a stale
    // or typo'd value must not crash the tab bar or silently pick
    // something that doesn't exist.
    const storage = fakeStorage({ [SETTINGS_TAB_STORAGE_KEY]: 'not-a-real-tab' });
    expect(readStoredSettingsTab(storage, VALID_TABS)).toBeNull();
  });

  it('returns null when nothing is stored', () => {
    expect(readStoredSettingsTab(fakeStorage(), VALID_TABS)).toBeNull();
  });

  it('tolerates storage being unavailable rather than throwing', () => {
    const throwingStorage = { getItem: () => { throw new Error('blocked'); } };
    expect(readStoredSettingsTab(throwingStorage, VALID_TABS)).toBeNull();
  });
});

describe('writeStoredSettingsTab', () => {
  it('writes the value under the real key', () => {
    const storage = fakeStorage();
    writeStoredSettingsTab(storage, 'about');
    expect(storage.getItem(SETTINGS_TAB_STORAGE_KEY)).toBe('about');
  });

  it('tolerates storage being unavailable rather than throwing', () => {
    const throwingStorage = { setItem: () => { throw new Error('blocked'); } };
    expect(() => writeStoredSettingsTab(throwingStorage, 'about')).not.toThrow();
    expect(writeStoredSettingsTab(throwingStorage, 'about')).toBe(false);
  });
});
