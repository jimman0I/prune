import { writeFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sqlite3ExePath } from './sqliteVacuum.js';

const execFileAsync = promisify(execFile);

/** Runs `sql` against the database at `dbPath` via sqlite3.exe's `.read`
 * meta-command rather than passing the SQL as a raw argv string.
 *
 * A real user's bookmark list can run into the hundreds or low thousands
 * of entries; at real-world escaped-URL lengths a `WHERE url NOT IN
 * (...)` list alone can cross Windows's ~32,767-char CreateProcess
 * command-line limit (spawn ENAMETOOLONG) well within that range. A
 * cross-database ATTACH query (mozillaFavicons.js) can also produce a
 * moderately long combined SQL string. Writing the script to a temp file
 * keeps argv tiny regardless of how large the generated SQL gets -- the
 * same fix `sqliteVacuum.test.js` already uses for its own oversized
 * setup script, applied here in production code. The temp file is always
 * removed afterward, even if the SQL itself throws.
 *
 * Extracted from chromeHistory.js, mozillaUrlHistory.js, and
 * mozillaFavicons.js, which each carried an identical copy of this
 * function under their own per-module temp-file prefix; this is the
 * single shared implementation all three now call, under one consistent
 * prefix. */
export async function runSqlViaTempScript(dbPath, sql) {
  const scriptPath = join(tmpdir(), `prune-sqlite-exec-${process.pid}-${randomUUID()}.sql`);
  try {
    await writeFile(scriptPath, sql, 'utf8');
    await execFileAsync(sqlite3ExePath(), [dbPath, `.read ${scriptPath}`]);
  } finally {
    await rm(scriptPath, { force: true });
  }
}
