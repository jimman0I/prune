import { describe, it, expect } from 'vitest';
import { removalModeFrom, cleanOutcome, effectiveRemovalMode, removalOverrideFor } from './cleanOutcome.js';

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

describe('effectiveRemovalMode (the confirm bar\'s per-run choice)', () => {
  it('ticking Delete now always means delete, whatever Settings says', () => {
    expect(effectiveRemovalMode('quarantine', true)).toBe('delete');
    expect(effectiveRemovalMode('recycle', true)).toBe('delete');
    expect(effectiveRemovalMode('delete', true)).toBe('delete');
  });

  it('leaving it off keeps Recycle exactly as Settings configured it', () => {
    expect(effectiveRemovalMode('recycle', false)).toBe('recycle');
    expect(effectiveRemovalMode('quarantine', false)).toBe('quarantine');
  });

  it('leaving it off backs a global Delete-now default out to Quarantine, never guesses Recycle', () => {
    expect(effectiveRemovalMode('delete', false)).toBe('quarantine');
  });
});

describe('removalOverrideFor (what is actually sent to the backend)', () => {
  it('sends delete when the toggle is on', () => {
    expect(removalOverrideFor('quarantine', true)).toBe('delete');
    expect(removalOverrideFor('recycle', true)).toBe('delete');
  });

  it('sends quarantine only to override a global delete default', () => {
    expect(removalOverrideFor('delete', false)).toBe('quarantine');
  });

  it('sends nothing when the per-run choice matches Settings, so Recycle is never touched', () => {
    expect(removalOverrideFor('quarantine', false)).toBeUndefined();
    expect(removalOverrideFor('recycle', false)).toBeUndefined();
  });

  it('always agrees with effectiveRemovalMode on what "delete" or "stick with quarantine" means', () => {
    for (const settingsMode of ['quarantine', 'recycle', 'delete']) {
      for (const deleteNow of [true, false]) {
        const override = removalOverrideFor(settingsMode, deleteNow);
        const effective = effectiveRemovalMode(settingsMode, deleteNow);
        if (override !== undefined) expect(override).toBe(effective === 'delete' ? 'delete' : 'quarantine');
      }
    }
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
