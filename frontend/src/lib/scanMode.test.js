import { describe, it, expect } from 'vitest';
import { SCAN_MODE_KEY, readScanMode, writeScanMode } from './scanMode.js';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, data };
}

describe('scan mode memory', () => {
  it('remembers the last mode the user actually chose', () => {
    const storage = memoryStorage();
    expect(writeScanMode(storage, 'crawl')).toBe(true);
    expect(readScanMode(storage)).toBe('crawl');
    writeScanMode(storage, 'fast');
    expect(readScanMode(storage)).toBe('fast');
  });

  it('remembers nothing until a choice was made', () => {
    expect(readScanMode(memoryStorage())).toBeNull();
  });

  it('treats an unknown stored value as no memory rather than trusting it', () => {
    expect(readScanMode(memoryStorage({ [SCAN_MODE_KEY]: 'turbo' }))).toBeNull();
    expect(readScanMode(memoryStorage({ [SCAN_MODE_KEY]: '' }))).toBeNull();
  });

  it('refuses to store anything but the two modes', () => {
    const storage = memoryStorage();
    expect(writeScanMode(storage, 'turbo')).toBe(false);
    expect(writeScanMode(storage, undefined)).toBe(false);
    expect(storage.data).toEqual({});
  });

  it('survives storage that throws', () => {
    const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    expect(readScanMode(broken)).toBeNull();
    expect(writeScanMode(broken, 'fast')).toBe(false);
    expect(readScanMode(null)).toBeNull();
  });
});
