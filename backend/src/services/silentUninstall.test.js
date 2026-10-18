import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { silentUninstallCommand, detectInstallerKind } from './silentUninstall.js';

/** Making a batch uninstall actually run without a person at the keyboard.
 *
 * The old behaviour appended /qn to MsiExec strings and left everything
 * else exactly as registered, with a comment saying that guessing a silent
 * flag risks passing one the installer does not understand. That caution
 * was right, and this does not abandon it -- it replaces guessing with
 * evidence.
 *
 * Measured on a real machine with 345 installed programs before any of
 * this was written, because the shape of the answer decides which
 * detectors are worth having at all:
 *
 *   52  publish QuietUninstallString -- the vendor's own silent command
 *   245 are MsiExec
 *   10  are Squirrel (Update.exe --uninstall)
 *   0   are Inno Setup uninstallers lacking a quiet string
 *   38  are something else, mostly NSIS
 *
 * That zero was why there was no Inno branch at first. A second machine had
 * thirteen, and 22 WiX Burn bundles besides: see the tests at the end.
 */

let dir;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'prune-silent-test-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe('the command it decides to run', () => {
  it('prefers the vendor\'s own quiet string over anything inferred', () => {
    /* The whole point. QuietUninstallString is what the installer author
     * wrote down as the correct silent invocation; nothing derived can
     * beat it, and 52 of 345 programs on the reference machine have one. */
    /* The vendor string here carries a flag inference could never produce
     * -- /allusers, which is real: it is what MCHOSE HUB publishes on this
     * machine. An earlier version of this test used 7-Zip's, which is the
     * uninstall string plus /S, and that is EXACTLY what the nsis branch
     * would have produced anyway. It passed against a build that ignored
     * QuietUninstallString entirely. Caught by mutation, not by reading. */
    const command = silentUninstallCommand({
      uninstallString: '"C:\\Program Files\\MCHOSE HUB\\Uninstall MCHOSE HUB.exe"',
      quietUninstallString: '"C:\\Program Files\\MCHOSE HUB\\Uninstall MCHOSE HUB.exe" /allusers /S',
      kind: 'nsis'
    });

    expect(command).toBe('"C:\\Program Files\\MCHOSE HUB\\Uninstall MCHOSE HUB.exe" /allusers /S');
  });

  it('ignores a quiet string that is blank or whitespace', () => {
    // A registry value that exists but is empty is not an answer.
    expect(silentUninstallCommand({
      uninstallString: 'MsiExec.exe /X{GUID}', quietUninstallString: '   ', kind: 'msi'
    })).toBe('MsiExec.exe /X{GUID} /qn /norestart');
  });

  describe('MsiExec', () => {
    it('adds quiet AND no-restart', () => {
      /* /norestart is the half the old code was missing. An MSI that
       * decides it wants a reboot will otherwise prompt -- or on some
       * packages simply restart the machine -- in the middle of a batch
       * the user has walked away from. */
      expect(silentUninstallCommand({ uninstallString: 'MsiExec.exe /X{GUID}', kind: 'msi' }))
        .toBe('MsiExec.exe /X{GUID} /qn /norestart');
    });

    it('does not argue with a UI mode the string already chose', () => {
      // /qb is "basic UI", a deliberate choice by whoever wrote the entry.
      // Appending /qn would be overriding it.
      expect(silentUninstallCommand({ uninstallString: 'MsiExec.exe /X{GUID} /qb', kind: 'msi' }))
        .toBe('MsiExec.exe /X{GUID} /qb /norestart');
    });

    it('does not add /norestart twice', () => {
      expect(silentUninstallCommand({ uninstallString: 'MsiExec.exe /X{GUID} /qn /norestart', kind: 'msi' }))
        .toBe('MsiExec.exe /X{GUID} /qn /norestart');
    });

    it('swaps the Install verb for Uninstall before going silent', () => {
      /* Real bug: some registry UninstallStrings publish /I{GUID} -- the
       * Modify path's verb -- instead of /X{GUID}. Shown visibly that
       * opens the modify/repair/remove dialog and a person picks Remove;
       * forced silent without the swap it would quietly repair the
       * program instead of removing it, so nothing would be uninstalled
       * and nothing would appear on screen to say so. */
      expect(silentUninstallCommand({ uninstallString: 'MsiExec.exe /I{GUID}', kind: 'msi' }))
        .toBe('MsiExec.exe /X{GUID} /qn /norestart');
    });

    it('swaps a lowercase /i verb too', () => {
      expect(silentUninstallCommand({ uninstallString: 'C:\\WINDOWS\\system32\\msiexec.exe /i{GUID}', kind: 'msi' }))
        .toBe('C:\\WINDOWS\\system32\\msiexec.exe /X{GUID} /qn /norestart');
    });

    it('leaves an already-correct /X verb alone', () => {
      expect(silentUninstallCommand({ uninstallString: 'MsiExec.exe /X{GUID}', kind: 'msi' }))
        .toBe('MsiExec.exe /X{GUID} /qn /norestart');
    });
  });

  describe('NSIS', () => {
    it('adds /S, capital S', () => {
      // NSIS parses its silent flag case-sensitively: /s is not /S.
      expect(silentUninstallCommand({ uninstallString: '"C:\\App\\uninst.exe"', kind: 'nsis' }))
        .toBe('"C:\\App\\uninst.exe" /S');
    });

    it('leaves a string that already has it alone', () => {
      expect(silentUninstallCommand({ uninstallString: '"C:\\App\\uninst.exe" /S', kind: 'nsis' }))
        .toBe('"C:\\App\\uninst.exe" /S');
    });

    it('still adds /S when the string only has a lowercase /s', () => {
      /* The entire reason the already-present check is case-sensitive for
       * this one flag. NSIS reads /S and /s as different things, so
       * treating them as equal would leave the wizard open while the code
       * believed it had already asked for silence -- a failure that looks
       * exactly like the bug this module was written to fix. */
      expect(silentUninstallCommand({ uninstallString: '"C:\\App\\uninst.exe" /s', kind: 'nsis' }))
        .toBe('"C:\\App\\uninst.exe" /s /S');
    });
  });

  describe('Squirrel', () => {
    it('adds -s', () => {
      expect(silentUninstallCommand({ uninstallString: '"C:\\App\\Update.exe" --uninstall', kind: 'squirrel' }))
        .toBe('"C:\\App\\Update.exe" --uninstall -s');
    });

    it('leaves a string that already has it alone', () => {
      expect(silentUninstallCommand({ uninstallString: '"C:\\App\\Update.exe" --uninstall -s', kind: 'squirrel' }))
        .toBe('"C:\\App\\Update.exe" --uninstall -s');
    });
  });

  it('changes nothing at all when the kind is unknown', () => {
    /* The old comment's warning, kept. An uninstaller nobody has
     * identified runs exactly as registered -- a wrong flag is worse than
     * a visible wizard, because the user watching a batch can click
     * through a wizard and cannot undo a flag that meant something else. */
    const raw = '"C:\\Program Files\\Odd\\Uninstaller.exe" /u';
    expect(silentUninstallCommand({ uninstallString: raw, kind: 'unknown' })).toBe(raw);
  });

  it('hands back an empty command untouched rather than inventing one', () => {
    expect(silentUninstallCommand({ uninstallString: '', kind: 'nsis' })).toBe('');
    expect(silentUninstallCommand({ uninstallString: null, kind: 'nsis' })).toBe(null);
  });
});

describe('working out what kind of installer it is', () => {
  it('recognises MsiExec from the string, without touching the disk', () => {
    // No file is involved: MsiExec.exe is Windows' own, and the GUID is
    // the product. Nothing to sniff.
    expect(detectInstallerKind('MsiExec.exe /X{GUID}')).toBe('msi');
    expect(detectInstallerKind('C:\\WINDOWS\\system32\\msiexec.exe /I{GUID}')).toBe('msi');
  });

  it('recognises Squirrel by its Update.exe handoff', () => {
    expect(detectInstallerKind('"C:\\Users\\x\\AppData\\Local\\App\\Update.exe" --uninstall')).toBe('squirrel');
  });

  it('recognises NSIS by what is INSIDE the uninstaller, not its name', () => {
    /* The reason this reads the file at all.
     *
     * Measured on the reference machine: of five uninstallers named
     * uninstall.exe or uninst.exe, four contained the Nullsoft signature
     * and one -- SQLiteStudio's, 6MB -- did not. A detector keyed on the
     * filename would have sent /S to that one. Naming proves nothing;
     * the bytes do. */
    const exe = join(dir, 'uninstall.exe');
    writeFileSync(exe, Buffer.concat([
      Buffer.from('MZ'), Buffer.alloc(64), Buffer.from('NullsoftInst'), Buffer.alloc(32)
    ]));

    expect(detectInstallerKind(`"${exe}"`)).toBe('nsis');
  });

  it('says unknown for an uninstaller that merely LOOKS like NSIS', () => {
    // The SQLiteStudio case, which is what stops this being a filename
    // guess wearing a file read.
    const exe = join(dir, 'uninstall.exe');
    writeFileSync(exe, Buffer.concat([Buffer.from('MZ'), Buffer.alloc(4096)]));

    expect(detectInstallerKind(`"${exe}"`)).toBe('unknown');
  });

  it('says unknown rather than throwing when the file is not there', () => {
    /* Reachable in normal use: the list on screen is a snapshot, and an
     * uninstaller can be gone by the time a batch reaches it -- that is
     * the same orphan the Applications tab already flags. */
    expect(detectInstallerKind(`"${join(dir, 'gone.exe')}"`)).toBe('unknown');
  });

  it('says unknown for nothing at all', () => {
    expect(detectInstallerKind('')).toBe('unknown');
    expect(detectInstallerKind(null)).toBe('unknown');
  });
});

describe('Inno Setup, WiX Burn, 7-Zip and WinRAR', () => {
  const binary = (path, signature) => writeFileSync(path, Buffer.concat([Buffer.from('MZ'), Buffer.alloc(64), Buffer.from(signature), Buffer.alloc(32)]));
  const touch = (path) => writeFileSync(path, '');

  it('recognises an Inno uninstaller by its signature, its unins000 name and its .dat beside it', () => {
    const exe = join(dir, 'unins000.exe');
    binary(exe, 'Inno Setup Setup Data');
    touch(join(dir, 'unins000.dat'));
    expect(detectInstallerKind(`"${exe}"`)).toBe('inno');
  });

  it('does not call it Inno without every piece of evidence', () => {
    const named = join(dir, 'unins000.exe');
    binary(named, 'Inno Setup');
    expect(detectInstallerKind(`"${named}"`), 'no .dat').toBe('unknown');
    const other = join(dir, 'uninstall.exe');
    binary(other, 'Inno Setup');
    touch(join(dir, 'uninstall.dat'));
    expect(detectInstallerKind(`"${other}"`), 'wrong name').toBe('unknown');
  });

  it('recognises a Burn bundle only when it is asked to uninstall', () => {
    const exe = join(dir, 'VC_redist.x64.exe');
    binary(exe, '.wixburn');
    expect(detectInstallerKind(`"${exe}"  /uninstall`)).toBe('burn');
    expect(detectInstallerKind(`"${exe}" -uninstall`)).toBe('burn');
    expect(detectInstallerKind(`"${exe}"`)).toBe('unknown');
  });

  it('recognises 7-Zip and WinRAR only beside their own program files', () => {
    const seven = join(dir, 'uninstall.exe');
    binary(seven, '7-Zip');
    expect(detectInstallerKind(`"${seven}"`), 'a string alone').toBe('unknown');
    touch(join(dir, '7z.exe'));
    touch(join(dir, '7z.dll'));
    expect(detectInstallerKind(`"${seven}"`)).toBe('7zip');

    rmSync(join(dir, '7z.exe'));
    binary(seven, 'WinRAR');
    expect(detectInstallerKind(`"${seven}"`), 'a string alone').toBe('unknown');
    touch(join(dir, 'WinRAR.exe'));
    expect(detectInstallerKind(`"${seven}"`)).toBe('winrar');
  });

  it('adds each one\'s documented switches, and never a reboot', () => {
    expect(silentUninstallCommand({ uninstallString: '"C:\\Program Files\\Git\\unins000.exe"', kind: 'inno' }))
      .toBe('"C:\\Program Files\\Git\\unins000.exe" /VERYSILENT /SUPPRESSMSGBOXES /NORESTART');
    expect(silentUninstallCommand({ uninstallString: '"C:\\PC\\vc.exe"  /uninstall', kind: 'burn' }))
      .toBe('"C:\\PC\\vc.exe"  /uninstall /quiet /norestart');
    expect(silentUninstallCommand({ uninstallString: '"C:\\Program Files\\7-Zip\\Uninstall.exe"', kind: '7zip' }))
      .toBe('"C:\\Program Files\\7-Zip\\Uninstall.exe" /S');
    expect(silentUninstallCommand({ uninstallString: 'C:\\Program Files\\WinRAR\\uninstall.exe', kind: 'winrar' }))
      .toBe('C:\\Program Files\\WinRAR\\uninstall.exe /S');
  });

  it('leaves a quiet level the entry already chose, and only adds no-reboot', () => {
    expect(silentUninstallCommand({ uninstallString: '"C:\\PC\\b.exe" /uninstall /passive', kind: 'burn' }))
      .toBe('"C:\\PC\\b.exe" /uninstall /passive /norestart');
    expect(silentUninstallCommand({ uninstallString: '"C:\\PC\\b.exe" -uninstall -quiet -norestart', kind: 'burn' }))
      .toBe('"C:\\PC\\b.exe" -uninstall -quiet -norestart');
    expect(silentUninstallCommand({ uninstallString: '"C:\\x\\unins000.exe" /SILENT', kind: 'inno' }))
      .toBe('"C:\\x\\unins000.exe" /SILENT /VERYSILENT /SUPPRESSMSGBOXES /NORESTART');
  });
});
