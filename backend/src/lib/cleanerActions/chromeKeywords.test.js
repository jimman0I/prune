import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scan, execute } from './chromeKeywords.js';
import { sqlite3ExePath } from './sqliteVacuum.js';

const execFileAsync = promisify(execFile);

async function makeKeywordsDb(filePath, rows, { withBackup = false } = {}) {
  const cols = "id INTEGER PRIMARY KEY, short_name VARCHAR, keyword VARCHAR, favicon_url VARCHAR, originating_url VARCHAR, suggest_url VARCHAR, date_created INTEGER, usage_count INTEGER";
  const values = rows.map(({ id, keyword, dateCreated, usageCount }) =>
    `(${id}, 'name', '${keyword}', '', '', '', ${dateCreated}, ${usageCount})`).join(',');
  let sql = `CREATE TABLE keywords (${cols}); INSERT INTO keywords (id, short_name, keyword, favicon_url, originating_url, suggest_url, date_created, usage_count) VALUES ${values};`;
  if (withBackup) sql += `CREATE TABLE keywords_backup (${cols});`;
  await execFileAsync(sqlite3ExePath(), [filePath, sql]);
}

let scratchDir;
let savedEnv;
beforeEach(async () => {
  scratchDir = await mkdtemp(join(tmpdir(), 'prune-chrome-keywords-test-'));
  savedEnv = process.env.UNREVO_QUARANTINE_ROOT;
  process.env.UNREVO_QUARANTINE_ROOT = await mkdtemp(join(tmpdir(), 'prune-chrome-keywords-qroot-'));
});
afterEach(async () => {
  await rm(scratchDir, { recursive: true, force: true });
  await rm(process.env.UNREVO_QUARANTINE_ROOT, { recursive: true, force: true });
  if (savedEnv === undefined) delete process.env.UNREVO_QUARANTINE_ROOT;
  else process.env.UNREVO_QUARANTINE_ROOT = savedEnv;
});

describe('chromeKeywords scan', () => {
  it('reports present:true for an existing Web Data file', async () => {
    const filePath = join(scratchDir, 'Web Data');
    await makeKeywordsDb(filePath, [{ id: 1, keyword: 'google.com', dateCreated: 0, usageCount: 0 }]);
    expect(scan({ expandedPath: filePath }).present).toBe(true);
  });
});

describe('chromeKeywords execute', () => {
  it('deletes only user-added keywords (date_created != 0), keeps browser defaults, resets usage_count', async () => {
    const filePath = join(scratchDir, 'Web Data');
    await makeKeywordsDb(filePath, [
      { id: 1, keyword: 'default-engine.com', dateCreated: 0, usageCount: 5 },
      { id: 2, keyword: 'my-custom-search.com', dateCreated: 1700000000, usageCount: 3 }
    ]);

    const result = await execute({ expandedPath: filePath }, 'Test Rule', {});

    const remaining = await execFileAsync(sqlite3ExePath(), [filePath, 'SELECT keyword, usage_count FROM keywords ORDER BY id;']);
    const rows = remaining.stdout.trim().split('\n');
    expect(rows).toEqual(['default-engine.com|0']); // custom one gone, default's usage_count reset to 0
    expect(result.quarantineBatch).toBeTruthy();
  });

  it('also clears keywords_backup when that table exists', async () => {
    const filePath = join(scratchDir, 'Web Data');
    await makeKeywordsDb(filePath, [{ id: 1, keyword: 'custom.com', dateCreated: 1700000000, usageCount: 1 }], { withBackup: true });
    await execFileAsync(sqlite3ExePath(), [filePath, "INSERT INTO keywords_backup (id, short_name, keyword, favicon_url, originating_url, suggest_url, date_created, usage_count) VALUES (1, 'name', 'custom.com', '', '', '', 1700000000, 1);"]);

    await execute({ expandedPath: filePath }, 'Test Rule', {});

    const remaining = await execFileAsync(sqlite3ExePath(), [filePath, 'SELECT COUNT(*) FROM keywords_backup;']);
    expect(remaining.stdout.trim()).toBe('0');
  });

  it('does not fail when keywords_backup does not exist (the normal, current-Chrome case)', async () => {
    const filePath = join(scratchDir, 'Web Data');
    await makeKeywordsDb(filePath, [{ id: 1, keyword: 'custom.com', dateCreated: 1700000000, usageCount: 1 }]);
    const result = await execute({ expandedPath: filePath }, 'Test Rule', {});
    expect(result.quarantineBatch).toBeTruthy();
  });

  it('skips a file with no keywords table', async () => {
    const filePath = join(scratchDir, 'Web Data');
    await execFileAsync(sqlite3ExePath(), [filePath, 'CREATE TABLE something_else (id INTEGER);']);
    const result = await execute({ expandedPath: filePath }, 'Test Rule', {});
    expect(result.skipped).toHaveLength(1);
  });

  it('really shrinks the file -- proves VACUUM ran, not a vacuous freedBytes check', async () => {
    const filePath = join(scratchDir, 'Web Data');
    const manyCustom = Array.from({ length: 40 }, (_, i) => ({
      id: i + 1, keyword: 'x'.repeat(150) + i, dateCreated: 1700000000, usageCount: 1
    }));
    await makeKeywordsDb(filePath, manyCustom);
    const before = (await (await import('node:fs/promises')).readFile(filePath)).length;

    const result = await execute({ expandedPath: filePath }, 'Test Rule', {});

    const after = (await (await import('node:fs/promises')).readFile(filePath)).length;
    expect(after).toBeLessThan(before);
    expect(result.freedBytes).toBeGreaterThan(0);
    expect(result.freedBytes).toBe(before - after);
  });
});
