import { existsSync, statSync } from 'node:fs';
import { writeFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isExcluded, isTooRecent } from '../cleanGuards.js';
import { sqlite3ExePath } from './sqliteVacuum.js';
import { sqliteTableExists } from './sqliteInspect.js';
import { quarantineFileEdit } from '../../services/quarantine.js';

const execFileAsync = promisify(execFile);

/** Firefox/Firefox-family `places.sqlite` cleaner, ported from BleachBit's
 * real `delete_mozilla_url_history()`. NOTE: this schema was NOT
 * independently re-verified against a live current Firefox install on
 * this machine (none available) -- it's ported from BleachBit's
 * documented schema as-is. Every non-`moz_places` table is
 * existence-checked before being touched, matching BleachBit's own
 * defensive comments about tables that don't exist on all Firefox
 * versions. */

function heldReason(expandedPath, mtimeMs, guards) {
  if (isExcluded(expandedPath, guards.excludeFolders, guards.excludeExtensions)) {
    return 'excluded by your own settings';
  }
  if (isTooRecent(mtimeMs, guards.skipRecentHours)) {
    return 'modified too recently';
  }
  return null;
}

/** Runs `sql` against the database at `dbPath` via sqlite3.exe's `.read`
 * meta-command rather than passing the SQL as a raw argv string. This
 * module has no large-list risk of its own (no bookmark-URL-list embedded
 * in the SQL, unlike chromeHistory.js), but a places.sqlite database with
 * many tables/rows could still produce a moderately long combined SQL
 * string across all the existence-checked DELETEs -- writing the script
 * to a temp file keeps argv tiny regardless, matching the same safer
 * convention chromeHistory.js's own `runSqlViaTempScript()` established.
 * The temp file is always removed afterward. */
async function runSqlViaTempScript(dbPath, sql) {
  const scriptPath = join(tmpdir(), `prune-mozilla-history-${process.pid}-${randomUUID()}.sql`);
  try {
    await writeFile(scriptPath, sql, 'utf8');
    await execFileAsync(sqlite3ExePath(), [dbPath, `.read ${scriptPath}`]);
  } finally {
    await rm(scriptPath, { force: true });
  }
}

/** Scans a mozilla.url.history action: the places.sqlite file's current
 * size, an upper bound on what clearing browsing history could reclaim. */
export function scan(action) {
  if (!existsSync(action.expandedPath)) {
    return { sizeBytes: 0, present: false };
  }
  return { sizeBytes: statSync(action.expandedPath).size, present: true };
}

/** Executes a mozilla.url.history action: clears browsing history while
 * preserving bookmarked places' own rows in `moz_places` (bookmarks live
 * in `moz_bookmarks`, referencing `moz_places` by `fk`, unlike Chrome's
 * separate `Bookmarks` JSON file -- so no external file needs to be read
 * or parsed here). Every table beyond `moz_places` is existence-checked
 * before being touched. */
export async function execute(action, ruleName, guards = {}) {
  if (!existsSync(action.expandedPath)) {
    return { freedBytes: 0, skipped: [] };
  }
  const before = statSync(action.expandedPath);
  const reason = heldReason(action.expandedPath, before.mtimeMs, guards);
  if (reason) {
    return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason }] };
  }

  const hasPlaces = await sqliteTableExists(action.expandedPath, 'moz_places');
  const hasHistoryVisits = await sqliteTableExists(action.expandedPath, 'moz_historyvisits');
  if (!hasPlaces && !hasHistoryVisits) {
    return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason: 'not a recognized Firefox places database' }] };
  }

  try {
    const manifest = await quarantineFileEdit({
      programName: `Deep Clean: ${ruleName}`,
      filePath: action.expandedPath,
      editFn: async (realPath) => {
        let sql = '';
        if (hasPlaces) {
          sql += `DELETE FROM moz_places WHERE id IN (
            SELECT moz_places.id FROM moz_places
            LEFT JOIN moz_bookmarks ON moz_bookmarks.fk = moz_places.id
            WHERE moz_bookmarks.id IS NULL
          );`;
          sql += 'UPDATE moz_places SET visit_count=0, frecency=-1, last_visit_date=NULL;';
        }
        if (hasPlaces && await sqliteTableExists(realPath, 'moz_annos')) {
          sql += `DELETE FROM moz_annos WHERE id IN (
            SELECT moz_annos.id FROM moz_annos
            LEFT JOIN moz_places ON moz_annos.place_id = moz_places.id
            WHERE moz_places.id IS NULL
          );`;
        }
        if (await sqliteTableExists(realPath, 'moz_historyvisits')) {
          sql += 'DELETE FROM moz_historyvisits;';
        }
        if (hasPlaces && await sqliteTableExists(realPath, 'moz_inputhistory')) {
          sql += 'DELETE FROM moz_inputhistory WHERE place_id NOT IN (SELECT id FROM moz_places);';
        }
        if (await sqliteTableExists(realPath, 'moz_origins')) {
          sql += 'DELETE FROM moz_origins WHERE id NOT IN (SELECT DISTINCT origin_id FROM moz_places);';
          sql += 'UPDATE moz_origins SET frecency=-1;';
        }
        if (await sqliteTableExists(realPath, 'moz_meta')) {
          sql += "DELETE FROM moz_meta WHERE key LIKE 'origin_frecency_%';";
        }
        if (await sqliteTableExists(realPath, 'moz_hosts')) {
          sql += 'DELETE FROM moz_hosts;';
        }
        sql += 'VACUUM;';
        await runSqlViaTempScript(realPath, sql);
      }
    });
    const after = statSync(action.expandedPath).size;
    return { freedBytes: Math.max(0, before.size - after), quarantineBatch: manifest.batchDir, skipped: [] };
  } catch {
    return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason: 'could not clear history: the database may be in use or corrupted' }] };
  }
}
