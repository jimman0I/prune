import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSnapshotStore } from './snapshotStore.js';
import { staleWhileRevalidate } from './staleWhileRevalidate.js';

/** The last launch's answer now, this launch's answer when it is ready.
 *
 * Icons and the Store list cost seconds to compute and barely change between
 * launches, so they used to appear a while after the window did. A snapshot on
 * disk lets the first ask of a launch be answered at once. */

let dir;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'prune-swr-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

const storeAt = (name = 'snap.json') => createSnapshotStore({ path: join(dir, name) });

describe('snapshotStore', () => {
  it('writes atomically and reads back what it wrote', async () => {
    const store = storeAt();
    expect(await store.read()).toBeNull();
    await store.write({ a: 1 });
    expect(await store.read()).toEqual({ a: 1 });
    // no temp file left beside it
    expect(existsSync(join(dir, `snap.json.${process.pid}.tmp`))).toBe(false);
  });

  it('treats a corrupt file, a wrong version and a missing value as no snapshot', async () => {
    const path = join(dir, 'snap.json');
    for (const text of ['not json', JSON.stringify({ version: 99, value: { a: 1 } }), JSON.stringify({ version: 1 }), '']) {
      writeFileSync(path, text);
      expect(await createSnapshotStore({ path }).read()).toBeNull();
    }
  });

  it('keeps nothing without a path, and never throws', async () => {
    const store = createSnapshotStore({});
    await store.write({ a: 1 });
    expect(await store.read()).toBeNull();
  });

  it('swallows a failed save', async () => {
    const blocker = join(dir, 'a-file');
    writeFileSync(blocker, 'x');
    // a folder that cannot be created because a file is in the way
    await expect(createSnapshotStore({ path: join(blocker, 'sub', 'snap.json') }).write({ a: 1 })).resolves.toBeUndefined();
  });
});

describe('staleWhileRevalidate', () => {
  it('with no snapshot, computes once and shares the run, like memoizeAsync', async () => {
    const compute = vi.fn(async () => ({ icons: 3 }));
    const lookup = staleWhileRevalidate(compute, { store: storeAt() });
    const [a, b] = await Promise.all([lookup(), lookup()]);
    expect(a).toEqual({ icons: 3 });
    expect(b).toEqual({ icons: 3 });
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('saves the finished answer for the next launch', async () => {
    const store = storeAt();
    await staleWhileRevalidate(async () => ({ icons: 3 }), { store })();
    await vi.waitFor(async () => expect(await store.read()).toEqual({ icons: 3 }));
  });

  it('answers at once from last launch\'s snapshot, then switches to the fresh answer', async () => {
    const store = storeAt();
    await store.write({ icons: 1 });
    let release;
    const slow = new Promise((resolve) => { release = resolve; });
    const lookup = staleWhileRevalidate(() => slow.then(() => ({ icons: 2 })), { store, ttlMs: 60_000 });

    // returned without waiting for the slow computation
    expect(await lookup()).toEqual({ icons: 1 });
    expect(await lookup()).toEqual({ icons: 1 }); // still computing

    release();
    await vi.waitFor(async () => expect(await lookup()).toEqual({ icons: 2 }));
    await vi.waitFor(async () => expect(await store.read()).toEqual({ icons: 2 }));
  });

  it('computes only once while that background run is under way', async () => {
    const store = storeAt();
    await store.write({ icons: 1 });
    const compute = vi.fn(async () => ({ icons: 2 }));
    const lookup = staleWhileRevalidate(compute, { store, ttlMs: 60_000 });
    await Promise.all([lookup(), lookup(), lookup()]);
    await lookup.settled();
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('never lets a failed or empty fresh answer replace a good snapshot', async () => {
    const store = storeAt();
    await store.write({ a: 'icon' });
    const lookup = staleWhileRevalidate(async () => ({}), {
      store, ttlMs: 60_000, accept: (map) => Object.keys(map).length > 0
    });
    expect(await lookup()).toEqual({ a: 'icon' });
    await lookup.settled();
    expect(await lookup()).toEqual({ a: 'icon' });
    expect(await store.read()).toEqual({ a: 'icon' });

    const failing = staleWhileRevalidate(async () => { throw new Error('boom'); }, { store, ttlMs: 60_000 });
    expect(await failing()).toEqual({ a: 'icon' });
    await failing.settled();
    expect(await failing()).toEqual({ a: 'icon' });
  });

  it('still rejects, and does not remember the failure, when there is no snapshot to show', async () => {
    let calls = 0;
    const lookup = staleWhileRevalidate(async () => { calls += 1; if (calls === 1) throw new Error('boom'); return { ok: true }; }, { store: storeAt() });
    await expect(lookup()).rejects.toThrow('boom');
    expect(await lookup()).toEqual({ ok: true });
  });

  it('after its time is up, shows the kept answer while making a new one', async () => {
    let t = 1000;
    const answers = [{ n: 1 }, { n: 2 }];
    const compute = vi.fn(async () => answers.shift());
    const lookup = staleWhileRevalidate(compute, { ttlMs: 100, now: () => t });
    expect(await lookup()).toEqual({ n: 1 });
    t += 50;
    expect(await lookup()).toEqual({ n: 1 });
    expect(compute).toHaveBeenCalledTimes(1);
    t += 100;
    expect(await lookup()).toEqual({ n: 1 }); // expired: old answer, new run started
    await lookup.settled();
    expect(await lookup()).toEqual({ n: 2 });
  });

  it('clear() forgets the answer and does not fall back to the disk', async () => {
    const store = storeAt();
    await store.write({ n: 'disk' });
    const compute = vi.fn(async () => ({ n: 'fresh' }));
    const lookup = staleWhileRevalidate(compute, { store, ttlMs: 60_000 });
    lookup.clear();
    expect(await lookup()).toEqual({ n: 'fresh' });
    expect(readFileSync(join(dir, 'snap.json'), 'utf8')).toBeTruthy();
  });
});
