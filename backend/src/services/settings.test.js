import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getSettings, updateSettings } from './settings.js';

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
    expect(settings).toEqual({ excludeFolders: [], autoQuarantine: true, theme: 'dark', accentColor: null });
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
    expect(result).toEqual({ excludeFolders: [], autoQuarantine: true, theme: 'light', accentColor: null });
  });
});
