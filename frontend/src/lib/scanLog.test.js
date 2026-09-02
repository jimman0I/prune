import { describe, it, expect } from 'vitest';
import { mergeScannedRule, scanLogLine } from './scanLog.js';

describe('mergeScannedRule', () => {
  it('creates the category on the first rule that belongs to it', () => {
    const next = mergeScannedRule([], { id: 'a', category: 'Applications', name: 'A' });
    expect(next).toEqual([{ category: 'Applications', items: [{ id: 'a', category: 'Applications', name: 'A' }] }]);
  });

  it('appends into an existing category, keeping arrival order', () => {
    let cats = mergeScannedRule([], { id: 'a', category: 'Applications' });
    cats = mergeScannedRule(cats, { id: 'b', category: 'Applications' });
    expect(cats).toHaveLength(1);
    expect(cats[0].items.map(i => i.id)).toEqual(['a', 'b']);
  });

  it('keeps categories in the order they first appeared', () => {
    let cats = mergeScannedRule([], { id: 'a', category: 'Applications' });
    cats = mergeScannedRule(cats, { id: 'b', category: 'Developer' });
    cats = mergeScannedRule(cats, { id: 'c', category: 'Applications' });
    expect(cats.map(c => c.category)).toEqual(['Applications', 'Developer']);
  });

  // React only re-renders what it sees change, and the tree fills in
  // while the scan is still running -- mutating the previous array would
  // leave the UI showing a stale count until something else moved.
  it('never mutates the array it was given', () => {
    const before = [{ category: 'Applications', items: [{ id: 'a' }] }];
    const snapshot = JSON.stringify(before);
    mergeScannedRule(before, { id: 'b', category: 'Applications' });
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe('scanLogLine', () => {
  it('reports a real size', () => {
    expect(scanLogLine({ name: 'Discord Cache', sizeBytes: 396361728, present: true, accessible: true }))
      .toEqual({ label: 'Discord Cache', detail: '378 MB', tone: 'size' });
  });

  // The three states that all used to read as "0 B" are genuinely
  // different answers, and the log is where they're easiest to see.
  it('distinguishes software that is not installed', () => {
    expect(scanLogLine({ name: 'Slack Cache', sizeBytes: 0, present: false }).detail).toBe('not installed');
  });

  it('distinguishes a folder it could not read', () => {
    const line = scanLogLine({ name: 'Prefetch', sizeBytes: 0, present: true, accessible: false });
    expect(line.detail).toBe('needs admin');
    expect(line.tone).toBe('warning');
  });

  it('distinguishes a rule with nothing to measure', () => {
    expect(scanLogLine({ name: 'DNS Cache', sizeBytes: null, present: true, accessible: true }).detail)
      .toBe('nothing to measure');
  });

  it('reports an installed but genuinely empty cache as empty, not as nothing', () => {
    expect(scanLogLine({ name: 'Zoom', sizeBytes: 0, present: true, accessible: true }).detail).toBe('empty');
  });
});

describe('mergeScannedRule over a pre-listed tree', () => {
  // The tree is built from the rule list before any scan runs, so every
  // scanned rule arrives to find a placeholder already sitting there.
  // Appending would have shown all forty rules twice.
  const listed = [
    { category: 'Applications', items: [
      { id: 'discord_cache', name: 'Discord Cache', sizeBytes: null, recommended: true },
      { id: 'spotify_cache', name: 'Spotify Cache', sizeBytes: null, recommended: true }
    ] }
  ];

  it('fills in the placeholder rather than adding a second row', () => {
    const next = mergeScannedRule(listed, {
      id: 'spotify_cache', category: 'Applications', name: 'Spotify Cache', sizeBytes: 5581061233, present: true
    });
    expect(next[0].items).toHaveLength(2);
    expect(next[0].items[1].sizeBytes).toBe(5581061233);
  });

  it('leaves the row where it was', () => {
    // A tree that reorders itself while the reader is looking at it is
    // worse than one that fills in quietly.
    const next = mergeScannedRule(listed, {
      id: 'spotify_cache', category: 'Applications', sizeBytes: 1, present: true
    });
    expect(next[0].items.map((i) => i.id)).toEqual(['discord_cache', 'spotify_cache']);
  });

  it('keeps fields the scan does not resend', () => {
    const next = mergeScannedRule(listed, { id: 'discord_cache', category: 'Applications', sizeBytes: 42 });
    expect(next[0].items[0].name).toBe('Discord Cache');
    expect(next[0].items[0].recommended).toBe(true);
  });

  it('still appends a rule with no placeholder', () => {
    const next = mergeScannedRule(listed, { id: 'brand_new', category: 'Applications', sizeBytes: 7 });
    expect(next[0].items.map((i) => i.id)).toEqual(['discord_cache', 'spotify_cache', 'brand_new']);
  });
});
