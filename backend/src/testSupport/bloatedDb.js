import { writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { sqlite3ExePath } from '../lib/cleanerActions/sqliteVacuum.js';

const execFileAsync = promisify(execFile);

/** SQL for a real SQLite database with real reclaimable free space: insert
 * a lot of rows, then delete every other one. The deleted rows' pages are
 * marked free but the file does not shrink until VACUUM runs -- exactly the
 * condition sqlite.vacuum exists to fix, so tests prove it against a real
 * file instead of a mock.
 *
 * The inserts sit inside ONE transaction. Left to autocommit, SQLite
 * commits every INSERT separately: a rollback journal created, written,
 * fsynced and deleted per row. For 500 rows that is 1.3 s on a dev SSD and
 * far longer on a GitHub Windows runner, where every journal create is also
 * scanned by Defender -- long enough to hit vitest's 30 s timeout with
 * sqlite3.exe still holding setup.sql open, so cleanup then failed with
 * EBUSY. One transaction takes 0.06 s and produces a byte-identical
 * database, so nothing about what the tests assert changes.
 *
 * The DELETE stays outside the transaction on purpose: it only has to
 * happen after the rows are committed for the pages to be freed. */
export function bloatedDbSql(rows = 500) {
  return [
    'CREATE TABLE t (id INTEGER PRIMARY KEY, data TEXT);',
    'BEGIN;',
    ...Array.from({ length: rows }, (_, i) => `INSERT INTO t (data) VALUES ('${'x'.repeat(500)}-${i}');`),
    'COMMIT;',
    'DELETE FROM t WHERE id % 2 = 0;'
  ].join('\n');
}

/** Builds the database at `dbPath`. The script goes through a file and
 * sqlite3's `.read` rather than argv: at this size it is ~250 KB, past
 * Windows's ~32 KB CreateProcess command-line limit (spawn ENAMETOOLONG). */
export async function makeBloatedDb({ dbPath, scriptPath, rows = 500 }) {
  await writeFile(scriptPath, bloatedDbSql(rows), 'utf8');
  await execFileAsync(sqlite3ExePath(), [dbPath, `.read ${scriptPath}`]);
}
