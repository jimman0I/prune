import { describe, it, expect } from 'vitest';
import {
  SIZE_UNITS, DEFAULT_SIZE_UNITS, normalizeSizeUnits, formatBytes, formatGigabytes, formatGigabytesFixed
} from './sizeUnits.js';

const KIB = 1024;
const GIB = 1024 ** 3;

describe('normalizeSizeUnits', () => {
  it('keeps each of the three choices', () => {
    for (const units of SIZE_UNITS) expect(normalizeSizeUnits(units)).toBe(units);
    expect(SIZE_UNITS).toEqual(['windows', 'binary', 'decimal']);
  });

  it("reads anything else as 'windows', the 1024-based KB that Prune always printed", () => {
    expect(DEFAULT_SIZE_UNITS).toBe('windows');
    for (const junk of [undefined, null, '', 'Decimal', 'si', 'iec', 1000, {}]) {
      expect(normalizeSizeUnits(junk), String(junk)).toBe('windows');
    }
  });
});

describe('formatBytes', () => {
  it("'windows' is exactly the old output: 1024-based, labelled KB/MB/GB", () => {
    expect(formatBytes(0, 'windows')).toBe('0 B');
    expect(formatBytes(512, 'windows')).toBe('512 B');
    expect(formatBytes(2 * KIB, 'windows')).toBe('2 KB');
    expect(formatBytes(1.5 * KIB * KIB, 'windows')).toBe('1.5 MB');
    expect(formatBytes(29.4 * GIB, 'windows')).toBe('29.4 GB');
    expect(formatBytes(2 * 1024 ** 4, 'windows')).toBe('2 TB');
  });

  it("'binary' is the same arithmetic with the IEC names", () => {
    expect(formatBytes(2 * KIB, 'binary')).toBe('2 KiB');
    expect(formatBytes(1.5 * KIB * KIB, 'binary')).toBe('1.5 MiB');
    expect(formatBytes(29.4 * GIB, 'binary')).toBe('29.4 GiB');
    expect(formatBytes(2 * 1024 ** 4, 'binary')).toBe('2 TiB');
  });

  it("'decimal' is 1000-based, so a drive sold as 1 TB reads 1 TB", () => {
    expect(formatBytes(2000, 'decimal')).toBe('2 KB');
    expect(formatBytes(1024, 'decimal')).toBe('1 KB');
    expect(formatBytes(1e12, 'decimal')).toBe('1 TB');
    expect(formatBytes(1e12, 'windows')).toBe('931.3 GB');
    expect(formatBytes(GIB, 'decimal')).toBe('1.1 GB');
  });

  it('treats an unknown mode as the default and an unmeasured value as missing', () => {
    expect(formatBytes(2 * KIB, 'nonsense')).toBe('2 KB');
    expect(formatBytes(2 * KIB)).toBe('2 KB');
    expect(formatBytes(null, 'decimal')).toBe('—');
    expect(formatBytes(undefined, 'windows', { missing: '-' })).toBe('-');
  });

  it('never runs off either end of the unit list', () => {
    expect(formatBytes(0.5, 'windows')).toBe('0.5 B');
    expect(formatBytes(3 * 1024 ** 5, 'windows')).toBe('3072 TB');
    expect(formatBytes(3e15, 'decimal')).toBe('3000 TB');
  });
});

describe('formatGigabytes / formatGigabytesFixed', () => {
  it('always say gigabytes, in the chosen thousand and name', () => {
    expect(formatGigabytes(12.4 * GIB, 'windows')).toBe('12.4 GB');
    expect(formatGigabytes(250 * GIB, 'windows')).toBe('250 GB');
    expect(formatGigabytes(250 * GIB, 'binary')).toBe('250 GiB');
    expect(formatGigabytes(250 * GIB, 'decimal')).toBe('268.4 GB');
    expect(formatGigabytes(0.8 * GIB)).toBe('0.8 GB');
  });

  it('the fixed form keeps its one decimal, as the tray tooltip always did', () => {
    expect(formatGigabytesFixed(12 * GIB, 'windows')).toBe('12.0 GB');
    expect(formatGigabytesFixed(12 * GIB, 'binary')).toBe('12.0 GiB');
    expect(formatGigabytesFixed(12e9, 'decimal')).toBe('12.0 GB');
  });
});
