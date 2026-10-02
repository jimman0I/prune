import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { getSettings, updateSettings, cleanGuardsFrom } from './settings.js';

/** The Deep Clean settings added for the BleachBit-parity track. Each one
 * that removes a guard or does something irreversible is off by default,
 * and a corrupted or hand-edited file can only ever turn one ON with an
 * exact `true`. */

let dir;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'prune-settings-v3-'));
  process.env.UNREVO_SETTINGS_PATH = join(dir, 'settings.json');
});
afterEach(() => {
  delete process.env.UNREVO_SETTINGS_PATH;
  rmSync(dir, { recursive: true, force: true });
});

const writeRaw = async (value) => {
  await mkdir(dirname(process.env.UNREVO_SETTINGS_PATH), { recursive: true });
  await writeFile(process.env.UNREVO_SETTINGS_PATH, JSON.stringify(value));
};

describe('overwrite before deleting', () => {
  it('is off by default, with one pass chosen for when it is switched on', async () => {
    const settings = await getSettings();
    expect(settings.overwriteBeforeDelete).toBe(false);
    expect(settings.overwritePasses).toBe(1);
  });

  it('reaches the cleaner as guards.overwritePasses -- 0 when off', () => {
    expect(cleanGuardsFrom({}).overwritePasses).toBe(0);
    expect(cleanGuardsFrom({ overwriteBeforeDelete: false, overwritePasses: 3 }).overwritePasses).toBe(0);
    expect(cleanGuardsFrom({ overwriteBeforeDelete: true }).overwritePasses).toBe(1);
    expect(cleanGuardsFrom({ overwriteBeforeDelete: true, overwritePasses: 1 }).overwritePasses).toBe(1);
    expect(cleanGuardsFrom({ overwriteBeforeDelete: true, overwritePasses: 3 }).overwritePasses).toBe(3);
  });

  it('is on only for an exact true -- a string or a number from a corrupted file does not count', () => {
    for (const junk of ['true', 'yes', 1, {}, [], null]) {
      expect(cleanGuardsFrom({ overwriteBeforeDelete: junk, overwritePasses: 3 }).overwritePasses).toBe(0);
    }
  });

  it('turns any passes value other than 3 into 1', async () => {
    for (const junk of [0, 2, 7, 35, '3x', null, 'many']) {
      expect(cleanGuardsFrom({ overwriteBeforeDelete: true, overwritePasses: junk }).overwritePasses).toBe(1);
    }
    expect((await updateSettings({ overwritePasses: 2 })).overwritePasses).toBe(1);
    expect((await updateSettings({ overwritePasses: 3 })).overwritePasses).toBe(3);
    await writeRaw({ overwriteBeforeDelete: true, overwritePasses: 99 });
    expect((await getSettings()).overwritePasses).toBe(1);
  });

  it('saves and reads back the switch', async () => {
    expect((await updateSettings({ overwriteBeforeDelete: true })).overwriteBeforeDelete).toBe(true);
    expect((await getSettings()).overwriteBeforeDelete).toBe(true);
    expect((await updateSettings({ overwriteBeforeDelete: 'true' })).overwriteBeforeDelete).toBe(false);
  });
});

describe('delete locked files at the next restart', () => {
  it('is off by default', async () => {
    expect((await getSettings()).deleteLockedFilesOnRestart).toBe(false);
    expect(cleanGuardsFrom({}).deleteLockedOnRestart).toBe(false);
  });

  it('reaches the cleaner only for an exact true -- it is a machine-wide registry write', () => {
    expect(cleanGuardsFrom({ deleteLockedFilesOnRestart: true }).deleteLockedOnRestart).toBe(true);
    for (const junk of ['true', 1, 'yes', {}, null]) {
      expect(cleanGuardsFrom({ deleteLockedFilesOnRestart: junk }).deleteLockedOnRestart).toBe(false);
    }
  });
});

describe('the free-space wipe choices', () => {
  it('default to the profile drive and one pass', async () => {
    const settings = await getSettings();
    expect(settings.wipeDrive).toBeNull();
    expect(settings.wipePasses).toBe(1);
  });

  it('reach the cleaner as guards.wipeDrive and guards.wipePasses', () => {
    expect(cleanGuardsFrom({}).wipeDrive).toBeNull();
    expect(cleanGuardsFrom({}).wipePasses).toBe(1);
    expect(cleanGuardsFrom({ wipeDrive: 'd:', wipePasses: 3 })).toMatchObject({ wipeDrive: 'D:', wipePasses: 3 });
  });

  it('accept only a bare drive letter -- the wipe fills whatever this names', () => {
    for (const bad of ['C:\\Windows', 'C', 'CD:', '\\\\server\\share', '..', '/', 7, {}, true, '']) {
      expect(cleanGuardsFrom({ wipeDrive: bad }).wipeDrive, String(bad)).toBeNull();
    }
  });

  it('turn any passes value other than 3 into 1', async () => {
    for (const junk of [0, 2, 99, 'many', null]) expect(cleanGuardsFrom({ wipePasses: junk }).wipePasses).toBe(1);
    expect((await updateSettings({ wipePasses: 3 })).wipePasses).toBe(3);
    expect((await updateSettings({ wipePasses: 5 })).wipePasses).toBe(1);
  });

  it('are repaired when a hand-edited file holds nonsense', async () => {
    await writeRaw({ wipeDrive: 'C:\\Windows', wipePasses: 12 });
    const settings = await getSettings();
    expect(settings.wipeDrive).toBeNull();
    expect(settings.wipePasses).toBe(1);
  });

  it('save a drive letter in upper case', async () => {
    expect((await updateSettings({ wipeDrive: 'e:' })).wipeDrive).toBe('E:');
    expect((await updateSettings({ wipeDrive: null })).wipeDrive).toBeNull();
  });
});