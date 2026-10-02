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
