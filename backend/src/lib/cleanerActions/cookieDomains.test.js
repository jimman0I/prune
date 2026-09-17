import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sqlite3ExePath } from './sqliteVacuum.js';

const execFileAsync = promisify(execFile);

/** listCookieDomains reads its rule set via loadCleanerRules(), which
 * normally reads the real cleaners.json. Mocked here so these tests
 * exercise the aggregation/error-handling logic in isolation, against a
 * synthetic rule pointed at a temp directory, rather than depending on
 * the real cleaners.json's exact rule ids or real browser profiles on
 * whatever machine runs this suite. expandPath/resolveBespokeActionPaths
 * stay real (importOriginal), so the real glob-resolution logic is still
 * exercised end to end -- only WHICH rules exist is faked. */
const fixtureRules = [];
vi.mock('../cleanerRules.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, loadCleanerRules: () => fixtureRules };
});

const { listCookieDomains } = await import('./cookieDomains.js');

async function makeChromiumCookieDb(filePath, rows) {
  const values = rows.map(({ host }) => `('${host}', 'name', 'value')`).join(',');
  const sql = `CREATE TABLE cookies (host_key TEXT, name TEXT, value TEXT); INSERT INTO cookies (host_key, name, value) VALUES ${values};`;
  await execFileAsync(sqlite3ExePath(), [filePath, sql]);
}

async function makeFirefoxCookieDb(filePath, rows) {
  const values = rows.map(({ host }) => `('${host}', 'name', 'value')`).join(',');
  const sql = `CREATE TABLE moz_cookies (host TEXT, name TEXT, value TEXT); INSERT INTO moz_cookies (host, name, value) VALUES ${values};`;
  await execFileAsync(sqlite3ExePath(), [filePath, sql]);
}

let scratchDir;
let savedAppData;
beforeEach(async () => {
  scratchDir = await mkdtemp(join(tmpdir(), 'prune-cookie-domains-test-'));
  savedAppData = process.env.APPDATA;
  process.env.APPDATA = scratchDir;
  fixtureRules.length = 0;
});
afterEach(async () => {
  await rm(scratchDir, { recursive: true, force: true });
  if (savedAppData === undefined) delete process.env.APPDATA;
  else process.env.APPDATA = savedAppData;
});

describe('listCookieDomains', () => {
  it('aggregates counts for the same domain across two profiles into one row', async () => {
    const profile1 = join(scratchDir, 'Browser', 'Default');
    const profile2 = join(scratchDir, 'Browser', 'Profile 1');
    await mkdir(profile1, { recursive: true });
    await mkdir(profile2, { recursive: true });
    await makeChromiumCookieDb(join(profile1, 'Cookies'), [{ host: 'example.com' }, { host: 'example.com' }]);
    await makeChromiumCookieDb(join(profile2, 'Cookies'), [{ host: 'example.com' }]);
    fixtureRules.push({
      id: 'test_cookies', category: 'Test', name: 'Test cookies',
      actions: [{ type: 'cookie', path: '%APPDATA%\\Browser\\*\\Cookies' }]
    });

    const result = await listCookieDomains();
    expect(result.domains).toEqual([{ domain: 'example.com', count: 3 }]);
    expect(result.errors).toEqual([]);
  });

  it('detects the Firefox schema too', async () => {
    const filePath = join(scratchDir, 'cookies.sqlite');
    await makeFirefoxCookieDb(filePath, [{ host: 'keep.com' }]);
    fixtureRules.push({
      id: 'test_firefox_cookies', category: 'Test', name: 'Test firefox cookies',
      actions: [{ type: 'cookie', path: '%APPDATA%\\cookies.sqlite' }]
    });

    const result = await listCookieDomains();
    expect(result.domains).toEqual([{ domain: 'keep.com', count: 1 }]);
  });

  it('sorts by count descending', async () => {
    const filePath = join(scratchDir, 'Cookies');
    await makeChromiumCookieDb(filePath, [
      { host: 'a.com' }, { host: 'b.com' }, { host: 'b.com' }, { host: 'b.com' }
    ]);
    fixtureRules.push({
      id: 'test_cookies', category: 'Test', name: 'Test cookies',
      actions: [{ type: 'cookie', path: '%APPDATA%\\Cookies' }]
    });

    const result = await listCookieDomains();
    expect(result.domains).toEqual([{ domain: 'b.com', count: 3 }, { domain: 'a.com', count: 1 }]);
  });

  it('skips a locked/corrupt file into errors rather than throwing', async () => {
    const filePath = join(scratchDir, 'Cookies');
    await writeFile(filePath, 'not a sqlite database at all');
    fixtureRules.push({
      id: 'test_cookies', category: 'Test', name: 'Test cookies',
      actions: [{ type: 'cookie', path: '%APPDATA%\\Cookies' }]
    });

    const result = await listCookieDomains();
    expect(result.domains).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].path).toBe(filePath);
  });

  it('returns empty domains and errors when no cookie files exist anywhere', async () => {
    fixtureRules.push({
      id: 'test_cookies', category: 'Test', name: 'Test cookies',
      actions: [{ type: 'cookie', path: '%APPDATA%\\DoesNotExist\\Cookies' }]
    });
    const result = await listCookieDomains();
    expect(result).toEqual({ domains: [], errors: [] });
  });

  it('normalizes host case and a leading dot the same way buildKeepPredicate matches, so counts merge correctly', async () => {
    const profile1 = join(scratchDir, 'A');
    const profile2 = join(scratchDir, 'B');
    await mkdir(profile1, { recursive: true });
    await mkdir(profile2, { recursive: true });
    await makeChromiumCookieDb(join(profile1, 'Cookies'), [{ host: 'Example.COM' }]);
    await makeChromiumCookieDb(join(profile2, 'Cookies'), [{ host: 'example.com' }]);
    fixtureRules.push(
      { id: 'a', category: 'Test', name: 'A', actions: [{ type: 'cookie', path: '%APPDATA%\\A\\Cookies' }] },
      { id: 'b', category: 'Test', name: 'B', actions: [{ type: 'cookie', path: '%APPDATA%\\B\\Cookies' }] }
    );
    const result = await listCookieDomains();
    expect(result.domains).toEqual([{ domain: 'example.com', count: 2 }]);
  });
});
