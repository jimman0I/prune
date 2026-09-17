import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scan, execute } from './cookie.js';
import { sqlite3ExePath } from './sqliteVacuum.js';

const execFileAsync = promisify(execFile);

async function makeChromiumCookieDb(filePath, rows) {
  // `value` defaults to a short placeholder for every existing caller, but
  // can be overridden per-row -- the real-VACUUM-shrink test below needs
  // enough real bytes in the table that DELETE + VACUUM produces a
  // measurable size reduction, not just a row-count change.
  const values = rows.map(({ host, value = 'value' }) => `('${host}', 'name', '${value}')`).join(',');
  const sql = `CREATE TABLE cookies (host_key TEXT, name TEXT, value TEXT); INSERT INTO cookies (host_key, name, value) VALUES ${values};`;
  await execFileAsync(sqlite3ExePath(), [filePath, sql]);
}

async function makeFirefoxCookieDb(filePath, rows) {
  const values = rows.map(({ host }) => `('${host}', 'name', 'value')`).join(',');
  const sql = `CREATE TABLE moz_cookies (host TEXT, name TEXT, value TEXT); INSERT INTO moz_cookies (host, name, value) VALUES ${values};`;
  await execFileAsync(sqlite3ExePath(), [filePath, sql]);
}

let scratchDir;
let savedEnv;
beforeEach(async () => {
  scratchDir = await mkdtemp(join(tmpdir(), 'prune-cookie-action-test-'));
  savedEnv = process.env.UNREVO_QUARANTINE_ROOT;
  process.env.UNREVO_QUARANTINE_ROOT = await mkdtemp(join(tmpdir(), 'prune-cookie-action-qroot-'));
});
afterEach(async () => {
  await rm(scratchDir, { recursive: true, force: true });
  await rm(process.env.UNREVO_QUARANTINE_ROOT, { recursive: true, force: true });
  if (savedEnv === undefined) delete process.env.UNREVO_QUARANTINE_ROOT;
  else process.env.UNREVO_QUARANTINE_ROOT = savedEnv;
});

describe('cookie scan', () => {
  it('reports present:true and a real size for an existing cookie database', async () => {
    const filePath = join(scratchDir, 'Cookies');
    await makeChromiumCookieDb(filePath, [{ host: 'example.com' }]);
    const result = scan({ expandedPath: filePath });
    expect(result.present).toBe(true);
    expect(result.sizeBytes).toBeGreaterThan(0);
  });

  it('reports present:false, sizeBytes 0, for a missing file', () => {
    const result = scan({ expandedPath: join(scratchDir, 'nope') });
    expect(result.present).toBe(false);
    expect(result.sizeBytes).toBe(0);
  });
});

describe('cookie execute -- empty keep list (whole-file delete)', () => {
  it('quarantines and removes the whole file when settings.cookieKeepList is empty', async () => {
    const filePath = join(scratchDir, 'Cookies');
    await makeChromiumCookieDb(filePath, [{ host: 'example.com' }, { host: 'other.com' }]);
    const before = (await stat(filePath)).size;
    const result = await execute({ expandedPath: filePath }, 'Test Rule', { cookieKeepList: [] });
    expect(await stat(filePath).catch(() => null)).toBeNull();
    expect(result.freedBytes).toBe(before);
    expect(result.quarantineBatch).toBeTruthy();
  });
});

describe('cookie execute -- keep list matches nothing in this file (also whole-file delete)', () => {
  it('deletes the whole file when the keep list is non-empty but nothing in it matches this file\'s cookies', async () => {
    const filePath = join(scratchDir, 'Cookies');
    await makeChromiumCookieDb(filePath, [{ host: 'example.com' }]);
    const result = await execute({ expandedPath: filePath }, 'Test Rule', { cookieKeepList: ['totally-unrelated.com'] });
    expect(await stat(filePath).catch(() => null)).toBeNull();
    expect(result.quarantineBatch).toBeTruthy();
  });
});

describe('cookie execute -- surgical row delete (Chromium schema)', () => {
  it('keeps rows for a kept domain and its subdomains, deletes everything else, quarantines the original', async () => {
    const filePath = join(scratchDir, 'Cookies');
    await makeChromiumCookieDb(filePath, [
      { host: 'example.com' }, { host: 'sub.example.com' },
      { host: 'other.com' }, { host: 'notexample.com' }
    ]);
    const originalBytes = await readFile(filePath);
    const result = await execute({ expandedPath: filePath }, 'Test Rule', { cookieKeepList: ['example.com'] });

    const remaining = await execFileAsync(sqlite3ExePath(), [filePath, 'SELECT host_key FROM cookies ORDER BY host_key;']);
    // The bundled sqlite3.exe CLI on Windows emits CRLF line endings, so a
    // plain split('\n') leaves a trailing '\r' on every line but the last
    // (confirmed live: 'example.com\r' vs 'sub.example.com'). Split on
    // /\r?\n/ to match the CLI's real output rather than assuming Unix
    // line endings.
    const remainingHosts = remaining.stdout.trim().split(/\r?\n/).filter(Boolean);
    expect(remainingHosts).toEqual(['example.com', 'sub.example.com']);
    expect(remainingHosts).not.toContain('notexample.com');

    expect(result.quarantineBatch).toBeTruthy();
    const batchFiles = await (await import('node:fs/promises')).readdir(result.quarantineBatch);
    const quarantinedFile = batchFiles.find((f) => f.startsWith('file-0-'));
    expect(await readFile(join(result.quarantineBatch, quarantinedFile))).toEqual(originalBytes);
    expect(result.freedBytes).toBeGreaterThanOrEqual(0);
  });
});

describe('cookie execute -- surgical row delete really shrinks the file', () => {
  it('produces a measurable size reduction once DELETE + VACUUM reclaim the freed pages, not just a no-op Math.max(0, ...) floor', async () => {
    const filePath = join(scratchDir, 'Cookies');
    // 30 rows x ~600 bytes of real payload each (~18KB of row data,
    // several SQLite pages at the default 4096-byte page size) so that
    // dropping all but one row and running VACUUM has real freed pages to
    // reclaim -- a handful of tiny rows can fit on a single page and would
    // shrink by 0 bytes even if VACUUM silently did nothing.
    const padding = 'x'.repeat(600);
    const bulkRows = Array.from({ length: 30 }, (_, i) => ({
      host: i === 0 ? 'example.com' : `dropped-${i}.com`,
      value: padding
    }));
    await makeChromiumCookieDb(filePath, bulkRows);
    const before = (await stat(filePath)).size;

    const result = await execute({ expandedPath: filePath }, 'Test Rule', { cookieKeepList: ['example.com'] });

    const after = (await stat(filePath)).size;
    expect(after).toBeLessThan(before);
    expect(result.freedBytes).toBeGreaterThan(0);
    expect(result.freedBytes).toBe(before - after);
  });
});

describe('cookie execute -- surgical row delete (Firefox schema)', () => {
  it('detects moz_cookies/host and applies the same keep logic', async () => {
    const filePath = join(scratchDir, 'cookies.sqlite');
    await makeFirefoxCookieDb(filePath, [{ host: 'keep.com' }, { host: 'drop.com' }]);
    await execute({ expandedPath: filePath }, 'Test Rule', { cookieKeepList: ['keep.com'] });
    const remaining = await execFileAsync(sqlite3ExePath(), [filePath, 'SELECT host FROM moz_cookies;']);
    expect(remaining.stdout.trim()).toBe('keep.com');
  });
});

describe('cookie execute -- guards and edge cases', () => {
  it('reports 0 freedBytes for a missing file, no error', async () => {
    const result = await execute({ expandedPath: join(scratchDir, 'nope') }, 'Test Rule', {});
    expect(result.freedBytes).toBe(0);
    expect(result.skipped).toEqual([]);
  });

  it('skips a file that is not a valid cookie database, with a reason, rather than corrupting it', async () => {
    const filePath = join(scratchDir, 'Cookies');
    await writeFile(filePath, 'not a sqlite database at all');
    const result = await execute({ expandedPath: filePath }, 'Test Rule', { cookieKeepList: ['example.com'] });
    expect(result.freedBytes).toBe(0);
    expect(result.skipped).toHaveLength(1);
    expect(await readFile(filePath, 'utf8')).toBe('not a sqlite database at all');
  });

  it('respects excludeFolders', async () => {
    const filePath = join(scratchDir, 'Cookies');
    await makeChromiumCookieDb(filePath, [{ host: 'example.com' }]);
    const result = await execute(
      { expandedPath: filePath }, 'Test Rule', { cookieKeepList: [], excludeFolders: [scratchDir] }
    );
    expect(result.freedBytes).toBe(0);
    expect(result.skipped[0].reason).toMatch(/excluded/);
  });

  it('respects autoQuarantine:false on the whole-file-delete path -- recycles instead', async () => {
    const filePath = join(scratchDir, 'Cookies');
    await makeChromiumCookieDb(filePath, [{ host: 'example.com' }]);
    const result = await execute(
      { expandedPath: filePath }, 'Test Rule', { cookieKeepList: [], autoQuarantine: false }
    );
    expect(result.recycled).toBe(true);
    expect(result.quarantineBatch).toBeUndefined();
  });
});
