import { listInstalledPrograms } from './programs.js';
import { measureFolder, sizeSourceFor } from './installSize.js';
import { getSteamApps, parseSteamAppId, steamRootFrom } from './steamApps.js';

/** Measured folder sizes, keyed by folder. Survives for the process's
 * life: walking 124 GB of install folders takes about thirteen seconds
 * and the answer doesn't change while the app is open. */
const cache = new Map();

/** Real sizes for the programs whose registry entry has no
 * EstimatedSize, as { programId: bytes }.
 *
 * 40 of the 130 entries on this machine report no size at all --
 * EstimatedSize is optional and plenty of installers never write it.
 *
 * Three sources, in order of how much they can be trusted:
 *
 *   1. Steam's own app manifest, for anything installed through Steam.
 *      Instant, exact, and the number Steam itself shows.
 *   2. The program's InstallLocation, measured on disk.
 *   3. The folder the uninstaller lives in -- but only when no other
 *      program points at the same one.
 *
 * Its own endpoint, like the icons, and for the same reason: this walks
 * the filesystem and the program list must not wait on it. Anything that
 * can't be sized safely is simply absent and the row keeps its blank. */
export async function getProgramSizes(programs) {
  const list = programs ?? await listInstalledPrograms();

  // Steam games all register the identical uninstall command, so their
  // real sizes have to come from Steam rather than from any folder the
  // registry points at.
  let steamApps = {};
  try {
    steamApps = await getSteamApps(steamRootFrom(list));
  } catch {
    // No Steam, or an unreadable library -- the folder paths below still
    // apply to everything else.
  }

  // How many programs would fall back to each folder. A folder several
  // entries share is a launcher's directory, not any one program's
  // install, and measuring it hands every one of them the same wrong
  // number.
  const fallbackUsers = new Map();
  for (const program of list) {
    if (program.installLocation) continue;
    // A Steam app is sized from its manifest and never touches the
    // folder route, so it must not count toward the folder's share.
    // Without this, Steam's own entry sees its directory "shared" with
    // every game installed through it and refuses to measure itself.
    if (parseSteamAppId(program.uninstallString)) continue;
    const folder = sizeSourceFor(program);
    if (folder) fallbackUsers.set(folder, (fallbackUsers.get(folder) || 0) + 1);
  }

  // Every folder that belongs to something, so a measure can exclude the
  // ones that aren't its own. Steam game folders are included: without
  // them, Steam's own entry counts every installed game as part of Steam.
  const allFolders = [];
  for (const program of list) {
    const folder = sizeSourceFor(program);
    if (folder) allFolders.push(folder);
  }
  for (const app of Object.values(steamApps)) {
    if (app.path) allFolders.push(app.path);
  }

  const sizes = {};
  for (const program of list) {
    if (typeof program.sizeBytes === 'number') continue;

    const appId = parseSteamAppId(program.uninstallString);
    if (appId) {
      // Steam knows exactly, and the folder route would be wrong anyway.
      const app = steamApps[appId];
      if (app?.sizeBytes) sizes[program.id] = app.sizeBytes;
      continue;
    }

    const folder = sizeSourceFor(program);
    if (!folder) continue;
    if (!program.installLocation && (fallbackUsers.get(folder) || 0) > 1) continue;

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
