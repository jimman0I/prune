import { readFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { parseUninstallerPath } from './uninstallerPath.js';

/** The Steam app id from a game's uninstall command, or null.
 *
 * Every Steam game registers the identical uninstall string -- steam.exe
 * with a protocol URL -- so the id is the only thing distinguishing one
 * game's registry entry from another's. It's also why the generic
 * "measure the uninstaller's folder" fallback gets these so wrong: that
 * folder is all of Steam. */
export function parseSteamAppId(uninstallString) {
  if (typeof uninstallString !== 'string') return null;
  const match = uninstallString.match(/steam:\/\/uninstall\/(\d+)/i);
  return match ? match[1] : null;
}

/** Pulls a quoted `"key" "value"` pair out of Valve's KeyValues text.
 * Deliberately not a full VDF parser -- these files are flat enough at
 * the depth we need that matching the key directly is both simpler and
 * harder to break on an unexpected nesting. */
function readKey(text, key) {
  const match = text.match(new RegExp(`"${key}"\\s*"([^"]*)"`, 'i'));
  return match ? match[1] : null;
}

/** One appmanifest_<id>.acf, reduced to what a size column needs.
 *
 * `SizeOnDisk` is Steam's own accounting of the installed game, which
 * beats walking the folder: it's instant, and it's the number Steam
 * itself shows. A game that's queued or still downloading reports 0,
 * which is not a size worth putting in place of a blank. */
export function parseAppManifest(text) {
  if (typeof text !== 'string' || !text.includes('"AppState"')) return null;
  const appid = readKey(text, 'appid');
  if (!appid) return null;

  const rawSize = Number(readKey(text, 'SizeOnDisk'));
  return {
    appid,
    name: readKey(text, 'name'),
    installdir: readKey(text, 'installdir'),
    sizeBytes: Number.isFinite(rawSize) && rawSize > 0 ? rawSize : null
  };
}

/** Every Steam library path from libraryfolders.vdf.
 *
 * Libraries are routinely spread across drives, and a game installed on
 * the second one has its manifest there rather than next to Steam. */
export function parseLibraryPaths(text) {
  if (typeof text !== 'string') return [];
  const paths = [];
  const pattern = /"path"\s*"([^"]+)"/gi;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    // The format escapes backslashes; the filesystem doesn't want them.
    paths.push(match[1].replace(/\\\\/g, '\\'));
  }
  return paths;
}

/** Every installed Steam app, as { appid: { sizeBytes, name, path } }.
 *
 * Located from Steam's own uninstall entry rather than a hardcoded
 * "C:\Program Files (x86)\Steam" -- people move it, and a wrong guess
 * here silently means no Steam sizes at all. */
export async function getSteamApps(steamRoot) {
  if (!steamRoot) return {};

  let libraries = [steamRoot];
  try {
    const vdf = await readFile(join(steamRoot, 'steamapps', 'libraryfolders.vdf'), 'utf8');
    const parsed = parseLibraryPaths(vdf);
    if (parsed.length > 0) libraries = parsed;
  } catch {
    // No library file: the default library is still worth reading.
  }

  const apps = {};
  for (const library of libraries) {
    const steamapps = join(library, 'steamapps');
    let entries;
    try {
      entries = await readdir(steamapps);
    } catch {
      continue; // a library on a drive that isn't currently attached
    }

    for (const entry of entries) {
      if (!/^appmanifest_\d+\.acf$/i.test(entry)) continue;
      try {
        const manifest = parseAppManifest(await readFile(join(steamapps, entry), 'utf8'));
        if (!manifest) continue;
        apps[manifest.appid] = {
          sizeBytes: manifest.sizeBytes,
          name: manifest.name,
          // Where the game actually lives, so Steam's own entry can
          // exclude it instead of counting every game as part of Steam.
          path: manifest.installdir ? join(steamapps, 'common', manifest.installdir) : null
        };
      } catch { /* one unreadable manifest shouldn't lose the rest */ }
    }
  }

  return apps;
}

/** Steam's install folder, taken from its own uninstall entry. */
export function steamRootFrom(programs) {
  const steam = programs.find((p) => /^steam$/i.test(p.name || ''));
  if (!steam) return null;
  if (steam.installLocation) return steam.installLocation.replace(/[\\/]+$/, '');
  const { executable } = parseUninstallerPath(steam.uninstallString);
  return executable ? dirname(executable) : null;
}
