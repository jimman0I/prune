/** The Junk files scan's results, as the dialog shows them.
 *
 * Pure functions over what the backend streams (routes/junkFiles.js): files
 * arrive one batch at a time, each naming the pattern that found it, and this
 * turns them into groups, starting ticks and totals. Nothing here talks to
 * the backend or decides what is safe -- the backend already refused what
 * must never be offered; this only decides what the list says.
 */

/** The built-in patterns, by the key their short description has in the
 * catalog. Catalog keys cannot hold the dots and stars of the patterns
 * themselves (catalog.test.js walks dotted paths), hence the names. */
const BUILT_IN = {
  '*.tmp': 'tmp',
  '*.temp': 'temp',
  '~*.*': 'tilde',
  '*.~*': 'tildeExt',
  '*.chk': 'chk',
  '*.old': 'old',
  '*.gid': 'gid',
  '*.dmp': 'dmp',
  'thumbs.db': 'thumbs',
  '*.bak': 'bak',
  '*.log': 'log'
};

/** The catalog key of a built-in pattern's description, or null for one the
 * person added (which has no description: it means what they say it means). */
export function patternDescriptionKey(pattern) {
  return BUILT_IN[String(pattern ?? '').toLowerCase()] ?? null;
}

/** Groups in the order of the pattern list -- the order the person arranged,
 * and the order the backend matched in -- each with its files biggest first
 * and its total. Groups with nothing in them are left out. `patterns` is the
 * scan's 'start' list ({ pattern, preselected }); a file naming a pattern
 * not in it (never expected) gets a group of its own at the end rather than
 * being dropped. */
export function groupJunkFiles(files, patterns = []) {
  const groups = new Map();
  for (const p of patterns) groups.set(p.pattern, { pattern: p.pattern, preselected: p.preselected === true, files: [], totalBytes: 0 });
  for (const file of files ?? []) {
    let group = groups.get(file.pattern);
    if (!group) {
      group = { pattern: file.pattern, preselected: false, files: [], totalBytes: 0 };
      groups.set(file.pattern, group);
    }
    group.files.push(file);
    group.totalBytes += Number(file.sizeBytes) || 0;
  }
  return [...groups.values()]
    .filter((g) => g.files.length > 0)
    .map((g) => ({ ...g, files: [...g.files].sort((a, b) => (b.sizeBytes - a.sizeBytes) || a.path.localeCompare(b.path)) }));
}

/** The paths that start ticked: only files found by a pattern the backend
 * marked preselected (scratch files and caches that rebuild themselves).
 * Everything else waits for the person. */
export function preselectedPaths(files, patterns = []) {
  const safe = new Set(patterns.filter((p) => p.preselected === true).map((p) => p.pattern));
  return (files ?? []).filter((f) => safe.has(f.pattern)).map((f) => f.path);
}

/** How many of the ticked files there are and what they add up to, counting
 * only files still in the list (a tick on a file since removed counts nothing). */
export function selectionSummary(files, selected) {
  let count = 0;
  let bytes = 0;
  for (const file of files ?? []) {
    if (!selected.has(file.path)) continue;
    count += 1;
    bytes += Number(file.sizeBytes) || 0;
  }
  return { count, bytes };
}

/** 'all' | 'some' | 'none' of a group's files are ticked -- the group
 * checkbox's three states. */
export function groupTickState(group, selected) {
  let ticked = 0;
  for (const file of group.files) if (selected.has(file.path)) ticked += 1;
  if (ticked === 0) return 'none';
  return ticked === group.files.length ? 'all' : 'some';
}

/** The kinds of file a scan left alone, in the order they are said, with
 * their counts -- zero counts dropped so the sentence only names what
 * happened. Folders the walk never entered are said separately: they are a
 * count of folders, not of files. */
export function skippedParts(skipped) {
  const s = skipped ?? {};
  return ['recent', 'protected', 'excluded', 'executable']
    .map((kind) => ({ kind, count: Number(s[kind]) || 0 }))
    .filter((part) => part.count > 0);
}

/** A drive letter as the root the backend scans: "C" -> "C:\". */
export function driveRoot(letter) {
  return `${String(letter).replace(/[:\\]+$/, '').toUpperCase()}:\\`;
}

/** Folders the person typed or picked, tidied and without duplicates
 * (Windows paths ignore case). Quotes from File Explorer's "Copy as path" are
 * stripped. Empty entries are dropped; whether a folder is usable is the
 * backend's to say. */
export function addFolder(folders, raw) {
  const path = String(raw ?? '').trim().replace(/^"(.*)"$/, '$1').trim().replace(/\//g, '\\').replace(/(?<=.)\\+$/, '');
  if (!path) return folders;
  if (folders.some((f) => f.toLowerCase() === path.toLowerCase())) return folders;
  return [...folders, path];
}
