import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
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
});
