import { describe, it, expect } from 'vitest';
import { appendScannedRule, scanLogLine } from './scanLog.js';

describe('appendScannedRule', () => {
  it('creates the category on the first rule that belongs to it', () => {
    const next = appendScannedRule([], { id: 'a', category: 'Applications', name: 'A' });
    expect(next).toEqual([{ category: 'Applications', items: [{ id: 'a', category: 'Applications', name: 'A' }] }]);
  });

  it('appends into an existing category, keeping arrival order', () => {
    let cats = appendScannedRule([], { id: 'a', category: 'Applications' });
    cats = appendScannedRule(cats, { id: 'b', category: 'Applications' });
    expect(cats).toHaveLength(1);
    expect(cats[0].items.map(i => i.id)).toEqual(['a', 'b']);
  });

  it('keeps categories in the order they first appeared', () => {
    let cats = appendScannedRule([], { id: 'a', category: 'Applications' });
    cats = appendScannedRule(cats, { id: 'b', category: 'Developer' });
    cats = appendScannedRule(cats, { id: 'c', category: 'Applications' });
    expect(cats.map(c => c.category)).toEqual(['Applications', 'Developer']);
  });

  // React only re-renders what it sees change, and the tree fills in
  // while the scan is still running -- mutating the previous array would
  // leave the UI showing a stale count until something else moved.
  it('never mutates the array it was given', () => {
    const before = [{ category: 'Applications', items: [{ id: 'a' }] }];
    const snapshot = JSON.stringify(before);
    appendScannedRule(before, { id: 'b', category: 'Applications' });
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
