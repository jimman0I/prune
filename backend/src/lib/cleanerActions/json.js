import { existsSync, statSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { isExcluded, isTooRecent } from '../cleanGuards.js';
import { resolveAddress } from './jsonAddress.js';
import { quarantineFileEdit } from '../../services/quarantine.js';
import { sendToRecycleBin } from '../../services/recycleBin.js';

/** Same two guards sqlite.vacuum's own execute applies to the one file it
 * touches -- see sqliteVacuum.js's own heldReason for the reasoning. The
 * reason strings are shared on purpose: callers/tests key off 'excluded'
 * and 'recently' regardless of which action produced them. */
function heldReason(expandedPath, mtimeMs, guards) {
  if (isExcluded(expandedPath, guards.excludeFolders, guards.excludeExtensions)) {
    return 'excluded by your own settings';
  }
  if (isTooRecent(mtimeMs, guards.skipRecentHours)) {
    return 'modified too recently';
  }
  return null;
}

/** Scans a `json` action: does the BleachBit-style `address` genuinely
 * resolve inside the file right now? Never throws -- a missing file, an
 * unreadable file, or invalid JSON all just mean `present: false`, the
 * same "absence is not an error" contract sqlite.vacuum's scan follows
 * for a missing database file. Uses `readFileSync`, not `require()` --
 * this module is ESM like every other file in cleanerActions/. */
export function scan(action) {
  if (!existsSync(action.expandedPath)) {
    return { sizeBytes: 0, present: false };
  }
  const sizeBytes = statSync(action.expandedPath).size;
  try {
    const parsed = JSON.parse(readFileSync(action.expandedPath, 'utf8'));
    return { sizeBytes, present: resolveAddress(parsed, action.address) !== null };
  } catch {
    return { sizeBytes, present: false };
  }
}

/** Executes a `json` action: deletes the one key `address` names from the
 * parsed file and rewrites it -- never a whole-file delete, since the
 * rest of the file's data (siblings, other settings) must survive.
 *
 * A missing file, an address that doesn't resolve, and a file that isn't
 * valid JSON are all reported without throwing -- "nothing to clean" and
 * "can't safely touch this" are both normal outcomes, matching
 * sqlite.vacuum's own contract for a file it can't safely VACUUM.
 *
 * The two guards (`excludeFolders`/`excludeExtensions` via `isExcluded`,
 * `skipRecentHours` via `isTooRecent`) apply exactly as they do to
 * sqlite.vacuum's one file. `autoQuarantine` DOES apply here, unlike
 * sqlite.vacuum -- this action can genuinely quarantine the original
 * (unlike an in-place VACUUM, there's a clean "before" to save), so
 * `autoQuarantine: false` sends that original to the Recycle Bin instead
 * of Prune's own quarantine store. */
export async function execute(action, ruleName, guards = {}) {
  if (!existsSync(action.expandedPath)) {
    return { freedBytes: 0, skipped: [] };
  }

  const before = statSync(action.expandedPath);
  const reason = heldReason(action.expandedPath, before.mtimeMs, guards);
  if (reason) {
    return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason }] };
  }

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(action.expandedPath, 'utf8'));
  } catch (err) {
    return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason: `not valid JSON: ${err.message}` }] };
  }

  const resolved = resolveAddress(parsed, action.address);
  if (!resolved) {
    return { freedBytes: 0, skipped: [] };
  }

  delete resolved.parent[resolved.key];
  const newContent = JSON.stringify(parsed);

  if (guards.autoQuarantine === false) {
    const recycleResult = await sendToRecycleBin([action.expandedPath]);
    if (!recycleResult.recycled.includes(action.expandedPath)) {
      return {
        freedBytes: 0,
        skipped: [{
          path: action.expandedPath,
          reason: `failed to send to Recycle Bin: ${recycleResult.error || 'the operation did not report success'}`
        }]
      };
    }
    await writeFile(action.expandedPath, newContent, 'utf8');
    const after = statSync(action.expandedPath).size;
    return { freedBytes: Math.max(0, before.size - after), recycled: true, skipped: [] };
  }

  const manifest = await quarantineFileEdit({
    programName: `Deep Clean: ${ruleName}`,
    filePath: action.expandedPath,
    newContent
  });
  const after = statSync(action.expandedPath).size;
  return { freedBytes: Math.max(0, before.size - after), quarantineBatch: manifest.batchDir, skipped: [] };
}
