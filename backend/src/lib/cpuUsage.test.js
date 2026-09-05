import { describe, it, expect } from 'vitest';
import { cpuTotals, cpuPercentBetween } from './cpuUsage.js';

/** os.cpus() returns CUMULATIVE tick counts since boot, per core. A
 * percentage is the change between two readings -- there is no "current
 * CPU usage" to read, which is the single thing most implementations get
 * wrong by reporting the since-boot average and calling it live. */
const core = (user, sys, idle) => ({ times: { user, nice: 0, sys, idle, irq: 0 } });

describe('cpuTotals', () => {
  it('adds every core into one pair of totals', () => {
    const totals = cpuTotals([core(100, 50, 850), core(200, 100, 700)]);
    expect(totals.idle).toBe(1550);
    expect(totals.total).toBe(2000);
  });

  it('copes with no readings', () => {
    expect(cpuTotals([])).toEqual({ idle: 0, total: 0 });
    expect(cpuTotals(null)).toEqual({ idle: 0, total: 0 });
  });
});

describe('cpuPercentBetween', () => {
  it('is the share of ticks that were not idle', () => {
    // 1000 ticks passed, 250 of them busy.
    const before = { idle: 750, total: 1000 };
    const after = { idle: 1500, total: 2000 };
    expect(cpuPercentBetween(before, after)).toBe(25);
  });

  it('reads 0 when nothing but idle happened', () => {
    expect(cpuPercentBetween({ idle: 100, total: 200 }, { idle: 200, total: 300 })).toBe(0);
  });

  it('reads 100 when nothing was idle', () => {
    expect(cpuPercentBetween({ idle: 100, total: 200 }, { idle: 100, total: 300 })).toBe(100);
  });

  it('returns null when no time has passed', () => {
    // Two readings in the same tick have no percentage to give. Zero
    // would be a lie -- it would draw an idle machine mid-scan.
    expect(cpuPercentBetween({ idle: 100, total: 200 }, { idle: 100, total: 200 })).toBeNull();
  });

  it('returns null for a first reading with nothing to compare', () => {
    expect(cpuPercentBetween(null, { idle: 100, total: 200 })).toBeNull();
  });

  it('returns null rather than a negative when the counters go backwards', () => {
    // A core going offline, or a suspend/resume, can make the cumulative
    // total drop. A negative percentage would render as an inverted arc.
    expect(cpuPercentBetween({ idle: 200, total: 400 }, { idle: 100, total: 200 })).toBeNull();
  });

  it('stays inside 0-100 for every consistent pair of readings', () => {
    // The first version of this test asserted a clamp using idle going
    // BACKWARDS while total went forwards -- which is not a percentage
    // that needs clamping, it is inconsistent counters, and the test
    // above already says those return null. With a valid pair the ratio
    // cannot exceed 1 by construction, so this checks the range holds
    // across the real spread rather than inventing an impossible input.
    for (let busy = 0; busy <= 1000; busy += 137) {
      const value = cpuPercentBetween(
        { idle: 1000, total: 2000 },
        { idle: 1000 + (1000 - busy), total: 3000 }
      );
      expect(value, `busy=${busy}`).toBeGreaterThanOrEqual(0);
      expect(value, `busy=${busy}`).toBeLessThanOrEqual(100);
    }
  });

  it('rounds to a whole percent', () => {
    expect(Number.isInteger(cpuPercentBetween({ idle: 0, total: 0 }, { idle: 333, total: 1000 }))).toBe(true);
  });
});
