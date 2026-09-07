import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expandPath } from '../lib/cleanerRules.js';
import { extractIcons } from './iconExtract.js';

const here = dirname(fileURLToPath(import.meta.url));
const ICON_MAP_PATH = join(here, '..', 'data', 'cleanerIcons.json');

/** The icon for each Deep Clean category, as { category: dataUri }.
 *
 * The Deep Clean list groups by application, so its section headings are
 * the one place in this app where a row IS an app and had nothing but its
 * name. That matters more than it sounds: "Chrome", "Edge", "Opera" and
 * "Vivaldi" are four headings of near-identical length and shape, and the
 * icon is the fastest way to find the one you want in a list of
 * twenty-nine.
 *
 * The sources are declared in data rather than matched by name against
 * the installed-programs list. Name matching looked cheaper and is
 * quietly unreliable -- "Chrome" would have to find "Google Chrome",
 * "Edge" would have to find "Microsoft Edge" without also matching
 * "Microsoft Edge WebView2 Runtime", and "Windows", "DirectX" and
 * "Developer tools" have no installed program to match at all. A declared
 * path either exists or does not.
 */

/** The raw category -> candidate paths map, comment key stripped. */
export function loadCleanerIconMap() {
  const { _comment, ...map } = JSON.parse(readFileSync(ICON_MAP_PATH, 'utf8'));
  return map;
}

/** Category -> the first candidate path present on this machine.
 *
 * `exists` is injectable so the ordering rule can be tested without
 * depending on what happens to be installed on the machine running the
 * tests.
 *
 * A category with no surviving candidate is left out entirely rather than
 * mapped to null. Absent is the ordinary case -- a rule set covers
 * programs most machines will not have -- and the caller's fallback is
 * the lettered tile it would have drawn anyway. */
export function pickIconSources(map, { exists = existsSync } = {}) {
  const sources = new Map();

  for (const [category, candidates] of Object.entries(map || {})) {
    if (category === '_comment' || !Array.isArray(candidates)) continue;
    const found = candidates
      .map((candidate) => expandPath(String(candidate)))
      .find((path) => path && exists(path));
    if (found) sources.set(category, found);
  }

  return sources;
}

/** Extraction is a pure function of files that do not change while the app
 * is open, and this endpoint is polled by a screen the user can revisit.
 * Cached for the life of the process, keyed by category. */
let cached = null;

export async function getCleanerCategoryIcons() {
  if (cached) return cached;

  const sources = pickIconSources(loadCleanerIconMap());
  if (sources.size === 0) {
    cached = {};
    return cached;
  }

  // Keyed by path rather than by category, so two categories pointing at
  // the same file are extracted once. Nothing does today; the rule set is
  // edited by hand and that will not stay true.
  const requests = new Map();
  for (const path of sources.values()) {
    if (!requests.has(path)) requests.set(path, { key: path, path, index: 0 });
  }

  const extracted = await extractIcons([...requests.values()]);

  const icons = {};
  for (const [category, path] of sources) {
    if (extracted[path]) icons[category] = `data:image/png;base64,${extracted[path]}`;
  }

  cached = icons;
  return cached;
}

/** Testing seam -- the cache is process-wide and would otherwise leak
 * between cases. */
export function clearCleanerCategoryIconCache() {
  cached = null;
}
