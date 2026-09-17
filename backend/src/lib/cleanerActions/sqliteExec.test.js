import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sqlite3ExePath } from './sqliteVacuum.js';
import { runSqlViaTempScript } from './sqliteExec.js';

const execFileAsync = promisify(execFile);

// `runSqlViaTempScript` names its temp script from `randomUUID()`, which
// this test pins to a fixed value so it can assert on ONE specific path
// rather than diffing the whole shared `os.tmpdir()` -- three other
// cleaner modules' own test files (chromeHistory/mozillaUrlHistory/
// mozillaFavicons) call this same shared function and, under vitest's
// parallel test-file execution, can transiently have their own
// `prune-sqlite-exec-*.sql` scripts present in that same directory at the
// exact moment a directory-diff assertion here would run -- a real flake
// this test hit once extraction made the temp-file prefix shared. Pinning
// the UUID keeps this test's assertion scoped to the one file IT created,
// immune to what sibling test files are doing concurrently in the same
// OS temp directory.
vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, randomUUID: () => 'sqliteexec-test-fixed-uuid' };
});

const expectedScriptPath = join(tmpdir(), `prune-sqlite-exec-${process.pid}-sqliteexec-test-fixed-uuid.sql`);

let scratchDir;
beforeEach(async () => {
  scratchDir = await mkdtemp(join(tmpdir(), 'prune-sqlite-exec-scratch-'));
  await rm(expectedScriptPath, { force: true });
});
afterEach(async () => {
  await rm(scratchDir, { recursive: true, force: true });
  await rm(expectedScriptPath, { force: true });
});

describe('runSqlViaTempScript', () => {
  it('executes real SQL against a real SQLite file via a temp .read script, then cleans the script up', async () => {
    const filePath = join(scratchDir, 'test.sqlite');
    await execFileAsync(sqlite3ExePath(), [filePath, 'CREATE TABLE t (id INTEGER PRIMARY KEY, val TEXT);']);

    expect(existsSync(expectedScriptPath)).toBe(false);
    await runSqlViaTempScript(filePath, "INSERT INTO t (id, val) VALUES (1, 'hello');");

    const result = await execFileAsync(sqlite3ExePath(), [filePath, 'SELECT val FROM t WHERE id = 1;']);
    expect(result.stdout.trim()).toBe('hello');

    // The temp script this specific call wrote (its path is deterministic
    // because randomUUID is pinned above) is gone afterward.
    expect(existsSync(expectedScriptPath)).toBe(false);
  });

  it('still cleans up the temp script when the SQL throws (invalid database)', async () => {
    const filePath = join(scratchDir, 'not-a-database.sqlite');
    await writeFile(filePath, 'this is not a sqlite file', 'utf8');

    await expect(runSqlViaTempScript(filePath, 'CREATE TABLE t (id INTEGER);')).rejects.toThrow();

    expect(existsSync(expectedScriptPath)).toBe(false);
  });
});
