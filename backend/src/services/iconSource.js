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

/** Where to get one program's icon from, or null if there's nowhere.
 *
 * DisplayIcon first, since that's the icon the vendor actually chose. 36
 * of the 129 programs here don't set one, and for those the uninstaller
 * executable is usually still the app's own binary with its own icon --
 * a roughly-right icon beats a coloured letter.
 *
 * The fallback deliberately refuses msiexec and PATH-resolved commands.
 * Extracting from msiexec.exe would succeed and give every MSI-installed
 * program on the machine the same generic Windows Installer icon, which
 * looks like a bug rather than a fallback. */
export function iconSourceForProgram(program) {
  const fromDisplayIcon = parseIconSource(program.displayIcon);
  if (fromDisplayIcon) return fromDisplayIcon;

  const { executable, isMsi } = parseUninstallerPath(program.uninstallString);
  if (!executable || isMsi) return null;
  // Same reasoning as programHealth.js: a bare command name is resolved
  // through PATH and isn't a file we can open.
  const isAbsolute = /^[a-z]:[\\/]/i.test(executable) || executable.startsWith('\\\\');
  if (!isAbsolute) return null;

  return { path: executable, index: 0 };
}
