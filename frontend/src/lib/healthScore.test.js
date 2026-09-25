import { describe, it, expect } from 'vitest';
import { computeHealthScore, healthBand } from './healthScore.js';

const HEALTHY_DRIVE_VERDICT = { percent: 90, statusLabel: null, tone: 'success' };
const CLEAN_DISK = { readErrorsUncorrected: 0, writeErrorsUncorrected: 0, smart: { mediaErrors: 0 } };

describe('computeHealthScore -- drive component', () => {
  it('uses the real life-remaining percent directly when one exists', () => {
    const { breakdown, score } = computeHealthScore({
      driveVerdict: { percent: 77, statusLabel: null, tone: 'success' }, primaryDisk: CLEAN_DISK
    });
    expect(breakdown.drive).toBe(77);
    expect(score).toBe(77);
  });

  it('falls back to a tone-based value when no percent exists: success', () => {
    const { score } = computeHealthScore({
      driveVerdict: { percent: null, statusLabel: 'Healthy', tone: 'success' }, primaryDisk: CLEAN_DISK
    });
    expect(score).toBe(100);
  });

  it('falls back to a tone-based value when no percent exists: warning', () => {
    const { score } = computeHealthScore({
      driveVerdict: { percent: null, statusLabel: 'Warning', tone: 'warning' }, primaryDisk: CLEAN_DISK
    });
    expect(score).toBe(50);
  });

  it('falls back to a tone-based value when no percent exists: danger', () => {
    const { score } = computeHealthScore({
      driveVerdict: { percent: null, statusLabel: 'Unhealthy', tone: 'danger' }, primaryDisk: CLEAN_DISK
    });
    expect(score).toBe(0);
  });

  it('a genuinely unknown drive verdict has no score, rather than an invented neutral one', () => {
    const { score } = computeHealthScore({
      driveVerdict: { percent: null, statusLabel: 'Unknown', tone: 'muted' }, primaryDisk: CLEAN_DISK
    });
    expect(score).toBeNull();
  });

  it('is null until the drive has answered, never a made-up healthy number', () => {
    const { breakdown, score } = computeHealthScore({ driveVerdict: null, primaryDisk: null });
    expect(breakdown.drive).toBeNull();
    expect(breakdown.errors).toBeNull();
    expect(score).toBeNull();
  });
});

describe('computeHealthScore -- drive errors', () => {
  it('leaves the score alone when the drive reports no errors', () => {
    const { breakdown, score } = computeHealthScore({ driveVerdict: HEALTHY_DRIVE_VERDICT, primaryDisk: CLEAN_DISK });
    expect(breakdown.errors).toBe(100);
    expect(score).toBe(90);
  });

  it('caps the score into the lowest band for any media error, however healthy the wear', () => {
    const { breakdown, score } = computeHealthScore({
      driveVerdict: { percent: 100, statusLabel: null, tone: 'success' },
      primaryDisk: { ...CLEAN_DISK, smart: { mediaErrors: 1 } }
    });
    expect(breakdown.errors).toBe(0);
    expect(score).toBe(40);
    expect(healthBand(score)).toBe('problem');
  });

  it('caps for an uncorrected read error', () => {
    const { score } = computeHealthScore({
      driveVerdict: HEALTHY_DRIVE_VERDICT, primaryDisk: { ...CLEAN_DISK, readErrorsUncorrected: 1 }
    });
    expect(score).toBe(40);
  });

  it('caps for an uncorrected write error', () => {
    const { score } = computeHealthScore({
      driveVerdict: HEALTHY_DRIVE_VERDICT, primaryDisk: { ...CLEAN_DISK, writeErrorsUncorrected: 1 }
    });
    expect(score).toBe(40);
  });

  it('never raises a drive that is already below the cap', () => {
    const { score } = computeHealthScore({
      driveVerdict: { percent: 12, statusLabel: null, tone: 'warning' },
      primaryDisk: { ...CLEAN_DISK, smart: { mediaErrors: 3 } }
    });
    expect(score).toBe(12);
  });
});

describe('computeHealthScore -- drive only', () => {
  it('takes no storage or apps input, and the breakdown holds only the drive', () => {
    const { breakdown } = computeHealthScore({
      driveVerdict: HEALTHY_DRIVE_VERDICT, primaryDisk: CLEAN_DISK,
      // Stale callers may still pass these; they must have no effect.
      diskSpace: { freeBytes: 1, totalBytes: 1000 }, brokenCount: 10
    });
    expect(Object.keys(breakdown).sort()).toEqual(['drive', 'errors']);
  });

  it('a nearly full disk and broken apps do not move the score', () => {
    const args = { driveVerdict: HEALTHY_DRIVE_VERDICT, primaryDisk: CLEAN_DISK };
    const clean = computeHealthScore({ ...args, diskSpace: { freeBytes: 900, totalBytes: 1000 }, brokenCount: 0 });
    const cramped = computeHealthScore({ ...args, diskSpace: { freeBytes: 5, totalBytes: 1000 }, brokenCount: 8 });
    expect(cramped.score).toBe(clean.score);
  });
});

describe('healthBand', () => {
  it('75 and up is good, 50 and up is caution, below that is a problem', () => {
    expect(healthBand(100)).toBe('good');
    expect(healthBand(75)).toBe('good');
    expect(healthBand(74)).toBe('caution');
    expect(healthBand(50)).toBe('caution');
    expect(healthBand(49)).toBe('problem');
    expect(healthBand(0)).toBe('problem');
  });

  it('has no band for a score that has not arrived', () => {
    expect(healthBand(null)).toBeNull();
    expect(healthBand(undefined)).toBeNull();
    expect(healthBand(NaN)).toBeNull();
  });
});
