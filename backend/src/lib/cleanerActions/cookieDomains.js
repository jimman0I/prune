import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { loadCleanerRules, normalizeRule, expandPath, resolveBespokeActionPaths } from '../cleanerRules.js';
import { sqlite3ExePath } from './sqliteVacuum.js';
import { normalizeDomain } from './cookieSql.js';
import { detectCookieTable } from './cookie.js';

const execFileAsync = promisify(execFile);

/** Every real cookie database Prune already knows about, via the exact
 * same rule set executeRule/scanRule dispatch against -- cleaners.json's
 * own `cookie`-action rules, glob-resolved across browser profiles the
 * same way a real clean would resolve them. A hardcoded second path list
 * here would drift from cleaners.json the first time someone edits a
 * cookie rule there. */
function cookieDbPaths() {
  return loadCleanerRules()
    .flatMap((rule) => normalizeRule(rule).actions)
    .filter((action) => action.type === 'cookie')
    .flatMap((action) => resolveBespokeActionPaths(expandPath(action.path)));
}

/** Lists every distinct cookie domain found on this machine, with how
 * many cookies each one has, summed across every browser/profile that
 * has any. A file that can't be read as a recognized cookie database
 * (locked, corrupt, not a database at all) is skipped into `errors`
 * rather than aborting the rest -- same non-fatal-per-file posture
 * cookie.js's own execute() already takes for a single file. */
export async function listCookieDomains() {
  const counts = new Map();
  const errors = [];

  for (const dbPath of cookieDbPaths()) {
    if (!existsSync(dbPath)) continue;

    let table;
    try {
      table = await detectCookieTable(dbPath);
    } catch (err) {
      errors.push({ path: dbPath, reason: `not a valid cookie database: ${err.message}` });
      continue;
    }
    if (!table) {
      errors.push({ path: dbPath, reason: 'not a recognized cookie database' });
      continue;
    }

    try {
      const { stdout } = await execFileAsync(
        sqlite3ExePath(),
        [dbPath, `SELECT ${table.hostColumn}, COUNT(*) FROM ${table.tableName} GROUP BY ${table.hostColumn};`]
      );
      // The bundled sqlite3.exe CLI's default list-mode output, one row
      // per line, columns separated by '|' -- same format cookie.test.js
      // already relies on for its own single-column SELECT. lastIndexOf
      // rather than a plain split: a host value could theoretically
      // contain '|', and the count is always the last field regardless.
      for (const line of stdout.trim().split(/\r?\n/).filter(Boolean)) {
        const sep = line.lastIndexOf('|');
        if (sep === -1) continue;
        const host = line.slice(0, sep);
        const count = parseInt(line.slice(sep + 1), 10);
        if (!host || Number.isNaN(count)) continue;
        const domain = normalizeDomain(host);
        counts.set(domain, (counts.get(domain) ?? 0) + count);
      }
    } catch (err) {
      errors.push({ path: dbPath, reason: `could not read cookies: ${err.message}` });
    }
  }

  const domains = [...counts.entries()]
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count);

  return { domains, errors };
}
