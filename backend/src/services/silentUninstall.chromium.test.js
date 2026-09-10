import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { silentUninstallCommand, detectInstallerKind, resolveSilentCommand } from './silentUninstall.js';

/** Silent uninstall for Chromium-based browsers, which was left out of the
 * first pass on purpose: silently removing someone's browser is where a
 * wrong call costs most, and it was not going to ship from memory.
 *
 * VERIFIED rather than recalled, before any of this was written:
 *
 *   - The dev machine has exactly four Chromium-style uninstallers --
 *     Brave, Chrome, Edge and Edge WebView2 Runtime -- all run as
 *     <version>\Installer\setup.exe --uninstall, none publishing a quiet
 *     command of its own.
 *   - All four setup.exe binaries contain the force-uninstall switch.
 *   - Chromium's own uninstall.cc: --force-uninstall means "we are going
 *     to do silent uninstall. Try to close all running Chrome instances"
 *     and skips the dialog. Browsing data is deleted only on
 *     --delete-profile or the dialog's own checkbox -- so a silent
 *     uninstall keeps it, which is the only acceptable default.
 *
 * Two things follow from that source, and they are what most of these
 * tests are about:
 *
 *   1. Force-uninstalling a RUNNING browser kills it. The dialog it skips
 *      is the one that asks you to close it first. On the dev machine
 *      Brave was running while this was written. So the flag is added
 *      only when the browser is known NOT to be running, and "unknown" is
 *      treated as running.
 *   2. Edge and WebView2 are never silenced. WebView2 is a shared runtime:
 *      at the time of measuring, six WebView2 processes were running,
 *      hosted by SearchHost.exe -- Windows Search itself. Edge is the
 *      system browser. Both keep running exactly as registered, with
 *      Microsoft's own dialog.
 */

let root;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'prune-chromium-test-')); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

/** A fake browser install with a real-shaped setup.exe. `supportsForce`
 * decides whether the binary carries the switch, which is the evidence
 * the detector reads -- the same rule as the NSIS signature check. */
function browser({ name = 'Brave-Browser', supportsForce = true } = {}) {
  const installer = join(root, name, 'Application', '152.1.94.121', 'Installer');
  mkdirSync(installer, { recursive: true });
  const setup = join(installer, 'setup.exe');
  writeFileSync(setup, Buffer.concat([
    Buffer.from('MZ'), Buffer.alloc(128),
    Buffer.from(supportsForce ? 'force-uninstall' : 'something-else'), Buffer.alloc(64)
  ]));
  return setup;
}

describe('recognising a Chromium browser uninstaller', () => {
  it('recognises Brave and Chrome by their setup.exe and its switch', () => {
    const setup = browser();
    expect(detectInstallerKind(`"${setup}" --uninstall --system-level`)).toBe('chromium');
    expect(detectInstallerKind(`"${setup}" --uninstall --channel=stable --system-level --verbose-logging`))
      .toBe('chromium');
  });

  it('does not trust the shape alone -- the binary has to carry the switch', () => {
    // A setup.exe under an Installer folder is a convention, not proof.
    // Passing a switch the binary does not know is the failure the first
    // pass's comment warned about.
    const setup = browser({ supportsForce: false });
    expect(detectInstallerKind(`"${setup}" --uninstall --system-level`)).toBe('unknown');
  });

  it('never classifies Microsoft Edge as a browser to silence', () => {
    // Its binary DOES carry the switch -- which is why the exclusion has to
    // be explicit rather than falling out of the evidence check.
    const setup = browser({ name: 'Edge' });
    expect(detectInstallerKind(`"${setup}" --uninstall --msedge --channel=stable --system-level --verbose-logging`))
      .toBe('unknown');
  });

  it('never classifies the WebView2 runtime as a browser to silence', () => {
    const setup = browser({ name: 'EdgeWebView' });
    expect(detectInstallerKind(`"${setup}" --uninstall --msedgewebview --system-level --verbose-logging`))
      .toBe('unknown');
  });

  it('requires the --uninstall flag itself, not something that merely starts with it', () => {
    /* Two separate properties, pinned together because the first is what
     * mutation testing found unguarded.
     *
     * Without --uninstall at all, this is some other setup.exe invocation,
     * and appending --force-uninstall to it would turn an unknown command
     * into an uninstall. And --uninstall-app-id is a DIFFERENT flag -- the
     * one Brave's web apps use. Its only realistic home is brave.exe, where
     * the path check already rejects it, which is exactly why the
     * exact-flag match went untested: nothing reachable depended on it.
     * This pins the contract rather than relying on the path to cover it. */
    const setup = browser();
    expect(detectInstallerKind(`"${setup}" --system-level`)).toBe('unknown');
    expect(detectInstallerKind(`"${setup}" --uninstall-app-id=abc --system-level`)).toBe('unknown');
  });

  it('is not confused by a Brave web app, which delegates to brave.exe', () => {
    // --uninstall-app-id is not --uninstall. A web app's entry must not be
    // mistaken for the browser's own.
    browser();
    const braveExe = join(root, 'Brave-Browser', 'Application', 'brave.exe');
    writeFileSync(braveExe, Buffer.from('MZ force-uninstall'));
    expect(detectInstallerKind(`"${braveExe}" --profile-directory=Default --uninstall-app-id=abc`))
      .not.toBe('chromium');
  });
});

describe('the command it runs', () => {
  const raw = '"C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\152.1.94.121\\Installer\\setup.exe" --uninstall --system-level';

  it('adds --force-uninstall when the browser is known not to be running', () => {
    expect(silentUninstallCommand({ uninstallString: raw, kind: 'chromium', running: false }))
      .toBe(`${raw} --force-uninstall`);
  });

  it('leaves the browser\'s own dialog in place when it IS running', () => {
    /* --force-uninstall would close it, and every tab with it. The dialog
     * that runs instead is the one that asks the user to close it first,
     * which is the protection the flag would have removed. */
    expect(silentUninstallCommand({ uninstallString: raw, kind: 'chromium', running: true })).toBe(raw);
  });

  it('treats "not known whether it is running" as running', () => {
    /* The asymmetry is the point, as with NonRemovable. Wrong one way shows
     * a dialog that did not need showing; wrong the other kills a browser
     * mid-session. Only an explicit false earns the flag. */
    expect(silentUninstallCommand({ uninstallString: raw, kind: 'chromium' })).toBe(raw);
    expect(silentUninstallCommand({ uninstallString: raw, kind: 'chromium', running: null })).toBe(raw);
  });

  it('never deletes browsing data', () => {
    // Chromium deletes the profile only on --delete-profile or the dialog's
    // checkbox. A silent uninstall must never be the thing that adds it.
    const command = silentUninstallCommand({ uninstallString: raw, kind: 'chromium', running: false });
    expect(command).not.toMatch(/delete-profile/);
  });

  it('does not add the switch twice', () => {
    const already = `${raw} --force-uninstall`;
    expect(silentUninstallCommand({ uninstallString: already, kind: 'chromium', running: false })).toBe(already);
  });
});

describe('resolving from a program', () => {
  it('passes running through, so the file read and the running check agree', () => {
    const setup = browser();
    const uninstallString = `"${setup}" --uninstall --system-level`;

    expect(resolveSilentCommand({ uninstallString, running: false })).toBe(`${uninstallString} --force-uninstall`);
    expect(resolveSilentCommand({ uninstallString, running: true })).toBe(uninstallString);
    expect(resolveSilentCommand({ uninstallString })).toBe(uninstallString);
  });
});
