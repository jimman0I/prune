import { describe, it, expect } from 'vitest';
import { cleanResultSentences, cleanResultText } from './cleanResultText.js';
import { CATALOG } from '../i18n/catalog.js';

const t = (path, ...args) => {
  const entry = path.split('.').reduce((n, k) => n?.[k], CATALOG.en);
  return typeof entry === 'function' ? entry(...args) : entry;
};

describe('cleanResultSentences', () => {
  it('says Freed for deleted bytes', () => {
    expect(cleanResultSentences({ freedBytes: 2048, movedBytes: 0, results: [] }, t)).toEqual(['Freed 2 KB']);
  });

  it('says Freed 0 B when nothing at all happened', () => {
    expect(cleanResultSentences({ freedBytes: 0, movedBytes: 0, results: [] }, t)).toEqual(['Freed 0 B']);
  });

  it('says Moved, never Freed, for what only changed folders', () => {
    const result = { freedBytes: 0, movedBytes: 3 * 1024 * 1024, results: [{ quarantineBatch: 'q1' }] };
    expect(cleanResultSentences(result, t)).toEqual(['Moved 3 MB to Quarantine. The space comes back when you empty it.']);
  });

  it('says both when both happened, and names the Recycle Bin when that was the destination', () => {
    const result = { freedBytes: 1024, movedBytes: 2048, results: [{ recycled: true }] };
    expect(cleanResultSentences(result, t)).toEqual([
      'Freed 1 KB',
      'Moved 2 KB to the Recycle Bin. The space comes back when you empty it.'
    ]);
  });

  it('mentions locked files scheduled for the next restart', () => {
    const result = { freedBytes: 1024, movedBytes: 0, results: [{ scheduledForRestart: 2 }] };
    expect(cleanResultSentences(result, t).at(-1)).toBe('Locked files to be deleted at the next restart: 2.');
  });

  it('joins them with full stops', () => {
    const result = { freedBytes: 1024, movedBytes: 2048, results: [{ quarantineBatch: 'q' }] };
    expect(cleanResultText(result, t)).toBe('Freed 1 KB. Moved 2 KB to Quarantine. The space comes back when you empty it.');
  });
});
