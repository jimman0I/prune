import { readdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { parseUninstallerPath } from './uninstallerPath.js';

/** Folders that are never one program's install directory. Measuring any
 * of them would report the size of Windows, or of every program on the
 * machine, against a single row. */
const SHARED_FOLDERS = [
  /^[a-z]:\\windows(\\|$)/i,
  /^[a-z]:\\program files( \(x86\))?\\common files(\\|$)/i,
  /^[a-z]:\\programdata(\\|$)/i
];

/** Normalizes a path for containment comparison: lowercase, one
 * separator style, no trailing separator.
 *
 * Collapsing forward slashes to backslashes is load-bearing, not
 * tidiness. The registry mixes them freely between entries -- on this
 * machine Ubisoft Connect records its location with backslashes while
 * Rainbow Six Siege, installed inside it, records
 * "C:/Program Files (x86)/Ubisoft/Ubisoft Game Launcher/games/..." with
 * forward ones. Compared raw, the nested folder doesn't look nested, and
 * the game's 54.69 GB is counted against both rows. */
function normalize(path) {
  return path.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase();
}

/** Whether `child` is inside `parent`.
 *
 * The separator check is the whole point: a plain startsWith would make
 * "C:\App" swallow "C:\AppData", which is the classic way this goes
 * wrong. */
function isInside(child, parent) {
  const c = normalize(child);
  const p = normalize(parent);
  return c === p || c.startsWith(p + '\\');
}

/** Total bytes of every file under `folder`, skipping any directory
 * listed in `exclude`.
 *
 * `exclude` exists because install folders nest. Measured on this
 * machine: Ubisoft Connect's folder came to 55.14 GB and Rainbow Six
 * Siege's to 54.69 GB, because the game is installed INSIDE the
 * launcher's directory. Reported as-is the same bytes are claimed by two
 * rows, and the column adds up to more than the drive holds. Excluding
 * other programs' folders gives each row the bytes that are actually its
 * own.
 *
 * Unreadable directories contribute nothing rather than failing the
 * measure -- same partial-over-total-failure convention the disk scanner
 * and leftover scan already use. */
export async function measureFolder(folder, exclude = []) {
  const excluded = exclude.map(normalize);
  let total = 0;
  const queue = [folder];

  while (queue.length > 0) {
    const current = queue.pop();
    if (excluded.some((e) => isInside(current, e))) continue;

    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue; // missing, or refused -- neither is worth failing over
    }

    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(full);
      } else if (entry.isFile()) {
        try {
          total += (await stat(full)).size;
        } catch { /* gone between readdir and stat */ }
      }
    }
  }

  return total;
}

/** Which folder to measure for a program, or null if there isn't a safe
 * one.
 *
 * InstallLocation first. Failing that, the folder the uninstaller lives
 * in: 16 of the 40 sizeless programs on this machine register no
 * InstallLocation, but their uninstaller sits right inside what they
 * installed (Equalizer APO's is C:\Program Files\EqualizerAPO\
 * Uninstall.exe).
 *
 * The guards matter more than the fallback. msiexec's folder is
 * system32; a shared folder like C:\Windows would report the size of
 * Windows against one program; and anything at a drive root or one level
 * down is a container, not an install. Each of those would produce a
 * confidently wrong number, which is worse than the blank it replaces. */
export function sizeSourceFor(program) {
  const location = typeof program.installLocation === 'string' ? program.installLocation.trim() : '';
  if (location) return isSafeFolder(location) ? location.replace(/[\\/]+$/, '') : null;

  const { executable, isMsi } = parseUninstallerPath(program.uninstallString);
  if (!executable || isMsi) return null;
  if (!/^[a-z]:[\\/]/i.test(executable)) return null;

  const folder = dirname(executable);
  return isSafeFolder(folder) ? folder : null;
}

function isSafeFolder(folder) {
  const clean = folder.replace(/[\\/]+$/, '');
  if (SHARED_FOLDERS.some((pattern) => pattern.test(clean))) return false;
  // "C:" or "C:\Program Files" -- a container, never one program's own
  // directory. Depth is counted in separators after the drive letter.
  const depth = clean.split(/[\\/]/).filter(Boolean).length;
  return depth >= 3;
}
