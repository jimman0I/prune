import { describe, it, expect } from 'vitest';
import {
  SIZE_CAP_OFF, maxBytesFrom, quarantineTotals, batchesOverCap, GIB
} from './quarantineSizeCap.js';

const batch = (name, createdAt, totalSizeBytes) => ({
  programName: name, createdAt, totalSizeBytes, batchDir: `C:\\q\\${createdAt}-${name}`
});

describe('maxBytesFrom', () => {
  it('reads a cap in the same GB the quarantine screen prints', () => {
    // The screen's formatBytes divides by 1024. A setting that meant
    // 1000-based GB would show "4.7 GB held" against a cap the user set
    // to 5 and be telling the truth twice in two different units.
    expect(maxBytesFrom({ quarantineMaxSizeGb: 5 })).toBe(5 * GIB);
    expect(GIB).toBe(1024 ** 3);
  });

  it('accepts a fraction of a gigabyte', () => {
    expect(maxBytesFrom({ quarantineMaxSizeGb: 0.5 })).toBe(0.5 * GIB);
  });

  it('treats every ambiguous value as off', () => {
    // The same rule retentionDaysFrom uses, for the same reason: a cap
    // that fails to run wastes disk, and one that runs when it should not
    // destroys the only copy of something the user deleted by accident.
    // Zero especially -- read as "keep nothing", it empties the safety net
    // the moment somebody types a 0 into a number field.
    for (const quarantineMaxSizeGb of [0, null, undefined, -1, 'lots', NaN, Infinity, {}]) {
      expect(maxBytesFrom({ quarantineMaxSizeGb }), String(quarantineMaxSizeGb)).toBe(SIZE_CAP_OFF);
    }
    expect(maxBytesFrom(undefined)).toBe(SIZE_CAP_OFF);
  });
});

describe('quarantineTotals', () => {
  it('adds up what is held', () => {
    const totals = quarantineTotals([batch('A', 3, 100), batch('B', 2, 250)]);
    expect(totals.totalBytes).toBe(350);
    expect(totals.batchCount).toBe(2);
  });

  it('counts an unmeasured batch separately rather than as zero', () => {
    // The Disk Map records the size its scan already had; a client that
    // sends none leaves the manifest with null. Adding that in as 0 would
    // understate the total while looking exact -- the same distinction
    // batchSummary already draws on the Applications tab.
    const totals = quarantineTotals([
      batch('A', 3, 100), batch('B', 2, null), { programName: 'C', createdAt: 1 }
    ]);
    expect(totals.totalBytes).toBe(100);
    expect(totals.unknownSizeCount).toBe(2);
    expect(totals.exact).toBe(false);
  });

  it('says so when every batch was measured', () => {
    const totals = quarantineTotals([batch('A', 3, 100)]);
    expect(totals.unknownSizeCount).toBe(0);
    expect(totals.exact).toBe(true);
  });

  it('has an empty quarantine hold nothing, exactly', () => {
    expect(quarantineTotals([])).toEqual({
      totalBytes: 0, batchCount: 0, unknownSizeCount: 0, exact: true
    });
    expect(quarantineTotals(undefined).totalBytes).toBe(0);
  });
});

describe('batchesOverCap', () => {
  const maxBytes = 1000;

  it('drops nothing while the quarantine fits', () => {
    const batches = [batch('new', 3, 400), batch('mid', 2, 400)];
    expect(batchesOverCap(batches, { maxBytes })).toEqual([]);
  });

  it('drops the oldest first, keeping as much recent undo as fits', () => {
    // Newest is the likeliest to be wanted back: it is the thing the user
    // just did and is most likely to regret.
    const batches = [batch('new', 5, 400), batch('mid', 4, 400), batch('old', 3, 400)];
    const dropped = batchesOverCap(batches, { maxBytes });
    expect(dropped.map((b) => b.programName)).toEqual(['old']);
  });

  it('drops everything older once the line is crossed, not just enough', () => {
    // Keeping an older batch after dropping a newer one would mean the
    // quarantine held a stranger set than either rule describes.
    const batches = [
      batch('a', 6, 600), batch('b', 5, 600), batch('c', 4, 10), batch('d', 3, 10)
    ];
    expect(batchesOverCap(batches, { maxBytes }).map((b) => b.programName)).toEqual(['b', 'c', 'd']);
  });

  it('NEVER drops the newest batch, even when it alone is over the cap', () => {
    // The dangerous case. A user quarantines a 60 GB folder from the Disk
    // Map with a 5 GB cap; purging to fit would permanently destroy the
    // thing they just moved there for safekeeping. The cap does not hold,
    // and that is the honest outcome -- the quarantine contains one item
    // bigger than its whole budget.
    const batches = [batch('huge', 5, 60_000), batch('old', 4, 10)];
    const dropped = batchesOverCap(batches, { maxBytes });
    expect(dropped.map((b) => b.programName)).toEqual(['old']);
  });

  it('does nothing at all when no cap is set', () => {
    const batches = [batch('a', 3, 10_000), batch('b', 2, 10_000)];
    expect(batchesOverCap(batches, { maxBytes: SIZE_CAP_OFF })).toEqual([]);
    expect(batchesOverCap(batches, {})).toEqual([]);
  });

  it('sorts before deciding rather than trusting the order it was handed', () => {
    // listQuarantineBatches returns newest first today. "Oldest first" is
    // the rule, not "last in the array", and a caller passing a filtered
    // or re-sorted list must not silently invert which undo is destroyed.
    const batches = [batch('old', 3, 600), batch('new', 5, 600)];
    expect(batchesOverCap(batches, { maxBytes }).map((b) => b.programName)).toEqual(['old']);
  });

  it('never lets an unmeasured batch push a measured one out', () => {
    // Unknown counts as zero toward the total, so it cannot cause an
    // eviction. It can still BE evicted once measured batches push the
    // total over -- it is a batch like any other, just not one that
    // contributes a number nobody recorded.
    const batches = [batch('new', 5, 900), batch('unknown', 4, null), batch('old', 3, 900)];
    const dropped = batchesOverCap(batches, { maxBytes });
    expect(dropped.map((b) => b.programName)).toEqual(['old']);
  });

  it('leaves a batch with no usable createdAt at the back of the queue', () => {
    // Unknown age is not evidence of being new. Treating it as newest
    // would let a corrupted manifest protect itself indefinitely.
    const batches = [batch('new', 5, 600), { programName: 'nodate', totalSizeBytes: 600, batchDir: 'x' }];
    expect(batchesOverCap(batches, { maxBytes }).map((b) => b.programName)).toEqual(['nodate']);
  });
});
