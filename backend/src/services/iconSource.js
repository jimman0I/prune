import { parseUninstallerPath } from './uninstallerPath.js';

/** Splits a registry DisplayIcon value into the file to pull an icon from
 * and which icon in it.
 *
 * Real shapes seen on this machine's 93 DisplayIcon values:
 *   C:\Program Files\7-Zip\7zFM.exe            bare executable
 *   C:\Program Files\PawnIO\uninstall.exe,0    with an icon index
 *   C:\Program Files\Git\...\git.ico           a real .ico file
 *   "C:\Program Files\...\MuMuNxMain.ico"      quoted
 *   C:\PROGRA~1\DIFX\...\DPInst_x64.exe,0      8.3 short path
 *
 * The index is only ever a comma followed by digits at the very END. A
 * comma is perfectly legal inside a Windows path ("C:\Program Files\Foo,
 * Inc\app.exe"), so splitting on the first one would silently truncate
 * the path and extract nothing. */
export function parseIconSource(displayIcon) {
  if (typeof displayIcon !== 'string') return null;
  let value = displayIcon.trim();
  if (!value) return null;

  let index = 0;
  const indexMatch = value.match(/,\s*(-?\d+)\s*$/);
  if (indexMatch) {
    index = Number(indexMatch[1]);
    value = value.slice(0, indexMatch.index);
  }

  const path = value.trim().replace(/^"|"$/g, '').trim();
  if (!path) return null;
  return { path, index };
}

/** The icon the vendor explicitly registered, or null. Always the first
 * choice -- it's the one they chose. */
export function iconSourceForProgram(program) {
  return parseIconSource(program.displayIcon);
}

/** The program's uninstaller as an icon source. LAST resort, after both
 * DisplayIcon and the real binary in InstallLocation.
 *
 * Found by looking at the list (2026-09-02): this used to rank above the
 * InstallLocation search, and it cost Discord its icon. Discord's
 * uninstaller is Squirrel's Update.exe -- an absolute path to a real
 * non-MSI executable, so it satisfied this fallback and stopped the
 * search -- but Update.exe carries no icon at all, while Discord.exe sits
 * one folder away in `app-1.0.9255`. An uninstaller is a plausible source
 * and a poor one; the application's own binary should always win.
 *
 * Refuses msiexec and PATH-resolved commands. Extracting from msiexec.exe
 * SUCCEEDS and hands every MSI-installed program the same generic Windows
 * Installer glyph, which reads as a bug rather than a fallback. */
export function iconSourceFromUninstaller(program) {
  const { executable, isMsi } = parseUninstallerPath(program.uninstallString);
  if (!executable || isMsi) return null;
  // Same reasoning as programHealth.js: a bare command name is resolved
  // through PATH and isn't a file we can open.
  const isAbsolute = /^[a-z]:[\\/]/i.test(executable) || executable.startsWith('\\\\');
  if (!isAbsolute) return null;

  return { path: executable, index: 0 };
}
