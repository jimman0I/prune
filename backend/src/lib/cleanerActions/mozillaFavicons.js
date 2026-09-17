import { existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { isExcluded, isTooRecent } from '../cleanGuards.js';
import { sqliteTableExists } from './sqliteInspect.js';
import { escapeSqlString } from './cookieSql.js';
import { runSqlViaTempScript } from './sqliteExec.js';
import { quarantineFileEdit } from '../../services/quarantine.js';

/** Firefox/Firefox-family `favicons.sqlite` cleaner, ported from
 * BleachBit's real `delete_mozilla_favicons()`. This is the most involved
 * cleaner in this phase: favicons.sqlite cross-references bookmarked page
 * URLs from a SIBLING `places.sqlite` file (same directory) via a
 * read-only `ATTACH DATABASE` -- places.sqlite itself is never written to
 * and never quarantined, since nothing in it changes. Verified for real
 * (not assumed) that ATTACH DATABASE works correctly when the attaching
 * statement and the queries that use it are both run through sqlite3.exe's
 * `.read <tempfile>` meta-command rather than as a raw argv string: the
 * attached schema persists for the rest of that `.read`'d script, exactly
 * as it would for a single interactive session, including with an
 * absolute Windows backslash path in the ATTACH literal. NOTE: this schema
 * was NOT independently re-verified against a live current Firefox
 * install on this machine (none available) -- it's ported from
 * BleachBit's documented schema as-is, same honest caveat as
 * mozillaUrlHistory.js. Page-level bookmark matching (keep exactly a
 * bookmarked page's own icon) rather than BleachBit's own domain-level
 * refinement -- a deliberate, safe scope decision for this phase. */

function heldReason(expandedPath, mtimeMs, guards) {
  if (isExcluded(expandedPath, guards.excludeFolders, guards.excludeExtensions)) {
    return 'excluded by your own settings';
  }
  if (isTooRecent(mtimeMs, guards.skipRecentHours)) {
    return 'modified too recently';
  }
  return null;
}

/** Scans a mozilla.favicons action: the favicons.sqlite file's current
 * size, an upper bound on what clearing unbookmarked favicons could
 * reclaim. */
export function scan(action) {
  if (!existsSync(action.expandedPath)) {
    return { sizeBytes: 0, present: false };
  }
  return { sizeBytes: statSync(action.expandedPath).size, present: true };
}

/** Executes a mozilla.favicons action: removes favicon entries for pages
 * that are not bookmarked, cross-referencing a SIBLING places.sqlite
 * (same directory) via a read-only ATTACH -- places.sqlite is never
 * written to and never quarantined, since nothing in it changes. Every
 * table beyond `moz_pages_w_icons` is existence-checked before being
 * touched, matching mozillaUrlHistory.js's own defensive convention for
 * tables that don't exist on all Firefox versions. */
export async function execute(action, ruleName, guards = {}) {
  if (!existsSync(action.expandedPath)) {
    return { freedBytes: 0, skipped: [] };
  }
  const before = statSync(action.expandedPath);
  const reason = heldReason(action.expandedPath, before.mtimeMs, guards);
  if (reason) {
    return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason }] };
  }

  const hasIcons = await sqliteTableExists(action.expandedPath, 'moz_pages_w_icons');
  if (!hasIcons) {
    return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason: 'not a recognized Firefox favicons database' }] };
  }

  const placesPath = join(dirname(action.expandedPath), 'places.sqlite');
  if (!existsSync(placesPath)) {
    return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason: 'no sibling places.sqlite found to check bookmarks against' }] };
  }

  try {
    const manifest = await quarantineFileEdit({
      programName: `Deep Clean: ${ruleName}`,
      filePath: action.expandedPath,
      editFn: async (realPath) => {
        const escapedPlaces = escapeSqlString(placesPath);
        const bookmarkedUrlsQuery =
          `SELECT url FROM places.moz_places WHERE id IN (SELECT DISTINCT fk FROM places.moz_bookmarks WHERE fk IS NOT NULL)`;
        let sql = `ATTACH DATABASE '${escapedPlaces}' AS places;`;
        sql += `DELETE FROM moz_pages_w_icons WHERE page_url NOT IN (${bookmarkedUrlsQuery});`;
        if (await sqliteTableExists(realPath, 'moz_icons_to_pages')) {
          sql += `DELETE FROM moz_icons_to_pages WHERE page_id NOT IN (SELECT id FROM moz_pages_w_icons);`;
        }
        if (await sqliteTableExists(realPath, 'moz_icons') && await sqliteTableExists(realPath, 'moz_icons_to_pages')) {
          sql += `DELETE FROM moz_icons WHERE id NOT IN (SELECT icon_id FROM moz_icons_to_pages);`;
        }
        sql += 'VACUUM;';
        await runSqlViaTempScript(realPath, sql);
      }
    });
    const after = statSync(action.expandedPath).size;
    return { freedBytes: Math.max(0, before.size - after), quarantineBatch: manifest.batchDir, skipped: [] };
  } catch {
    return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason: 'could not clear favicons: the database may be in use or corrupted' }] };
  }
}
