import { promises as fs } from 'node:fs';
import { join, basename } from 'node:path';

/** How many levels of `children` the returned tree exposes. A directory
 * beyond this depth still contributes its true size to every ancestor's
 * total -- the walk still recurses fully to keep totals honest -- only
 * its own `children` array is omitted from the response, bounding how
 * deep/large the JSON tree the frontend has to render can get.
 *
 * This does NOT bound total scan TIME or file count (a shallow-but-huge
 * directory blows past any depth cap in file count, not depth) -- that's
 * what the `signal` parameter below is for. See the route's own
 * SCAN_TIMEOUT_MS for the real time budget. */
import { normalizePath, toExcludePattern } from '../lib/cleanGuards.js';
import { matchesExtension } from '../lib/exclusionInput.js';

export const DEFAULT_MAX_DEPTH = 12;

async function scanNode(entryPath, name, depthRemaining, signal, exclusions) {
  // Checked BEFORE starting new work, not just relied on to reject an
  // in-flight fs call -- an already-aborted signal should stop growing the
  // tree immediately rather than spend one more stat/readdir round-trip
  // finding that out the slow way.
  if (signal?.aborted) return null;

  // The user's exclusions, honoured by the SCANNER and not only by the
  // cleaner. They were read by the cleaner alone, which made the setting
  // half-true: a folder someone had excluded still appeared in the disk
  // map, still counted toward the totals, and still offered a Delete in
  // its context menu. Skipping it here costs nothing and saves walking
  // it -- an excluded D:\Games is usually the largest thing on the drive.
  //
  // Marked rather than dropped. An entry that vanishes from its parent's
  // total with no trace is the same dishonesty as an unreadable folder
  // reported as empty, and the map already has a shape for "present but
  // not counted".
  if (isExcludedEntry(entryPath, exclusions)) {
    return { name, size: 0, type: 'directory', excluded: true, children: [] };
  }

  let stat;
  try {
    stat = await fs.stat(entryPath, { signal });
  } catch {
    // Covers real permission errors (EPERM/EACCES/gone by the time we got
    // here) AND an abort that landed mid-call -- fs.promises rejects with
    // an AbortError in that case, which reads the same as "couldn't read
    // this entry" to a caller, and is exactly the honest partial-result
    // behavior an abort is supposed to produce.
    return null;
  }

  if (!stat.isDirectory()) {
    return { name, size: stat.size, type: 'file' };
  }

  let entryNames;
  try {
    entryNames = await fs.readdir(entryPath, { signal });
  } catch {
    // Can stat it but can't list it -- the classic Windows
    // "System Volume Information" / "$Recycle.Bin" shape (or an abort
    // mid-readdir). Reported as present with size 0 rather than dropped
    // silently: an entry that visibly exists but is opaque is more honest
    // than one that vanishes from its parent's total with no trace.
    //
    // `readable: false` distinguishes it from a directory that really is
    // empty. Both used to come back as `children: []`, which the folder
    // table then reported as "0 items" -- stating that we looked and
    // found nothing, when we could not look at all. Windows' "Documents
    // and Settings" junction is the everyday example.
    return { name, size: 0, type: 'directory', readable: false, children: [] };
  }

  // Sequential, not Promise.all -- Node's fs thread pool (UV_THREADPOOL_SIZE,
  // default 4) is shared with every other fs-based route in this process;
  // firing hundreds of concurrent stat/readdir calls for one big directory
  // would starve everyone else's fs I/O just as badly as the old synchronous
  // walk starved the whole event loop. Each `await` here still yields
  // control back to the event loop between entries, which is the actual
  // fix for "the backend freezes" -- other requests get serviced in the
  // gaps, they just don't race this scan for the same 4 I/O threads.
  const children = [];
  for (let i = 0; i < entryNames.length; i++) {
    if (signal?.aborted) {
      // Real showstopper found running the packaged app unelevated
      // (2026-09-02): the loop used to just `break` here, dropping every
      // sibling it hadn't reached. Scanning C:\ hit the 30s budget
      // alphabetically at "Games" and returned 35.7 GB for a drive with
      // 845 GB in use -- Users (528 GB), Program Files (x86) (225 GB),
      // ProgramData (155 GB) and Windows weren't shown as unknown, they
      // were simply gone, so the treemap reported Games as 82% of the
      // disk with total confidence. A truncated scan is fine; one that
      // silently deletes most of the drive from its own answer is not.
      //
      // `scanned: false` is the load-bearing part. Size 0 does NOT mean
      // empty here, and the UI has to be able to tell the difference --
      // same distinction the cleaner rules already draw between "nothing
      // to clean" and "we couldn't look".
      for (const skipped of entryNames.slice(i)) {
        children.push({ name: skipped, size: 0, type: 'directory', scanned: false });
      }
      break;
    }
    const entryName = entryNames[i];
    const child = await scanNode(join(entryPath, entryName), entryName, depthRemaining - 1, signal, exclusions);
    if (child) children.push(child);
  }
  const size = children.reduce((sum, c) => sum + c.size, 0);

  // When a directory was last written, for the folder table. Free: the
  // stat above already ran and this value was being discarded.
  //
  // Directories ONLY, deliberately. The same field on every file node
  // would add roughly a megabyte to a 4.4 MB response for data no folder
  // table ever shows -- and the tree is sent whole.
  const modified = Number.isFinite(stat.mtimeMs) && stat.mtimeMs > 0
    ? Math.round(stat.mtimeMs)
    : null;

  // `type: 'directory'` still applies at the depth cap (no `children` key)
  // -- it's what lets a caller tell a capped directory (clickable, worth a
  // fresh scan to go deeper) apart from a plain file (never has children),
  // since both would otherwise collapse to the same { name, size } shape.
  return depthRemaining > 0
    ? { name, size, type: 'directory', modified, children }
    : { name, size, type: 'directory', modified };
}

/** Recursively scans `dirPath`, returning a hierarchical
 * { name, size, children } tree -- size is a file's own byte size, or the
 * sum of every descendant for a directory. An entry that throws while
 * being scanned (Windows system-protected folders, permission errors, a
 * path that's gone by the time it's visited) is simply omitted rather
 * than failing the whole scan. Returns null if `dirPath` itself can't be
 * read at all.
 *
 * `signal` (optional AbortSignal) bounds the walk itself, not just the
 * response shape -- pass one from an AbortController tied to a timeout
 * (see the route) to cap how long a single scan can run. An abort mid-walk
 * doesn't throw or discard progress: the tree returned reflects whatever
 * was genuinely visited before the signal fired, an honest partial result
 * rather than an error or a silently-inaccurate "complete" one. */
export async function scanDirectory(dirPath, maxDepth = DEFAULT_MAX_DEPTH, signal, exclusions = null) {
  return scanNode(dirPath, basename(dirPath) || dirPath, maxDepth, signal, exclusions);
}

/** Whether the scanner should skip this entry outright.
 *
 * Only the USER's own exclusions, not cleanGuards' DEFAULT_EXCLUDED. Those
 * defaults exist to stop a cleaner taking files out of places like
 * WinSxS; they are not a statement that the disk map should pretend
 * WinSxS is empty. A disk map that hid the component store would be
 * lying about where the space went, which is the one thing it is for.
 *
 * Null exclusions means the caller did not ask for any -- every existing
 * test and the MFT path included -- so the walk behaves exactly as before.
 */
function isExcludedEntry(entryPath, exclusions) {
  if (!exclusions) return false;
  const folders = exclusions.excludeFolders ?? [];
  const extensions = exclusions.excludeExtensions ?? [];
  if (folders.length === 0 && extensions.length === 0) return false;

  if (matchesExtension(entryPath, extensions)) return true;

  const haystack = normalizePath(entryPath);
  if (haystack === '') return false;
  return folders.map(toExcludePattern).filter(Boolean).some((p) => haystack.includes(p));
}
