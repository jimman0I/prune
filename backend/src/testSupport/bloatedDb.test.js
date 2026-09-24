import { describe, it, expect } from 'vitest';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { bloatedDbSql, makeBloatedDb } from './bloatedDb.js';
import { sqlite3ExePath } from '../lib/cleanerActions/sqliteVacuum.js';

const execFileAsync = promisify(execFile);

describe('bloatedDbSql', () => {
  it('inserts every row inside ONE transaction, so building the fixture costs one commit, not one per row', () => {
    // Without BEGIN/COMMIT SQLite commits each INSERT on its own: a journal
    // file created, written, fsynced and deleted per row. 500 of those took
    // 1.3 s on a dev SSD and long enough on a GitHub Windows runner (every
    // journal create scanned by Defender) to blow a 30 s test timeout and
    // leave sqlite3.exe holding setup.sql open when cleanup tried to
    // delete it (EBUSY). One transaction: 0.06 s, byte-identical database.
    const lines = bloatedDbSql(500).split('\n');

    const begin = lines.indexOf('BEGIN;');
    const commit = lines.indexOf('COMMIT;');
    const inserts = lines.map((line, i) => (line.startsWith('INSERT') ? i : -1)).filter((i) => i >= 0);

    expect(lines.filter((l) => l === 'BEGIN;')).toHaveLength(1);
    expect(lines.filter((l) => l === 'COMMIT;')).toHaveLength(1);
    expect(inserts).toHaveLength(500);
    expect(Math.min(...inserts)).toBeGreaterThan(begin);
    expect(Math.max(...inserts)).toBeLessThan(commit);
  });

  it('deletes half the rows AFTER the commit, which is what leaves free pages for VACUUM to reclaim', () => {
    const lines = bloatedDbSql(10).split('\n');
    expect(lines.indexOf('COMMIT;')).toBeLessThan(lines.findIndex((l) => l.startsWith('DELETE')));
  });
});

describe('makeBloatedDb', () => {
  it('builds a real database that still has free space in it', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'prune-bloated-helper-'));
    try {
      const dbPath = join(dir, 'x.db');
      await makeBloatedDb({ dbPath, scriptPath: join(dir, 'setup.sql'), rows: 300 });

      expect((await stat(dbPath)).size).toBeGreaterThan(0);
      const { stdout } = await execFileAsync(sqlite3ExePath(), [dbPath, 'PRAGMA freelist_count;']);
      expect(Number(stdout.trim())).toBeGreaterThan(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 30000);
});
