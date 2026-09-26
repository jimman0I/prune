import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readdir, stat, writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  wipeFreeSpace, cleanupWipeLeftovers, estimateWipe, defaultReserveBytes, FILLER_PREFIX, wipeInProgress
} from './wipeFreeSpace.js';

// A tiny pretend drive. Nothing here writes more than a few hundred KB: the
// wipe is given a fake "how much is free" that is computed from the real
// files it has actually written into a temp folder.
const KB = 1024;
let root;
let dir;

/** A drive of `total` bytes with `otherUsed` already taken by something
 * else, whose free space shrinks as filler files really grow. */
function fakeDrive({ total, otherUsed = 0 }) {
  let external = 0;
  const used = async () => {
    let sum = otherUsed + external;
    for (const name of await readdir(dir).catch(() => [])) sum += (await stat(join(dir, name)).catch(() => ({ size: 0 }))).size;
    return sum;
  };
  return {
    getFreeBytes: async () => total - (await used()),
    /** Another process writing to the drive while the wipe runs. */
    consume: (bytes) => { external += bytes; },
    freeNow: async () => total - (await used())
  };
}

const fillerNames = async () => (await readdir(dir).catch(() => [])).filter((n) => n.startsWith(FILLER_PREFIX));

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'prune-wipe-'));
  dir = join(root, 'wipe');
});
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

const run = (options) => wipeFreeSpace({
  dir, chunkBytes: 16 * KB, fileMaxBytes: 100 * KB, recheckEveryBytes: 16 * KB, progressEveryMs: 0, ...options
});

describe('wipeFreeSpace', () => {
  it('writes until only the reserve is left, then puts every byte back', async () => {
    const drive = fakeDrive({ total: 1000 * KB, otherUsed: 100 * KB });
    const startFree = await drive.freeNow(); // 900 KB
    const seenFree = [];
    const result = await run({
      reserveBytes: 200 * KB,
      getFreeBytes: drive.getFreeBytes,
      onProgress: async () => { seenFree.push(await drive.freeNow()); }
    });

    expect(result.aborted).toBe(false);
    expect(result.bytesWritten).toBe(startFree - 200 * KB);
    // Never below the reserve, at any point during the run.
    expect(Math.min(...seenFree)).toBeGreaterThanOrEqual(200 * KB);
    // And the drive has its space back afterwards.
    expect(await drive.freeNow()).toBe(startFree);
    expect(existsSync(dir)).toBe(false);
  });

  it('writes nothing when there is not more free than the reserve', async () => {
    const drive = fakeDrive({ total: 1000 * KB, otherUsed: 900 * KB });
    const result = await run({ reserveBytes: 200 * KB, getFreeBytes: drive.getFreeBytes });
    expect(result.bytesWritten).toBe(0);
    expect(await fillerNames()).toEqual([]);
  });

  it('stops early, keeping the reserve, when something else fills the drive meanwhile', async () => {
    const drive = fakeDrive({ total: 1000 * KB });
    let calls = 0;
    const result = await run({
      reserveBytes: 200 * KB,
      getFreeBytes: async () => {
        calls += 1;
        if (calls === 6) drive.consume(300 * KB); // another program writes 300 KB
        return drive.getFreeBytes();
      }
    });
    // 1000 KB drive, 200 KB reserve, 300 KB taken by someone else: room for
    // about 500 KB of filler, not the 800 KB it first expected.
    expect(result.bytesWritten).toBeLessThanOrEqual(500 * KB + 16 * KB);
    expect(await drive.freeNow()).toBe(700 * KB); // filler is gone; the other 300 KB remains
  });

  it('splits the filler into files no bigger than the cap, all recognisably named', async () => {
    const drive = fakeDrive({ total: 1000 * KB });
    let names = [];
    let biggest = 0;
    await run({
      reserveBytes: 300 * KB,
      getFreeBytes: drive.getFreeBytes,
      onProgress: async () => {
        names = await fillerNames();
        for (const n of names) biggest = Math.max(biggest, (await stat(join(dir, n))).size);
      }
    });
    expect(names.length).toBeGreaterThan(1);
    expect(biggest).toBeLessThanOrEqual(100 * KB);
    for (const n of names) expect(n.startsWith(FILLER_PREFIX)).toBe(true);
  });

  it('writes zeros', async () => {
    const drive = fakeDrive({ total: 300 * KB });
    let sample;
    await run({
      reserveBytes: 100 * KB,
      getFreeBytes: drive.getFreeBytes,
      onProgress: async () => {
        const [first] = await fillerNames();
        if (first && !sample) sample = await readFile(join(dir, first));
      }
    });
    expect(sample.length).toBeGreaterThan(0);
    expect(sample.every((b) => b === 0)).toBe(true);
  });

  it('reports bytes written, the total it is aiming for, and elapsed time', async () => {
    const drive = fakeDrive({ total: 500 * KB });
    const seen = [];
    await run({ reserveBytes: 100 * KB, getFreeBytes: drive.getFreeBytes, onProgress: (p) => seen.push(p) });
    const last = seen.at(-1);
    expect(last.totalBytes).toBe(400 * KB);
    expect(last.bytesWritten).toBe(400 * KB);
    expect(last.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(seen.some((p) => p.bytesWritten > 0 && p.bytesWritten < 400 * KB)).toBe(true);
  });

  it('stops promptly when aborted and deletes what it wrote', async () => {
    const drive = fakeDrive({ total: 1000 * KB });
    const controller = new AbortController();
    const result = await run({
      reserveBytes: 100 * KB,
      getFreeBytes: drive.getFreeBytes,
      signal: controller.signal,
      onProgress: (p) => { if (p.bytesWritten >= 64 * KB) controller.abort(); }
    });
    expect(result.aborted).toBe(true);
    expect(result.bytesWritten).toBeLessThan(200 * KB);
    expect(existsSync(dir)).toBe(false);
    expect(await drive.freeNow()).toBe(1000 * KB);
  });

  it('does nothing at all when already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await run({ reserveBytes: 1, getFreeBytes: async () => 10 ** 9, signal: controller.signal });
    expect(result.aborted).toBe(true);
    expect(result.bytesWritten).toBe(0);
  });

  it('deletes the filler even when something throws mid-run', async () => {
    const drive = fakeDrive({ total: 1000 * KB });
    let calls = 0;
    await expect(run({
      reserveBytes: 100 * KB,
      getFreeBytes: async () => {
        calls += 1;
        if (calls > 4) throw new Error('disk vanished');
        return drive.getFreeBytes();
      }
    })).rejects.toThrow('disk vanished');
    expect(existsSync(dir)).toBe(false);
  });

  it('stops cleanly, not with an error, if the drive genuinely runs out of room', async () => {
    // getFreeBytes lies and says there is plenty; real writes into a tiny
    // quota cannot be simulated in a temp dir, so simulate the write failing.
    const drive = fakeDrive({ total: 1000 * KB });
    let writes = 0;
    const result = await run({
      reserveBytes: 100 * KB,
      getFreeBytes: drive.getFreeBytes,
      writeChunk: async (handle, buffer, length) => {
        writes += 1;
        if (writes > 3) throw Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' });
        return handle.write(buffer, 0, length);
      }
    });
    expect(result.reason).toBe('full');
    expect(existsSync(dir)).toBe(false);
  });

  it('refuses to start a second wipe while one is running', async () => {
    const drive = fakeDrive({ total: 1000 * KB });
    let inner;
    const first = run({
      reserveBytes: 100 * KB,
      getFreeBytes: drive.getFreeBytes,
      onProgress: async () => {
        if (!inner) inner = wipeFreeSpace({ dir, reserveBytes: 1, getFreeBytes: drive.getFreeBytes });
        await inner.catch(() => {});
      }
    });
    await first;
    await expect(inner).rejects.toThrow(/already running/i);
    expect(wipeInProgress()).toBe(false);
  });
});

describe('cleanupWipeLeftovers', () => {
  it('removes filler a crashed run left behind, and only filler', async () => {
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${FILLER_PREFIX}0001.bin`), Buffer.alloc(8 * KB));
    await writeFile(join(dir, `${FILLER_PREFIX}0002.bin`), Buffer.alloc(8 * KB));
    await writeFile(join(dir, 'notes.txt'), 'mine');
    const removed = await cleanupWipeLeftovers({ dir });
    expect(removed.files).toBe(2);
    expect(removed.bytes).toBe(16 * KB);
    expect(await readdir(dir)).toEqual(['notes.txt']);
  });

  it('is a no-op when there is no folder', async () => {
    expect(await cleanupWipeLeftovers({ dir })).toEqual({ files: 0, bytes: 0 });
  });

  it('removes the emptied folder', async () => {
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${FILLER_PREFIX}0001.bin`), Buffer.alloc(KB));
    await cleanupWipeLeftovers({ dir });
    expect(existsSync(dir)).toBe(false);
  });

  it('runs before a new wipe, so a crashed run cannot make the next one start short', async () => {
    const drive = fakeDrive({ total: 300 * KB });
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${FILLER_PREFIX}0099.bin`), Buffer.alloc(50 * KB));
    const result = await run({ reserveBytes: 100 * KB, getFreeBytes: drive.getFreeBytes });
    expect(result.bytesWritten).toBe(200 * KB); // measured after the old filler was gone
  });
});

describe('estimateWipe and defaults', () => {
  it('reads the drive, the reserve, how much would be written, and a measured speed', async () => {
    const est = await estimateWipe({
      dir,
      reserveBytes: 100 * KB,
      sampleMs: 20,
      chunkBytes: 16 * KB,
      getStats: async () => ({ freeBytes: 600 * KB, totalBytes: 1000 * KB })
    });
    expect(est.drive).toMatch(/^[A-Za-z]:$/);
    expect(est.freeBytes).toBe(600 * KB);
    expect(est.reserveBytes).toBe(100 * KB);
    expect(est.bytesToWrite).toBe(500 * KB);
    expect(est.bytesPerSecond).toBeGreaterThan(0);
    expect(est.seconds).toBeGreaterThan(0);
    // The sample file is gone.
    expect(existsSync(dir) ? await fillerNames() : []).toEqual([]);
  });

  it('says zero to write when the drive is already at or under the reserve', async () => {
    const est = await estimateWipe({
      dir, reserveBytes: 500 * KB, sampleMs: 5, chunkBytes: 4 * KB,
      getStats: async () => ({ freeBytes: 100 * KB, totalBytes: 1000 * KB })
    });
    expect(est.bytesToWrite).toBe(0);
  });

  it('keeps the larger of 2 GB and 2% of the drive free', () => {
    const GB = 1024 ** 3;
    expect(defaultReserveBytes(100 * GB)).toBe(2 * GB);
    expect(defaultReserveBytes(1000 * GB)).toBe(20 * GB);
    expect(defaultReserveBytes(0)).toBe(2 * GB);
  });
});
