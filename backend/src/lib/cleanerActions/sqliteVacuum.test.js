import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { scan, execute, sqlite3ExePath } from './sqliteVacuum.js';

const execFileAsync = promisify(execFile);

let scratchDir;
beforeEach(async () => {
  scratchDir = await mkdtemp(join(tmpdir(), 'prune-vacuum-test-'));
});
afterEach(async () => {
  await rm(scratchDir, { recursive: true, force: true });
});

/** A real SQLite database with real reclaimable free space: insert a lot
 * of rows, then delete most of them. SQLite marks their pages free but
 * does not shrink the file until VACUUM runs -- this is the exact
 * condition the action exists to fix, so the test proves it against a
 * real file rather than asserting on a mock.
 *
 * The SQL script is written to a temp file and run via sqlite3's `.read`
 * meta-command rather than passed as a raw argv string: at this row
 * count the script is ~250KB, which blows past Windows's ~32K
 * CreateProcess command-line limit (spawn ENAMETOOLONG) when passed
 * directly as an argument. `.read <file>` keeps the argv tiny while
 * running the exact same SQL. */
async function makeBloatedDb(path) {
  const sql = [
    'CREATE TABLE t (id INTEGER PRIMARY KEY, data TEXT);',
    ...Array.from({ length: 500 }, (_, i) => `INSERT INTO t (data) VALUES ('${'x'.repeat(500)}-${i}');`),
    'DELETE FROM t WHERE id % 2 = 0;'
  ].join('\n');
  const scriptPath = join(scratchDir, 'setup.sql');
  await writeFile(scriptPath, sql, 'utf8');
  await execFileAsync(sqlite3ExePath(), [path, `.read ${scriptPath}`]);
}

describe('sqlite.vacuum scan', () => {
  it('reports the file\'s current size as the (upper-bound) reclaimable amount', async () => {
    const dbPath = join(scratchDir, 'test.db');
    await makeBloatedDb(dbPath);
    const { size: realSize } = await stat(dbPath);

    const result = scan({ expandedPath: dbPath });

    expect(result.sizeBytes).toBe(realSize);
    expect(result.present).toBe(true);
  });

  it('reports present:false for a file that does not exist', () => {
    const result = scan({ expandedPath: join(scratchDir, 'nope.db') });
    expect(result.present).toBe(false);
    expect(result.sizeBytes).toBe(0);
  });
});

describe('sqlite.vacuum execute', () => {
  it('shrinks a real bloated database and reports the real byte delta', async () => {
    const dbPath = join(scratchDir, 'test.db');
    await makeBloatedDb(dbPath);
    const { size: before } = await stat(dbPath);

    const result = await execute({ expandedPath: dbPath });
    const { size: after } = await stat(dbPath);

    expect(after).toBeLessThan(before);
    expect(result.freedBytes).toBe(before - after);
    expect(result.freedBytes).toBeGreaterThan(0);
    expect(result.skipped).toEqual([]);
  });

  it('never reports a negative freedBytes when nothing shrinks', async () => {
    const dbPath = join(scratchDir, 'empty.db');
    await execFileAsync(sqlite3ExePath(), [dbPath, 'CREATE TABLE t (id INTEGER);']);

    const result = await execute({ expandedPath: dbPath });

    expect(result.freedBytes).toBeGreaterThanOrEqual(0);
  });

  it('skips a file that is not actually a SQLite database, with a reason, rather than corrupting it', async () => {
    const notADb = join(scratchDir, 'notadb.db');
    await writeFile(notADb, 'this is plain text, not a SQLite file', 'utf8');
    const before = await stat(notADb);

    const result = await execute({ expandedPath: notADb });
    const after = await stat(notADb);

    expect(result.freedBytes).toBe(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].path).toBe(notADb);
    expect(after.size).toBe(before.size); // untouched
  });

  it('reports 0 freedBytes and no error for a file that does not exist', async () => {
    const result = await execute({ expandedPath: join(scratchDir, 'nope.db') });
    expect(result.freedBytes).toBe(0);
    expect(result.skipped).toEqual([]);
  });

  it('respects excludeExtensions -- the same guard a delete action would honor', async () => {
    const dbPath = join(scratchDir, 'test.db');
    await makeBloatedDb(dbPath);
    const { size: before } = await stat(dbPath);

    const result = await execute({ expandedPath: dbPath }, { excludeExtensions: ['.db'] });
    const { size: after } = await stat(dbPath);

    expect(result.freedBytes).toBe(0);
    expect(result.skipped[0].reason).toMatch(/excluded/);
    expect(after.size).toBe(before.size); // untouched
  });

  it('respects skipRecentHours -- refuses a file modified inside the window', async () => {
    const dbPath = join(scratchDir, 'test.db');
    await makeBloatedDb(dbPath); // just written -- well inside any positive window

    const result = await execute({ expandedPath: dbPath }, { skipRecentHours: 24 });

    expect(result.freedBytes).toBe(0);
    expect(result.skipped[0].reason).toMatch(/recently/);
  });

  it('is exempt from autoQuarantine -- vacuums even with autoQuarantine: false, since nothing is deleted', async () => {
    const dbPath = join(scratchDir, 'test.db');
    await makeBloatedDb(dbPath);
    const { size: before } = await stat(dbPath);

    const result = await execute({ expandedPath: dbPath }, { autoQuarantine: false });
    const { size: after } = await stat(dbPath);

    expect(after).toBeLessThan(before);
    expect(result.freedBytes).toBeGreaterThan(0);
  });
});
