import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readdir, stat, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, parse } from 'node:path';
import {
  wipeFreeSpace, estimateWipe, FILLER_PREFIX, wipeDir, wipeDirFor, execute
} from './wipeFreeSpace.js';

// The multi-pass and choose-a-drive half of the free-space wipe. Same tiny
// pretend drive as wipeFreeSpace.test.js: nothing here writes more than a
// few hundred KB, and everything happens in a temp folder.
const KB = 1024;
let root;
let dir;

function fakeDrive({ total, otherUsed = 0 }) {
  const used = async () => {
    let sum = otherUsed;
    for (const name of await readdir(dir).catch(() => [])) sum += (await stat(join(dir, name)).catch(() => ({ size: 0 }))).size;
    return sum;
  };
  return {
    getFreeBytes: async () => total - (await used()),
    freeNow: async () => total - (await used())
  };
}
const fillerNames = async () => (await readdir(dir).catch(() => [])).filter((n) => n.startsWith(FILLER_PREFIX));

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'prune-wipe-passes-'));
  dir = join(root, 'wipe');
});
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

const run = (options) => wipeFreeSpace({
  dir, chunkBytes: 16 * KB, fileMaxBytes: 100 * KB, recheckEveryBytes: 16 * KB, progressEveryMs: 0, ...options
});

describe('more than one pass', () => {
  it('fills the free space once per pass, handing the space back between passes', async () => {
    const drive = fakeDrive({ total: 1000 * KB, otherUsed: 100 * KB });
    const startFree = await drive.freeNow(); // 900 KB
    const passesSeen = new Set();
    const freeAtPassStart = [];
    let lastPass = 0;
    const result = await run({
      reserveBytes: 200 * KB,
      passes: 3,
      getFreeBytes: drive.getFreeBytes,
      onProgress: async (p) => {
        passesSeen.add(p.pass);
        if (p.pass !== lastPass) { lastPass = p.pass; freeAtPassStart.push(await drive.freeNow()); }
      }
    });

    expect(result.passes).toBe(3);
    expect(result.bytesWritten).toBe(3 * (startFree - 200 * KB));
    expect([...passesSeen].sort()).toEqual([1, 2, 3]);
    // Each pass began with the previous pass's filler already gone: well over
    // the reserve free, not down at it.
    expect(freeAtPassStart.slice(1).every((free) => free > 600 * KB)).toBe(true);
    expect(await drive.freeNow()).toBe(startFree);
    expect(existsSync(dir)).toBe(false);
  });

  it('aims at the whole job in totalBytes, so progress runs to 100% once', async () => {
    const drive = fakeDrive({ total: 500 * KB });
    const seen = [];
    await run({ reserveBytes: 100 * KB, passes: 3, getFreeBytes: drive.getFreeBytes, onProgress: (p) => seen.push(p) });
    expect(seen.at(-1).totalBytes).toBe(3 * 400 * KB);
    expect(seen.at(-1).bytesWritten).toBe(3 * 400 * KB);
    expect(Math.max(...seen.map((p) => p.bytesWritten / p.totalBytes))).toBeLessThanOrEqual(1);
  });

  it('writes random data on three passes, a different stream each time', async () => {
    const drive = fakeDrive({ total: 300 * KB });
    const firstChunks = new Map(); // pass -> first bytes of the first filler file
    await run({
      reserveBytes: 100 * KB,
      passes: 3,
      getFreeBytes: drive.getFreeBytes,
      onProgress: async (p) => {
        if (firstChunks.has(p.pass)) return;
        const [first] = await fillerNames();
        if (first) firstChunks.set(p.pass, (await readFile(join(dir, first))).subarray(0, 4096));
      }
    });
    expect([...firstChunks.keys()].sort()).toEqual([1, 2, 3]);
    for (const chunk of firstChunks.values()) expect(chunk.some((b) => b !== 0)).toBe(true);
    expect(firstChunks.get(1).equals(firstChunks.get(2))).toBe(false);
  });

  it('reports what it wrote: zeros for one pass, random data for three', async () => {
    const drive = fakeDrive({ total: 300 * KB });
    expect((await run({ reserveBytes: 100 * KB, getFreeBytes: drive.getFreeBytes })).pattern).toBe('zeros');
    expect((await run({ reserveBytes: 100 * KB, passes: 3, getFreeBytes: drive.getFreeBytes })).pattern).toBe('random');
  });

  it('treats any passes value other than 3 as one zero pass', async () => {
    const drive = fakeDrive({ total: 300 * KB });
    const result = await run({ reserveBytes: 100 * KB, passes: 2, getFreeBytes: drive.getFreeBytes });
    expect(result.passes).toBe(1);
    expect(result.pattern).toBe('zeros');
  });

  it('stops in the middle of a later pass when aborted, and deletes what it wrote', async () => {
    const drive = fakeDrive({ total: 500 * KB });
    const controller = new AbortController();
    const result = await run({
      reserveBytes: 100 * KB,
      passes: 3,
      getFreeBytes: drive.getFreeBytes,
      signal: controller.signal,
      onProgress: (p) => { if (p.pass === 2 && p.bytesWritten > 400 * KB + 32 * KB) controller.abort(); }
    });
    expect(result.aborted).toBe(true);
    expect(result.bytesWritten).toBeGreaterThan(400 * KB);
    expect(result.bytesWritten).toBeLessThan(3 * 400 * KB);
    expect(existsSync(dir)).toBe(false);
    expect(await drive.freeNow()).toBe(500 * KB);
  });
});

describe('choosing the drive', () => {
  it('uses the folder beside settings for the profile drive, and a folder of its own at the root of any other', () => {
    const profileDrive = parse(wipeDir()).root.replace(/[\\/]+$/, '').toUpperCase();
    expect(wipeDirFor(null)).toBe(wipeDir());
    expect(wipeDirFor(profileDrive)).toBe(wipeDir());
    const other = profileDrive === 'Z:' ? 'Y:' : 'Z:';
    expect(wipeDirFor(other)).toBe(`${other}\\Prune-wipe`);
    expect(wipeDirFor(other.toLowerCase())).toBe(`${other}\\Prune-wipe`);
  });

  it('refuses anything that is not a bare drive letter', () => {
    for (const bad of ['C:\\Windows', 'C', '\\\\server\\share', '..', 'C:\\..', '/', 'CD:', 7, {}]) {
      expect(() => wipeDirFor(bad), String(bad)).toThrow(/drive/i);
    }
  });

  it('estimates for the chosen drive and scales the time by the passes', async () => {
    const est = await estimateWipe({
      dir, drive: 'D:', passes: 3, reserveBytes: 100 * KB, sampleMs: 20, chunkBytes: 16 * KB,
      getStats: async () => ({ freeBytes: 600 * KB, totalBytes: 1000 * KB })
    });
    expect(est.drive).toBe('D:');
    expect(est.passes).toBe(3);
    expect(est.pattern).toBe('random');
    expect(est.bytesToWrite).toBe(500 * KB); // one pass
    expect(est.totalBytesToWrite).toBe(3 * 500 * KB);
    expect(est.seconds).toBe(Math.ceil((3 * 500 * KB) / est.bytesPerSecond));
  });
});

describe('execute (the rule action)', () => {
  const stats = async () => ({ freeBytes: 0, totalBytes: 100 * 1024 ** 3 });
  const finished = (options, extra = {}) => ({
    bytesWritten: 1, totalBytes: 1, elapsedMs: 1, aborted: false, reason: null,
    passes: options.passes, pattern: options.passes === 3 ? 'random' : 'zeros', ...extra
  });

  it('wipes the drive and passes named in the guards, with the reserve for that drive', async () => {
    const calls = [];
    const fakeRun = async (options) => { calls.push(options); return finished(options); };
    const result = await execute({ type: 'wipe.freespace' }, 'Free disk space', { wipeDrive: 'D:', wipePasses: 3 }, { run: fakeRun, stats });
    expect(calls).toHaveLength(1);
    expect(calls[0].dir).toBe('D:\\Prune-wipe');
    expect(calls[0].passes).toBe(3);
    expect(calls[0].reserveBytes).toBe(2 * 1024 ** 3);
    expect(result.freedBytes).toBe(0);
    expect(result.wiped.drive).toBe('D:');
    expect(result.wiped.pattern).toBe('random');
  });

  it('defaults to the profile drive and one pass', async () => {
    const calls = [];
    const fakeRun = async (options) => { calls.push(options); return finished(options); };
    await execute({ type: 'wipe.freespace' }, 'Free disk space', {}, { run: fakeRun, stats });
    expect(calls[0].dir).toBe(wipeDir());
    expect(calls[0].passes).toBe(1);
  });

  it('forwards Stop and progress, tagged as a wipe', async () => {
    const controller = new AbortController();
    const progress = [];
    const fakeRun = async (options) => {
      expect(options.signal).toBe(controller.signal);
      options.onProgress({ bytesWritten: 5, totalBytes: 10, pass: 2, passes: 3, pattern: 'random' });
      return finished(options);
    };
    await execute({ type: 'wipe.freespace' }, 'x', {
      wipeDrive: 'D:', wipePasses: 3, signal: controller.signal, onProgress: (p) => progress.push(p)
    }, { run: fakeRun, stats });
    expect(progress).toEqual([{ wipe: true, bytesWritten: 5, totalBytes: 10, pass: 2, passes: 3, pattern: 'random' }]);
  });

  it('refuses a drive that is not a bare letter, without writing anything', async () => {
    const fakeRun = async () => { throw new Error('should not run'); };
    await expect(execute({ type: 'wipe.freespace' }, 'x', { wipeDrive: 'C:\\Windows' }, { run: fakeRun, stats })).rejects.toThrow(/drive/i);
  });
});
