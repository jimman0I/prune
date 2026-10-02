import { readdir, lstat } from 'node:fs/promises';
import { join } from 'node:path';

const SHORTCUT = /\.(lnk|url)$/i;

/** Bytes under a path, for the size shown next to a leftover.
 *
 * Bounded by entries and time because it runs on whatever folder a scan
 * pointed at, and an install folder can hold a million files. It stops with
 * what it has counted so far rather than making the review wait. Links are
 * not followed: a junction's target is not what a removal would take. */
export async function measureDirectory(path, { maxEntries = 200000, budgetMs = 8000, now = Date.now } = {}) {
  const started = now();
  let total = 0;
  let seen = 0;
  const stack = [path];
  while (stack.length > 0) {
    if (seen >= maxEntries || now() - started > budgetMs) break;
    const current = stack.pop();
    let info;
    try { info = await lstat(current); } catch { continue; }
    if (info.isSymbolicLink()) continue;
    if (!info.isDirectory()) { total += info.size; seen += 1; continue; }
    let entries;
    try { entries = await readdir(current); } catch { continue; }
    for (const entry of entries) stack.push(join(current, entry));
  }
  return total;
}

/** A bounded breadth-first walk for things whose name matches.
 *
 * This is the Advanced scan's file half, and it is plain Node rather than a
 * PowerShell script for three reasons: the powershell wrapper gives a call
 * 15 seconds and a retry, which a deep search of AppData does not fit in;
 * a Node walk can be bounded by time AND by entries and say it stopped
 * early; and it can be tested against a real directory tree.
 *
 * Breadth-first, so a budget that runs out has covered every root's shallow
 * levels (where nearly all real leftovers are) before it gives up on the
 * deep ones.
 *
 * A matching folder is reported and not entered: everything inside it
 * belongs to it, and listing the children as well would only offer the same
 * bytes twice. Symbolic links and junctions are never followed -- one in
 * AppData can point anywhere on the machine.
 *
 * Reports `truncated` when it stopped on a budget, so the caller can say the
 * search was partial instead of presenting a clean result it did not earn. */
export async function walkForLeftovers({
  roots,
  isMatch,
  skipDescent = () => false,
  budgetMs = 20000,
  maxEntries = 300000,
  now = Date.now
}) {
  const started = now();
  const matches = [];
  const seen = new Set();
  let visited = 0;
  let truncated = false;

  // One queue across every root, ordered by depth, so the shallow level of
  // every root is read before the deep level of any.
  let level = roots.map((root) => ({ path: root.path, depthLeft: root.depth ?? 3, root }));

  while (level.length > 0 && !truncated) {
    const next = [];
    for (const { path, depthLeft, root } of level) {
      if (now() - started > budgetMs || visited >= maxEntries) { truncated = true; break; }

      let entries;
      try {
        entries = await readdir(path, { withFileTypes: true });
      } catch {
        continue; // a folder that is missing or unreadable is not an error
      }

      for (const entry of entries) {
        if (visited >= maxEntries) { truncated = true; break; }
        visited += 1;
        if (entry.isSymbolicLink()) continue;

        const full = join(path, entry.name);
        const isDirectory = entry.isDirectory();
        if (!isDirectory && !(root.shortcuts && SHORTCUT.test(entry.name))) continue;

        if (isMatch(entry.name, full, isDirectory, root)) {
          const key = full.toLowerCase();
          if (!seen.has(key)) { seen.add(key); matches.push({ path: full, isDirectory, root: root.path }); }
          continue;
        }
        if (isDirectory && depthLeft > 1 && !skipDescent(entry.name, full)) {
          next.push({ path: full, depthLeft: depthLeft - 1, root });
        }
      }
    }
    level = next;
  }

  return { matches, truncated, visited };
}
