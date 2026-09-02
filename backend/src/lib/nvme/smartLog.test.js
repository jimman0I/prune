import { describe, it, expect } from 'vitest';
import { parseNvmeSmartLog, lifeRemainingFromWear } from './smartLog.js';

/** A real SMART log page captured from this machine's Micron 2300 NVMe.
 * Cross-checked at capture time against values known from other sources:
 * the temperature agreed with Get-StorageReliabilityCounter's reading to
 * within the degree it drifts between reads. Using genuine bytes rather
 * than a hand-built buffer is what makes these offsets trustworthy --
 * a synthetic fixture only proves the parser agrees with itself. */
const REAL_LOG = Buffer.from('AEUBZDIMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA3aGQSAAAAAAAAAAAAAAAAesSiDgAAAAAAAAAAAAAAACtmqX0AAAAAAAAAAAAAAACoz/pjAAAAAAAAAAAAAAAAsLgAAAAAAAAAAAAAAAAAAI4IAAAAAAAAAAAAAAAAAACMMAAAAAAAAAAAAAAAAAAANwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAChCAAAAAAAAAAAAAAAAAAAAAAAAAAAAABFAUsBAAAAAAAAAAAAAAAAuREAAAAAAACjLRYBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', 'base64');

describe('parseNvmeSmartLog (real drive capture)', () => {
  it('reads the log page this drive actually returned', () => {
    const smart = parseNvmeSmartLog(REAL_LOG);
    expect(smart.temperatureC).toBe(52);
    expect(smart.percentageUsed).toBe(12);
    expect(smart.availableSparePercent).toBe(100);
    expect(smart.availableSpareThresholdPercent).toBe(50);
    expect(smart.powerOnHours).toBe(12428);
    expect(smart.powerCycles).toBe(2190);
    expect(smart.unsafeShutdowns).toBe(55);
    expect(smart.mediaErrors).toBe(0);
  });

  it('converts data units to bytes at 512,000 per unit', () => {
    const smart = parseNvmeSmartLog(REAL_LOG);
    expect(smart.bytesWritten).toBe(smart.dataUnitsWritten * 512000);
    // ~126 TB written, which is the number a wear estimate has to be
    // consistent with -- a drive reporting 12% used after 126 TB is
    // coherent for a 1 TB consumer NVMe.
    expect(smart.bytesWritten / 1e12).toBeGreaterThan(100);
  });

  it('reports no critical warnings on a healthy drive', () => {
    const smart = parseNvmeSmartLog(REAL_LOG);
    expect(smart.criticalWarning).toBe(0);
    expect(Object.values(smart.criticalWarningFlags).every((f) => f === false)).toBe(true);
  });
});

describe('parseNvmeSmartLog (synthetic edge cases)', () => {
  const blank = () => Buffer.alloc(512);

  it('decodes each critical-warning bit separately', () => {
    const b = blank();
    b[0] = 0b00010101;
    const flags = parseNvmeSmartLog(b).criticalWarningFlags;
    expect(flags.spareBelowThreshold).toBe(true);
    expect(flags.temperatureThreshold).toBe(false);
    expect(flags.reliabilityDegraded).toBe(true);
    expect(flags.readOnlyMode).toBe(false);
    expect(flags.volatileMemoryBackupFailed).toBe(true);
  });

  // A drive reporting 0 Kelvin is not at absolute zero, it just isn't
  // reporting -- showing -273 C would be an obvious lie.
  it('returns null for a temperature the drive does not report', () => {
    expect(parseNvmeSmartLog(blank()).temperatureC).toBeNull();
  });

  it('reads a counter that needs more than 32 bits', () => {
    const b = blank();
    b.writeBigUInt64LE(5_000_000_000n, 128);
    expect(parseNvmeSmartLog(b).powerOnHours).toBe(5_000_000_000);
  });

  it('rejects a buffer that is not a full log page', () => {
    expect(() => parseNvmeSmartLog(Buffer.alloc(100))).toThrow(/512/);
    expect(() => parseNvmeSmartLog(null)).toThrow();
  });
});

describe('lifeRemainingFromWear', () => {
  it('subtracts wear from 100', () => {
    expect(lifeRemainingFromWear(12)).toBe(88);
    expect(lifeRemainingFromWear(0)).toBe(100);
  });

  // The NVMe spec explicitly allows Percentage Used to exceed 100 once a
  // drive passes its rated endurance. Unclamped, that renders a negative
  // bar.
  it('clamps a drive past its rated endurance to 0', () => {
    expect(lifeRemainingFromWear(140)).toBe(0);
  });

  it('returns null when there is no wear figure', () => {
    expect(lifeRemainingFromWear(null)).toBeNull();
    expect(lifeRemainingFromWear(undefined)).toBeNull();
  });
});
