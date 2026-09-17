import { existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join } from 'node:path';
import { isExcluded, isTooRecent } from '../cleanGuards.js';
import { sqlite3ExePath } from './sqliteVacuum.js';
import { sqliteTableExists } from './sqliteInspect.js';
import { escapeSqlString } from './cookieSql.js';
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

/** Collects every URL string bookmarked in a Chrome/Chromium `Bookmarks`
 * JSON file, walking `roots` recursively (folders have `children`, a
 * bookmark node has `type: "url"` and its own `url`). Returns an empty
 * array if the file doesn't exist or isn't valid JSON. */
async function collectBookmarkUrls(historyPath) {
  const bookmarksPath = join(dirname(historyPath), 'Bookmarks');
  if (!existsSync(bookmarksPath)) return [];
  try {
    const data = JSON.parse(await readFile(bookmarksPath, 'utf8'));
    const urls = [];
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'folder' && Array.isArray(node.children)) {
        for (const child of node.children) walk(child);
      } else if (node.type === 'url' && typeof node.url === 'string') {
        urls.push(node.url);
      }
    };
    for (const root of Object.values(data.roots ?? {})) walk(root);
    return urls;
  } catch {
    return [];
  }
}

/** Scans a chrome.history action: the History file's current size, an
 * upper bound on what clearing browsing history could reclaim. */
export function scan(action) {
  if (!existsSync(action.expandedPath)) {
    return { sizeBytes: 0, present: false };
  }
  return { sizeBytes: statSync(action.expandedPath).size, present: true };
}

/** Executes a chrome.history action: clears browsing history while
 * preserving bookmarked URLs' own rows in `urls` -- everything else
 * clears unconditionally. Every table beyond `urls` is existence-checked
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

  const hasUrls = await sqliteTableExists(action.expandedPath, 'urls');
  if (!hasUrls) {
    return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason: 'not a recognized Chrome History file' }] };
  }

  try {
    const manifest = await quarantineFileEdit({
      programName: `Deep Clean: ${ruleName}`,
      filePath: action.expandedPath,
      editFn: async (realPath) => {
        const bookmarkUrls = await collectBookmarkUrls(realPath);
        let urlsWhere = '';
        if (bookmarkUrls.length > 0) {
          const list = bookmarkUrls.map((u) => `'${escapeSqlString(u)}'`).join(',');
          urlsWhere = ` WHERE url NOT IN (${list})`;
        }
        let sql = `DELETE FROM urls${urlsWhere};`;
        for (const table of ['visits', 'keyword_search_terms', 'downloads', 'segments', 'segment_usage']) {
          if (await sqliteTableExists(realPath, table)) sql += `DELETE FROM ${table};`;
        }
        sql += 'VACUUM;';
        await execFileAsync(sqlite3ExePath(), [realPath, sql]);
      }
    });
    const after = statSync(action.expandedPath).size;
    return { freedBytes: Math.max(0, before.size - after), quarantineBatch: manifest.batchDir, skipped: [] };
  } catch {
    return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason: 'could not clear history: the database may be in use or corrupted' }] };
  }
}
