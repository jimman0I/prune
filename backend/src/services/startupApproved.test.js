import { describe, it, expect } from 'vitest';
import { isStartupEnabled, approvedKindFor, approvedLookupKey } from './startupApproved.js';

describe('isStartupEnabled', () => {
  it('treats an entry Windows has no record of as enabled', () => {
    // Most entries are this: nothing has ever asked Windows to disable
    // them, so StartupApproved holds nothing about them at all.
    expect(isStartupEnabled(null)).toBe(true);
    expect(isStartupEnabled(undefined)).toBe(true);
  });

  it('reads the two enabled bytes Windows actually writes', () => {
    expect(isStartupEnabled([2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])).toBe(true);
    expect(isStartupEnabled([6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])).toBe(true);
  });

  it('reads the two disabled bytes Windows actually writes', () => {
    expect(isStartupEnabled([3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])).toBe(false);
    expect(isStartupEnabled([7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])).toBe(false);
  });

  it('reads the low bit rather than matching those four numbers', () => {
    // The remaining bytes are a timestamp of when the state last changed,
    // so a real value is never all zeroes after the first byte.
    expect(isStartupEnabled([3, 122, 19, 88, 201, 4, 0, 0])).toBe(false);
    expect(isStartupEnabled([2, 122, 19, 88, 201, 4, 0, 0])).toBe(true);
  });

  it('reads the shapes PowerShell hands a REG_BINARY over in', () => {
    // A single-element array comes back as a bare number, and a value that
    // has been through a string conversion arrives space- or
    // comma-separated. All of these have come out of one query.
    expect(isStartupEnabled(3)).toBe(false);
    expect(isStartupEnabled(2)).toBe(true);
    expect(isStartupEnabled('3 0 0 0')).toBe(false);
    expect(isStartupEnabled('2 0 0 0')).toBe(true);
    expect(isStartupEnabled('03,00,00')).toBe(false);
  });

  it('calls anything it cannot read enabled', () => {
    // This list's job is to show what runs. Hiding something as "off" when
    // it may well be on is the failure that matters.
    expect(isStartupEnabled('nonsense')).toBe(true);
    expect(isStartupEnabled([])).toBe(true);
    expect(isStartupEnabled({})).toBe(true);
  });
});

describe('approvedKindFor', () => {
  it('sends a Startup-folder shortcut to the StartupFolder key', () => {
    expect(approvedKindFor({ source: 'folder', location: 'C:\\...\\Startup' })).toBe('StartupFolder');
  });

  it('sends a 32-bit Run value to Run32, reading the registry path', () => {
    // Not `location` -- that is the friendly label, "Run (32-bit)", and
    // matching WOW6432Node against it finds nothing, which reads as
    // enabled: the same silent wrong answer as not looking at all.
    expect(approvedKindFor({
      source: 'registry',
      location: 'Run (32-bit)',
      registryKey: 'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run'
    })).toBe('Run32');
  });

  it('sends an ordinary Run value to Run', () => {
    expect(approvedKindFor({
      source: 'registry',
      location: 'Run',
      registryKey: 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run'
    })).toBe('Run');
    expect(approvedKindFor({ source: 'registry', registryKey: '' })).toBe('Run');
    expect(approvedKindFor(null)).toBe('Run');
  });
});

describe('approvedLookupKey', () => {
  it('files an entry under its scope, its kind and the name Windows uses', () => {
    expect(approvedLookupKey({
      scope: 'user',
      source: 'registry',
      registryKey: 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run',
      name: 'Discord',
      approvedName: 'Discord'
    })).toBe('user|Run|Discord');
  });

  it('uses the shortcut file name, extension and all, for a Startup folder', () => {
    // StartupApproved records a folder entry by its FILE name. The list
    // shows "FxSound"; the key is "FxSound.lnk", and looking up the
    // display name finds nothing.
    expect(approvedLookupKey({
      scope: 'machine', source: 'folder', name: 'FxSound', approvedName: 'FxSound.lnk'
    })).toBe('machine|StartupFolder|FxSound.lnk');
  });

  it('keeps the two hives apart', () => {
    // A machine entry and a user entry can share a name, and their
    // decisions live in different keys.
    const base = { source: 'registry', registryKey: 'HKLM:\\...\\Run', name: 'Discord' };
    expect(approvedLookupKey({ ...base, scope: 'machine' }))
      .not.toBe(approvedLookupKey({ ...base, scope: 'user' }));
  });
});
