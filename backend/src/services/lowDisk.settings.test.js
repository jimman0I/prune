import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getSettings, updateSettings } from './settings.js';

let dir;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'prune-lowdisk-settings-'));
  process.env.UNREVO_SETTINGS_PATH = join(dir, 'settings.json');
});
afterEach(() => {
  delete process.env.UNREVO_SETTINGS_PATH;
  rmSync(dir, { recursive: true, force: true });
});

describe('the low-disk warning setting', () => {
  it('is on at 10 percent until someone changes it', async () => {
    expect((await getSettings()).lowDiskWarning).toBe(10);
  });

  it.each([0, 5, 10, 15])('keeps %p when saved', async (value) => {
    await updateSettings({ lowDiskWarning: value });
    expect((await getSettings()).lowDiskWarning).toBe(value);
  });

  it.each([7, '10', -3, null, 100, 'off'])('turns %p into the default when saved, never into Off', async (value) => {
    const saved = await updateSettings({ lowDiskWarning: value });
    expect(saved.lowDiskWarning).toBe(10);
  });

  it('reads a hand-edited file the same way', async () => {
    writeFileSync(process.env.UNREVO_SETTINGS_PATH, JSON.stringify({ lowDiskWarning: 'never' }), 'utf8');
    expect((await getSettings()).lowDiskWarning).toBe(10);
  });

  it('reads a settings file from before the warning existed as the default', async () => {
    writeFileSync(process.env.UNREVO_SETTINGS_PATH, JSON.stringify({ theme: 'dark' }), 'utf8');
    expect((await getSettings()).lowDiskWarning).toBe(10);
  });
});
