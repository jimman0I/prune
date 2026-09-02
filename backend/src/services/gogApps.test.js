import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeGogGame } from './gogApps.js';

describe('normalizeGogGame', () => {
  it('reads a game from its registry key', () => {
    expect(normalizeGogGame({
      gameId: '1207658930',
      gameName: 'The Witcher 3: Wild Hunt',
      path: 'D:\\GOG Games\\The Witcher 3 Wild Hunt',
      workingDir: 'D:\\GOG Games\\The Witcher 3 Wild Hunt'
    })).toEqual({
      gameId: '1207658930',
      name: 'The Witcher 3: Wild Hunt',
      installLocation: 'D:\\GOG Games\\The Witcher 3 Wild Hunt'
    });
  });

  it('falls back to workingDir when path is missing', () => {
    expect(normalizeGogGame({ gameName: 'Thing', path: '', workingDir: 'C:\\GOG\\Thing' }).installLocation)
      .toBe('C:\\GOG\\Thing');
  });

  // Same normalization Epic needs: a path recorded with the other
  // separator style or a trailing slash would not match the one Windows
  // records for the same folder.
  it('normalizes separators and trailing slashes', () => {
    expect(normalizeGogGame({ gameName: 'X', path: 'C:/GOG Games/X/' }).installLocation)
      .toBe('C:\\GOG Games\\X');
  });

  it('returns null when there is no folder to point at', () => {
    expect(normalizeGogGame({ gameName: 'X', path: '', workingDir: '' })).toBeNull();
    expect(normalizeGogGame({})).toBeNull();
    expect(normalizeGogGame(null)).toBeNull();
  });
});

describe('getGogApps', () => {
  beforeEach(() => { vi.resetModules(); });

  it('returns an empty list when GOG is not installed', async () => {
    // The common case on most machines, and not an error.
    vi.doMock('./powershell.js', () => ({ runPowerShellJson: async () => null }));
    const { getGogApps } = await import('./gogApps.js');
    expect(await getGogApps()).toEqual([]);
  });

  // PowerShell's ConvertTo-Json emits a bare object rather than a
  // one-element array, which has already broken this project's disk
  // query once.
  it('handles a single game coming back as a bare object', async () => {
    vi.doMock('./powershell.js', () => ({
      runPowerShellJson: async () => ({ gameId: '1', gameName: 'Solo', path: 'C:\\GOG\\Solo' })
    }));
    const { getGogApps } = await import('./gogApps.js');
    const apps = await getGogApps();
    expect(apps).toHaveLength(1);
    expect(apps[0].name).toBe('Solo');
  });

  it('returns an empty list rather than throwing when the query fails', async () => {
    vi.doMock('./powershell.js', () => ({
      runPowerShellJson: async () => { throw new Error('registry unavailable'); }
    }));
    const { getGogApps } = await import('./gogApps.js');
    expect(await getGogApps()).toEqual([]);
  });
});
