import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

/** Where the Epic Games Launcher records what it has installed. One
 * .item file per game, JSON. */
function manifestDir() {
  const programData = process.env.ProgramData || 'C:\\ProgramData';
  return join(programData, 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests');
}

/** One Epic .item manifest, reduced to what a size column needs.
 *
 * `InstallSize` is Epic's own figure for the game, which is both instant
 * and the number the launcher itself shows.
 *
 * Epic writes InstallLocation with FORWARD slashes. Left alone, that path
 * would never match the backslashed one Windows records for the same
 * folder -- the same mismatch that already made the nested-folder
 * exclusion silently do nothing once in this project, so it is normalized
 * here at the boundary rather than at every comparison. */
export function parseEpicManifest(text) {
  if (typeof text !== 'string' || !text.trim()) return null;

  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return null; // a half-written manifest during an install
  }

  // An interrupted install reports the size it was aiming for, not what
  // is on disk.
  if (raw?.bIsIncompleteInstall) return null;
  if (!raw?.InstallLocation) return null;

  const size = Number(raw.InstallSize);
  return {
    appName: raw.AppName || null,
    displayName: raw.DisplayName || raw.AppName || null,
    installLocation: String(raw.InstallLocation).replace(/\//g, '\\').replace(/\\+$/, ''),
    sizeBytes: Number.isFinite(size) && size > 0 ? size : null
  };
}

/** Every game the Epic launcher has installed.
 *
 * Returns [] when Epic isn't installed, which is the common case and not
 * an error. Epic Store titles usually create no Windows uninstall entry
 * at all, so on many machines this finds games the program list never
 * shows -- the caller decides what to do with that. */
export async function getEpicApps() {
  const dir = manifestDir();

  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    return []; // Epic not installed
  }

  const apps = [];
  for (const entry of entries) {
    if (!entry.toLowerCase().endsWith('.item')) continue;
    try {
      const app = parseEpicManifest(await readFile(join(dir, entry), 'utf8'));
      if (app) apps.push(app);
    } catch { /* one unreadable manifest shouldn't lose the rest */ }
  }
  return apps;
}
