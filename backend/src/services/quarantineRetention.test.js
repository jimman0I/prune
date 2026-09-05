import { describe, it, expect } from 'vitest';
import { expiredBatches, retentionDaysFrom, RETENTION_OFF } from './quarantineRetention.js';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 5, 12, 0, 0);
const batch = (name, ageDays) => ({
  programName: name,
  batchDir: `C:\\q\\${name}`,
  createdAt: NOW - ageDays * DAY
});

describe('retentionDaysFrom', () => {
  it('reads a real number of days', () => {
    expect(retentionDaysFrom({ quarantineRetentionDays: 30 })).toBe(30);
  });

  it('treats zero as off, not as "purge everything immediately"', () => {
    // The single most dangerous misreading available here. 0 has to mean
    // "keep forever", because the alternative empties the safety net the
    // moment someone types it.
    expect(retentionDaysFrom({ quarantineRetentionDays: 0 })).toBe(RETENTION_OFF);
  });

  it('treats missing, null and nonsense as off', () => {
    // Off is the only safe default for a setting that deletes things. A
    // corrupt settings file must not start purging.
    expect(retentionDaysFrom({})).toBe(RETENTION_OFF);
    expect(retentionDaysFrom({ quarantineRetentionDays: null })).toBe(RETENTION_OFF);
    expect(retentionDaysFrom({ quarantineRetentionDays: 'thirty' })).toBe(RETENTION_OFF);
    expect(retentionDaysFrom({ quarantineRetentionDays: -5 })).toBe(RETENTION_OFF);
    expect(retentionDaysFrom(null)).toBe(RETENTION_OFF);
  });
});

describe('expiredBatches', () => {
  const batches = [
    batch('Ancient', 90),
    batch('OldEnough', 31),
    batch('ExactlyAtLimit', 30),
    batch('Recent', 2),
    batch('Today', 0)
  ];

  it('returns only what is older than the retention window', () => {
    const expired = expiredBatches(batches, { now: NOW, retentionDays: 30 }).map((b) => b.programName);
    expect(expired).toEqual(['Ancient', 'OldEnough']);
  });

  it('keeps a batch that is exactly at the limit', () => {
    // "Empty after 30 days" should not delete something on its thirtieth
    // day. Strictly older, so the boundary keeps the file.
    const names = expiredBatches(batches, { now: NOW, retentionDays: 30 }).map((b) => b.programName);
    expect(names).not.toContain('ExactlyAtLimit');
  });

  it('returns nothing when retention is off', () => {
    expect(expiredBatches(batches, { now: NOW, retentionDays: RETENTION_OFF })).toEqual([]);
    expect(expiredBatches(batches, { now: NOW, retentionDays: 0 })).toEqual([]);
  });

  it('ignores a batch with no usable timestamp', () => {
    // A manifest that lost its createdAt has an unknown age, and unknown
    // must not mean "expired" for something irreversible.
    const odd = [
      { programName: 'NoDate', batchDir: 'x' },
      { programName: 'BadDate', batchDir: 'y', createdAt: 'yesterday' },
      { programName: 'Future', batchDir: 'z', createdAt: NOW + 5 * DAY }
    ];
    expect(expiredBatches(odd, { now: NOW, retentionDays: 1 })).toEqual([]);
  });

  it('copes with no batches at all', () => {
    expect(expiredBatches(null, { now: NOW, retentionDays: 30 })).toEqual([]);
    expect(expiredBatches([], { now: NOW, retentionDays: 30 })).toEqual([]);
  });
});
