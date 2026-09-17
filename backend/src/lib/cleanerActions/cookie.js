import { existsSync, statSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isExcluded, isTooRecent } from '../cleanGuards.js';
import { sqlite3ExePath } from './sqliteVacuum.js';
import { SQLITE_TABLES, TABLE_DETECT_SQL, buildKeepPredicate } from './cookieSql.js';
import { quarantineAndDelete, quarantineFileEdit } from '../../services/quarantine.js';
import { sendToRecycleBin } from '../../services/recycleBin.js';

const execFileAsync = promisify(execFile);

/** Same two guards sqlite.vacuum's/json's own execute apply to the one file
 * each touches -- see sqliteVacuum.js's own heldReason for the reasoning.
 * The reason strings are shared on purpose: callers/tests key off
 * 'excluded' and 'recently' regardless of which action produced them. */
function heldReason(expandedPath, mtimeMs, guards) {
  if (isExcluded(expandedPath, guards.excludeFolders, guards.excludeExtensions)) {
    return 'excluded by your own settings';
  }
  if (isTooRecent(mtimeMs, guards.skipRecentHours)) {
    return 'modified too recently';
  }
  return null;
}

/** Runs the shared table-detection query against the real file via the
 * bundled sqlite3.exe CLI, and maps whichever real table name comes back
 * (`cookies` or `moz_cookies`) onto its `{ tableName, hostColumn }` shape
 * from cookieSql.js. A file with neither table (not a cookie database at
 * all, or a schema this doesn't recognize) resolves to null rather than
 * throwing -- the caller decides what "not a recognized cookie database"
 * means for the action as a whole. */
export async function detectCookieTable(dbPath) {
  const { stdout } = await execFileAsync(sqlite3ExePath(), [dbPath, TABLE_DETECT_SQL]);
  const foundName = stdout.trim().split('\n')[0]?.trim();
  return SQLITE_TABLES[foundName] ?? null;
}

/** Scans a `cookie` action: does the file exist, and how big is it right
 * now? Same "absence is not an error" contract sqlite.vacuum's and json's
 * own scans follow -- a missing cookie database just means `present:
 * false`, and this never opens the file (never mutates, never even reads
 * it as SQLite) to answer that question. */
export function scan(action) {
  if (!existsSync(action.expandedPath)) {
    return { sizeBytes: 0, present: false };
  }
  return { sizeBytes: statSync(action.expandedPath).size, present: true };
}

/** Executes a `cookie` action.
 *
 * Two real outcomes, chosen by whether a non-empty `cookieKeepList`
 * actually matches anything IN THIS FILE:
 *
 * - No keep list (or an empty one): the whole file is gone. There's
 *   nothing to keep, so there's no reason to open it as a database at
 *   all -- same whole-file-removal path as a `delete` action's own file,
 *   quarantined (or recycled, if `autoQuarantine: false`) exactly like
 *   one.
 *
 * - A keep list that matches at least one row in this file: a surgical
 *   DELETE + VACUUM through the bundled sqlite3.exe CLI, run via
 *   `quarantineFileEdit`'s `editFn` mode (the original is safely copied
 *   into quarantine before the CLI ever touches the real file, and the
 *   manifest is written whether the edit succeeds or throws).
 *
 * - A keep list that matches NOTHING in this specific file (a keep list
 *   for other files/browsers, none of it relevant here): falls through to
 *   the exact same whole-file-removal path as the empty-keep-list case.
 *   The OUTCOME is identical (the whole file is gone) regardless of WHY
 *   nothing survived, so there's no reason to route it any differently.
 *
 * A file that isn't a valid/recognized cookie database is skipped with a
 * reason instead of being risked -- sqlite3.exe itself refuses a
 * non-database file and exits non-zero, which is treated as the signal to
 * skip, same as sqlite.vacuum's own contract. */
export async function execute(action, ruleName, guards = {}) {
  if (!existsSync(action.expandedPath)) {
    return { freedBytes: 0, skipped: [] };
  }
  const before = statSync(action.expandedPath);
  const reason = heldReason(action.expandedPath, before.mtimeMs, guards);
  if (reason) {
    return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason }] };
  }

  const keepList = guards.cookieKeepList ?? [];
  if (keepList.length > 0) {
    let table;
    try {
      table = await detectCookieTable(action.expandedPath);
    } catch (err) {
      return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason: `not a valid cookie database: ${err.message}` }] };
    }
    if (!table) {
      return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason: 'not a recognized cookie database' }] };
    }

    const predicate = buildKeepPredicate(keepList, table.hostColumn);
    let keptCount;
    try {
      const { stdout } = await execFileAsync(
        sqlite3ExePath(), [action.expandedPath, `SELECT COUNT(*) FROM ${table.tableName} WHERE ${predicate};`]
      );
      keptCount = parseInt(stdout.trim(), 10);
    } catch (err) {
      return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason: `not a valid cookie database: ${err.message}` }] };
    }

    if (keptCount > 0) {
      try {
        const manifest = await quarantineFileEdit({
          programName: `Deep Clean: ${ruleName}`,
          filePath: action.expandedPath,
          editFn: async (realPath) => {
            await execFileAsync(sqlite3ExePath(), [realPath, `DELETE FROM ${table.tableName} WHERE NOT ${predicate}; VACUUM;`]);
          }
        });
        const after = statSync(action.expandedPath).size;
        return { freedBytes: Math.max(0, before.size - after), quarantineBatch: manifest.batchDir, skipped: [] };
      } catch {
        // Deliberately NOT err.message here -- execFileAsync's own failure
        // text for this call is `Command failed: <sqlite3.exe path> <db
        // path> <raw SQL>`, which would leak real filesystem paths and SQL
        // text into a message a Deep Clean UI user could see. The two
        // catches above (table detection, COUNT) already prefix theirs
        // with 'not a valid cookie database: ', but that message is a much
        // shorter, cleaner failure than a full DELETE+VACUUM command dump,
        // so this gets its own short, user-facing reason instead.
        return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason: 'could not clean cookies: the database may be in use or corrupted' }] };
      }
    }
    // keptCount === 0: nothing in this file matches the keep list -- fall
    // through to the same whole-file-delete path the empty-keep-list case
    // uses below. Deliberately NOT a different code path: the outcome
    // (whole file gone) is identical regardless of why nothing was kept.
  }

  if (guards.autoQuarantine === false) {
    const { failed, error } = await sendToRecycleBin([action.expandedPath]);
    if (failed.length > 0) {
      return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason: error ? `could not be recycled: ${error}` : 'could not be recycled' }] };
    }
    return { freedBytes: before.size, recycled: true, skipped: [] };
  }

  try {
    const manifest = await quarantineAndDelete({
      programName: `Deep Clean: ${ruleName}`,
      files: [action.expandedPath],
      registryKeys: []
    });
    return { freedBytes: manifest.totalSizeBytes, quarantineBatch: manifest.batchDir, skipped: [] };
  } catch (err) {
    return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason: err.message }] };
  }
}
