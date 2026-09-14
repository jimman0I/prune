import { existsSync, statSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isExcluded, isTooRecent } from '../cleanGuards.js';

const execFileAsync = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));

/** Where the bundled sqlite3.exe CLI actually is.
 *
 * A function, not a constant -- read at call time, not import time, same
 * reason settings.js's settingsPath() and quarantine.js's quarantineRoot()
 * both are: a test can override it via env var without touching the real
 * install.
 *
 * Packaged mode: electron/main.cjs sets UNREVO_SQLITE3_PATH from
 * process.resourcesPath before importing the backend (see the earlier
 * task that bundled sqlite3.exe). Dev/standalone/test mode: this reaches
 * electron/build/sqlite3.exe directly by relative path -- backend/ and
 * electron/ are sibling folders in this repo, and up 4 levels from this
 * file's own directory (cleanerActions -> lib -> src -> backend) is the
 * repo root. */
export function sqlite3ExePath() {
  return process.env.UNREVO_SQLITE3_PATH
    || join(here, '..', '..', '..', '..', 'electron', 'build', 'sqlite3.exe');
}

/** Same two guards `partitionCleanableFiles` applies to a `delete` action's
 * files, applied here to the ONE file a sqlite.vacuum action names --
 * there's no batch to partition, so this calls the same two underlying
 * checks (`isExcluded`/`isTooRecent`) directly rather than routing through
 * a function built for an array. Returns the reason it's held back, or
 * null if it's clear to touch. `autoQuarantine` is deliberately NOT
 * checked here -- see execute()'s own comment for why. */
function heldReason(expandedPath, mtimeMs, guards) {
  if (isExcluded(expandedPath, guards.excludeFolders, guards.excludeExtensions)) {
    return 'excluded by your own settings';
  }
  if (isTooRecent(mtimeMs, guards.skipRecentHours)) {
    return 'modified too recently';
  }
  return null;
}

/** Scans a sqlite.vacuum action: the file's CURRENT size, which is an
 * upper bound on what vacuuming could reclaim, not a promise -- SQLite's
 * own free-page accounting is only knowable by actually running VACUUM,
 * and a scan must never mutate anything. A file the guards would hold
 * back still reports its real present/size (same as a `delete` action's
 * own scan, which counts held files in `heldCount` rather than hiding
 * them) -- only `execute` actually skips it. */
export function scan(action, guards = {}) {
  if (!existsSync(action.expandedPath)) {
    return { sizeBytes: 0, present: false };
  }
  return { sizeBytes: statSync(action.expandedPath).size, present: true };
}

/** Executes a sqlite.vacuum action: stat before, run VACUUM, stat after.
 * freedBytes is the real byte delta, never negative -- a vacuum that
 * doesn't shrink the file frees 0, not a fabricated negative number.
 *
 * A file that is not actually a valid SQLite database is skipped with a
 * reason rather than risking corruption -- sqlite3.exe itself refuses and
 * exits non-zero against a non-database file, which this treats as the
 * signal to skip rather than throw. A missing file is not an error either
 * -- "nothing to clean" is a normal outcome, same as an absent cache
 * folder for the delete action.
 *
 * `excludeFolders`/`excludeExtensions`/`skipRecentHours` apply exactly as
 * they do to a `delete` action's files. `autoQuarantine` does NOT apply --
 * there is nothing to quarantine here. The file isn't deleted, it's
 * rewritten in place by VACUUM, so "move it to Quarantine first" has no
 * meaning for this action type. This is the one guard sqlite.vacuum is
 * deliberately exempt from. */
export async function execute(action, guards = {}) {
  if (!existsSync(action.expandedPath)) {
    return { freedBytes: 0, skipped: [] };
  }
  const before = statSync(action.expandedPath);
  const reason = heldReason(action.expandedPath, before.mtimeMs, guards);
  if (reason) {
    return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason }] };
  }
  try {
    await execFileAsync(sqlite3ExePath(), [action.expandedPath, 'VACUUM;']);
  } catch (err) {
    return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason: err.message }] };
  }
  const after = statSync(action.expandedPath).size;
  return { freedBytes: Math.max(0, before.size - after), skipped: [] };
}
