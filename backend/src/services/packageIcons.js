import { readFile, readdir } from 'node:fs/promises';
import { dirname, basename, extname, join } from 'node:path';
import { getStoreApps } from './storeApps.js';
import { getBrowserExtensions } from './browserExtensions.js';

/** Icons for the rows that do not come from the registry.
 *
 * The Store apps and browser extensions added to the program list arrived
 * with lettered tiles while every registry program beside them had its
 * real icon, which made the new rows look half-finished rather than new.
 *
 * Their icons are ordinary image files inside the package or extension
 * folder, so this is plain file reading -- no PowerShell, no
 * PrivateExtractIcons, and none of the encoding trouble that comes with
 * shelling out. */
const MAX_ICON_BYTES = 256 * 1024;

/** The row renders at 20px, so a 32- or 48-pixel asset is the right
 * trade: large enough not to blur on a high-DPI screen, small enough that
 * 100 of them inline as data URIs without bloating the response. */
const STORE_PREFERENCE = [
  'targetsize-32', 'targetsize-48', 'targetsize-24', 'targetsize-16',
  'scale-100', 'scale-200'
];

/** Picks the best available file for a declared Store logo.
 *
 * A manifest names something like "Assets\\PaintAppList.png", and that
 * exact file frequently does not exist -- Windows ships only the scaled
 * and target-size variants beside it. So the declared name is treated as
 * a stem to match against, not a path to open. */
export function pickLogoFile(declaredPath, availableNames) {
  if (typeof declaredPath !== 'string' || !declaredPath) return null;
  const names = (availableNames || []).filter((name) => typeof name === 'string');
  if (names.length === 0) return null;

  const wanted = basename(declaredPath);
  const stem = basename(wanted, extname(wanted)).toLowerCase();

  // The exact name wins when it is really there.
  const exact = names.find((name) => name.toLowerCase() === wanted.toLowerCase());
  if (exact) return exact;

  const variants = names.filter((name) => name.toLowerCase().startsWith(`${stem}.`));
  if (variants.length === 0) return null;

  for (const qualifier of STORE_PREFERENCE) {
    // "unplated" drops the coloured tile behind the glyph, which is what
    // suits a list row rather than a Start menu tile.
    const unplated = variants.find((n) => n.toLowerCase().includes(qualifier) && n.toLowerCase().includes('unplated'));
    if (unplated) return unplated;
    const plain = variants.find((n) => n.toLowerCase().includes(qualifier));
    if (plain) return plain;
  }

  return variants[0];
}

/** Picks an extension's icon from its manifest `icons` map.
 *
 * Keyed by pixel size as strings. 48 first for the same reason as above,
 * then whatever is closest, because plenty of extensions declare only one. */
export function pickExtensionIcon(icons) {
  if (!icons || typeof icons !== 'object') return null;
  const sizes = Object.keys(icons)
    .map((key) => ({ size: Number(key), path: icons[key] }))
    .filter((entry) => Number.isFinite(entry.size) && typeof entry.path === 'string' && entry.path);
  if (sizes.length === 0) return null;

  // Closest to 48, and on a tie the LARGER one: 64 scales down to a 20px
  // row cleanly, 32 scaled up does not.
  sizes.sort((a, b) => Math.abs(a.size - 48) - Math.abs(b.size - 48) || b.size - a.size);
  return sizes[0].path;
}

function mimeFor(path) {
  const ext = extname(path).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.webp') return 'image/webp';
  return null;
}

async function readAsDataUri(path) {
  const mime = mimeFor(path);
  if (!mime) return null;
  try {
    const bytes = await readFile(path);
    // An icon this large is not an icon; refusing it keeps one odd
    // package from inflating the whole response.
    if (bytes.length === 0 || bytes.length > MAX_ICON_BYTES) return null;
    return `data:${mime};base64,${bytes.toString('base64')}`;
  } catch {
    return null;
  }
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
}

async function storeIcon(app) {
  if (!app.installLocation) return null;

  const manifestPath = join(app.installLocation, 'AppxManifest.xml');
  let xml;
  try {
    xml = await readFile(manifestPath, 'utf8');
  } catch {
    return null;
  }

  // Read with a regex rather than an XML parser: the only thing wanted is
  // one attribute, and adding a parser dependency for it would be the
  // tail wagging the dog.
  const declared =
    (xml.match(/Square44x44Logo\s*=\s*"([^"]+)"/i) || [])[1] ||
    (xml.match(/<Logo>([^<]+)<\/Logo>/i) || [])[1];
  if (!declared) return null;

  const folder = join(app.installLocation, dirname(declared));
  let names;
  try {
    names = await readdir(folder);
  } catch {
    return null;
  }

  const file = pickLogoFile(declared, names);
  return file ? readAsDataUri(join(folder, file)) : null;
}

async function extensionIcon(extension) {
  if (!extension.installLocation) return null;

  // installLocation is the extension id folder; the manifest lives one
  // level down, inside the version folder.
  let versions;
  try {
    versions = await readdir(extension.installLocation, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of versions.filter((e) => e.isDirectory()).reverse()) {
    const root = join(extension.installLocation, entry.name);
    const manifest = await readJson(join(root, 'manifest.json'));
    if (!manifest) continue;
    const relative = pickExtensionIcon(manifest.icons)
      || pickExtensionIcon(manifest.browser_action?.default_icon)
      || pickExtensionIcon(manifest.action?.default_icon);
    if (!relative) continue;
    const uri = await readAsDataUri(join(root, relative));
    if (uri) return uri;
  }
  return null;
}

/** Icons for every Store app and browser extension, as
 * { rowId: dataUri }. Anything without a readable icon is simply absent
 * and the row keeps its lettered tile, exactly as for a registry program
 * whose icon cannot be extracted. */
export async function getPackageIcons() {
  const [apps, extensions] = await Promise.all([
    getStoreApps().catch(() => []),
    getBrowserExtensions().catch(() => [])
  ]);

  const icons = {};

  await Promise.all([
    ...apps.map(async (app) => {
      const uri = await storeIcon(app).catch(() => null);
      if (uri) icons[app.id] = uri;
    }),
    ...extensions.map(async (extension) => {
      const uri = await extensionIcon(extension).catch(() => null);
      if (uri) icons[extension.id] = uri;
    })
  ]);

  return icons;
}
