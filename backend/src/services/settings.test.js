import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getSettings, updateSettings, cleanGuardsFrom } from './settings.js';

let dir;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'unrevo-settings-'));
  process.env.UNREVO_SETTINGS_PATH = join(dir, 'settings.json');
});

afterEach(() => {
  delete process.env.UNREVO_SETTINGS_PATH;
  rmSync(dir, { recursive: true, force: true });
});

describe('getSettings', () => {
  it('returns the default shape when no settings file exists yet', async () => {
    const settings = await getSettings();
    expect(settings).toEqual({
      excludeFolders: [], autoQuarantine: true, theme: 'dark', accentColor: null,
      minimizeToTray: true, skipRecentHours: 24, createRestorePoint: true, hideUnavailableRules: false,
      quarantineRetentionDays: null
    });
  });
});

describe('updateSettings', () => {
  it('persists a real change that a later getSettings call reads back', async () => {
    await updateSettings({ autoQuarantine: false });
    const settings = await getSettings();
    expect(settings.autoQuarantine).toBe(false);
  });

  it('merges rather than replaces -- changing one field leaves the others untouched', async () => {
    await updateSettings({ excludeFolders: ['C:\\Games'] });
    const after = await updateSettings({ theme: 'light' });

    expect(after.excludeFolders).toEqual(['C:\\Games']); // untouched by the second call
    expect(after.theme).toBe('light');
    expect(after.autoQuarantine).toBe(true); // still the default, never touched
  });

  it('returns the full updated settings object, not just the partial that was passed in', async () => {
    const result = await updateSettings({ theme: 'light' });
    expect(result).toEqual({
      excludeFolders: [], autoQuarantine: true, theme: 'light', accentColor: null,
      minimizeToTray: true, skipRecentHours: 24, createRestorePoint: true, hideUnavailableRules: false,
      quarantineRetentionDays: null
    });
  });

  it('supports the minimizeToTray preference the tray close-handler reads', async () => {
    const result = await updateSettings({ minimizeToTray: false });
    expect(result.minimizeToTray).toBe(false);
  });
});

describe('cleanGuardsFrom', () => {
  it('passes the user\'s exclusion list through', () => {
    expect(cleanGuardsFrom({ excludeFolders: ['C:\Games'] }).excludeFolders).toEqual(['C:\Games']);
  });

  it('treats a missing or malformed exclusion list as empty', () => {
    expect(cleanGuardsFrom({}).excludeFolders).toEqual([]);
    expect(cleanGuardsFrom({ excludeFolders: 'C:\Games' }).excludeFolders).toEqual([]);
    expect(cleanGuardsFrom(null).excludeFolders).toEqual([]);
  });

  it('passes a real recency window through', () => {
    expect(cleanGuardsFrom({ skipRecentHours: 48 }).skipRecentHours).toBe(48);
  });

  it('turns anything that is not a positive number into no guard at all', () => {
    // 0 is the user saying "clean everything" and has to mean exactly
    // that; the rest are nonsense that must not silently become 24.
    expect(cleanGuardsFrom({ skipRecentHours: 0 }).skipRecentHours).toBe(0);
    expect(cleanGuardsFrom({ skipRecentHours: -5 }).skipRecentHours).toBe(0);
    expect(cleanGuardsFrom({ skipRecentHours: 'soon' }).skipRecentHours).toBe(0);
    expect(cleanGuardsFrom({}).skipRecentHours).toBe(0);
  });

  it('reads a numeric string, which is what a number input gives back', () => {
    expect(cleanGuardsFrom({ skipRecentHours: '12' }).skipRecentHours).toBe(12);
  });
});
