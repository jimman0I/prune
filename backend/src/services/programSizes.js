import { listInstalledPrograms } from './programs.js';
import { measureFolder, sizeSourceFor } from './installSize.js';
import { getSteamApps, parseSteamAppId, steamRootFrom } from './steamApps.js';
import { getEpicApps } from './epicApps.js';
import { getGogApps } from './gogApps.js';
import { matchLauncherApp } from './launcherMatch.js';
import { memoizeAsync } from '../lib/memoizeAsync.js';
import { defaultFolderSizeStore } from './folderSizeStore.js';

/** Measured folder sizes, keyed by folder, held as the promise so that two
 * callers who want the same folder share one walk instead of each doing it.
 * Survives for the process's life: walking 124 GB of install folders takes
 * about thirteen seconds and the answer doesn't change while the app is
 * open. */
const cache = new Map();

/** The same answers kept on disk between launches (see folderSizeStore.js),
 * created on first use so the environment is read when it is needed. */
let store = null;
const sizeStore = () => (store ??= defaultFolderSizeStore());

/** Folders whose kept size was a day or more old when it was used, waiting for
 * refreshStaleSizes. */
const staleFolders = new Map();

/** The whole lookup for the real program list, shared by whoever asks while
 * it is running: the window's own request and any other caller get one walk. */
const sharedLookup = memoizeAsync(() => resolveProgramSizes(null));

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
  // An explicit list is a caller asking about specific programs, so it
  // always runs on its own. The real list is shared while it is running.
  return programs ? resolveProgramSizes(programs) : sharedLookup();
}

async function resolveProgramSizes(programs) {
  const list = programs ?? await listInstalledPrograms();
  const kept = sizeStore();
  await kept.load();

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

  // Epic and GOG both keep their own record of what they installed and
  // where. Each returns [] when that launcher isn't present, which is the
  // common case and not an error.
  //
  // They differ in what they can offer. Epic records an InstallSize, so
  // its games are sized without touching the disk. GOG records only the
  // folder -- but a GOG game gets its own directory, so measuring it is
  // safe in a way it never is for Steam or Ubisoft, where the path the
  // registry points at is the launcher's and holds every game.
  const [epicApps, gogApps] = await Promise.all([
    getEpicApps().catch(() => []),
    getGogApps().catch(() => [])
  ]);
  const launcherApps = [...epicApps, ...gogApps];

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
  for (const app of launcherApps) {
    if (app.installLocation) allFolders.push(app.installLocation);
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

    // Epic gives a size outright. GOG gives a folder, which is measured
    // below like any other -- but a launcher-supplied folder is the
    // game's own, so it bypasses the shared-folder refusal that exists
    // for uninstaller paths.
    const launcherApp = matchLauncherApp(program, launcherApps);
    if (launcherApp?.sizeBytes) {
      sizes[program.id] = launcherApp.sizeBytes;
      continue;
    }

    const folder = launcherApp?.installLocation || sizeSourceFor(program);
    if (!folder) continue;
    // The shared-folder refusal only applies to a folder guessed from the
    // uninstaller. A launcher naming the game's own directory is a real
    // record, not a guess.
    if (!launcherApp && !program.installLocation && (fallbackUsers.get(folder) || 0) > 1) continue;

    if (!cache.has(folder)) {
      const nested = allFolders.filter((other) => other !== folder && isStrictlyInside(other, folder));
      // Which folders are left out is part of what was measured.
      const exclusions = nested.map(exclusionKey).sort().join('|');
      const remembered = kept.lookup(folder, exclusions);
      if (remembered) {
        cache.set(folder, Promise.resolve(remembered.bytes));
        // Shown now, measured again later (refreshStaleSizes), not on the spot.
        if (!remembered.fresh) staleFolders.set(folder, { nested, exclusions });
      } else {
        cache.set(folder, measureFolder(folder, nested).then((bytes) => { kept.set(folder, exclusions, bytes); return bytes; }));
      }
    }

    const measured = await cache.get(folder);
    // Zero means the folder is gone or empty, which is not a size worth
    // showing in place of a blank -- it reads as "this program is free",
    // and it usually means the entry is stale.
    if (measured > 0) sizes[program.id] = measured;
  }

  await kept.save();
  return sizes;
}

/** Measures again the folders that were shown from an out-of-date kept size,
 * one at a time, and keeps the new figures for the next launch (and for any
 * later request in this session). Run as start-up housekeeping, once the
 * window has opened, so the walk that used to sit on the first seconds happens
 * after them. Returns how many folders were refreshed. */
export async function refreshStaleSizes() {
  const kept = sizeStore();
  await kept.load();
  let refreshed = 0;
  for (const [folder, { nested, exclusions }] of [...staleFolders]) {
    staleFolders.delete(folder);
    const bytes = await measureFolder(folder, nested);
    kept.set(folder, exclusions, bytes);
    cache.set(folder, Promise.resolve(bytes));
    refreshed++;
  }
  await kept.save();
  return refreshed;
}

/** A folder as it is written into the "what was left out" part of a kept size. */
function exclusionKey(folder) {
  return folder.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase();
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
  staleFolders.clear();
  store = null;
  sharedLookup.clear();
}
