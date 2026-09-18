import { describe, it, expect } from 'vitest';
import { computeHealthScore } from './healthScore.js';

const HEALTHY_DRIVE_VERDICT = { percent: 90, statusLabel: null, tone: 'success' };
const DISK_SPACE_25_PERCENT_FREE = { freeBytes: 250, totalBytes: 1000 }; // 25% free
const CLEAN_DISK = { readErrorsUncorrected: 0, writeErrorsUncorrected: 0, smart: { mediaErrors: 0 } };

describe('computeHealthScore -- drive component', () => {
  it('uses the real life-remaining percent directly when one exists', () => {
    const { breakdown } = computeHealthScore({
      driveVerdict: { percent: 77, statusLabel: null, tone: 'success' },
      primaryDisk: CLEAN_DISK, diskSpace: DISK_SPACE_25_PERCENT_FREE, brokenCount: 0
    });
    expect(breakdown.drive).toBe(77);
  });

  it('falls back to a tone-based value when no percent exists: success', () => {
    const { breakdown } = computeHealthScore({
      driveVerdict: { percent: null, statusLabel: 'Healthy', tone: 'success' },
      primaryDisk: CLEAN_DISK, diskSpace: DISK_SPACE_25_PERCENT_FREE, brokenCount: 0
    });
    expect(breakdown.drive).toBe(100);
  });

  it('falls back to a tone-based value when no percent exists: warning', () => {
    const { breakdown } = computeHealthScore({
      driveVerdict: { percent: null, statusLabel: 'Warning', tone: 'warning' },
      primaryDisk: CLEAN_DISK, diskSpace: DISK_SPACE_25_PERCENT_FREE, brokenCount: 0
    });
    expect(breakdown.drive).toBe(50);
  });

  it('falls back to a tone-based value when no percent exists: danger', () => {
    const { breakdown } = computeHealthScore({
      driveVerdict: { percent: null, statusLabel: 'Unhealthy', tone: 'danger' },
      primaryDisk: CLEAN_DISK, diskSpace: DISK_SPACE_25_PERCENT_FREE, brokenCount: 0
    });
    expect(breakdown.drive).toBe(0);
  });

  it('a genuinely unknown drive verdict (a real answer, not a loading state) scores as neutral, not failing', () => {
    const { breakdown } = computeHealthScore({
      driveVerdict: { percent: null, statusLabel: 'Unknown', tone: 'muted' },
      primaryDisk: CLEAN_DISK, diskSpace: DISK_SPACE_25_PERCENT_FREE, brokenCount: 0
    });
    expect(breakdown.drive).toBe(75);
  });

  it('is null when drive data has not loaded yet at all', () => {
    const { breakdown, score } = computeHealthScore({
      driveVerdict: null, primaryDisk: null, diskSpace: DISK_SPACE_25_PERCENT_FREE, brokenCount: 0
    });
    expect(breakdown.drive).toBeNull();
    // The whole score stays hidden until drive AND storage have both
    // answered -- see this task's own top-of-file note for why.
    expect(score).toBeNull();
  });
});

describe('computeHealthScore -- storage component', () => {
  it('scores full at 20% free or above', () => {
    const { breakdown } = computeHealthScore({
      driveVerdict: HEALTHY_DRIVE_VERDICT, primaryDisk: CLEAN_DISK,
      diskSpace: { freeBytes: 200, totalBytes: 1000 }, brokenCount: 0 // 20% free
    });
    expect(breakdown.storage).toBe(100);
  });

  it('scores 0 at 2% free or below', () => {
    const { breakdown } = computeHealthScore({
      driveVerdict: HEALTHY_DRIVE_VERDICT, primaryDisk: CLEAN_DISK,
      diskSpace: { freeBytes: 20, totalBytes: 1000 }, brokenCount: 0 // 2% free
    });
    expect(breakdown.storage).toBe(0);
  });

  it('scales linearly between the two thresholds', () => {
    const { breakdown } = computeHealthScore({
      driveVerdict: HEALTHY_DRIVE_VERDICT, primaryDisk: CLEAN_DISK,
      diskSpace: { freeBytes: 110, totalBytes: 1000 }, brokenCount: 0 // 11% free, halfway between 2 and 20
    });
    expect(breakdown.storage).toBe(50);
  });

  it('is null when disk space has not loaded yet, and so is the whole score', () => {
    const { breakdown, score } = computeHealthScore({
      driveVerdict: HEALTHY_DRIVE_VERDICT, primaryDisk: CLEAN_DISK, diskSpace: null, brokenCount: 0
    });
    expect(breakdown.storage).toBeNull();
    expect(score).toBeNull();
  });
});

describe('computeHealthScore -- apps component', () => {
  it('scores full with zero broken apps', () => {
    const { breakdown } = computeHealthScore({
      driveVerdict: HEALTHY_DRIVE_VERDICT, primaryDisk: CLEAN_DISK, diskSpace: DISK_SPACE_25_PERCENT_FREE, brokenCount: 0
    });
    expect(breakdown.apps).toBe(100);
  });

  it('deducts per broken app', () => {
    const { breakdown } = computeHealthScore({
      driveVerdict: HEALTHY_DRIVE_VERDICT, primaryDisk: CLEAN_DISK, diskSpace: DISK_SPACE_25_PERCENT_FREE, brokenCount: 2
    });
    expect(breakdown.apps).toBe(50);
  });

  it('floors at 0 rather than going negative', () => {
    const { breakdown } = computeHealthScore({
      driveVerdict: HEALTHY_DRIVE_VERDICT, primaryDisk: CLEAN_DISK, diskSpace: DISK_SPACE_25_PERCENT_FREE, brokenCount: 10
    });
    expect(breakdown.apps).toBe(0);
  });
});

describe('computeHealthScore -- errors component', () => {
  it('scores full with no reported errors', () => {
    const { breakdown } = computeHealthScore({
      driveVerdict: HEALTHY_DRIVE_VERDICT, primaryDisk: CLEAN_DISK, diskSpace: DISK_SPACE_25_PERCENT_FREE, brokenCount: 0
    });
    expect(breakdown.errors).toBe(100);
  });

  it('scores 0 for any media error, regardless of count', () => {
    const { breakdown } = computeHealthScore({
      driveVerdict: HEALTHY_DRIVE_VERDICT,
      primaryDisk: { ...CLEAN_DISK, smart: { mediaErrors: 1 } },
      diskSpace: DISK_SPACE_25_PERCENT_FREE, brokenCount: 0
    });
    expect(breakdown.errors).toBe(0);
  });

  it('scores 0 for an uncorrected read error', () => {
    const { breakdown } = computeHealthScore({
      driveVerdict: HEALTHY_DRIVE_VERDICT,
      primaryDisk: { ...CLEAN_DISK, readErrorsUncorrected: 1 },
      diskSpace: DISK_SPACE_25_PERCENT_FREE, brokenCount: 0
    });
    expect(breakdown.errors).toBe(0);
  });

  it('scores 0 for an uncorrected write error', () => {
    const { breakdown } = computeHealthScore({
      driveVerdict: HEALTHY_DRIVE_VERDICT,
      primaryDisk: { ...CLEAN_DISK, writeErrorsUncorrected: 1 },
      diskSpace: DISK_SPACE_25_PERCENT_FREE, brokenCount: 0
    });
    expect(breakdown.errors).toBe(0);
  });

  it('is null when there is no disk at all', () => {
    const { breakdown } = computeHealthScore({
      driveVerdict: null, primaryDisk: null, diskSpace: DISK_SPACE_25_PERCENT_FREE, brokenCount: 0
    });
    expect(breakdown.errors).toBeNull();
  });
});

describe('computeHealthScore -- the composite score', () => {
  it('weights drive 40, storage 25, apps 20, errors 15 when everything is known and perfect', () => {
    const { score } = computeHealthScore({
      driveVerdict: { percent: 100, statusLabel: null, tone: 'success' },
      primaryDisk: CLEAN_DISK, diskSpace: { freeBytes: 500, totalBytes: 1000 }, brokenCount: 0
    });
    expect(score).toBe(100);
  });

  it('a real mixed case computes the documented weighted average', () => {
    // drive 50 (warning tone) * 40 + storage 100 * 25 + apps 75 (1 broken app) * 20 + errors 100 * 15
    // = 2000 + 2500 + 1500 + 1500 = 7500 / 100 = 75
    const { score } = computeHealthScore({
      driveVerdict: { percent: null, statusLabel: 'Warning', tone: 'warning' },
      primaryDisk: CLEAN_DISK, diskSpace: { freeBytes: 500, totalBytes: 1000 }, brokenCount: 1
    });
    expect(score).toBe(75);
  });

  it('rescales the denominator when errors is unavailable but drive and storage are known', () => {
    // This can't actually happen with a real primaryDisk (drive requires
    // primaryDisk, and primaryDisk implies errors is computable too), but
    // the function must not divide by a weight that was never included.
    // drive 100*40 + storage 100*25 + apps 100*20 = 8500 / 85 = 100
    const { score } = computeHealthScore({
      driveVerdict: { percent: 100, statusLabel: null, tone: 'success' },
      primaryDisk: null, diskSpace: { freeBytes: 500, totalBytes: 1000 }, brokenCount: 0
    });
    // drive itself requires primaryDisk truthiness in real Dashboard usage
    // (a later task), but this function only sees what it's handed --
    // prove it doesn't crash or divide by zero on an inconsistent input,
    // and that a null errors component is excluded from both sides of the
    // average rather than silently scored as 0.
    expect(score).toBe(100);
  });
});
