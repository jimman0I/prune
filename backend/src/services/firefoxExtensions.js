import { readdir, readFile, stat } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';

/** Firefox-family extensions.
 *
 * Gecko browsers store nothing like Chromium does. There is no folder per
 * extension holding a manifest; there is one JSON index per profile,
 * `extensions.json`, listing every add-on the browser knows about, and the
 * add-ons themselves are .xpi archives (or, occasionally, unpacked
 * folders) beside it.
 *
 * HONEST LIMIT, worth stating in the code rather than only in a commit:
 * no Gecko profile exists on the machine this was written on -- no
 * Firefox, LibreWolf, Waterfox, Zen or SeaMonkey -- so unlike the
 * Chromium reader beside it, this has never been run against a real
 * profile. The profile LOCATIONS are verified (they match the paths
 * BleachBit ships for Firefox). The shape of extensions.json is from its
 * documented format.
 *
 * Everything here is therefore written to fail closed. Each add-on must
 * carry the fields we actually use, and anything that does not match is
 * dropped rather than guessed at, so a format that differs from what is
 * expected yields an empty list -- never a list of wrong rows. */
const GECKO_BROWSERS = [
  { id: 'firefox', name: 'Firefox', from: 'APPDATA', path: 'Mozilla\\Firefox' },
  { id: 'librewolf', name: 'LibreWolf', from: 'APPDATA', path: 'LibreWolf' },
  { id: 'waterfox', name: 'Waterfox', from: 'APPDATA', path: 'Waterfox' },
  { id: 'zen', name: 'Zen', from: 'APPDATA', path: 'zen' },
  { id: 'seamonkey', name: 'SeaMonkey', from: 'APPDATA', path: 'Mozilla\\SeaMonkey' }
];

/** Add-ons that are part of the browser rather than something installed.
 *
 * Gecko records where an add-on came from. Only "app-profile" is a user
 * install; the rest are shipped with the browser or dropped in by the
 * system, and listing them would bury the handful someone actually chose
 * under dozens they did not. The Chromium reader draws the same line with
 * its built-in id list. */
const USER_INSTALLED_LOCATION = 'app-profile';

/** Profile directories named in a profiles.ini.
 *
 * The file is INI-shaped: `[Profile0]` sections each carrying `Path=` and
 * `IsRelative=`. A relative path is relative to the browser's data folder;
 * an absolute one is used as given, which is how a profile moved to
 * another drive still resolves. */
export function parseProfilesIni(text, baseDir) {
  if (typeof text !== 'string' || !text.trim()) return [];

  const profiles = [];
  let path = null;
  let relative = true;

  const flush = () => {
    if (path) profiles.push(relative && !isAbsolute(path) ? join(baseDir, path) : path);
    path = null;
    relative = true;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith('[')) {
      flush();
      continue;
    }
    const match = line.match(/^([A-Za-z]+)\s*=\s*(.*)$/);
    if (!match) continue;
    const key = match[1].toLowerCase();
    // Gecko writes forward slashes here even on Windows.
    if (key === 'path') path = match[2].trim().replace(/\//g, '\\');
    if (key === 'isrelative') relative = match[2].trim() !== '0';
  }
  flush();

  return profiles;
}

/** One add-on from extensions.json, or null.
 *
 * Requires an id, a user-install location, and a name -- the three things
 * a row cannot be built without. Anything missing them is dropped rather
 * than filled in, which is what makes an unexpected format produce nothing
 * instead of nonsense. */
export function normalizeFirefoxAddon(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.location !== USER_INSTALLED_LOCATION) return null;
  // Themes, dictionaries and language packs are not extensions.
  if (raw.type && raw.type !== 'extension') return null;

  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  if (!id) return null;

  const name = typeof raw.defaultLocale?.name === 'string' ? raw.defaultLocale.name.trim() : '';
  if (!name) return null;

  const description = typeof raw.defaultLocale?.description === 'string'
    ? raw.defaultLocale.description.trim()
    : null;

  return {
    addonId: id,
    name,
    version: typeof raw.version === 'string' ? raw.version : '',
    description: description || null,
    // Absent on some entries; the caller falls back to the profile's
    // extensions folder.
    path: typeof raw.path === 'string' && raw.path ? raw.path : null,
    // A disabled add-on is still installed and still on disk, which is
    // what this list is about, but the row should be able to say so.
    enabled: raw.active !== false && raw.userDisabled !== true
  };
}

async function sizeOf(path) {
  try {
    const info = await stat(path);
    if (info.isFile()) return info.size;
    if (!info.isDirectory()) return 0;
  } catch {
    return 0;
  }

  let total = 0;
  const stack = [path];
  while (stack.length > 0) {
    const dir = stack.pop();
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) {
        try {
          total += (await stat(full)).size;
        } catch { /* vanished mid-walk */ }
      }
    }
  }
  return total;
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
}

async function directories(path) {
  try {
    const entries = await readdir(path, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [];
  }
}

/** Profiles for one browser: from profiles.ini where there is one, else
 * whatever sits under Profiles\. The second path matters because a
 * profile folder can outlive the ini, and because some forks ship without
 * one. */
async function profilesFor(baseDir) {
  const ini = await readFile(join(baseDir, 'profiles.ini'), 'utf8').catch(() => null);
  const listed = ini ? parseProfilesIni(ini, baseDir) : [];
  if (listed.length > 0) return listed;

  const under = await directories(join(baseDir, 'Profiles'));
  return under.map((name) => join(baseDir, 'Profiles', name));
}

/** Every user-installed extension in every Gecko browser found.
 *
 * Returns [] when none are installed, which on most machines -- including
 * the one this was written on -- is the answer. */
export async function getFirefoxExtensions() {
  const found = [];

  for (const browser of GECKO_BROWSERS) {
    const base = process.env[browser.from];
    if (!base) continue;
    const baseDir = join(base, browser.path);

    for (const profileDir of await profilesFor(baseDir)) {
      const index = await readJson(join(profileDir, 'extensions.json'));
      const addons = Array.isArray(index?.addons) ? index.addons : [];

      for (const raw of addons) {
        const addon = normalizeFirefoxAddon(raw);
        if (!addon) continue;

        // `path` is usually absolute and points at the .xpi. Where it is
        // missing, the convention is <profile>\extensions\<id>.xpi.
        const location = addon.path || join(profileDir, 'extensions', `${addon.addonId}.xpi`);

        found.push({
          id: `extension:${browser.id}:${profileDir}:${addon.addonId}`,
          name: addon.name,
          version: addon.version,
          description: addon.description,
          browser: browser.name,
          profile: profileDir,
          extensionId: addon.addonId,
          enabled: addon.enabled,
          sizeBytes: await sizeOf(location),
          installLocation: location,
          source: 'extension'
        });
      }
    }
  }

  return found;
}
