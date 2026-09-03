import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeKeyDate } from './installDates.js';

describe('normalizeKeyDate', () => {
  it('keeps a plain date', () => {
    expect(normalizeKeyDate('2026-07-20')).toBe('2026-07-20');
  });

  it('reduces a timestamp to its date', () => {
    expect(normalizeKeyDate('2026-07-20T14:32:11')).toBe('2026-07-20');
  });

  it('rejects anything that is not a date', () => {
    expect(normalizeKeyDate('')).toBeNull();
    expect(normalizeKeyDate(null)).toBeNull();
    expect(normalizeKeyDate('not a date')).toBeNull();
    expect(normalizeKeyDate('20/07/2025')).toBeNull();
  });

  // A registry key with no meaningful write time reads back as the FILETIME
  // epoch. Showing 1601 as an install date would be worse than a blank.
  it('rejects a date no install could have', () => {
    expect(normalizeKeyDate('1601-01-01')).toBeNull();
    expect(normalizeKeyDate('1899-12-30')).toBeNull();
  });
});

describe('getProgramInstallDates', () => {
  beforeEach(() => { vi.resetModules(); });

  const programs = [
    { id: 'a', installDate: '2020-01-01', registryKey: 'HKLM:\\SOFTWARE\\X\\a' },
    { id: 'b', installDate: null, registryKey: 'HKLM:\\SOFTWARE\\X\\b' },
    { id: 'c', installDate: null, registryKey: 'HKLM:\\SOFTWARE\\X\\c' },
    { id: 'd', installDate: null, registryKey: null }
  ];

  function mockRows(rows) {
    vi.doMock('./powershell.js', () => ({ runPowerShellJson: async () => rows }));
  }

  it('fills only the programs the registry left without a date', async () => {
    mockRows([
      { key: 'HKLM:\\SOFTWARE\\X\\a', written: '2024-05-05' },
      { key: 'HKLM:\\SOFTWARE\\X\\b', written: '2026-07-20' }
    ]);
    const { getProgramInstallDates } = await import('./installDates.js');
    const dates = await getProgramInstallDates(programs);

    expect(dates.b).toBe('2026-07-20');
    // The registry's own InstallDate is what the installer declared. A key
    // write time is when the entry last changed, which an update also
    // does, so it must never overwrite the declared value.
    expect(dates.a).toBeUndefined();
  });

  it('leaves a program with no answer alone', async () => {
    mockRows([{ key: 'HKLM:\\SOFTWARE\\X\\b', written: '2026-07-20' }]);
    const { getProgramInstallDates } = await import('./installDates.js');
    const dates = await getProgramInstallDates(programs);
    expect(dates.c).toBeUndefined();
    expect(dates.d).toBeUndefined();
  });

  it('matches the key case-insensitively', async () => {
    // The registry is case-insensitive and PowerShell does not promise to
    // echo back the casing it was given.
    mockRows([{ key: 'hklm:\\software\\x\\b', written: '2026-07-20' }]);
    const { getProgramInstallDates } = await import('./installDates.js');
    expect((await getProgramInstallDates(programs)).b).toBe('2026-07-20');
  });

  it('handles a single row coming back as a bare object', async () => {
    mockRows({ key: 'HKLM:\\SOFTWARE\\X\\b', written: '2026-07-20' });
    const { getProgramInstallDates } = await import('./installDates.js');
    expect((await getProgramInstallDates(programs)).b).toBe('2026-07-20');
  });

  it('returns nothing rather than throwing when the query fails', async () => {
    vi.doMock('./powershell.js', () => ({
      runPowerShellJson: async () => { throw new Error('registry unavailable'); }
    }));
    const { getProgramInstallDates } = await import('./installDates.js');
    expect(await getProgramInstallDates(programs)).toEqual({});
  });

  it('does no work when every program already has a date', async () => {
    let called = false;
    vi.doMock('./powershell.js', () => ({
      runPowerShellJson: async () => { called = true; return []; }
    }));
    const { getProgramInstallDates } = await import('./installDates.js');
    await getProgramInstallDates([{ id: 'a', installDate: '2020-01-01', registryKey: 'HKLM:\\X' }]);
    expect(called).toBe(false);
  });
});
