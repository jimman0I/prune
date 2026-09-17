/** The two real cookie-table shapes BleachBit's own Cookie.py detects --
 * Chromium-family (`cookies`/`host_key`) and Firefox-family
 * (`moz_cookies`/`host`). A cookie action never needs to know which
 * browser wrote the file it's pointed at; it only needs to know which of
 * these two shapes the file actually has. */
export const SQLITE_TABLES = {
  cookies: { tableName: 'cookies', hostColumn: 'host_key' },
  moz_cookies: { tableName: 'moz_cookies', hostColumn: 'host' }
};

/** A query whose output names whichever of the two real cookie tables
 * exists in the database it's run against. The caller (cookie.js) runs
 * this via the bundled sqlite3.exe CLI and reads its stdout. */
export const TABLE_DETECT_SQL =
  `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('cookies', 'moz_cookies');`;

/** Doubles a single quote, SQLite's own escaping rule for a string
 * literal -- this codebase's cookie SQL is built as plain text handed to
 * the sqlite3.exe CLI (which has no parameter-binding mode over its
 * command-line interface, unlike a real driver), so every value that
 * becomes part of a SQL string literal must be escaped this way before
 * being embedded, or a domain containing a quote could break out of its
 * literal. */
export function escapeSqlString(value) {
  return value.replace(/'/g, "''");
}

/** Normalizes one keep-list entry the same way BleachBit's own
 * delete_cookies() does before matching: lowercased, with any single
 * leading dot stripped. */
function normalizeDomain(domain) {
  return domain.replace(/^\./, '').toLowerCase();
}

/** Builds the SQL predicate matching every row whose host is exactly one
 * of `domains`, OR a subdomain of one of them. `domains` must be
 * non-empty; the caller (cookie.js) never calls this with an empty keep
 * list -- an empty list means "delete the whole file", a different code
 * path entirely that never needs a predicate at all. */
export function buildKeepPredicate(domains, hostColumn) {
  const clauses = domains.map((rawDomain) => {
    const domain = escapeSqlString(normalizeDomain(rawDomain));
    return `${hostColumn} = '${domain}' OR ${hostColumn} LIKE '%.${domain}'`;
  });
  return `(${clauses.join(' OR ')})`;
}
