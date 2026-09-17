import { existsSync, statSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isExcluded, isTooRecent } from '../cleanGuards.js';
import { sqlite3ExePath } from './sqliteVacuum.js';
import { sqliteTableExists } from './sqliteInspect.js';
import { quarantineFileEdit } from '../../services/quarantine.js';

const execFileAsync = promisify(execFile);

function heldReason(expandedPath, mtimeMs, guards) {
  if (isExcluded(expandedPath, guards.excludeFolders, guards.excludeExtensions)) {
    return 'excluded by your own settings';
  }
  if (isTooRecent(mtimeMs, guards.skipRecentHours)) {
    return 'modified too recently';
  }
  return null;
}

/** Scans a chrome.keywords action: the Web Data file's current size, an
 * upper bound on what clearing user-added search engines could reclaim. */
export function scan(action) {
  if (!existsSync(action.expandedPath)) {
    return { sizeBytes: 0, present: false };
  }
  return { sizeBytes: statSync(action.expandedPath).size, present: true };
}

/** Executes a chrome.keywords action: deletes only user-added search
 * engines (`date_created != 0`, BleachBit's own predicate for "not a
 * browser-shipped default engine") from the `keywords` table, resets
 * `usage_count` on what's left, and does the same to `keywords_backup`
 * when that table exists (old Chrome only -- confirmed absent on a
 * current real Web Data file, so its absence is the normal case, not an
 * error). Then VACUUMs, quarantining the original first. A file with no
 * `keywords` table (wrong file) is skipped with a reason, never
 * touched. */
export async function execute(action, ruleName, guards = {}) {
  if (!existsSync(action.expandedPath)) {
    return { freedBytes: 0, skipped: [] };
  }
  const before = statSync(action.expandedPath);
  const reason = heldReason(action.expandedPath, before.mtimeMs, guards);
  if (reason) {
    return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason }] };
  }

  const hasTable = await sqliteTableExists(action.expandedPath, 'keywords');
  if (!hasTable) {
    return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason: 'not a recognized Chrome Web Data file' }] };
  }

  try {
    const manifest = await quarantineFileEdit({
      programName: `Deep Clean: ${ruleName}`,
      filePath: action.expandedPath,
      editFn: async (realPath) => {
        const hasBackup = await sqliteTableExists(realPath, 'keywords_backup');
        let sql = "DELETE FROM keywords WHERE NOT date_created = 0; UPDATE keywords SET usage_count = 0;";
        if (hasBackup) {
          sql += "DELETE FROM keywords_backup WHERE NOT date_created = 0; UPDATE keywords_backup SET usage_count = 0;";
        }
        sql += 'VACUUM;';
        await execFileAsync(sqlite3ExePath(), [realPath, sql]);
      }
    });
    const after = statSync(action.expandedPath).size;
    return { freedBytes: Math.max(0, before.size - after), quarantineBatch: manifest.batchDir, skipped: [] };
  } catch {
    return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason: 'could not clear search engine data: the database may be in use or corrupted' }] };
  }
}
