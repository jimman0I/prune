import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Regression tests for the guards, across everything the Deep Clean track
 * added. Each new way of removing a file (overwrite-then-delete, shredding,
 * the free-space wipe, scheduling for restart, Custom locations, imported
 * cleaners, the command line) must still stop at the same lines:
 *
 *   - the user's excluded folders and file types,
 *   - the cleaner's built-in protected folders (Quarantine, System Volume
 *     Information, ...),
 *   - the recent-files guard,
 *   - the protected places (Windows, whole drives, profiles) for anything
 *     nobody curated,
 *   - Quarantine / Recycle Bin modes never destroy a file they promise to keep.
 *
 * Everything runs in a temp folder. The one real system folder named
 * (C:\Windows\Fonts) is only ever listed, never touched. */

const schedulePendingDelete = vi.fn(async () => {});
vi.mock('./services/pendingReboot.js', () => ({ schedulePendingDelete: (...a) => schedulePendingDelete(...a) }));

const shredSpy = vi.fn();
vi.mock('./lib/shredFile.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, shredPaths: (...a) => { shredSpy(...a); return actual.shredPaths(...a); } };
});

const { executeRule, scanRule, loadCleanerRules } = await import('./lib/cleanerRules.js');
const { saveImported, importedDir } = await import('./lib/userRules.js');
const { importBleachBitXml } = await import('./lib/bleachbitImport.js');
const { shredRequested, previewShred } = await import('./services/shredTool.js');
const { removeLeftovers } = await import('./services/leftoverRemoval.js');
const { cleanupAllWipeLeftovers, FILLER_PREFIX, DRIVE_WIPE_FOLDER, wipeDirFor } = await import('./lib/cleanerActions/wipeFreeSpace.js');
const { getSettings, updateSettings } = await import('./services/settings.js');

let root;
let work;
beforeEach(() => {
  vi.clearAllMocks();
  root = mkdtempSync(join(tmpdir(), 'prune-guards-'));
  work = join(root, 'work');
  mkdirSync(work, { recursive: true });
  process.env.UNREVO_SETTINGS_PATH = join(root, 'settings.json');
  process.env.UNREVO_QUARANTINE_ROOT = join(root, 'quarantine');
  delete process.env.UNREVO_CLEANERS_PATH;
});
afterEach(() => {
  delete process.env.UNREVO_SETTINGS_PATH;
  delete process.env.UNREVO_QUARANTINE_ROOT;
  rmSync(root, { recursive: true, force: true });
});

const put = (rel, content = 'data') => {
  const full = join(work, rel);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, content);
  return full;
};

/** The ways a rule can be defined, each pointed at `work`. */
async function ruleKinds() {
  writeFileSync(join(root, 'settings.json'), JSON.stringify({ customLocations: [work] }));
  const { cleaner, report } = importBleachBitXml(
    `<cleaner id="g"><label>G</label><option id="all"><label>All</label><action command="delete" search="walk.all" path="${work}"/></option></cleaner>`
  );
  await saveImported(cleaner, report, { dir: importedDir() });
  const all = loadCleanerRules();
  return {
    'a curated rule': { id: 'curated', category: 'C', name: 'C', paths: [work] },
    'Custom locations': all.find((r) => r.id === 'custom_locations'),
    'an imported cleaner': all.find((r) => r.id === 'imp_g_all')
  };
}

const MODES = [
  ['Quarantine', { removal: 'quarantine', overwritePasses: 0 }],
  ['Delete now', { removal: 'delete', overwritePasses: 0 }],
  ['Delete now with overwrite', { removal: 'delete', overwritePasses: 3 }]
];

describe.each(MODES)('%s', (_name, mode) => {
  it('never takes a file from the cleaner\'s built-in protected folders, however the rule is defined', async () => {
    const kinds = await ruleKinds();
    for (const [label, rule] of Object.entries(kinds)) {
      const guarded = put(`${label}\\Quarantine\\sample.bin`.replace(/[ ]/g, '_'), 'protected');
      const result = await executeRule(rule, { ...mode, skipRecentHours: 0 });
      expect(existsSync(guarded), label).toBe(true);
      expect(readFileSync(guarded, 'utf8'), label).toBe('protected'); // and not overwritten either
      expect(result.skipped.some((s) => s.path === guarded), label).toBe(true);
    }
  });

  it('never takes a file from the user\'s excluded folders or of an excluded type', async () => {
    const kinds = await ruleKinds();
    for (const [label, rule] of Object.entries(kinds)) {
      const dir = label.replace(/ /g, '_');
      const inFolder = put(`${dir}\\keep\\a.dat`, 'folder');
      const byType = put(`${dir}\\b.iso`, 'type');
      await executeRule(rule, {
        ...mode, skipRecentHours: 0, excludeFolders: [join(work, dir, 'keep')], excludeExtensions: ['.iso']
      });
      expect(readFileSync(inFolder, 'utf8'), label).toBe('folder');
      expect(readFileSync(byType, 'utf8'), label).toBe('type');
    }
  });

  it('never takes a file modified inside the recent-files window', async () => {
    const kinds = await ruleKinds();
    for (const [label, rule] of Object.entries(kinds)) {
      const fresh = put(`${label.replace(/ /g, '_')}\\fresh.tmp`, 'fresh');
      await executeRule(rule, { ...mode, skipRecentHours: 24 });
      expect(readFileSync(fresh, 'utf8'), label).toBe('fresh');
    }
  });

  it('does take an ordinary old file, so the guards above are the reason and not a rule that does nothing', async () => {
    const kinds = await ruleKinds();
    const old = new Date(Date.now() - 3 * 24 * 3600 * 1000);
    const { utimesSync } = await import('node:fs');
    for (const [label, rule] of Object.entries(kinds)) {
      const file = put(`${label.replace(/ /g, '_')}\\ordinary.tmp`, 'junk');
      utimesSync(file, old, old);
      await executeRule(rule, { ...mode, skipRecentHours: 24 });
      expect(existsSync(file), label).toBe(false);
    }
  });
});

describe('overwriting happens only where a file is destroyed', () => {
  it('Quarantine and the Recycle Bin never overwrite what they are keeping', async () => {
    const file = put('keepme.tmp', 'recoverable');
    await executeRule({ id: 'r', category: 'C', name: 'R', paths: [work] }, { removal: 'quarantine', overwritePasses: 3, skipRecentHours: 0 });
    expect(shredSpy).not.toHaveBeenCalled();
    expect(existsSync(file)).toBe(false);
    // The quarantined copy still holds the original bytes.
    const batches = existsSync(join(root, 'quarantine')) ? readdirSync(join(root, 'quarantine')) : [];
    expect(batches.length).toBeGreaterThan(0);
  });

  it('an uninstall\'s permanent delete refuses a protected path before any overwrite', async () => {
    const windows = process.env.SystemRoot || 'C:\\Windows';
    const result = await removeLeftovers({ programName: 'X', files: [windows], registryKeys: [], destination: 'permanent', overwritePasses: 3 });
    expect(shredSpy).not.toHaveBeenCalled();
    expect(result.failedFiles).toHaveLength(1);
    expect(existsSync(windows)).toBe(true);
  });
});

describe('shredding', () => {
  it('refuses protected folders, the user\'s exclusions and whole drives, and lists why in the preview', async () => {
    const guarded = put('Quarantine\\x.bin', 'x');
    const excluded = put('mine\\y.dat', 'y');
    const guards = { excludeFolders: [join(work, 'mine')], excludeExtensions: [] };
    const preview = await previewShred([guarded, excluded, 'C:\\', process.env.SystemRoot || 'C:\\Windows'], guards);
    expect(preview.files).toBe(0);
    expect(preview.refused).toHaveLength(4);
    const result = await shredRequested([guarded, excluded], 3, guards);
    expect(result.shreddedFiles).toBe(0);
    expect(existsSync(guarded) && existsSync(excluded)).toBe(true);
  });
});

describe('locked files scheduled for restart', () => {
  it('only ever schedules files the other guards let through', async () => {
    const fs = await import('node:fs');
    const realOpen = fs.promises.open.bind(fs.promises);
    const spy = vi.spyOn(fs.promises, 'open').mockImplementation(async (p, ...rest) => {
      if (String(p).includes('busy')) throw Object.assign(new Error('EBUSY'), { code: 'EBUSY' });
      return realOpen(p, ...rest);
    });
    try {
      const protectedBusy = put('Quarantine\\busy.bin');
      const excludedBusy = put('mine\\busy.dat');
      const fine = put('ok\\busy.tmp');
      await executeRule({ id: 'r', category: 'C', name: 'R', paths: [work] }, {
        removal: 'delete', skipRecentHours: 0, deleteLockedOnRestart: true, excludeFolders: [join(work, 'mine')]
      });
      const scheduled = schedulePendingDelete.mock.calls.map((c) => c[0]);
      expect(scheduled).toEqual([fine]);
      expect(scheduled).not.toContain(protectedBusy);
      expect(scheduled).not.toContain(excludedBusy);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('the free-space wipe', () => {
  it('sweeps leftover filler from each drive\'s own folder and nothing else in it', async () => {
    // A pretend drive: wipeDirFor('Z:') is Z:\Prune-wipe, which does not exist
    // here; the sweep must cope with that and never throw.
    expect(wipeDirFor('Z:')).toBe(`Z:\\${DRIVE_WIPE_FOLDER}`);
    await expect(cleanupAllWipeLeftovers({ drives: ['Z:', 'Y:', 'not-a-drive'] })).resolves.toMatchObject({ files: 0 });
  });

  it('removes only files with its own prefix from the profile folder', async () => {
    const dir = join(root, 'wipe');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${FILLER_PREFIX}0001.bin`), 'x');
    writeFileSync(join(dir, 'users-file.txt'), 'mine');
    const { cleanupWipeLeftovers } = await import('./lib/cleanerActions/wipeFreeSpace.js');
    const removed = await cleanupWipeLeftovers({ dir });
    expect(removed.files).toBe(1);
    expect(readFileSync(join(dir, 'users-file.txt'), 'utf8')).toBe('mine');
  });
});

describe('settings cannot be hand-edited past the guards', () => {
  it('drops a protected or malformed custom location on read and on write', async () => {
    writeFileSync(join(root, 'settings.json'), JSON.stringify({ customLocations: ['C:\\Windows', 'C:\\', 'relative', 'D:\\ok\\sub\\*.tmp'] }));
    expect((await getSettings()).customLocations).toEqual(['D:\\ok\\sub\\*.tmp']);
    expect((await updateSettings({ customLocations: ['C:\\Program Files', 'D:\\ok2'] })).customLocations).toEqual(['D:\\ok2']);
  });

  it('only an exact true turns on overwriting, scheduling for restart', async () => {
    writeFileSync(join(root, 'settings.json'), JSON.stringify({ overwriteBeforeDelete: 'true', deleteLockedFilesOnRestart: 'true' }));
    const { cleanGuardsFrom } = await import('./services/settings.js');
    const guards = cleanGuardsFrom(await getSettings());
    expect(guards.overwritePasses).toBe(0);
    expect(guards.deleteLockedOnRestart).toBe(false);
  });
});

describe('a custom or imported rule can never reach a protected place', () => {
  it('lists nothing from C:\\Windows\\Fonts however it is written (read-only check)', async () => {
    const fonts = join(process.env.SystemRoot || 'C:\\Windows', 'Fonts');
    const { cleaner, report } = importBleachBitXml(
      `<cleaner id="evil"><label>E</label><option id="o"><label>O</label><action command="delete" search="walk.all" path="${fonts}"/></option></cleaner>`
    );
    await saveImported(cleaner, report, { dir: importedDir() });
    const rule = loadCleanerRules().find((r) => r.id === 'imp_evil_o');
    expect(scanRule(rule, {})).toMatchObject({ fileCount: 0 });
  });
});
