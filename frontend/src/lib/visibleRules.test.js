import { describe, it, expect } from 'vitest';
import { visibleCategories, hiddenRuleCount } from './visibleRules.js';

const categories = [
  {
    category: 'Brave',
    items: [
      { id: 'brave_cache', present: true },
      { id: 'brave_cookies', present: true }
    ]
  },
  {
    category: 'Opera',
    items: [
      { id: 'opera_cache', present: false },
      { id: 'opera_cookies', present: false }
    ]
  },
  {
    category: 'Windows',
    items: [
      { id: 'prefetch', present: true },
      { id: 'dns_cache' } // a command rule -- present was never computed
    ]
  }
];

describe('visibleCategories', () => {
  it('returns everything untouched when the filter is off', () => {
    expect(visibleCategories(categories, false)).toBe(categories);
  });

  it('drops the rules whose software is not installed', () => {
    const visible = visibleCategories(categories, true);
    const ids = visible.flatMap((g) => g.items.map((i) => i.id));
    expect(ids).not.toContain('opera_cache');
    expect(ids).toContain('brave_cache');
  });

  it('drops a category once nothing is left in it', () => {
    // An empty heading is a claim that the group exists and is empty --
    // true, and not worth a row of screen.
    expect(visibleCategories(categories, true).map((g) => g.category)).toEqual(['Brave', 'Windows']);
  });

  it('keeps a rule whose applicability was never measured', () => {
    // A command rule has no paths to look for, and a scan in progress has
    // not reached every rule yet. Hiding either would make the list shrink
    // while it loads.
    const ids = visibleCategories(categories, true).flatMap((g) => g.items.map((i) => i.id));
    expect(ids).toContain('dns_cache');
  });

  it('does not mutate what it was given', () => {
    const before = JSON.stringify(categories);
    visibleCategories(categories, true);
    expect(JSON.stringify(categories)).toBe(before);
  });

  it('copes with nothing', () => {
    expect(visibleCategories(null, true)).toEqual([]);
    expect(visibleCategories(null, false)).toEqual([]);
  });
});

describe('hiddenRuleCount', () => {
  it('counts what the filter is holding back', () => {
    // Without this the setting is invisible from the screen it affects.
    expect(hiddenRuleCount(categories, true)).toBe(2);
  });

  it('is zero when the filter is off, however much would qualify', () => {
    expect(hiddenRuleCount(categories, false)).toBe(0);
  });

  it('copes with nothing', () => {
    expect(hiddenRuleCount(null, true)).toBe(0);
  });
});
