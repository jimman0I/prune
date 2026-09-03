import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

/** Where the Chromium-family browsers keep their profiles.
 *
 * Revo Uninstaller gives browser extensions a module of their own, and
 * they are a real blind spot: an extension can be as large as a small
 * application -- one here is 19 MB -- and nothing in Windows' own
 * uninstall list mentions any of them.
 *
 * All of these store extensions identically, because they are all
 * Chromium: <User Data>\<Profile>\Extensions\<id>\<version>\manifest.json.
 * Firefox is deliberately absent -- it uses a completely different layout
 * (extensions.json in the profile) and is not installed here to test
 * against, and a guess at a format nobody has verified is worth less than
 * an honest gap. */
const BROWSERS = [
  { id: 'brave', name: 'Brave', from: 'LOCALAPPDATA', path: 'BraveSoftware\\Brave-Browser\\User Data' },
  { id: 'chrome', name: 'Chrome', from: 'LOCALAPPDATA', path: 'Google\\Chrome\\User Data' },
  { id: 'edge', name: 'Edge', from: 'LOCALAPPDATA', path: 'Microsoft\\Edge\\User Data' },
  { id: 'vivaldi', name: 'Vivaldi', from: 'LOCALAPPDATA', path: 'Vivaldi\\User Data' },
  { id: 'opera', name: 'Opera', from: 'APPDATA', path: 'Opera Software\\Opera Stable' }
];

/** Extensions the browser ships itself. They cannot be removed and nobody
 * chose to install them, so listing them is noise. */
const BUILT_IN = new Set([
  'nmmhkkegccagdldgiimedpiccmgmieda', // Chrome Web Store payments
  'pkedcjkdefgpdelpbcmbmeomcjbeemfm'  // Chrome media router
]);

/** Resolves a manifest name that points at a localised string.
 *
 * Chromium extensions may declare `"name": "__MSG_extName__"` and put the
 * real text in _locales/<default_locale>/messages.json. Six of the 26
 * extensions on this machine do exactly that, and showing
 * "__MSG_extName__" in a list of installed software would be useless. */
export function resolveExtensionName(rawName, messages) {
  const name = typeof rawName === 'string' ? rawName.trim() : '';
  const match = name.match(/^__MSG_(.+)__$/);
  if (!match) return name || null;

  const key = match[1];
  // Message keys are case-insensitive in Chromium.
  const found = messages && (messages[key] ?? messages[key.toLowerCase()]);
  const resolved = typeof found?.message === 'string' ? found.message.trim() : '';
  return resolved || null;
}

/** The newest version folder of an extension.
 *
 * An extension keeps its old versions alongside the current one after an
 * update, and the manifest that matters is the newest. Compared
 * numerically per segment rather than as strings, or "1.0.10" sorts below
 * "1.0.9". */
export function newestVersionDir(names) {
  const list = (names || []).filter((name) => typeof name === 'string' && name);
  if (list.length === 0) return null;

  return list.slice().sort((a, b) => compareVersions(b, a))[0];
}

function compareVersions(a, b) {
  const left = a.split(/[._]/);
  const right = b.split(/[._]/);
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    const x = Number.parseInt(left[i] ?? '0', 10) || 0;
    const y = Number.parseInt(right[i] ?? '0', 10) || 0;
    if (x !== y) return x - y;
  }
  return 0;
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

/** Bytes under a folder. Its own walk rather than installSize's, which
 * takes an exclusion list this has no use for and is built around program
 * install folders. */
async function folderSize(path) {
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
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        try {
          total += (await stat(full)).size;
        } catch { /* a file that vanished mid-walk is not an error */ }
      }
    }
  }
  return total;
}

/** One extension folder, or null when it holds nothing readable. */
async function readExtension(browser, profile, extensionId, extensionsDir) {
  const versionDir = newestVersionDir(await directories(join(extensionsDir, extensionId)));
  if (!versionDir) return null;

  const root = join(extensionsDir, extensionId, versionDir);
  const manifest = await readJson(join(root, 'manifest.json'));
  if (!manifest) return null;

  let name = manifest.name;
  if (typeof name === 'string' && name.startsWith('__MSG_')) {
    const locale = manifest.default_locale || 'en';
    const messages = await readJson(join(root, '_locales', locale, 'messages.json'));
    name = resolveExtensionName(manifest.name, messages);
  } else {
    name = resolveExtensionName(name, null);
  }
  if (!name) return null;

  return {
    id: `extension:${browser.id}:${profile}:${extensionId}`,
    name,
    version: typeof manifest.version === 'string' ? manifest.version : '',
    description: typeof manifest.description === 'string' && !manifest.description.startsWith('__MSG_')
      ? manifest.description
      : null,
    browser: browser.name,
    profile,
    extensionId,
    // Every version folder, not just the newest: the old ones are still
    // on disk and still taking up room, which is the number that matters
    // when the question is what to remove.
    sizeBytes: await folderSize(join(extensionsDir, extensionId)),
    installLocation: join(extensionsDir, extensionId),
    source: 'extension'
  };
}

/** Every extension installed in every Chromium-family browser found.
 *
 * Returns [] when none are installed, which is not an error. Reading this
 * is pure filesystem work -- no PowerShell -- so it is quick and immune to
 * the console-encoding problems that come with shelling out. */
export async function getBrowserExtensions() {
  const found = [];

  for (const browser of BROWSERS) {
    const base = process.env[browser.from];
    if (!base) continue;
    const userData = join(base, browser.path);

    // "Default" plus any "Profile 1", "Profile 2"; everything else under
    // User Data is browser state rather than a profile.
    const profiles = (await directories(userData))
      .filter((name) => name === 'Default' || /^Profile \d+$/.test(name));

    for (const profile of profiles) {
      const extensionsDir = join(userData, profile, 'Extensions');
      for (const extensionId of await directories(extensionsDir)) {
        if (BUILT_IN.has(extensionId)) continue;
        try {
          const extension = await readExtension(browser, profile, extensionId, extensionsDir);
          if (extension) found.push(extension);
        } catch { /* one unreadable extension shouldn't lose the rest */ }
      }
    }
  }

  return found.sort((a, b) => b.sizeBytes - a.sizeBytes);
}
