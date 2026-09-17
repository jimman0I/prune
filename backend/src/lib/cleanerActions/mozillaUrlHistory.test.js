import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scan, execute } from './mozillaUrlHistory.js';
import { sqlite3ExePath } from './sqliteVacuum.js';

const execFileAsync = promisify(execFile);

async function makePlacesDb(filePath) {
  const sql = `
    CREATE TABLE moz_bookmarks (id INTEGER PRIMARY KEY, fk INTEGER);
    CREATE TABLE moz_places (id INTEGER PRIMARY KEY, url LONGVARCHAR, rev_host LONGVARCHAR, title LONGVARCHAR, visit_count INTEGER, frecency INTEGER, last_visit_date INTEGER, favicon_id INTEGER);
    INSERT INTO moz_places (id, url, rev_host, title, visit_count, frecency) VALUES
      (1, 'https://bookmarked.com', 'moc.dekramkoob.', 'Kept', 5, 100),
      (2, 'https://not-bookmarked.com', 'moc.dekramkoobton.', 'Gone', 3, 50);
    INSERT INTO moz_bookmarks (id, fk) VALUES (1, 1);
    CREATE TABLE moz_historyvisits (id INTEGER PRIMARY KEY, place_id INTEGER);
    INSERT INTO moz_historyvisits (id, place_id) VALUES (1, 1), (2, 2);
    CREATE TABLE moz_inputhistory (place_id INTEGER, input VARCHAR);
    INSERT INTO moz_inputhistory (place_id, input) VALUES (2, 'typed text');
    CREATE TABLE moz_annos (id INTEGER PRIMARY KEY, place_id INTEGER, content VARCHAR);
    INSERT INTO moz_annos (id, place_id, content) VALUES (1, 2, 'annotation');
  `;
  await execFileAsync(sqlite3ExePath(), [filePath, sql]);
}

let scratchDir;
let savedEnv;
beforeEach(async () => {
  scratchDir = await mkdtemp(join(tmpdir(), 'prune-mozilla-history-test-'));
  savedEnv = process.env.UNREVO_QUARANTINE_ROOT;
  process.env.UNREVO_QUARANTINE_ROOT = await mkdtemp(join(tmpdir(), 'prune-mozilla-history-qroot-'));
});
afterEach(async () => {
  await rm(scratchDir, { recursive: true, force: true });
  await rm(process.env.UNREVO_QUARANTINE_ROOT, { recursive: true, force: true });
  if (savedEnv === undefined) delete process.env.UNREVO_QUARANTINE_ROOT;
  else process.env.UNREVO_QUARANTINE_ROOT = savedEnv;
});

describe('mozillaUrlHistory scan', () => {
  it('reports present:true for a real places.sqlite', async () => {
    const filePath = join(scratchDir, 'places.sqlite');
    await makePlacesDb(filePath);
    expect(scan({ expandedPath: filePath }).present).toBe(true);
  });
});

describe('mozillaUrlHistory execute', () => {
  it('keeps a bookmarked place, clears everything orphaned by removing the non-bookmarked one', async () => {
    const filePath = join(scratchDir, 'places.sqlite');
    await makePlacesDb(filePath);

    const result = await execute({ expandedPath: filePath }, 'Test Rule', {});

    const places = await execFileAsync(sqlite3ExePath(), [filePath, 'SELECT url, visit_count, frecency FROM moz_places ORDER BY url;']);
    expect(places.stdout.trim()).toBe('https://bookmarked.com|0|-1');

    const visits = await execFileAsync(sqlite3ExePath(), [filePath, 'SELECT COUNT(*) FROM moz_historyvisits;']);
    expect(visits.stdout.trim()).toBe('0');

    const input = await execFileAsync(sqlite3ExePath(), [filePath, 'SELECT COUNT(*) FROM moz_inputhistory;']);
    expect(input.stdout.trim()).toBe('0');

    expect(result.quarantineBatch).toBeTruthy();
  });

  it('skips a file with no moz_places table', async () => {
    const filePath = join(scratchDir, 'places.sqlite');
    await execFileAsync(sqlite3ExePath(), [filePath, 'CREATE TABLE something_else (id INTEGER);']);
    const result = await execute({ expandedPath: filePath }, 'Test Rule', {});
    expect(result.skipped).toHaveLength(1);
  });

  it('really shrinks the file -- proves VACUUM ran', async () => {
    const filePath = join(scratchDir, 'places.sqlite');
    const sql = `
      CREATE TABLE moz_bookmarks (id INTEGER PRIMARY KEY, fk INTEGER);
      CREATE TABLE moz_places (id INTEGER PRIMARY KEY, url LONGVARCHAR, rev_host LONGVARCHAR, title LONGVARCHAR, visit_count INTEGER, frecency INTEGER, last_visit_date INTEGER);
      ` + Array.from({ length: 30 }, (_, i) =>
        `INSERT INTO moz_places (id, url, rev_host, title, visit_count, frecency) VALUES (${i + 1}, 'https://site${i}.example.com/', '.', '${'x'.repeat(150)}${i}', 1, 1);`
      ).join('\n');
    await execFileAsync(sqlite3ExePath(), [filePath, sql]);
    const before = (await (await import('node:fs/promises')).readFile(filePath)).length;

    const result = await execute({ expandedPath: filePath }, 'Test Rule', {});

    const after = (await (await import('node:fs/promises')).readFile(filePath)).length;
    expect(after).toBeLessThan(before);
    expect(result.freedBytes).toBeGreaterThan(0);
  });
});
