import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { sqlite3ExePath } from './sqliteVacuum.js';

const execFileAsync = promisify(execFile);

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
