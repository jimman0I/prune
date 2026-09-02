import { describe, it, expect } from 'vitest';
import { withUnscannedRemainder } from './unscannedRemainder.js';

const GB = 1024 ** 3;

const partial = {
  name: 'C:',
  size: 35.7 * GB,
  type: 'directory',
  truncated: true,
  children: [
    { name: 'Games', size: 29.4 * GB, type: 'directory' },
    { name: 'Android', size: 5.9 * GB, type: 'directory' }
  ]
};

describe('withUnscannedRemainder', () => {
  // The real numbers this exists for: an unelevated scan of C:\ hit its
  // time budget alphabetically at "Games" and reported 35.7 GB against
  // 845 GB actually in use. Rendered as-is, the treemap said Games was
  // 82% of the disk.
  it('adds the unaccounted space as a visible block', () => {
    const result = withUnscannedRemainder(partial, 845 * GB);
    const remainder = result.children.find((c) => c.scanned === false);
    expect(remainder).toBeDefined();
    expect(remainder.size).toBeCloseTo((845 - 35.7) * GB, -6);
    // The root now totals what the drive really holds, so every slice is
    // a fraction of the truth rather than a fraction of the fragment.
    expect(result.size).toBe(845 * GB);
  });

  it('leaves the scanned children untouched', () => {
    const result = withUnscannedRemainder(partial, 845 * GB);
    const games = result.children.find((c) => c.name === 'Games');
    expect(games.size).toBe(29.4 * GB);
  });

  it('does nothing to a scan that completed', () => {
    const complete = { ...partial, truncated: false };
    expect(withUnscannedRemainder(complete, 845 * GB)).toBe(complete);
  });

  // Without a real used-space figure there is no honest remainder to
  // draw, and inventing one would be worse than the omission.
  it('does nothing when used space is unknown', () => {
    expect(withUnscannedRemainder(partial, null)).toBe(partial);
    expect(withUnscannedRemainder(partial, undefined)).toBe(partial);
  });

  it('does nothing when the scan already accounts for the drive', () => {
    const nearlyAll = { ...partial, size: 844 * GB };
    expect(withUnscannedRemainder(nearlyAll, 845 * GB)).toBe(nearlyAll);
  });

  it('does not add a negative or absurd remainder when the scan exceeds used space', () => {
    // Hardlinks make a sum of logical sizes legitimately exceed used
    // space; that is not unscanned room.
    const over = { ...partial, size: 900 * GB };
    expect(withUnscannedRemainder(over, 845 * GB)).toBe(over);
  });

  it('never mutates the tree it was given', () => {
    const before = JSON.stringify(partial);
    withUnscannedRemainder(partial, 845 * GB);
    expect(JSON.stringify(partial)).toBe(before);
  });

  it('handles a null tree', () => {
    expect(withUnscannedRemainder(null, 845 * GB)).toBeNull();
  });
});

import { scanCoverage } from './unscannedRemainder.js';

describe('scanCoverage', () => {
  const withRemainder = withUnscannedRemainder(partial, 845 * GB);

  it('reports how much of the drive the scan actually measured', () => {
    const c = scanCoverage(withRemainder);
    expect(c.used).toBe(845 * GB);
    expect(c.measured).toBeCloseTo(35.7 * GB, -6);
    // 35.7 of 845 is 4% -- the number that makes the situation obvious.
    expect(c.percent).toBe(4);
  });

  it('returns null when there is no remainder block to measure against', () => {
    expect(scanCoverage(partial)).toBeNull();
    expect(scanCoverage(null)).toBeNull();
    expect(scanCoverage({ name: 'C:', size: 1, type: 'directory' })).toBeNull();
  });

  it('never reports 0% for a scan that did measure something', () => {
    // Rounding a real but tiny result down to 0% would read as "nothing
    // was scanned", which is a different and wrong claim.
    const tiny = withUnscannedRemainder(
      { ...partial, size: 0.5 * GB },
      845 * GB
    );
    expect(scanCoverage(tiny).percent).toBe(1);
  });
});
