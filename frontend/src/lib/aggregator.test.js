import { describe, it, expect, vi } from 'vitest';
import { createAggregator } from './aggregator.js';
import * as folderTable from './folderTable.js';

const tree = {
  type: 'directory', name: 'C:', size: 30, fullPath: 'C:\\',
  children: [
    { type: 'file', name: 'a.txt', size: 10, fullPath: 'C:\\a.txt' },
    { type: 'file', name: 'b.log', size: 20, fullPath: 'C:\\b.log' }
  ]
};

describe('createAggregator', () => {
  it('computes the three views for a tree', () => {
    const handle = createAggregator();
    const out = handle({ requestId: 7, tree, fileLimit: 10 });
    expect(out.requestId).toBe(7);
    expect(out.extensionBreakdown.totalFiles).toBe(2);
    expect(out.largestFiles.map((f) => f.name)).toEqual(['b.log', 'a.txt']);
    expect(out.folderRows.map((r) => r.name).sort()).toEqual(['a.txt', 'b.log']);
  });

  it('answers a search without being sent the tree again', () => {
    const handle = createAggregator();
    handle({ requestId: 1, tree, fileLimit: 10 });
    const out = handle({ requestId: 2, fileLimit: 10, filterText: '*.txt' });
    expect(out.largestFiles.map((f) => f.name)).toEqual(['a.txt']);
  });

  it('does not recompute the parts a search cannot change', () => {
    const spy = vi.spyOn(folderTable, 'folderTableRows');
    const handle = createAggregator();
    handle({ requestId: 1, tree, fileLimit: 10 });
    handle({ requestId: 2, fileLimit: 10, filterText: 'a' });
    handle({ requestId: 3, fileLimit: 10, filterText: 'b' });
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('recomputes everything when a new tree arrives', () => {
    const handle = createAggregator();
    handle({ requestId: 1, tree, fileLimit: 10 });
    const other = { type: 'directory', name: 'D:', size: 5, fullPath: 'D:\\', children: [{ type: 'file', name: 'z.iso', size: 5, fullPath: 'D:\\z.iso' }] };
    const out = handle({ requestId: 2, tree: other, fileLimit: 10 });
    expect(out.largestFiles.map((f) => f.name)).toEqual(['z.iso']);
  });

  it('refuses a request that arrives before any tree', () => {
    expect(() => createAggregator()({ requestId: 1, fileLimit: 5 })).toThrow(/No tree/);
  });
});
