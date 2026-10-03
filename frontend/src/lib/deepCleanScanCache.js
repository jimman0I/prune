/** Deep Clean's remembered scan.
 *
 * BleachBit scans once and then just cleans; Prune used to walk the disk for
 * about twenty seconds on every launch. This keeps the last COMPLETE scan in
 * the renderer's localStorage so opening the screen can draw the tree at once.
 *
 * Three rules shape everything below:
 *
 * - It stores measurements, not rules. Names, descriptions and paths come
 *   from the live rule listing (they are translated, and they change with an
 *   update); a rule's size, file count and presence are all this needs. The
 *   per-file lists a scan returns are never stored -- they are the bulk of a
 *   scan's size and are only useful while the scan is fresh.
 * - It is thrown away the moment it could be wrong. Alongside the sizes goes a
 *   fingerprint of everything that changes what a scan would find (the
 *   exclusion settings, the rule set, the app version); a different
 *   fingerprint means the stored scan is not used.
 * - It can never break the screen it speeds up. Every storage access is
 *   wrapped, anything unrecognised reads as "nothing stored", and a value too
 *   big to be ours is refused rather than parsed.
 */

export const SCAN_CACHE_KEY = 'prune.deepCleanScan';
export const SCAN_CACHE_VERSION = 1;
/** A real scan is a few kilobytes. This is far above that and far below
 * localStorage's quota, so hitting it means something is wrong, not that the
 * scan was big. */
export const SCAN_CACHE_MAX_CHARS = 200_000;
const MAX_RULES = 2000;
const MAX_STRING = 64;

/** Fields a scan fills in on a rule. These are what is remembered, and what
 * the fingerprint ignores (they describe the machine, not the rule). */
const NUMBER_FIELDS = ['sizeBytes', 'fileCount', 'heldCount'];
const FLAG_FIELDS = ['present', 'accessible', 'filesListed', 'rescanNeeded'];
const MEASURED_KEYS = new Set([...NUMBER_FIELDS, ...FLAG_FIELDS, 'incomplete', 'files', 'fromCache']);

function defaultStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** cyrb53: a small, well-spread 53-bit string hash. Not for security -- it
 * only has to tell two configurations apart. */
function hash(text) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** JSON with object keys sorted, so two equal values always serialise equally. */
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

const asList = (value) => (Array.isArray(value) ? value : []);

/** A hash of the rule set itself -- every rule's definition, with whatever a
 * scan filled in removed. Adding or removing a rule (a custom location, an
 * imported cleaner), or an update editing one, changes it. */
export function rulesSignature(categories) {
  const rules = [];
  for (const group of asList(categories)) {
    for (const item of asList(group?.items)) {
      const definition = {};
      for (const key of Object.keys(item)) if (!MEASURED_KEYS.has(key)) definition[key] = item[key];
      rules.push(definition);
    }
  }
  rules.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return hash(canonical(rules));
}

/** The settings that change what a scan finds. `hideUnavailableRules` does
 * not change a measurement, but it changes which rules the screen shows and
 * ticks, so a scan remembered under the other value is not shown. */
export function settingsSignature(settings) {
  const sorted = (list) => [...asList(list)].map((x) => canonical(x)).sort();
  const hours = Number(settings?.skipRecentHours);
  return hash(canonical({
    excludeFolders: sorted(settings?.excludeFolders),
    excludeExtensions: sorted(settings?.excludeExtensions),
    skipRecentHours: Number.isFinite(hours) ? hours : 0,
    hideUnavailableRules: settings?.hideUnavailableRules === true,
    customLocations: sorted(settings?.customLocations),
    cookieKeepList: sorted(settings?.cookieKeepList)
  }));
}

/** Joins the pieces; split out so a component can recompute only the part
 * that changed (the rules hash walks every rule). */
export function joinFingerprint({ rulesSig, settings, appVersion }) {
  return `${SCAN_CACHE_VERSION}.${hash(String(appVersion ?? ''))}.${rulesSig}.${settingsSignature(settings)}`;
}

/** Everything that changes what a scan would find, as one short string. */
export function scanFingerprint({ settings, rules, appVersion }) {
  return joinFingerprint({ rulesSig: rulesSignature(rules), settings, appVersion });
}

/** The remembered shape of one measured row, or null if it holds nothing. */
function entryOf(item) {
  if (!item || typeof item.id !== 'string') return null;
  const entry = {};
  let measured = false;
  for (const key of NUMBER_FIELDS) {
    if (item[key] === null || typeof item[key] === 'number') {
      if (typeof item[key] === 'number' && Number.isFinite(item[key]) && item[key] >= 0) measured = true;
      if (item[key] === null || (Number.isFinite(item[key]) && item[key] >= 0)) entry[key] = item[key];
    }
  }
  for (const key of FLAG_FIELDS) if (typeof item[key] === 'boolean') entry[key] = item[key];
  if (typeof item.incomplete === 'string' && item.incomplete.length <= MAX_STRING) entry.incomplete = item.incomplete;
  else if (item.incomplete === true) entry.incomplete = true;
  // A row a clean settled to "cleaned, measure again" is worth remembering
  // even though it has no size; a row that was only ever listed is not.
  if (item.rescanNeeded === true) measured = true;
  return measured || item.accessible === false ? entry : null;
}

/** { id: entry } for every row of the tree that was actually measured. */
export function snapshotRules(tree) {
  const rules = {};
  for (const group of asList(tree)) {
    for (const item of asList(group?.items)) {
      const entry = entryOf(item);
      if (entry) rules[item.id] = entry;
    }
  }
  return rules;
}

/** Remembers `tree` as the last complete scan. Returns whether it was kept.
 * An entry too big to store is refused, and the previous one removed with it:
 * an older scan left in place would be shown as though it were current. */
export function saveScanCache({ tree, fingerprint, savedAt = Date.now() }, storage = defaultStorage()) {
  if (!storage) return false;
  const rules = snapshotRules(tree);
  try {
    if (Object.keys(rules).length === 0) return false;
    const text = JSON.stringify({ version: SCAN_CACHE_VERSION, savedAt, fingerprint, rules });
    if (text.length > SCAN_CACHE_MAX_CHARS) {
      storage.removeItem(SCAN_CACHE_KEY);
      return false;
    }
    storage.setItem(SCAN_CACHE_KEY, text);
    return true;
  } catch {
    return false;
  }
}

export function clearScanCache(storage = defaultStorage()) {
  try { storage?.removeItem(SCAN_CACHE_KEY); } catch { /* nothing to clear */ }
}

const isCount = (v) => v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0);

/** One stored entry, or null if any field is the wrong type. Unknown fields
 * are dropped, not carried into the tree. */
function validEntry(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const entry = {};
  for (const key of NUMBER_FIELDS) {
    if (raw[key] === undefined) continue;
    if (!isCount(raw[key])) return null;
    entry[key] = raw[key];
  }
  for (const key of FLAG_FIELDS) {
    if (raw[key] === undefined) continue;
    if (typeof raw[key] !== 'boolean') return null;
    entry[key] = raw[key];
  }
  if (raw.incomplete !== undefined) {
    if (raw.incomplete === true || (typeof raw.incomplete === 'string' && raw.incomplete.length <= MAX_STRING)) entry.incomplete = raw.incomplete;
    else return null;
  }
  return entry;
}

/** The stored scan as { savedAt, fingerprint, rules }, or null when there is
 * none or it is not recognisably ours. Never throws. */
export function loadScanCache(storage = defaultStorage()) {
  if (!storage) return null;
  try {
    const text = storage.getItem(SCAN_CACHE_KEY);
    if (typeof text !== 'string' || text.length === 0 || text.length > SCAN_CACHE_MAX_CHARS) return null;
    const raw = JSON.parse(text);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    if (raw.version !== SCAN_CACHE_VERSION) return null;
    if (typeof raw.savedAt !== 'number' || !Number.isFinite(raw.savedAt) || raw.savedAt <= 0) return null;
    if (typeof raw.fingerprint !== 'string' || raw.fingerprint === '') return null;
    if (!raw.rules || typeof raw.rules !== 'object' || Array.isArray(raw.rules)) return null;
    const ids = Object.keys(raw.rules);
    if (ids.length === 0 || ids.length > MAX_RULES) return null;
    const rules = {};
    for (const id of ids) {
      const entry = validEntry(raw.rules[id]);
      if (!entry) return null;
      rules[id] = entry;
    }
    return { savedAt: raw.savedAt, fingerprint: raw.fingerprint, rules };
  } catch {
    return null;
  }
}

/** The listed tree with each remembered rule's measurements laid over it,
 * marked `fromCache` so the screen can say where the numbers came from. Null
 * if none of the remembered rules is in the listing. */
export function applyScanCache(listedTree, cache) {
  if (!cache) return null;
  let matched = 0;
  const tree = asList(listedTree).map((group) => ({
    ...group,
    items: asList(group.items).map((item) => {
      const entry = cache.rules[item.id];
      if (!entry) return item;
      matched += 1;
      return { ...item, ...entry, fromCache: true };
    })
  }));
  return matched > 0 ? tree : null;
}

/** The remembered scan, ready to show -- or null when there is none, it is
 * stale (a different fingerprint) or it does not fit the current rules. */
export function readFreshScanCache({ fingerprint, listedTree }, storage = defaultStorage()) {
  const cache = loadScanCache(storage);
  if (!cache || cache.fingerprint !== fingerprint) return null;
  const tree = applyScanCache(listedTree, cache);
  return tree ? { savedAt: cache.savedAt, tree } : null;
}
