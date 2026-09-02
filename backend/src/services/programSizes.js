import { listInstalledPrograms } from './programs.js';
import { measureFolder, sizeSourceFor } from './installSize.js';

/** Measured folder sizes, keyed by folder. Survives for the process's
 * life: walking 124 GB of install folders takes about thirteen seconds
 * and the answer doesn't change while the app is open. */
const cache = new Map();

/** Real folder sizes for the programs whose registry entry has no
 * EstimatedSize, as { programId: bytes }.
 *
 * 40 of the 130 entries on this machine report no size at all --
 * EstimatedSize is optional and plenty of installers never write it --
 * so those rows showed a blank where the interesting number belongs.
 *
 * Its own endpoint, like the icons, and for the same reason: this is
 * ~13 seconds of walking the filesystem, and the program list must not
 * wait on it. Anything that can't be measured safely is simply absent
 * from the map and the row keeps its honest blank.
 *
 * Every other program's install folder is excluded from each measure, so
 * nested installs don't have their bytes counted twice -- see
 * measureFolder. */
export async function getProgramSizes(programs) {
  const list = programs ?? await listInstalledPrograms();

  // Every known install folder, so a measure can exclude the ones that
  // belong to someone else. Built from ALL programs, not just the
  // sizeless ones: the folder nested inside usually reports its own size
  // perfectly well, which is exactly why the outer one must not re-count
  // it.
  const allFolders = [];
  for (const program of list) {
    const folder = sizeSourceFor(program);
    if (folder) allFolders.push(folder);
  }

  const sizes = {};
  for (const program of list) {
    if (typeof program.sizeBytes === 'number') continue;

    const folder = sizeSourceFor(program);
    if (!folder) continue;

    if (!cache.has(folder)) {
      const nested = allFolders.filter((other) => other !== folder && isStrictlyInside(other, folder));
      cache.set(folder, await measureFolder(folder, nested));
    }

    const measured = cache.get(folder);
    // Zero means the folder is gone or empty, which is not a size worth
    // showing in place of a blank -- it reads as "this program is free",
    // and it usually means the entry is stale.
    if (measured > 0) sizes[program.id] = measured;
  }

  return sizes;
}

/** Separators are collapsed to one style first: the registry mixes
 * forward and back slashes between entries, and a nested folder recorded
 * in the other style would not look nested. See installSize.js for the
 * real pair this came from. */
function isStrictlyInside(child, parent) {
  const c = child.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase();
  const p = parent.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase();
  return c !== p && c.startsWith(p + '\\');
}

/** Testing seam -- the cache is process-wide. */
export function clearSizeCache() {
  cache.clear();
}
