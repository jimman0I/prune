import { describe, it, expect } from 'vitest';
import { selectionTotal } from './selectionTotal.js';

const categories = [
  { category: 'Applications', items: [
    { id: 'a', sizeBytes: 1000 },
    { id: 'b', sizeBytes: null },
    { id: 'c', sizeBytes: 0 }
  ] }
];

describe('selectionTotal', () => {
  it('adds up only what is selected', () => {
    expect(selectionTotal(categories, new Set(['a'])).bytes).toBe(1000);
    expect(selectionTotal(categories, new Set()).bytes).toBe(0);
  });

  it('separates unmeasured rules from empty ones', () => {
    // The distinction the footer exists to make. A rule measured at zero
    // really has nothing to free; a rule with no size has not been looked
    // at, and reporting either as "0 B" states something we do not know.
    const total = selectionTotal(categories, new Set(['b', 'c']));
    expect(total.measured).toBe(1);
    expect(total.unmeasured).toBe(1);
    expect(total.bytes).toBe(0);
  });

  it('reports nothing measured for a freshly listed tree', () => {
    const listed = [{ category: 'X', items: [{ id: 'a', sizeBytes: null }, { id: 'b', sizeBytes: null }] }];
    const total = selectionTotal(listed, new Set(['a', 'b']));
    expect(total.anyMeasured).toBe(false);
    expect(total.unmeasured).toBe(2);
  });

  it('reports measured once a scan has filled anything in', () => {
    expect(selectionTotal(categories, new Set(['a', 'b'])).anyMeasured).toBe(true);
  });

  it('copes with no tree at all', () => {
    expect(selectionTotal(null, new Set(['a']))).toEqual({ bytes: 0, measured: 0, unmeasured: 0, anyMeasured: false });
  });
});
