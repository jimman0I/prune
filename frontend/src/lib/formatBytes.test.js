import { describe, it, expect, afterEach } from 'vitest';
import {
  SIZE_UNITS, DEFAULT_SIZE_UNITS, normalizeSizeUnits, formatBytes, setSizeUnits, getSizeUnits, unitBytes, unitLabel
} from './formatBytes.js';

const KIB = 1024;
const GIB = 1024 ** 3;

afterEach(() => setSizeUnits(DEFAULT_SIZE_UNITS));

describe('formatBytes', () => {
  it('by default prints exactly what it always did: 1024-based, KB/MB/GB, one decimal at most', () => {
    expect(getSizeUnits()).toBe('windows');
    expect(formatBytes(null)).toBe('—');
    expect(formatBytes(undefined)).toBe('—');
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2 * KIB)).toBe('2 KB');
    expect(formatBytes(1.25 * KIB * KIB)).toBe('1.3 MB');
    expect(formatBytes(29.4 * GIB)).toBe('29.4 GB');
    expect(formatBytes(2 * 1024 ** 4)).toBe('2 TB');
  });

  it('follows the app-wide choice once it is set, with the label always matching the arithmetic', () => {
    setSizeUnits('binary');
    expect(formatBytes(2 * KIB)).toBe('2 KiB');
    expect(formatBytes(29.4 * GIB)).toBe('29.4 GiB');
    setSizeUnits('decimal');
    expect(formatBytes(2000)).toBe('2 KB');
    expect(formatBytes(1e12)).toBe('1 TB');
    expect(formatBytes(GIB)).toBe('1.1 GB');
    setSizeUnits('windows');
    expect(formatBytes(1e12)).toBe('931.3 GB');
  });

  it('takes a mode for one call without changing the app-wide one', () => {
    expect(formatBytes(2 * KIB, 'binary')).toBe('2 KiB');
    expect(getSizeUnits()).toBe('windows');
  });

  it('reads an unknown choice as the default, and never runs off either end of the units', () => {
    setSizeUnits('metric');
    expect(getSizeUnits()).toBe('windows');
    expect(normalizeSizeUnits(undefined)).toBe('windows');
    expect(SIZE_UNITS).toEqual(['windows', 'binary', 'decimal']);
    expect(formatBytes(0.5)).toBe('0.5 B');
    expect(formatBytes(3 * 1024 ** 5)).toBe('3072 TB');
  });

  it('names and sizes each unit per mode', () => {
    expect(unitLabel(3, 'windows')).toBe('GB');
    expect(unitLabel(3, 'binary')).toBe('GiB');
    expect(unitLabel(3, 'decimal')).toBe('GB');
    expect(unitBytes(3, 'binary')).toBe(GIB);
    expect(unitBytes(3, 'decimal')).toBe(1e9);
  });

  it('agrees with the backend copy the tray, notifications and command line use, byte for byte', async () => {
    const backend = await import('../../../backend/src/lib/sizeUnits.js');
    expect(backend.SIZE_UNITS).toEqual(SIZE_UNITS);
    expect(backend.DEFAULT_SIZE_UNITS).toBe(DEFAULT_SIZE_UNITS);
    const samples = [null, 0, 0.5, 1, 999, 1000, 1023, 1024, 1536, 1e6, 1048576, 123456789, GIB, 1e12, 7.3 * 1024 ** 4, 3e15];
    for (const units of SIZE_UNITS) {
      for (const bytes of samples) {
        expect(backend.formatBytes(bytes, units), `${units} ${bytes}`).toBe(formatBytes(bytes, units));
      }
    }
  });
});
