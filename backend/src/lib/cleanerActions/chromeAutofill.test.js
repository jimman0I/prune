import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scan, execute } from './chromeAutofill.js';
import { sqlite3ExePath } from './sqliteVacuum.js';

const execFileAsync = promisify(execFile);

async function makeWebDataDb(filePath, rows) {
  const values = rows.map(({ name, value }) => `('${name}', '${value}', '${value.toLowerCase()}')`).join(',');
  await execFileAsync(sqlite3ExePath(), [
    filePath,
    `CREATE TABLE autofill (name VARCHAR, value VARCHAR, value_lower VARCHAR); INSERT INTO autofill (name, value, value_lower) VALUES ${values};`
  ]);
}

let scratchDir;
let savedEnv;
beforeEach(async () => {
  scratchDir = await mkdtemp(join(tmpdir(), 'prune-chrome-autofill-test-'));
  savedEnv = process.env.UNREVO_QUARANTINE_ROOT;
  process.env.UNREVO_QUARANTINE_ROOT = await mkdtemp(join(tmpdir(), 'prune-chrome-autofill-qroot-'));
});
afterEach(async () => {
  await rm(scratchDir, { recursive: true, force: true });
  await rm(process.env.UNREVO_QUARANTINE_ROOT, { recursive: true, force: true });
  if (savedEnv === undefined) delete process.env.UNREVO_QUARANTINE_ROOT;
  else process.env.UNREVO_QUARANTINE_ROOT = savedEnv;
});

describe('chromeAutofill scan', () => {
  it('reports present:true and a real size', async () => {
    const filePath = join(scratchDir, 'Web Data');
    await makeWebDataDb(filePath, [{ name: 'email', value: 'a@b.com' }]);
    const result = scan({ expandedPath: filePath });
    expect(result.present).toBe(true);
    expect(result.sizeBytes).toBeGreaterThan(0);
  });

  it('reports present:false for a missing file', () => {
    expect(scan({ expandedPath: join(scratchDir, 'nope') }).present).toBe(false);
  });
});

describe('chromeAutofill execute', () => {
  it('clears the autofill table, quarantines the original, reports a real byte delta', async () => {
    const filePath = join(scratchDir, 'Web Data');
    // 50 rows x ~200 bytes of real payload each in BOTH the value and
    // value_lower columns makeWebDataDb populates (~20KB of row data
    // total, similar overall sizing to cookie.test.js's own ~18KB padded
    // fixture -- kept smaller per-column than that fixture's 600 bytes
    // because this schema duplicates the payload into a second column,
    // and doubling straight to 600/column would blow past the Windows
    // command-line length limit for the sqlite3.exe CLI invocation).
    // Several SQLite pages at the default 4096-byte page size, so that
    // clearing the table and running VACUUM has real freed pages to
    // reclaim -- a handful of tiny rows can fit on a single page and
    // would shrink by 0 bytes even if VACUUM silently did nothing, the
    // same vacuous-test gap cookie.test.js's own padded fixture guards
    // against for its surgical row delete.
    const padding = 'x'.repeat(200);
    await makeWebDataDb(filePath, Array.from({ length: 50 }, (_, i) => ({ name: 'field' + i, value: padding + i })));
    const before = (await readFile(filePath)).length;

    const result = await execute({ expandedPath: filePath }, 'Test Rule', {});

    const remaining = await execFileAsync(sqlite3ExePath(), [filePath, 'SELECT COUNT(*) FROM autofill;']);
    expect(remaining.stdout.trim()).toBe('0');
    expect(result.quarantineBatch).toBeTruthy();
    const after = (await readFile(filePath)).length;
    expect(after).toBeLessThan(before);
    expect(result.freedBytes).toBeGreaterThan(0);
    expect(result.freedBytes).toBe(before - after);

    const batchFiles = await (await import('node:fs/promises')).readdir(result.quarantineBatch);
    const quarantinedFile = batchFiles.find((f) => f.startsWith('file-0-'));
    const quarantinedCount = await execFileAsync(sqlite3ExePath(), [join(result.quarantineBatch, quarantinedFile), 'SELECT COUNT(*) FROM autofill;']);
    expect(quarantinedCount.stdout.trim()).toBe('50');
  });

  it('reports 0 freedBytes for a missing file, no error', async () => {
    const result = await execute({ expandedPath: join(scratchDir, 'nope') }, 'Test Rule', {});
    expect(result.freedBytes).toBe(0);
    expect(result.skipped).toEqual([]);
  });

  it('skips a file with no autofill table, with a reason', async () => {
    const filePath = join(scratchDir, 'Web Data');
    await execFileAsync(sqlite3ExePath(), [filePath, 'CREATE TABLE something_else (id INTEGER);']);
    const result = await execute({ expandedPath: filePath }, 'Test Rule', {});
    expect(result.freedBytes).toBe(0);
    expect(result.skipped).toHaveLength(1);
  });

  it('respects excludeFolders', async () => {
    const filePath = join(scratchDir, 'Web Data');
    await makeWebDataDb(filePath, [{ name: 'email', value: 'a@b.com' }]);
    const result = await execute({ expandedPath: filePath }, 'Test Rule', { excludeFolders: [scratchDir] });
    expect(result.freedBytes).toBe(0);
    expect(result.skipped[0].reason).toMatch(/excluded/);
  });
});
