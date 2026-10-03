import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLowDiskWatcher, fileNotifiedStore, localDay, makeNotifier } from './lowDiskWatch.js';

const GB = 1024 ** 3;
const low = (letter) => ({ drive: letter, label: '', freeBytes: 10 * GB, totalBytes: 250 * GB, percentFree: 4 });

function memoryStore(initial = {}) {
  let data = { ...initial };
  return { load: async () => ({ ...data }), save: async (next) => { data = { ...next }; }, peek: () => data };
}

function makeWatcher(overrides = {}) {
  const notify = vi.fn();
  let day = new Date(2026, 9, 3, 9, 0, 0);
  const watcher = createLowDiskWatcher({
    getPercent: async () => 10,
    findLow: async () => [low('C:')],
    notify,
    canNotify: () => true,
    store: memoryStore(),
    now: () => day,
    ...overrides
  });
  return { watcher, notify, setDay: (d) => { day = d; } };
}

describe('the daily low-disk notification', () => {
  it('tells you about a low drive', async () => {
    const { watcher, notify } = makeWatcher();
    await watcher.tick();
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0][0].drive).toBe('C:');
  });

  it('tells you once a day per drive, however many times it looks', async () => {
    const { watcher, notify } = makeWatcher();
    await watcher.tick();
    await watcher.tick();
    await watcher.tick();
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('tells you again the next day', async () => {
    const { watcher, notify, setDay } = makeWatcher();
    await watcher.tick();
    setDay(new Date(2026, 9, 3, 23, 59, 0));
    await watcher.tick();
    expect(notify).toHaveBeenCalledTimes(1);
    setDay(new Date(2026, 9, 4, 0, 1, 0));
    await watcher.tick();
    expect(notify).toHaveBeenCalledTimes(2);
  });

  it('counts each drive on its own', async () => {
    const drives = [low('C:')];
    const { watcher, notify } = makeWatcher({ findLow: async () => drives });
    await watcher.tick();
    drives.push(low('D:'));
    await watcher.tick();
    expect(notify.mock.calls.map(([d]) => d.drive)).toEqual(['C:', 'D:']);
  });

  it('does not tell you again if the drive recovers and runs low again the same day', async () => {
    let drives = [low('C:')];
    const { watcher, notify } = makeWatcher({ findLow: async () => drives });
    await watcher.tick();
    drives = [];
    await watcher.tick();
    drives = [low('C:')];
    await watcher.tick();
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('says nothing, and reads nothing, when the warning is off', async () => {
    const findLow = vi.fn(async () => [low('C:')]);
    const { watcher, notify } = makeWatcher({ getPercent: async () => 0, findLow });
    await watcher.tick();
    expect(notify).not.toHaveBeenCalled();
    expect(findLow).not.toHaveBeenCalled();
  });

  it('says nothing while you are looking at Prune, and does not use up the day for it', async () => {
    let looking = true;
    const { watcher, notify } = makeWatcher({ canNotify: () => !looking });
    await watcher.tick();
    expect(notify).not.toHaveBeenCalled();
    looking = false;
    await watcher.tick();
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('remembers across a restart that it already told you today', async () => {
    const store = memoryStore();
    const first = makeWatcher({ store });
    await first.watcher.tick();
    const second = makeWatcher({ store });
    await second.watcher.tick();
    expect(second.notify).not.toHaveBeenCalled();
  });

  it('does not count a notification that failed to show', async () => {
    const notify = vi.fn().mockRejectedValueOnce(new Error('no notifications here')).mockResolvedValue(undefined);
    const { watcher } = makeWatcher({ notify });
    await watcher.tick();
    await watcher.tick();
    expect(notify).toHaveBeenCalledTimes(2);
  });

  it('survives its own reads failing', async () => {
    const { watcher, notify } = makeWatcher({ findLow: async () => { throw new Error('boom'); } });
    await expect(watcher.tick()).resolves.toBeUndefined();
    expect(notify).not.toHaveBeenCalled();
  });

  it('survives a store that cannot be read or written', async () => {
    const store = { load: async () => { throw new Error('locked'); }, save: async () => { throw new Error('full'); } };
    const { watcher, notify } = makeWatcher({ store });
    await expect(watcher.tick()).resolves.toBeUndefined();
    expect(notify).toHaveBeenCalledTimes(1);
  });
});

describe('start and stop', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('looks on a timer, lightly, and stops when told', async () => {
    const findLow = vi.fn(async () => []);
    const { watcher } = makeWatcher({ findLow });
    watcher.start({ firstDelayMs: 1000, intervalMs: 300_000 });
    expect(findLow).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(findLow).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(300_000);
    expect(findLow).toHaveBeenCalledTimes(2);
    watcher.stop();
    await vi.advanceTimersByTimeAsync(900_000);
    expect(findLow).toHaveBeenCalledTimes(2);
  });

  it('is safe to start twice', async () => {
    const findLow = vi.fn(async () => []);
    const { watcher } = makeWatcher({ findLow });
    watcher.start({ firstDelayMs: 10, intervalMs: 1000 });
    watcher.start({ firstDelayMs: 10, intervalMs: 1000 });
    await vi.advanceTimersByTimeAsync(10);
    expect(findLow).toHaveBeenCalledTimes(1);
    watcher.stop();
  });
});

describe('localDay', () => {
  it('is the calendar day on this clock, not UTC', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
    expect(localDay(new Date(2026, 11, 31, 0, 5))).toBe('2026-12-31');
  });
});

describe('fileNotifiedStore', () => {
  let dir;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'prune-lowdisk-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('round-trips, atomically', async () => {
    const path = join(dir, 'lowDiskNotified.json');
    const store = fileNotifiedStore(path);
    await store.save({ 'C:': '2026-10-03' });
    expect(await store.load()).toEqual({ 'C:': '2026-10-03' });
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ 'C:': '2026-10-03' });
    expect(existsSync(`${path}.${process.pid}.tmp`)).toBe(false);
  });

  it('reads a missing or damaged file as nothing notified yet', async () => {
    const path = join(dir, 'lowDiskNotified.json');
    expect(await fileNotifiedStore(path).load()).toEqual({});
    writeFileSync(path, '{"C:": "2026', 'utf8');
    expect(await fileNotifiedStore(path).load()).toEqual({});
    writeFileSync(path, '[1,2]', 'utf8');
    expect(await fileNotifiedStore(path).load()).toEqual({});
  });

  it('keeps only drive letters mapped to dates', async () => {
    const path = join(dir, 'lowDiskNotified.json');
    writeFileSync(path, JSON.stringify({ 'C:': '2026-10-03', 'D:': 5, '../x': '2026-10-03', 'E:': 'not a date' }), 'utf8');
    expect(await fileNotifiedStore(path).load()).toEqual({ 'C:': '2026-10-03' });
  });
});

describe('makeNotifier', () => {
  function fakeElectron({ supported = true } = {}) {
    const shown = [];
    class Notification {
      static isSupported() { return supported; }
      constructor(options) { this.options = options; this.handlers = {}; shown.push(this); }
      on(event, fn) { this.handlers[event] = fn; }
      show() { this.shownAt = true; }
    }
    return { Notification, shown };
  }

  it('shows a native notification with the drive and the room left', async () => {
    const { Notification, shown } = fakeElectron();
    const show = vi.fn();
    await makeNotifier({ Notification, showWindow: show })(low('C:'));
    expect(shown).toHaveLength(1);
    expect(shown[0].options.title).toBe('Low disk space on C:');
    expect(shown[0].options.body).toContain('10 GB free of 250 GB (4%)');
    expect(shown[0].shownAt).toBe(true);
  });

  it('brings Prune forward when the notification is clicked', async () => {
    const { Notification, shown } = fakeElectron();
    const show = vi.fn();
    await makeNotifier({ Notification, showWindow: show })(low('C:'));
    shown[0].handlers.click();
    expect(show).toHaveBeenCalledTimes(1);
  });

  it('refuses, so nothing is counted as told, where notifications are not supported', async () => {
    const { Notification, shown } = fakeElectron({ supported: false });
    await expect(makeNotifier({ Notification, showWindow: vi.fn() })(low('C:'))).rejects.toThrow(/not supported/i);
    expect(shown).toHaveLength(0);
  });
});
