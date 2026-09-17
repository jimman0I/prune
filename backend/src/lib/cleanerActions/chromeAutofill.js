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

/** Scans a chrome.autofill action: the Web Data file's current size, an
 * upper bound on what clearing the autofill table could reclaim. */
export function scan(action) {
  if (!existsSync(action.expandedPath)) {
    return { sizeBytes: 0, present: false };
  }
  return { sizeBytes: statSync(action.expandedPath).size, present: true };
}

/** Executes a chrome.autofill action: clears the `autofill` table (raw
 * form-field value history) and VACUUMs, quarantining the original
 * first. Scoped to ONLY this table -- see the design spec for why the
 * saved-profile/address tables BleachBit's own version also touches are
 * deliberately excluded (they don't exist under those names in the
 * current Chrome schema; the real current equivalent is a different,
 * riskier feature). A file with no `autofill` table (wrong file, or a
 * Web Data file from a version old enough not to have it) is skipped
 * with a reason, never touched. */
export async function execute(action, ruleName, guards = {}) {
  if (!existsSync(action.expandedPath)) {
    return { freedBytes: 0, skipped: [] };
  }
  const before = statSync(action.expandedPath);
  const reason = heldReason(action.expandedPath, before.mtimeMs, guards);
  if (reason) {
    return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason }] };
  }

  const hasTable = await sqliteTableExists(action.expandedPath, 'autofill');
  if (!hasTable) {
    return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason: 'not a recognized Chrome Web Data file' }] };
  }

  try {
    const manifest = await quarantineFileEdit({
      programName: `Deep Clean: ${ruleName}`,
      filePath: action.expandedPath,
      editFn: async (realPath) => {
        await execFileAsync(sqlite3ExePath(), [realPath, 'DELETE FROM autofill; VACUUM;']);
      }
    });
    const after = statSync(action.expandedPath).size;
    return { freedBytes: Math.max(0, before.size - after), quarantineBatch: manifest.batchDir, skipped: [] };
  } catch {
    return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason: 'could not clear autofill data: the database may be in use or corrupted' }] };
  }
}
