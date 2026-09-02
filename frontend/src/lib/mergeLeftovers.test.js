import { describe, it, expect } from 'vitest';
import { mergeLeftovers } from './mergeLeftovers.js';

const scanA = {
  files: { ok: true, items: [{ path: 'C:/A/one', sizeBytes: 10 }] },
  registryKeys: { ok: true, items: [{ path: 'HKCU:/SOFTWARE/A' }] },
  scheduledTasks: { ok: true, items: [{ name: 'AUpdater', path: '/' }] }
};

const scanB = {
  files: { ok: true, items: [{ path: 'C:/B/two', sizeBytes: 20 }] },
  registryKeys: { ok: true, items: [] },
  scheduledTasks: { ok: true, items: [] }
};

describe('mergeLeftovers', () => {
  it('combines every program\'s findings into one reviewable set', () => {
    const merged = mergeLeftovers([
      { program: 'App A', scan: scanA },
      { program: 'App B', scan: scanB }
    ]);
    expect(merged.files.items.map(i => i.path)).toEqual(['C:/A/one', 'C:/B/two']);
    expect(merged.registryKeys.items).toHaveLength(1);
    expect(merged.scheduledTasks.items).toHaveLength(1);
  });

  // After a batch, "which program did this come from" is the only way to
  // judge a path you don't recognise.
  it('labels each item with the program it came from', () => {
    const merged = mergeLeftovers([{ program: 'App A', scan: scanA }]);
    expect(merged.files.items[0].program).toBe('App A');
    expect(merged.registryKeys.items[0].program).toBe('App A');
  });

  // Two programs from the same vendor legitimately match the same folder.
  // Listing it twice would let the user tick it twice and make the review
  // claim more space than removing it actually frees.
  it('does not list the same path twice', () => {
    const merged = mergeLeftovers([
      { program: 'App A', scan: scanA },
      { program: 'App A2', scan: scanA }
    ]);
    expect(merged.files.items).toHaveLength(1);
    expect(merged.registryKeys.items).toHaveLength(1);
  });

  // A group that failed for ANY program is not a group we can call clean
  // for the batch -- saying "no registry leftovers" when one scan errored
  // would be a claim we can't support.
  it('marks a group as failed when any single scan failed', () => {
    const failed = { ...scanB, registryKeys: { ok: false, items: [] } };
    const merged = mergeLeftovers([
      { program: 'App A', scan: scanA },
      { program: 'App B', scan: failed }
    ]);
    expect(merged.registryKeys.ok).toBe(false);
    // What did succeed is still kept.
    expect(merged.registryKeys.items).toHaveLength(1);
  });

  it('handles an empty list and missing groups', () => {
    expect(mergeLeftovers([])).toEqual({
      files: { ok: true, items: [] },
      registryKeys: { ok: true, items: [] },
      scheduledTasks: { ok: true, items: [] }
    });
    expect(() => mergeLeftovers([{ program: 'X', scan: {} }])).not.toThrow();
  });
});
