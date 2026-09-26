import { describe, it, expect } from 'vitest';
import { spaceBreakdown, largestPrograms, DASHBOARD_TOP_COUNT } from './spaceBreakdown.js';

const GB = 1024 ** 3;
const disk = { freeBytes: 167 * GB, totalBytes: 953 * GB };
const prog = (name, gb) => ({ id: name, name, sizeBytes: gb === undefined ? undefined : gb * GB });

describe('spaceBreakdown', () => {
  it('is not ready until BOTH the disk and the program sizes have been measured', () => {
    expect(spaceBreakdown({ diskSpace: null, programs: [], programsMeasured: true }).ready).toBe(false);
    expect(spaceBreakdown({ diskSpace: disk, programs: [], programsMeasured: false }).ready).toBe(false);
    expect(spaceBreakdown({ diskSpace: disk, programs: [], programsMeasured: true }).ready).toBe(true);
  });

  it('still reports used and free from the disk alone, so the two-segment bar can draw', () => {
    const b = spaceBreakdown({ diskSpace: disk, programs: [], programsMeasured: false });
    expect(b.usedBytes).toBe(786 * GB);
    expect(b.freeBytes).toBe(167 * GB);
    expect(b.totalBytes).toBe(953 * GB);
    expect(b.programsBytes).toBeNull();
    expect(b.otherBytes).toBeNull();
  });

  it('splits used into programs and everything else, summing only measured sizes', () => {
    const b = spaceBreakdown({
      diskSpace: disk, programsMeasured: true,
      programs: [prog('A', 100), prog('B', 50), prog('Ext', undefined), { id: 'n', name: 'N', sizeBytes: null }]
    });
    expect(b.programsBytes).toBe(150 * GB);
    expect(b.otherBytes).toBe(636 * GB);
    expect(b.unsizedCount).toBe(2);
    expect(b.sizedCount).toBe(2);
  });

  it('counts a measured zero as sized, not as missing', () => {
    const b = spaceBreakdown({ diskSpace: disk, programsMeasured: true, programs: [prog('Z', 0)] });
    expect(b.sizedCount).toBe(1);
    expect(b.unsizedCount).toBe(0);
  });

  it('floors everything else at 0 and flags programs that add up to more than the drive holds', () => {
    const b = spaceBreakdown({ diskSpace: disk, programsMeasured: true, programs: [prog('Huge', 900)] });
    expect(b.otherBytes).toBe(0);
    expect(b.exceedsUsed).toBe(true);
    // The bar never draws past what is used.
    expect(b.segments.programs + b.segments.other + b.segments.free).toBeCloseTo(100, 6);
  });

  it('gives segment widths in percent of the drive that add up to 100', () => {
    const b = spaceBreakdown({ diskSpace: disk, programsMeasured: true, programs: [prog('A', 200)] });
    expect(b.segments.programs).toBeCloseTo((200 / 953) * 100, 6);
    expect(b.segments.other).toBeCloseTo((586 / 953) * 100, 6);
    expect(b.segments.free).toBeCloseTo((167 / 953) * 100, 6);
  });

  it('while measuring, draws used and free only', () => {
    const b = spaceBreakdown({ diskSpace: disk, programs: [prog('A', 200)], programsMeasured: false });
    expect(b.segments.programs).toBe(0);
    expect(b.segments.other).toBeCloseTo((786 / 953) * 100, 6);
  });
});

describe('largestPrograms', () => {
  it('returns the biggest measured programs first, at most five', () => {
    const list = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((n, i) => prog(n, i + 1));
    const top = largestPrograms(list);
    expect(DASHBOARD_TOP_COUNT).toBe(5);
    expect(top.map((p) => p.name)).toEqual(['g', 'f', 'e', 'd', 'c']);
  });

  it('skips programs with no size or a size of zero, and does not mutate its input', () => {
    const list = [prog('none', undefined), prog('zero', 0), prog('real', 3)];
    const copy = [...list];
    expect(largestPrograms(list).map((p) => p.name)).toEqual(['real']);
    expect(list).toEqual(copy);
  });

  it('gives each row its share of the largest, for the proportional bar', () => {
    const top = largestPrograms([prog('big', 10), prog('half', 5)]);
    expect(top[0].ratio).toBe(1);
    expect(top[1].ratio).toBeCloseTo(0.5, 6);
  });
});
