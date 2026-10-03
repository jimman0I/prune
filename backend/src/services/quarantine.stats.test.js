import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { quarantineAndDelete, deletePermanently, emptyQuarantine, restoreQuarantine } from './quarantine.js';
import { getStats } from './stats.js';

/** The Quarantine side of the lifetime total: moving a file in frees nothing,
 * so it counts when the batch is permanently deleted -- once, whichever way
 * that happens. */

let dir;
const saved = {};
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'prune-qstats-'));
  for (const name of ['UNREVO_QUARANTINE_ROOT', 'UNREVO_STATS_PATH']) saved[name] = process.env[name];
  process.env.UNREVO_QUARANTINE_ROOT = join(dir, 'q');
  process.env.UNREVO_STATS_PATH = join(dir, 'stats.json');
});
afterEach(async () => {
  for (const [name, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
  await rm(dir, { recursive: true, force: true });
});

async function quarantineFile(program, size) {
  const file = join(dir, `${program}.bin`);
  await writeFile(file, Buffer.alloc(size, 1));
  return quarantineAndDelete({ programName: program, files: [file], registryKeys: [] });
}

describe('quarantining', () => {
  it('counts nothing: the file is moved, not freed', async () => {
    await quarantineFile('alpha', 1000);
    expect(await getStats()).toEqual({ freedBytes: 0, since: null });
  });

  it('counts nothing when a batch is restored either', async () => {
    const batch = await quarantineFile('alpha', 1000);
    await restoreQuarantine(batch.batchDir);
    expect((await getStats()).freedBytes).toBe(0);
  });
});

describe('deleting a batch for good', () => {
  it('counts the bytes it held', async () => {
    const batch = await quarantineFile('alpha', 1000);
    const result = await deletePermanently(batch.batchDir);
    expect(result.freedBytes).toBe(1000);
    expect((await getStats()).freedBytes).toBe(1000);
  });

  it('counts a batch only once, even if asked twice', async () => {
    const batch = await quarantineFile('alpha', 1000);
    await deletePermanently(batch.batchDir);
    expect(await deletePermanently(batch.batchDir)).toEqual({ deleted: false, freedBytes: 0 });
    expect((await getStats()).freedBytes).toBe(1000);
  });

  it('counts nothing for a batch that is not there', async () => {
    await deletePermanently(join(dir, 'q', 'no-such-batch'));
    expect((await getStats()).freedBytes).toBe(0);
  });
});

describe('Empty Quarantine', () => {
  it('counts each batch once -- the sum, never twice', async () => {
    await quarantineFile('alpha', 1000);
    await quarantineFile('beta', 250);
    const result = await emptyQuarantine();
    expect(result.freedBytes).toBe(1250);
    expect((await getStats()).freedBytes).toBe(1250);
  });

  it('counts nothing when there is nothing to empty', async () => {
    await emptyQuarantine();
    expect((await getStats()).freedBytes).toBe(0);
  });
});
