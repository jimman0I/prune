import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { open } from 'node:fs/promises';
import { sqlite3ExePath } from './sqliteVacuum.js';

const execFileAsync = promisify(execFile);

/** Every valid SQLite database file starts with this exact 16-byte,
 * null-terminated ASCII header. https://www.sqlite.org/fileformat.html#the_database_header */
const SQLITE_MAGIC_HEADER = 'SQLite format 3\0';

/** True if the file at `dbPath` starts with the real SQLite file magic
 * header. Deliberately does NOT shell out to sqlite3.exe -- the CLI has
 * a confirmed bug where pointing it at a file that's too small/malformed
 * to fail its "not a valid database" check cleanly (e.g. an 11-byte text
 * file) makes it exit 0 AND silently create a new, empty SQLite database
 * file in the process's current working directory, named after the SQL
 * query text itself. Checking the header ourselves first avoids ever
 * invoking the CLI on a file that would trigger that bug. */
async function hasSqliteMagicHeader(dbPath) {
  let handle;
  try {
    handle = await open(dbPath, 'r');
    const buffer = Buffer.alloc(SQLITE_MAGIC_HEADER.length);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return bytesRead === buffer.length && buffer.toString('latin1') === SQLITE_MAGIC_HEADER;
  } catch {
    return false;
  } finally {
    await handle?.close();
  }
}

/** True if `tableName` genuinely exists in the SQLite database at
 * `dbPath`, false for a missing table OR a file that isn't a valid
 * SQLite database at all (never throws for the latter -- every caller in
 * this phase treats "not a real database" and "the table just isn't
 * there" the same way: nothing to do). `tableName` must be a fixed,
 * hardcoded string from the CALLER (never end-user input) -- this
 * function interpolates it directly into SQL text handed to the
 * sqlite3.exe CLI, which has no parameter-binding mode over its
 * command-line interface, same constraint cookie.js's own table
 * detection already documented and relies on in Phase C. */
export async function sqliteTableExists(dbPath, tableName) {
  if (!(await hasSqliteMagicHeader(dbPath))) return false;
  try {
    const { stdout } = await execFileAsync(
      sqlite3ExePath(),
      [dbPath, `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}';`]
    );
    return stdout.trim() === tableName;
  } catch {
    return false;
  }
}
