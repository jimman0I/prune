import { describe, it, expect } from 'vitest';
import { lockedFileSummary } from './lockedFiles.js';

const result = (skipped) => ({ results: [{ id: 'r1', skipped }] });

describe('lockedFileSummary', () => {
  it('counts files the clean could not touch', () => {
    const summary = lockedFileSummary(result([
      { path: 'C:\\a\\one.dat', reason: 'locked or inaccessible' },
      { path: 'C:\\a\\two.dat', reason: 'locked or inaccessible' },
      { path: 'C:\\a\\three.dat', reason: 'locked or inaccessible' }
    ]));
    expect(summary.count).toBe(3);
    expect(summary.message).toBe('Skipped 3 locked files.');
    expect(summary.detail).toMatch(/close/i);
  });

  it('says one file in the singular', () => {
    const summary = lockedFileSummary(result([{ path: 'C:\\a\\one.dat', reason: 'locked' }]));
    expect(summary.message).toBe('Skipped 1 locked file.');
  });

  it('adds across every rule, not just the first', () => {
    const summary = lockedFileSummary({
      results: [
        { id: 'a', skipped: [{ path: 'p1' }, { path: 'p2' }] },
        { id: 'b', skipped: [{ path: 'p3' }] },
        { id: 'c', skipped: [] }
      ]
    });
    expect(summary.count).toBe(3);
  });

  it('carries the paths, capped, so the toast can show which', () => {
    // "3 files were skipped" invites the question "which ones", and a
    // list of forty answers it worse than a list of three plus a count.
    const many = Array.from({ length: 40 }, (_, i) => ({ path: `C:\\x\\f${i}.dat` }));
    const summary = lockedFileSummary(result(many));
    expect(summary.count).toBe(40);
    expect(summary.paths.length).toBeLessThanOrEqual(5);
    expect(summary.paths[0]).toBe('C:\\x\\f0.dat');
  });

  it('separates files held back on purpose from files that were locked', () => {
    // The recency guard holds back files younger than skipRecentHours.
    // Those were not locked and telling the user to close an app would
    // send them chasing a problem that does not exist.
    const summary = lockedFileSummary(result([
      { path: 'C:\\a\\held.dat', reason: 'modified in the last 24 hours' },
      { path: 'C:\\a\\locked.dat', reason: 'locked or inaccessible' }
    ]));
    expect(summary.count).toBe(1);
    expect(summary.paths).toEqual(['C:\\a\\locked.dat']);
  });

  it('has nothing to say when nothing was skipped', () => {
    expect(lockedFileSummary(result([]))).toBeNull();
    expect(lockedFileSummary({ results: [] })).toBeNull();
    expect(lockedFileSummary(null)).toBeNull();
    expect(lockedFileSummary({})).toBeNull();
  });

  it('survives a rule with no skipped array at all', () => {
    expect(lockedFileSummary({ results: [{ id: 'a' }, { id: 'b', skipped: null }] })).toBeNull();
  });
});
