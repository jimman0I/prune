import { describe, it, expect } from 'vitest';
import {
  DEEP_CLEAN_COLLAPSED_KEY, readCollapsedCategories, writeCollapsedCategories
} from './deepCleanExpansion.js';

const fakeStorage = (initial = {}) => {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); }
  };
};

describe('readCollapsedCategories', () => {
  it('is empty when nothing was stored, so every category opens', () => {
    expect(readCollapsedCategories(fakeStorage()).size).toBe(0);
  });

  it('round-trips what was written', () => {
    const storage = fakeStorage();
    writeCollapsedCategories(storage, new Set(['Brave', 'Windows']));
    expect([...readCollapsedCategories(storage)].sort()).toEqual(['Brave', 'Windows']);
  });

  it('treats a value that is not JSON, or not an array, as absent', () => {
    for (const junk of ['not json', '{"a":1}', '"Brave"', '42', 'null', '']) {
      const storage = fakeStorage({ [DEEP_CLEAN_COLLAPSED_KEY]: junk });
      expect(readCollapsedCategories(storage).size).toBe(0);
    }
  });

  it('keeps only the strings of a mixed array', () => {
    const storage = fakeStorage({ [DEEP_CLEAN_COLLAPSED_KEY]: JSON.stringify(['Brave', 7, null, {}, '', 'Windows']) });
    expect([...readCollapsedCategories(storage)]).toEqual(['Brave', 'Windows']);
  });

  it('is bounded, so a corrupt value cannot grow without limit', () => {
    const many = Array.from({ length: 5000 }, (_, i) => `c${i}`);
    const storage = fakeStorage({ [DEEP_CLEAN_COLLAPSED_KEY]: JSON.stringify(many) });
    expect(readCollapsedCategories(storage).size).toBeLessThanOrEqual(200);
  });

  it('survives storage that throws on read', () => {
    const storage = { getItem: () => { throw new Error('blocked'); } };
    expect(readCollapsedCategories(storage).size).toBe(0);
  });

  it('survives no storage at all', () => {
    expect(readCollapsedCategories(null).size).toBe(0);
  });
});

describe('writeCollapsedCategories', () => {
  it('reports failure instead of throwing when storage refuses', () => {
    const storage = { setItem: () => { throw new Error('quota'); } };
    expect(writeCollapsedCategories(storage, new Set(['Brave']))).toBe(false);
  });

  it('writes under its own key, never the selection setting', () => {
    const storage = fakeStorage();
    writeCollapsedCategories(storage, new Set(['Brave']));
    expect(Object.keys(storage.data)).toEqual(['prune.deepCleanCollapsed']);
  });
});
