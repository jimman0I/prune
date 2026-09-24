import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runUninstaller } from './uninstall.js';

/** runUninstaller against a REAL cmd.exe, with nothing mocked.
 *
 * uninstall.test.js mocks child_process.spawn, so it can only ever check
 * that spawn was called -- never that the command line it built actually
 * launches anything. That gap hid a real bug: an UninstallString that is a
 * quoted path containing a space (`"C:\Program Files\X\uninstall.exe" /S`,
 * `"C:\Riot Games\Riot Client\RiotClientServices.exe" --uninstall-...`) was
 * escaped as `\"` by Node, which cmd.exe does not understand, so cmd said
 * "not recognized" and exited 1 without ever starting the uninstaller. No
 * window, no process, and the caller ignores the exit code by design.
 *
 * The uninstaller here is a .cmd in a folder whose name contains a space,
 * and it proves it ran by writing a file next to itself. */

const onWindows = process.platform === 'win32';

describe.skipIf(!onWindows)('runUninstaller with a real cmd.exe', () => {
  let dir;
  let script;
  let marker;

  beforeAll(() => {
    dir = join(mkdtempSync(join(tmpdir(), 'prune-spawn-')), 'has a space');
    mkdirSync(dir);
    script = join(dir, 'fake uninstaller.cmd');
    marker = join(dir, 'ran.txt');
    // %* is everything after the script name, so the flags are proven to
    // arrive too, not just the executable.
    writeFileSync(script, '@echo off\r\necho %* > "%~dp0ran.txt"\r\nexit /b 0\r\n');
  });

  afterAll(() => {
    rmSync(join(dir, '..'), { recursive: true, force: true });
  });

  it('starts an uninstaller whose quoted path contains a space, and passes its flags', async () => {
    const events = [];
    const result = await runUninstaller(
      { uninstallString: `"${script}" --uninstall-product=valorant --uninstall-patchline=live` },
      (type, data) => events.push([type, data])
    );

    expect(events.find(([type]) => type === 'exited')[1].stderr).toBeNull();
    expect(result).toEqual({ code: 0 });
    expect(existsSync(marker)).toBe(true);
    expect(readFileSync(marker, 'utf8')).toContain('--uninstall-product=valorant --uninstall-patchline=live');
  }, 30000);

  it('passes a quoted argument that itself contains a space and an ampersand', async () => {
    const result = await runUninstaller(
      { uninstallString: `"${script}" "C:\\Some Folder\\a & b.txt"` },
      () => {}
    );

    expect(result).toEqual({ code: 0 });
    expect(readFileSync(marker, 'utf8')).toContain('"C:\\Some Folder\\a & b.txt"');
  }, 30000);

  it('reports the real path in its error, not a backslash-mangled one, when the uninstaller is missing', async () => {
    const missing = join(dir, 'missing uninstaller.exe');
    const events = [];
    const result = await runUninstaller(
      { uninstallString: `"${missing}" /S` },
      (type, data) => events.push([type, data])
    );

    expect(result.code).not.toBe(0);
    // The broken quoting named `\"C:\...\"` -- backslash-escaped quotes --
    // for every command, present or not, so a missing uninstaller and a
    // working one were indistinguishable. Now the message carries the
    // path exactly as it is on disk.
    const stderr = events.find(([type]) => type === 'exited')[1].stderr;
    expect(stderr).toContain(missing);
    expect(stderr).not.toContain('\\"');
  }, 30000);
});
