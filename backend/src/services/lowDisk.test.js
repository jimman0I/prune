import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isLow, findLowDrives, normalizeLowDiskPercent, lowDiskMessage, resetDriveListCache,
  MIN_MONITORED_BYTES, ROOMY_FREE_BYTES
} from './lowDisk.js';

const GB = 1024 ** 3;
const drive = (letter, totalGb, freeGb, extra = {}) => ({
  drive: letter, label: '', totalBytes: totalGb * GB, freeBytes: freeGb * GB, ...extra
});

describe('isLow', () => {
  it('is low when free space is under the chosen share of the drive', () => {
    expect(isLow(drive('C:', 500, 49), 10)).toBe(true);
    expect(isLow(drive('C:', 500, 51), 10)).toBe(false);
  });

  it('is not low exactly at the line: it has to fall below it', () => {
    expect(isLow(drive('C:', 500, 50), 10)).toBe(false);
  });

  it('follows the share that was chosen', () => {
    const c = drive('C:', 200, 25); // 12.5%
    expect(isLow(c, 5)).toBe(false);
    expect(isLow(c, 10)).toBe(false);
    expect(isLow(c, 15)).toBe(true);
  });

  it('is never low when the warning is off', () => {
    expect(isLow(drive('C:', 500, 1), 0)).toBe(false);
  });

  it('ignores a volume too small to be a place to store things (recovery, tools)', () => {
    expect(MIN_MONITORED_BYTES).toBe(8 * GB);
    expect(isLow({ totalBytes: 7 * GB, freeBytes: 0 }, 10)).toBe(false);
    expect(isLow({ totalBytes: 8 * GB, freeBytes: 0 }, 10)).toBe(true);
  });

  it('never calls a drive low while it has 100 GB free, whatever its size', () => {
    // 10% of a 4 TB disk is about 410 GB: not a number anyone needs warning at.
    expect(ROOMY_FREE_BYTES).toBe(100 * GB);
    expect(isLow(drive('D:', 4096, 300), 10)).toBe(false);
    expect(isLow(drive('D:', 4096, 99), 10)).toBe(true);
  });

  it('is not fooled by sizes that make no sense', () => {
    expect(isLow({ totalBytes: 0, freeBytes: 0 }, 10)).toBe(false);
    expect(isLow({ totalBytes: NaN, freeBytes: 5 }, 10)).toBe(false);
    expect(isLow({ totalBytes: 100 * GB, freeBytes: NaN }, 10)).toBe(false);
    expect(isLow({ totalBytes: 100 * GB, freeBytes: -5 }, 10)).toBe(true);
  });
});

describe('normalizeLowDiskPercent', () => {
  it.each([0, 5, 10, 15])('keeps %p', (value) => expect(normalizeLowDiskPercent(value)).toBe(value));

  it.each([undefined, null, '10', 7, -1, 100, NaN, {}, true])('reads %p as the default, never as Off', (value) => {
    expect(normalizeLowDiskPercent(value)).toBe(10);
  });
});

describe('findLowDrives', () => {
  beforeEach(() => resetDriveListCache());

  it('returns only the low drives, with how much is free and what share that is', async () => {
    const fetchDrives = vi.fn(async () => [drive('C:', 500, 20), drive('D:', 1000, 600)]);
    const readSpace = vi.fn(async (letter) => (letter === 'C:' ? { freeBytes: 20 * GB, totalBytes: 500 * GB } : { freeBytes: 600 * GB, totalBytes: 1000 * GB }));
    const low = await findLowDrives({ percent: 10, fetchDrives, readSpace });
    expect(low).toEqual([{ drive: 'C:', label: '', freeBytes: 20 * GB, totalBytes: 500 * GB, percentFree: 4 }]);
  });

  it('does not even look at the disks when the warning is off', async () => {
    const fetchDrives = vi.fn();
    const readSpace = vi.fn();
    expect(await findLowDrives({ percent: 0, fetchDrives, readSpace })).toEqual([]);
    expect(fetchDrives).not.toHaveBeenCalled();
    expect(readSpace).not.toHaveBeenCalled();
  });

  it('trusts the live reading over the one the list was made with', async () => {
    const fetchDrives = async () => [drive('C:', 500, 300)];
    const readSpace = async () => ({ freeBytes: 10 * GB, totalBytes: 500 * GB });
    const low = await findLowDrives({ percent: 10, fetchDrives, readSpace });
    expect(low.map((d) => d.drive)).toEqual(['C:']);
  });

  it('falls back to the listed figures when a live reading fails', async () => {
    const fetchDrives = async () => [drive('C:', 500, 10)];
    const readSpace = async () => { throw new Error('EPERM'); };
    const low = await findLowDrives({ percent: 10, fetchDrives, readSpace });
    expect(low).toHaveLength(1);
    expect(low[0].freeBytes).toBe(10 * GB);
  });

  it('is empty, not an error, when the drives cannot be listed', async () => {
    const fetchDrives = async () => { throw new Error('powershell died'); };
    expect(await findLowDrives({ percent: 10, fetchDrives, readSpace: vi.fn() })).toEqual([]);
  });

  it('leaves out a volume that is full by design', async () => {
    const fetchDrives = async () => [drive('R:', 1, 0), drive('C:', 500, 10)];
    const readSpace = async (letter) => (letter === 'R:' ? { freeBytes: 0, totalBytes: 1 * GB } : { freeBytes: 10 * GB, totalBytes: 500 * GB });
    const low = await findLowDrives({ percent: 10, fetchDrives, readSpace });
    expect(low.map((d) => d.drive)).toEqual(['C:']);
  });
});

describe('the drive list is kept for a while', () => {
  it('is asked for once inside the hour, because the set of drives rarely changes', async () => {
    resetDriveListCache();
    let now = 1_000_000;
    const fetchDrives = vi.fn(async () => [drive('C:', 500, 10)]);
    const readSpace = async () => ({ freeBytes: 10 * GB, totalBytes: 500 * GB });
    await findLowDrives({ percent: 10, readSpace, fetchDrives, now: () => now });
    now += 10 * 60 * 1000;
    await findLowDrives({ percent: 10, readSpace, fetchDrives, now: () => now });
    expect(fetchDrives).toHaveBeenCalledTimes(1);
    now += 60 * 60 * 1000;
    await findLowDrives({ percent: 10, readSpace, fetchDrives, now: () => now });
    expect(fetchDrives).toHaveBeenCalledTimes(2);
  });

  it('is asked again soon after a failure, not an hour later', async () => {
    resetDriveListCache();
    let now = 1_000_000;
    const fetchDrives = vi.fn()
      .mockRejectedValueOnce(new Error('busy'))
      .mockResolvedValue([drive('C:', 500, 10)]);
    const readSpace = async () => ({ freeBytes: 10 * GB, totalBytes: 500 * GB });
    expect(await findLowDrives({ percent: 10, readSpace, fetchDrives, now: () => now })).toEqual([]);
    now += 2 * 60 * 1000;
    expect(await findLowDrives({ percent: 10, readSpace, fetchDrives, now: () => now })).toHaveLength(1);
  });
});

describe('lowDiskMessage', () => {
  it('names the drive, what is free, and what share that is', () => {
    const msg = lowDiskMessage({ drive: 'C:', freeBytes: 12.4 * GB, totalBytes: 250 * GB, percentFree: 5 });
    expect(msg.title).toBe('Low disk space on C:');
    expect(msg.body).toBe('12.4 GB free of 250 GB (5%). Open Prune to free some up.');
  });
});
