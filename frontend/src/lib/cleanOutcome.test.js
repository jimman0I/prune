import { describe, it, expect } from 'vitest';
import { removalModeFrom, cleanOutcome } from './cleanOutcome.js';

describe('removalModeFrom', () => {
  it("is 'delete' only for exactly 'delete'", () => {
    expect(removalModeFrom({ deepCleanRemoval: 'delete' })).toBe('delete');
    expect(removalModeFrom({ deepCleanRemoval: 'DELETE' })).toBe('quarantine');
    expect(removalModeFrom({ deepCleanRemoval: 'permanent' })).toBe('quarantine');
  });

  it('is quarantine when nothing is known, so the reversible one wins', () => {
    expect(removalModeFrom(undefined)).toBe('quarantine');
    expect(removalModeFrom({})).toBe('quarantine');
  });

  it("is 'recycle' when Auto-Quarantine is off, and 'delete' beats it", () => {
    expect(removalModeFrom({ autoQuarantine: false })).toBe('recycle');
    expect(removalModeFrom({ autoQuarantine: false, deepCleanRemoval: 'delete' })).toBe('delete');
  });
});

describe('cleanOutcome', () => {
  it('keeps freed and moved apart', () => {
    const out = cleanOutcome({ freedBytes: 5, movedBytes: 100, results: [{ quarantineBatch: 'b' }] });
    expect(out).toEqual({ freedBytes: 5, movedBytes: 100, movedTo: 'quarantine' });
  });

  it('says recycle when the moved files went to the Recycle Bin', () => {
    expect(cleanOutcome({ movedBytes: 9, results: [{ recycled: true }] }).movedTo).toBe('recycle');
  });

  it('has no destination when nothing was moved', () => {
    expect(cleanOutcome({ freedBytes: 7, results: [] })).toEqual({ freedBytes: 7, movedBytes: 0, movedTo: null });
    expect(cleanOutcome(undefined)).toEqual({ freedBytes: 0, movedBytes: 0, movedTo: null });
  });
});
