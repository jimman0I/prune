import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { purgeExpiredQuarantine } from './quarantineRetention.js';
import { listQuarantineBatches } from './quarantine.js';

/** Against a real quarantine root on disk.
 *
 * The pure tests beside this file all passed while this module imported a
 * `listQuarantineBatches` that did not exist -- the listing lived inline
 * in the route. Nothing that only exercises `expiredBatches` can catch
 * that; something has to actually run the purge. */
const DAY = 24 * 60 * 60 * 1000;

let root;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'prune-retention-test-'));
  process.env.UNREVO_QUARANTINE_ROOT = root;
});
afterEach(async () => {
  delete process.env.UNREVO_QUARANTINE_ROOT;
  await rm(root, { recursive: true, force: true });
});

async function makeBatch(name, ageDays) {
  const batchDir = join(root, `${Date.now()}-${name}`);
  await mkdir(batchDir, { recursive: true });
  await writeFile(join(batchDir, 'file-0-thing.txt'), 'contents', 'utf8');
  await writeFile(
    join(batchDir, 'manifest.json'),
    JSON.stringify({ programName: name, batchDir, createdAt: Date.now() - ageDays * DAY, files: [], registryKeys: [] }),
    'utf8'
  );
  return batchDir;
}

describe('purgeExpiredQuarantine (real quarantine root)', () => {
  it('deletes only the batches past the window', async () => {
    const old = await makeBatch('Ancient', 90);
    const fresh = await makeBatch('Recent', 3);

    const result = await purgeExpiredQuarantine({ quarantineRetentionDays: 30 });

    expect(result.ok).toBe(true);
    expect(result.purged.map((b) => b.programName)).toEqual(['Ancient']);
    expect(result.failed).toEqual([]);
    expect(existsSync(old)).toBe(false);
    expect(existsSync(fresh)).toBe(true);
  }, 30000);

  it('deletes nothing at all when retention is off', async () => {
    // The setting defaults to off, and off has to mean off: this is the
    // app's undo folder.
    const a = await makeBatch('Ancient', 400);
    const result = await purgeExpiredQuarantine({});

    expect(result.purged).toEqual([]);
    expect(result.retentionDays).toBeNull();
    expect(existsSync(a)).toBe(true);
  }, 30000);

  it('reads the same batches the quarantine screen lists', async () => {
    // The bug this file exists for: the purge and the list must come from
    // one function, or the screen shows batches the purge cannot see.
    await makeBatch('One', 1);
    await makeBatch('Two', 2);
    const batches = await listQuarantineBatches();
    expect(batches.map((b) => b.programName).sort()).toEqual(['One', 'Two']);
  }, 30000);

  it('leaves a directory with no manifest alone', async () => {
    // Not a batch. Deleting an unrecognised folder out of the quarantine
    // root would be destroying something this app did not put there.
    const stray = join(root, 'not-a-batch');
    await mkdir(stray, { recursive: true });
    await makeBatch('Ancient', 90);

    await purgeExpiredQuarantine({ quarantineRetentionDays: 1 });
    expect(existsSync(stray)).toBe(true);
    expect((await readdir(root)).length).toBe(1);
  }, 30000);
});
