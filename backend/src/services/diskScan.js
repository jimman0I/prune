import * as fs from 'node:fs';
import { join, basename } from 'node:path';

/** How many levels of `children` the returned tree exposes. A directory
 * beyond this depth still contributes its true size to every ancestor's
 * total -- the walk always recurses fully to keep totals honest -- only
 * its own `children` array is omitted from the response, bounding how
 * deep/large the JSON tree the frontend has to render can get. A hard
 * stop on the WALK ITSELF (for a genuinely pathological scan, e.g. a
 * root drive with millions of files) is future work -- see diskScan.js's
 * route for the same tradeoff called out where it matters for latency. */
export const DEFAULT_MAX_DEPTH = 12;

function scanNode(entryPath, name, depthRemaining) {
  let stat;
  try {
    stat = fs.statSync(entryPath);
  } catch {
    return null; // unreadable (EPERM/EACCES/gone by the time we got here) -- caller drops this entry
  }

  if (!stat.isDirectory()) {
    return { name, size: stat.size };
  }

  let entryNames;
  try {
    entryNames = fs.readdirSync(entryPath);
  } catch {
    // Can stat it but can't list it -- the classic Windows
    // "System Volume Information" / "$Recycle.Bin" shape. Reported as
    // present with size 0 rather than dropped silently: an entry that
    // visibly exists but is opaque is more honest than one that vanishes
    // from its parent's total with no trace.
    return { name, size: 0, children: [] };
  }

  const children = [];
  for (const entryName of entryNames) {
    const child = scanNode(join(entryPath, entryName), entryName, depthRemaining - 1);
    if (child) children.push(child);
  }
  const size = children.reduce((sum, c) => sum + c.size, 0);

  return depthRemaining > 0 ? { name, size, children } : { name, size };
}

/** Recursively scans `dirPath`, returning a hierarchical
 * { name, size, children } tree -- size is a file's own byte size, or the
 * sum of every descendant for a directory. An entry that throws while
 * being scanned (Windows system-protected folders, permission errors, a
 * path that's gone by the time it's visited) is simply omitted rather
 * than failing the whole scan. Returns null if `dirPath` itself can't be
 * read at all. */
export function scanDirectory(dirPath, maxDepth = DEFAULT_MAX_DEPTH) {
  return scanNode(dirPath, basename(dirPath) || dirPath, maxDepth);
}
