import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
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
  /** Pins the defaults that MATTER rather than the exact key set.
   *
   * This was a deep-equal on the whole object and it broke three times in
   * one afternoon, once per feature that added a key -- each break a
   * mechanical edit that proved nothing. What is worth protecting is not
   * "no key was added" but "no safe default quietly became an unsafe
   * one": every value below is one where flipping it removes a guard or
   * starts deleting something. */
  it('defaults to the safe side of every choice that has one', async () => {
    const settings = await getSettings();

    expect(settings.autoQuarantine).toBe(true);        // removals are reversible
    expect(settings.createRestorePoint).toBe(true);    // a rollback exists
    expect(settings.skipRecentHours).toBe(24);         // today's files are left alone
    expect(settings.quarantineRetentionDays).toBeNull(); // the undo is never purged
    expect(settings.automation.enabled).toBe(false);   // nothing runs unattended
    expect(settings.automation.task).toBe('scan');     // and if it did, it measures
    expect(settings.excludeFolders).toEqual([]);
    expect(settings.excludeExtensions).toEqual([]);
    expect(settings.updateCheck).toBe(false);          // nothing leaves the machine
    expect(settings.leftoverDestination).toBe('quarantine'); // leftovers can be put back
    expect(settings.preselectLeftovers).toBe(true);    // today's behaviour, unchanged
    expect(settings.scanLeftoversAfterUninstall).toBe(true);
    expect(settings.keepUninstallHistory).toBe(true);
    expect(settings.restorePointBeforeUninstall).toBe(false);   // needs admin, slow
    expect(settings.registryBackupBeforeUninstall).toBe(false); // ~140 MB each time
    expect(settings.deleteLockedFilesOnRestart).toBe(false); // writes to HKLM, needs admin
    expect(settings.autoInstallUpdates).toBe(false);   // nothing installs unasked
    expect(settings.language).toBe('en');              // no Electron in this test env to detect another
    expect(settings.showFreeSpaceOnMap).toBe(false);   // WizTree ships it off too
  });

  it('returns every key the app reads, so a missing one fails here', async () => {
    // The other half of what the deep-equal was doing, without the
    // churn: a key the app expects and never gets would otherwise fail
    // somewhere far away, as undefined.
    const settings = await getSettings();
    for (const key of [
      'excludeFolders', 'excludeExtensions', 'autoQuarantine', 'theme',
      'minimizeToTray', 'skipRecentHours', 'createRestorePoint', 'hideUnavailableRules',
      'acknowledgedCleanWarnings', 'deepCleanSelection',
      'quarantineRetentionDays', 'quarantineMaxSizeGb', 'automation', 'updateCheck'
    ]) {
      expect(settings, key).toHaveProperty(key);
    }
  });
});

describe('updateSettings', () => {
  it('persists a real change that a later getSettings call reads back', async () => {
    await updateSettings({ autoQuarantine: false });
    const settings = await getSettings();
    expect(settings.autoQuarantine).toBe(false);
  });

  it('deepCleanSelection defaults to an empty array and round-trips a real one', async () => {
    const before = await getSettings();
    expect(before.deepCleanSelection).toEqual([]);

    await updateSettings({ deepCleanSelection: ['chrome_cache', 'brave_cookies'] });
    const after = await getSettings();
    expect(after.deepCleanSelection).toEqual(['chrome_cache', 'brave_cookies']);
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
    // The changed key, and proof the untouched ones came back too -- the
    // frontend replaces its whole cache with this reply.
    expect(result.theme).toBe('light');
    expect(result.autoQuarantine).toBe(true);
    expect(result.skipRecentHours).toBe(24);
    expect(result.automation.enabled).toBe(false);
  });

  it('supports the minimizeToTray preference the tray close-handler reads', async () => {
    const result = await updateSettings({ minimizeToTray: false });
    expect(result.minimizeToTray).toBe(false);
  });

  it('persists a language, same as any other setting', async () => {
    const result = await updateSettings({ language: 'el' });
    expect(result.language).toBe('el');
    expect((await getSettings()).language).toBe('el');
  });
});

describe('the default language', () => {
  it('is English when there is no Electron to ask -- the case in this test suite', async () => {
    // detectDefaultLanguage()'s own guard: 'electron' is not an installed
    // package for the backend project, only for the separate electron/
    // one, so this exercises the real failure path rather than a mock.
    expect((await getSettings()).language).toBe('en');
  });

  it('uses whatever detectLanguage answers for a brand-new settings file', async () => {
    // Injected rather than a real Electron locale (untestable here, see
    // detectDefaultLanguage's own comment) -- this proves the VALUE
    // actually reaches the returned settings, not merely that it defaults
    // to 'en' the same way a broken wiring would too.
    expect((await getSettings({ detectLanguage: async () => 'el' })).language).toBe('el');
  });

  it('falls back to the settings.js default when the settings.json on disk predates language entirely', async () => {
    // A file from before this feature existed has no `language` key at
    // all -- written directly, bypassing updateSettings(), which would
    // otherwise bake today's detected language into the file itself and
    // hide whether DEFAULT_SETTINGS.language is still doing its job.
    await mkdir(dirname(process.env.UNREVO_SETTINGS_PATH), { recursive: true });
    await writeFile(process.env.UNREVO_SETTINGS_PATH, JSON.stringify({ autoQuarantine: false }), 'utf8');
    expect((await getSettings()).language).toBe('en');
  });

  it('is only consulted once -- an existing file is never re-detected', async () => {
    // Writing any field creates the file; a second read must not call
    // detectLanguage again -- proven by an injected detector that would
    // change the answer if it ran a second time.
    await updateSettings({ autoQuarantine: false });
    expect((await getSettings({ detectLanguage: async () => 'el' })).language).not.toBe('el');
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

  it('passes the user\'s cookie keep list through', () => {
    expect(cleanGuardsFrom({ cookieKeepList: ['example.com'] }).cookieKeepList).toEqual(['example.com']);
  });

  it('treats a missing or malformed cookie keep list as empty', () => {
    expect(cleanGuardsFrom({}).cookieKeepList).toEqual([]);
    expect(cleanGuardsFrom({ cookieKeepList: 'example.com' }).cookieKeepList).toEqual([]);
    expect(cleanGuardsFrom(null).cookieKeepList).toEqual([]);
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
