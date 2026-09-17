import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scan, execute } from './mozillaFavicons.js';
import { sqlite3ExePath } from './sqliteVacuum.js';

const execFileAsync = promisify(execFile);

async function makePlacesDb(filePath) {
  const sql = `
    CREATE TABLE moz_bookmarks (id INTEGER PRIMARY KEY, fk INTEGER);
    CREATE TABLE moz_places (id INTEGER PRIMARY KEY, url LONGVARCHAR);
    INSERT INTO moz_places (id, url) VALUES (1, 'https://bookmarked.com/some/deep/page');
    INSERT INTO moz_bookmarks (id, fk) VALUES (1, 1);
  `;
  await execFileAsync(sqlite3ExePath(), [filePath, sql]);
}

async function makeFaviconsDb(filePath) {
  const sql = `
    CREATE TABLE moz_icons (id INTEGER PRIMARY KEY, icon_url LONGVARCHAR, data BLOB);
    INSERT INTO moz_icons (id, icon_url, data) VALUES
      (1, 'https://bookmarked.com/favicon.ico', x'01'),
      (2, 'https://not-bookmarked.com/favicon.ico', x'02');
    CREATE TABLE moz_pages_w_icons (id INTEGER PRIMARY KEY, page_url LONGVARCHAR);
    INSERT INTO moz_pages_w_icons (id, page_url) VALUES
      (1, 'https://bookmarked.com/some/deep/page'),
      (2, 'https://not-bookmarked.com/');
    CREATE TABLE moz_icons_to_pages (page_id INTEGER, icon_id INTEGER);
    INSERT INTO moz_icons_to_pages (page_id, icon_id) VALUES (1, 1), (2, 2);
  `;
  await execFileAsync(sqlite3ExePath(), [filePath, sql]);
}

let scratchDir;
let savedEnv;
beforeEach(async () => {
  scratchDir = await mkdtemp(join(tmpdir(), 'prune-mozilla-favicons-test-'));
  savedEnv = process.env.UNREVO_QUARANTINE_ROOT;
  process.env.UNREVO_QUARANTINE_ROOT = await mkdtemp(join(tmpdir(), 'prune-mozilla-favicons-qroot-'));
});
afterEach(async () => {
  await rm(scratchDir, { recursive: true, force: true });
  await rm(process.env.UNREVO_QUARANTINE_ROOT, { recursive: true, force: true });
  if (savedEnv === undefined) delete process.env.UNREVO_QUARANTINE_ROOT;
  else process.env.UNREVO_QUARANTINE_ROOT = savedEnv;
});

describe('mozillaFavicons scan', () => {
  it('reports present:true for a real favicons database', async () => {
    const filePath = join(scratchDir, 'favicons.sqlite');
    await makeFaviconsDb(filePath);
    expect(scan({ expandedPath: filePath }).present).toBe(true);
  });
});

describe('mozillaFavicons execute', () => {
  it('keeps the bookmarked page/icon, removes the non-bookmarked one, leaves places.sqlite untouched', async () => {
    await makePlacesDb(join(scratchDir, 'places.sqlite'));
    const filePath = join(scratchDir, 'favicons.sqlite');
    await makeFaviconsDb(filePath);
    const placesBefore = await readFile(join(scratchDir, 'places.sqlite'));

    const result = await execute({ expandedPath: filePath }, 'Test Rule', {});

    const pages = await execFileAsync(sqlite3ExePath(), [filePath, 'SELECT page_url FROM moz_pages_w_icons;']);
    expect(pages.stdout.trim()).toBe('https://bookmarked.com/some/deep/page');

    const placesAfter = await readFile(join(scratchDir, 'places.sqlite'));
    expect(placesAfter).toEqual(placesBefore);

    expect(result.quarantineBatch).toBeTruthy();
  });

  it('skips gracefully when there is no sibling places.sqlite', async () => {
    const filePath = join(scratchDir, 'favicons.sqlite');
    await makeFaviconsDb(filePath);

    const result = await execute({ expandedPath: filePath }, 'Test Rule', {});

    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toMatch(/places/i);
  });

  it('skips a file with no moz_pages_w_icons table', async () => {
    const filePath = join(scratchDir, 'favicons.sqlite');
    await execFileAsync(sqlite3ExePath(), [filePath, 'CREATE TABLE something_else (id INTEGER);']);
    const result = await execute({ expandedPath: filePath }, 'Test Rule', {});
    expect(result.skipped).toHaveLength(1);
  });
});
