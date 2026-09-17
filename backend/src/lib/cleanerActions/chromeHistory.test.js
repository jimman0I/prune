import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scan, execute } from './chromeHistory.js';
import { sqlite3ExePath } from './sqliteVacuum.js';

const execFileAsync = promisify(execFile);

async function makeHistoryDb(filePath, urls) {
  const urlValues = urls.map(({ id, url, title }) => `(${id}, '${url}', '${title}', 1, 0, 1700000000, 0)`).join(',');
  const sql = `
    CREATE TABLE urls (id INTEGER PRIMARY KEY, url LONGVARCHAR, title LONGVARCHAR, visit_count INTEGER, typed_count INTEGER, last_visit_time INTEGER, hidden INTEGER);
    INSERT INTO urls VALUES ${urlValues};
    CREATE TABLE visits (id INTEGER PRIMARY KEY, url INTEGER, visit_time INTEGER);
    INSERT INTO visits (id, url, visit_time) VALUES (1, ${urls[0].id}, 1700000000);
    CREATE TABLE keyword_search_terms (keyword_id INTEGER, url_id INTEGER, term LONGVARCHAR, normalized_term LONGVARCHAR);
    INSERT INTO keyword_search_terms VALUES (1, ${urls[0].id}, 'search term', 'search term');
    CREATE TABLE downloads (id INTEGER PRIMARY KEY, current_path VARCHAR, target_path VARCHAR);
    INSERT INTO downloads (id, current_path, target_path) VALUES (1, 'C:\\file.exe', 'C:\\file.exe');
    CREATE TABLE segments (id INTEGER PRIMARY KEY, name VARCHAR, url_id INTEGER);
    INSERT INTO segments VALUES (1, 'segment', ${urls[0].id});
    CREATE TABLE segment_usage (id INTEGER PRIMARY KEY, segment_id INTEGER, time_slot INTEGER, visit_count INTEGER);
    INSERT INTO segment_usage VALUES (1, 1, 1700000000, 1);
    CREATE TABLE meta (key VARCHAR, value VARCHAR);
    INSERT INTO meta VALUES ('version', '70');
  `;
  await execFileAsync(sqlite3ExePath(), [filePath, sql]);
}

function makeBookmarksJson(bookmarkedUrls) {
  return JSON.stringify({
    roots: {
      bookmark_bar: {
        type: 'folder',
        children: bookmarkedUrls.map((url) => ({ type: 'url', url }))
      }
    }
  });
}

let scratchDir;
let savedEnv;
beforeEach(async () => {
  scratchDir = await mkdtemp(join(tmpdir(), 'prune-chrome-history-test-'));
  savedEnv = process.env.UNREVO_QUARANTINE_ROOT;
  process.env.UNREVO_QUARANTINE_ROOT = await mkdtemp(join(tmpdir(), 'prune-chrome-history-qroot-'));
});
afterEach(async () => {
  await rm(scratchDir, { recursive: true, force: true });
  await rm(process.env.UNREVO_QUARANTINE_ROOT, { recursive: true, force: true });
  if (savedEnv === undefined) delete process.env.UNREVO_QUARANTINE_ROOT;
  else process.env.UNREVO_QUARANTINE_ROOT = savedEnv;
});

describe('chromeHistory scan', () => {
  it('reports present:true for a real History file', async () => {
    const filePath = join(scratchDir, 'History');
    await makeHistoryDb(filePath, [{ id: 1, url: 'https://example.com', title: 'Example' }]);
    expect(scan({ expandedPath: filePath }).present).toBe(true);
  });
});

describe('chromeHistory execute', () => {
  it('clears history but keeps a bookmarked URL row in urls', async () => {
    const filePath = join(scratchDir, 'History');
    await makeHistoryDb(filePath, [
      { id: 1, url: 'https://bookmarked.com', title: 'Kept' },
      { id: 2, url: 'https://not-bookmarked.com', title: 'Gone' }
    ]);
    await writeFile(join(scratchDir, 'Bookmarks'), makeBookmarksJson(['https://bookmarked.com']));

    const result = await execute({ expandedPath: filePath }, 'Test Rule', {});

    const urls = await execFileAsync(sqlite3ExePath(), [filePath, 'SELECT url FROM urls;']);
    expect(urls.stdout.trim()).toBe('https://bookmarked.com');

    const visits = await execFileAsync(sqlite3ExePath(), [filePath, 'SELECT COUNT(*) FROM visits;']);
    expect(visits.stdout.trim()).toBe('0');

    const downloads = await execFileAsync(sqlite3ExePath(), [filePath, 'SELECT COUNT(*) FROM downloads;']);
    expect(downloads.stdout.trim()).toBe('0');

    expect(result.quarantineBatch).toBeTruthy();
  });

  it('clears everything when there is no Bookmarks file at all', async () => {
    const filePath = join(scratchDir, 'History');
    await makeHistoryDb(filePath, [{ id: 1, url: 'https://example.com', title: 'Example' }]);
    await execute({ expandedPath: filePath }, 'Test Rule', {});
    const urls = await execFileAsync(sqlite3ExePath(), [filePath, 'SELECT COUNT(*) FROM urls;']);
    expect(urls.stdout.trim()).toBe('0');
  });

  it('skips a file with no urls table', async () => {
    const filePath = join(scratchDir, 'History');
    await execFileAsync(sqlite3ExePath(), [filePath, 'CREATE TABLE something_else (id INTEGER);']);
    const result = await execute({ expandedPath: filePath }, 'Test Rule', {});
    expect(result.skipped).toHaveLength(1);
  });

  it('really shrinks the file -- proves VACUUM ran', async () => {
    const filePath = join(scratchDir, 'History');
    const manyUrls = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, url: `https://site${i}.example.com/`, title: 'x'.repeat(150) + i }));
    await makeHistoryDb(filePath, manyUrls);
    const before = (await (await import('node:fs/promises')).readFile(filePath)).length;

    const result = await execute({ expandedPath: filePath }, 'Test Rule', {});

    const after = (await (await import('node:fs/promises')).readFile(filePath)).length;
    expect(after).toBeLessThan(before);
    expect(result.freedBytes).toBeGreaterThan(0);
    expect(result.freedBytes).toBe(before - after);
  });

  it('handles a huge bookmark list that would blow an argv-based approach', async () => {
    const filePath = join(scratchDir, 'History');
    await makeHistoryDb(filePath, [
      { id: 1, url: 'https://bookmarked.com', title: 'Kept' },
      { id: 2, url: 'https://not-bookmarked.com', title: 'Gone' }
    ]);
    // 1000+ synthetic bookmarked URLs, long enough per-entry that the old
    // "embed the WHERE-list directly in argv" approach would have blown
    // past Windows's ~32,767-char command-line limit.
    const manyBookmarks = Array.from({ length: 1200 }, (_, i) => `https://bookmark-site-${i}.example.com/some/long/path/segment/${'a'.repeat(40)}`);
    manyBookmarks.push('https://bookmarked.com');
    await writeFile(join(scratchDir, 'Bookmarks'), makeBookmarksJson(manyBookmarks));

    const result = await execute({ expandedPath: filePath }, 'Test Rule', {});

    expect(result.skipped).toHaveLength(0);
    const urls = await execFileAsync(sqlite3ExePath(), [filePath, 'SELECT url FROM urls;']);
    expect(urls.stdout.trim()).toBe('https://bookmarked.com');
  });

  it('skips the whole action when the Bookmarks file exists but is corrupt', async () => {
    const filePath = join(scratchDir, 'History');
    await makeHistoryDb(filePath, [
      { id: 1, url: 'https://bookmarked.com', title: 'Kept' },
      { id: 2, url: 'https://not-bookmarked.com', title: 'Gone' }
    ]);
    await writeFile(join(scratchDir, 'Bookmarks'), '{ this is not valid JSON ][');

    const result = await execute({ expandedPath: filePath }, 'Test Rule', {});

    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toMatch(/corrupt|unreadable/);
    const urls = await execFileAsync(sqlite3ExePath(), [filePath, 'SELECT COUNT(*) FROM urls;']);
    expect(urls.stdout.trim()).toBe('2');
  });
});
