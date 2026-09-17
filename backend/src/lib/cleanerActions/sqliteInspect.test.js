import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sqliteTableExists } from './sqliteInspect.js';
import { sqlite3ExePath } from './sqliteVacuum.js';

const execFileAsync = promisify(execFile);
let scratchDir;
beforeEach(async () => { scratchDir = await mkdtemp(join(tmpdir(), 'prune-sqlite-inspect-test-')); });
afterEach(async () => { await rm(scratchDir, { recursive: true, force: true }); });

describe('sqliteTableExists', () => {
  it('returns true when the table genuinely exists', async () => {
    const filePath = join(scratchDir, 'db.sqlite');
    await execFileAsync(sqlite3ExePath(), [filePath, 'CREATE TABLE urls (id INTEGER);']);
    expect(await sqliteTableExists(filePath, 'urls')).toBe(true);
  });

  it('returns false when the table does not exist', async () => {
    const filePath = join(scratchDir, 'db.sqlite');
    await execFileAsync(sqlite3ExePath(), [filePath, 'CREATE TABLE urls (id INTEGER);']);
    expect(await sqliteTableExists(filePath, 'visits')).toBe(false);
  });

  it('returns false (not a throw) for a file that is not a valid database', async () => {
    const filePath = join(scratchDir, 'notadb.txt');
    await (await import('node:fs/promises')).writeFile(filePath, 'plain text');
    expect(await sqliteTableExists(filePath, 'urls')).toBe(false);
  });

  it('a file too small for a full SQLite header returns false and never invokes sqlite3.exe (no stray junk file)', async () => {
    // This is the exact regression case: sqlite3.exe, when pointed at a file too
    // small/malformed to fail its "not a valid database" check cleanly, prints a
    // swallowed parse error but exits 0 AND silently creates a new, empty SQLite
    // database file in the process's CWD, named after the SQL query text itself.
    const filePath = join(scratchDir, 'tiny.db');
    await writeFile(filePath, 'short'); // 5 bytes, well under the 16-byte magic header
    const cwdBefore = await readdir(process.cwd());

    expect(await sqliteTableExists(filePath, 'urls')).toBe(false);

    const cwdAfter = await readdir(process.cwd());
    expect(cwdAfter).toEqual(cwdBefore);
    expect(cwdAfter.some((name) => name.startsWith('SELECT '))).toBe(false);
  });

  it('a file with a genuine SQLite magic header but garbage content beyond it still falls through to sqlite3.exe', async () => {
    const filePath = join(scratchDir, 'fakedb.db');
    // Real 16-byte magic header followed by garbage -- not a byte-for-byte valid
    // database, but enough to pass our header pre-check and reach the CLI.
    await writeFile(filePath, Buffer.concat([Buffer.from('SQLite format 3\0', 'latin1'), Buffer.from('garbage garbage garbage')]));
    expect(await sqliteTableExists(filePath, 'urls')).toBe(false);
  });
});
