import { describe, it, expect } from 'vitest';
import { defaultSelection, selectableIds } from './defaultSelection.js';
import { needsWarning } from './cleanWarning.js';
import { biggestSelected } from './biggestFiles.js';

/** The user's own rules (Custom locations, imported cleaners) are never
 * swept into a Clean by a default, and one that warns still warns. */

const tree = [
  { category: 'Custom', items: [{ id: 'custom_locations', custom: true, recommended: false, present: true, accessible: true, sizeBytes: 10 }] },
  { category: 'Slack', items: [
    { id: 'imp_slack_cache', imported: true, recommended: false, present: true, accessible: true, sizeBytes: 5 },
    { id: 'imp_slack_pw', imported: true, risky: true, recommended: false, present: true, accessible: true, sizeBytes: 5 }
  ] },
  { category: 'Windows', items: [{ id: 'temp', recommended: true, present: true, accessible: true, sizeBytes: 1 }] }
];

describe('defaults', () => {
  it('tick only what Prune recommends, never a user or imported rule', () => {
    expect([...defaultSelection(tree)]).toEqual(['temp']);
  });

  it('"Select everything" reaches an imported rule but not one that loses data', () => {
    expect([...selectableIds(tree, [])].sort()).toEqual(['custom_locations', 'imp_slack_cache', 'temp']);
  });

  it('an imported rule marked as losing data asks before it is ticked, like any other', () => {
    const risky = tree[1].items[1];
    expect(needsWarning(risky, { checking: true, acknowledged: [] })).toBe(true);
    expect(needsWarning(risky, { checking: true, acknowledged: ['imp_slack_pw'] })).toBe(false);
  });
});

describe('the Delete confirmation\'s biggest items', () => {
  it('only come from rules that are ticked', () => {
    const withFiles = [{ category: 'A', items: [
      { id: 'a', files: [{ path: 'C:\\a\\big', sizeBytes: 9 }] },
      { id: 'b', files: [{ path: 'C:\\b\\huge', sizeBytes: 99 }] }
    ] }];
    expect(biggestSelected(withFiles, new Set(['a']), 3).map((f) => f.path)).toEqual(['C:\\a\\big']);
  });
});
