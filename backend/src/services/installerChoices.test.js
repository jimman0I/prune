import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyInstallerChoices, INSTALLER_CHOICES_FILE } from './installerChoices.js';

/** The installer's "Check for updates" page, handed over to the app.
 *
 * The installer cannot write settings.json -- NSIS has no JSON, and a
 * reinstall would have to merge into a file it cannot parse. It leaves a
 * one-line file beside it instead, and the app applies it on the next
 * start and deletes it. These tests hold the two things that matter about
 * that handover: the installer can change the update check and nothing
 * else, and a file is only ever acted on once. */

let dir;
const file = () => join(dir, INSTALLER_CHOICES_FILE);
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'prune-installer-choices-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe('applyInstallerChoices', () => {
  it('does nothing when the installer left nothing', async () => {
    const save = vi.fn();
    expect(await applyInstallerChoices({ dir, save })).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });

  it('turns the update check on when the box was ticked, then forgets the file', async () => {
    writeFileSync(file(), '{"updateCheck":true}');
    const save = vi.fn(async () => {});

    expect(await applyInstallerChoices({ dir, save })).toEqual({ updateCheck: true });
    expect(save).toHaveBeenCalledWith({ updateCheck: true });
    expect(existsSync(file())).toBe(false);
  });

  it('turns it off when the box was left clear', async () => {
    // A reinstall with the box cleared is a choice too, and it overrides
    // whatever was set before.
    writeFileSync(file(), '{"updateCheck":false}');
    const save = vi.fn(async () => {});

    await applyInstallerChoices({ dir, save });
    expect(save).toHaveBeenCalledWith({ updateCheck: false });
  });

  it('applies nothing but the update check and the language, whatever else the file says', async () => {
    // The file sits in a folder the user can write to. It gets to answer
    // the two questions the installer asked, not to rewrite settings.
    writeFileSync(file(), '{"updateCheck":true,"language":"el","leftoverDestination":"permanent","autoInstallUpdates":true}');
    const save = vi.fn(async () => {});

    await applyInstallerChoices({ dir, save });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ updateCheck: true, language: 'el' });
  });

  it('applies the language the installer was run in', async () => {
    writeFileSync(file(), '{"language":"el"}');
    const save = vi.fn(async () => {});

    expect(await applyInstallerChoices({ dir, save })).toEqual({ language: 'el' });
    expect(save).toHaveBeenCalledWith({ language: 'el' });
  });

  it('ignores a language this version of Prune does not have', async () => {
    // Installer offers 40; a future one might offer 41, and an older app
    // opening a newer installer's file should not crash or store garbage.
    writeFileSync(file(), '{"language":"xx"}');
    const save = vi.fn();

    expect(await applyInstallerChoices({ dir, save })).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });

  it('applies both answers together when both are real', async () => {
    writeFileSync(file(), '{"updateCheck":false,"language":"ja"}');
    const save = vi.fn(async () => {});

    expect(await applyInstallerChoices({ dir, save })).toEqual({ updateCheck: false, language: 'ja' });
  });

  it('ignores anything but a real true or false', async () => {
    for (const value of ['"yes"', '1', 'null', '"true"']) {
      writeFileSync(file(), `{"updateCheck":${value}}`);
      const save = vi.fn();
      expect(await applyInstallerChoices({ dir, save }), value).toBeNull();
      expect(save).not.toHaveBeenCalled();
      expect(existsSync(file())).toBe(false);
    }
  });

  it('deletes a file it cannot read, so it is not tried on every start', async () => {
    writeFileSync(file(), '{updateCheck: tru');
    const save = vi.fn();

    expect(await applyInstallerChoices({ dir, save })).toBeNull();
    expect(save).not.toHaveBeenCalled();
    expect(existsSync(file())).toBe(false);
  });

  it('reads a file written with a byte-order mark', async () => {
    writeFileSync(file(), '﻿{"updateCheck":true}');
    const save = vi.fn(async () => {});

    await applyInstallerChoices({ dir, save });
    expect(save).toHaveBeenCalledWith({ updateCheck: true });
  });

  it('keeps the file when the save fails, so the choice is not lost', async () => {
    writeFileSync(file(), '{"updateCheck":true}');
    const save = vi.fn(async () => { throw new Error('EPERM'); });

    await expect(applyInstallerChoices({ dir, save })).rejects.toThrow('EPERM');
    expect(existsSync(file())).toBe(true);
  });
});
