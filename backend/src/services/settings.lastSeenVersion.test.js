import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { getSettings, updateSettings, normalizeLastSeenVersion } from './settings.js';
import { appVersion } from './updateCheck.js';

/** `lastSeenVersion`: the last app version whose "What's new" notice the
 * person has been shown (or that they installed fresh, which counts as seeing
 * it). The frontend compares it with the running version; the backend's part
 * is to store a clean string, keep it through every other save, and decide
 * what a settings file that has none means. */

let dir;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'prune-lastseen-'));
  process.env.UNREVO_SETTINGS_PATH = join(dir, 'settings.json');
});
afterEach(() => {
  delete process.env.UNREVO_SETTINGS_PATH;
  rmSync(dir, { recursive: true, force: true });
});

async function writeRaw(object) {
  await mkdir(dirname(process.env.UNREVO_SETTINGS_PATH), { recursive: true });
  await writeFile(process.env.UNREVO_SETTINGS_PATH, JSON.stringify(object));
}

describe('normalizeLastSeenVersion', () => {
  it('keeps a plain version and drops everything else to null', () => {
    expect(normalizeLastSeenVersion('3.0.0')).toBe('3.0.0');
    expect(normalizeLastSeenVersion('2.9.2')).toBe('2.9.2');
    expect(normalizeLastSeenVersion('3.1.0-beta.1')).toBe('3.1.0-beta.1');
    for (const junk of [undefined, null, 3, 3.0, {}, [], true, '', 'abc', '3', '3.0', 'v3.0.0', '3.0.0.0', ' 3.0.0', '<b>3.0.0</b>', '3.0.0\n', '1'.repeat(80)]) {
      expect(normalizeLastSeenVersion(junk), String(junk)).toBeNull();
    }
  });
});

describe('lastSeenVersion in the settings file', () => {
  it('is null for an existing install that never recorded one -- everyone updating from 2.x', async () => {
    await writeRaw({ theme: 'light', language: 'el' });
    const settings = await getSettings();
    expect(settings).toHaveProperty('lastSeenVersion');
    expect(settings.lastSeenVersion).toBeNull();
  });

  it('is the running version on a brand-new install, so nothing is announced to someone who just installed', async () => {
    // settings.json does not exist yet.
    expect((await getSettings()).lastSeenVersion).toBe(appVersion());
  });

  it('stays the running version when the first thing to write the file is not the notice (the installer\'s answers)', async () => {
    // applyInstallerChoices saves before the window has asked for anything.
    const saved = await updateSettings({ updateCheck: true });
    expect(saved.lastSeenVersion).toBe(appVersion());
    expect(JSON.parse(readFileSync(process.env.UNREVO_SETTINGS_PATH, 'utf8')).lastSeenVersion).toBe(appVersion());
    expect((await getSettings()).lastSeenVersion).toBe(appVersion());
  });

  it('does not stamp an existing install by saving something else', async () => {
    await writeRaw({ theme: 'light' });
    const saved = await updateSettings({ theme: 'dark' });
    expect(saved.lastSeenVersion).toBeNull();
    expect((await getSettings()).lastSeenVersion).toBeNull();
  });

  it('round-trips through updateSettings and the file', async () => {
    await writeRaw({ theme: 'light' });
    const saved = await updateSettings({ lastSeenVersion: '3.0.0' });
    expect(saved.lastSeenVersion).toBe('3.0.0');
    expect(JSON.parse(readFileSync(process.env.UNREVO_SETTINGS_PATH, 'utf8')).lastSeenVersion).toBe('3.0.0');
    expect((await getSettings()).lastSeenVersion).toBe('3.0.0');
  });

  it('survives every other save', async () => {
    await writeRaw({ theme: 'light' });
    await updateSettings({ lastSeenVersion: '3.0.0' });
    await updateSettings({ theme: 'dark' });
    await updateSettings({ skipRecentHours: 12 });
    expect((await getSettings()).lastSeenVersion).toBe('3.0.0');
  });

  it('survives overlapping saves of other settings (the queue merges, nothing is lost)', async () => {
    await writeRaw({ theme: 'light' });
    await Promise.all([
      updateSettings({ theme: 'dark' }),
      updateSettings({ lastSeenVersion: '3.0.0' }),
      updateSettings({ skipRecentHours: 6 }),
      updateSettings({ language: 'el' })
    ]);
    const settings = await getSettings();
    expect(settings.lastSeenVersion).toBe('3.0.0');
    expect(settings.theme).toBe('dark');
    expect(settings.skipRecentHours).toBe(6);
    expect(settings.language).toBe('el');
  });

  it('never stores junk: a bad value is read and saved as null', async () => {
    await writeRaw({ lastSeenVersion: '<script>' });
    expect((await getSettings()).lastSeenVersion).toBeNull();
    await writeRaw({ lastSeenVersion: 7 });
    expect((await getSettings()).lastSeenVersion).toBeNull();

    await writeRaw({ theme: 'light' });
    expect((await updateSettings({ lastSeenVersion: 'not a version' })).lastSeenVersion).toBeNull();
    expect(JSON.parse(readFileSync(process.env.UNREVO_SETTINGS_PATH, 'utf8')).lastSeenVersion).toBeNull();
  });

  it('can be recorded again for a later version', async () => {
    await writeRaw({ lastSeenVersion: '3.0.0' });
    expect((await updateSettings({ lastSeenVersion: '3.1.0' })).lastSeenVersion).toBe('3.1.0');
  });
});
