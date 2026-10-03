import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getStats, recordFreed, statsPath } from './stats.js';

/** The lifetime "Prune has freed X" total.
 *
 * Only space that is actually back counts: bytes deleted, or bytes of a
 * Quarantine batch that has been permanently deleted. A move is not recorded
 * anywhere, so it can never be counted twice -- once on the way in and again
 * when the Quarantine is emptied. */

let dir;
let previous;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'prune-stats-'));
  previous = process.env.UNREVO_STATS_PATH;
  process.env.UNREVO_STATS_PATH = join(dir, 'stats.json');
});
afterEach(() => {
  if (previous === undefined) delete process.env.UNREVO_STATS_PATH; else process.env.UNREVO_STATS_PATH = previous;
  rmSync(dir, { recursive: true, force: true });
});

describe('where it lives', () => {
  it('sits beside settings.json when nothing overrides it', () => {
    delete process.env.UNREVO_STATS_PATH;
    const was = process.env.UNREVO_SETTINGS_PATH;
    process.env.UNREVO_SETTINGS_PATH = join(dir, 'userData', 'settings.json');
    try {
      expect(statsPath()).toBe(join(dir, 'userData', 'stats.json'));
    } finally {
      if (was === undefined) delete process.env.UNREVO_SETTINGS_PATH; else process.env.UNREVO_SETTINGS_PATH = was;
    }
  });
});

describe('reading', () => {
  it('is zero, with no date, before anything was freed', async () => {
    expect(await getStats()).toEqual({ freedBytes: 0, since: null });
    expect(existsSync(statsPath())).toBe(false);
  });
});

describe('recording', () => {
  it('adds up what is freed, and dates the total from the first time', async () => {
    const first = await recordFreed(1000, new Date('2026-03-01T10:00:00Z').getTime());
    expect(first.freedBytes).toBe(1000);
    await recordFreed(234, new Date('2026-04-01T10:00:00Z').getTime());
    expect(await getStats()).toEqual({ freedBytes: 1234, since: new Date('2026-03-01T10:00:00Z').getTime() });
  });

  it('persists to a file a later read finds', async () => {
    await recordFreed(500);
    const onDisk = JSON.parse(readFileSync(statsPath(), 'utf8'));
    expect(onDisk.freedBytes).toBe(500);
    expect(typeof onDisk.since).toBe('number');
  });

  it('rounds fractions down to whole bytes', async () => {
    await recordFreed(10.9);
    expect((await getStats()).freedBytes).toBe(10);
  });

  it.each([0, -5, NaN, Infinity, '12', null, undefined, {}, [], 0.4])('ignores %p', async (bad) => {
    await recordFreed(100);
    await recordFreed(bad);
    expect((await getStats()).freedBytes).toBe(100);
  });

  it('writes nothing at all for nothing', async () => {
    await recordFreed(0);
    expect(existsSync(statsPath())).toBe(false);
  });

  it('does not lose counts when many land at once', async () => {
    await Promise.all(Array.from({ length: 40 }, () => recordFreed(25)));
    expect((await getStats()).freedBytes).toBe(1000);
  });

  it('leaves no temporary file behind', async () => {
    await recordFreed(1);
    await recordFreed(1);
    expect(readdirSync(dir)).toEqual(['stats.json']);
  });
});

describe('a damaged file', () => {
  it('reads as zero when it is not JSON, and the next count starts it afresh', async () => {
    writeFileSync(statsPath(), '{"freedBytes": 12', 'utf8');
    expect(await getStats()).toEqual({ freedBytes: 0, since: null });
    await recordFreed(40);
    expect((await getStats()).freedBytes).toBe(40);
  });

  it.each([
    ['an array', '[1,2]'],
    ['a string', '"hi"'],
    ['a negative total', '{"freedBytes":-5,"since":1}'],
    ['a total that is not a number', '{"freedBytes":"lots","since":1}'],
    ['an infinite total', '{"freedBytes":1e999,"since":1}'],
    ['null', 'null']
  ])('reads %s as zero', async (_label, text) => {
    writeFileSync(statsPath(), text, 'utf8');
    expect((await getStats()).freedBytes).toBe(0);
  });

  it('drops a date that is not a date, but keeps the total', async () => {
    writeFileSync(statsPath(), '{"freedBytes":700,"since":"yesterday"}', 'utf8');
    expect(await getStats()).toEqual({ freedBytes: 700, since: null });
  });
});

describe('when it cannot be written', () => {
  it('never throws, because a counter must not break a clean', async () => {
    // A path whose "directory" is a file.
    const blocker = join(dir, 'blocker');
    writeFileSync(blocker, 'x');
    process.env.UNREVO_STATS_PATH = join(blocker, 'stats.json');
    await expect(recordFreed(100)).resolves.toBeDefined();
    await expect(getStats()).resolves.toEqual({ freedBytes: 0, since: null });
  });
});
