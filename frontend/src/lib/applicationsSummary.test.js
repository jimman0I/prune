import { describe, it, expect } from 'vitest';
import { applicationsSummary } from './applicationsSummary.js';

const t = (key, ...args) => `${key}(${args.join(',')})`;
const fmt = (n) => `${n}B`;

describe('the Applications header line', () => {
  it('states the whole list when nothing is filtered', () => {
    expect(applicationsSummary({ t, view: { filtered: false, shown: 210, total: 210, bytes: 5 }, count: 210, sizeBytes: 420, format: fmt }))
      .toBe('app.applicationsSummary(210,420B)');
  });

  it('states the whole list before the list has reported a view', () => {
    expect(applicationsSummary({ t, view: null, count: 210, sizeBytes: 420, format: fmt }))
      .toBe('app.applicationsSummary(210,420B)');
  });

  it('follows a filter: what is shown, of how many, and the size of just those', () => {
    expect(applicationsSummary({ t, view: { filtered: true, shown: 1, total: 210, bytes: 105 }, count: 210, sizeBytes: 420, format: fmt }))
      .toBe('app.applicationsSummaryFiltered(1,210,105B)');
  });
});
