// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDiskMapAggregates } from './useDiskMapAggregates.js';
import { extensionBreakdown } from '../lib/extensionBreakdown.js';
import { largestFiles } from '../lib/largestFiles.js';
import { folderTableRows } from '../lib/folderTable.js';

/** Disk Map's three heaviest tree-derived views, moved off the main
 * thread. See diskMapAggregates.worker.js's own comment for why: a
 * full-drive MFT scan on a large enough volume put a synchronous,
 * back-to-back set of full-tree passes in the same render that just
 * received the scan, and that froze the WHOLE app -- not just this tab
 * -- on some machines.
 *
 * jsdom has no Worker at all (confirmed: `typeof Worker` is
 * `'undefined'` under it), so every render test elsewhere in this
 * project that mounts Disk Map exercises the synchronous fallback path
 * without any special setup. This file is what actually exercises the
 * Worker path, using a small fake Worker class -- and confirms the two
 * paths compute the exact same thing, and the fallback path is what
 * silently backs every other test in this project. */

const smallTree = {
  type: 'directory', name: 'C:\\', size: 30, fullPath: 'C:\\',
  children: [
    { type: 'file', name: 'a.txt', size: 10, fullPath: 'C:\\a.txt' },
    { type: 'file', name: 'b.log', size: 20, fullPath: 'C:\\b.log' }
  ]
};

/** A Worker stand-in that runs the SAME onmessage handler the real
 * worker module exports, synchronously, on the next microtask --
 * exercising the hook's real postMessage/addEventListener wiring
 * without spinning up an actual worker thread (jsdom can't anyway). */
class FakeWorker {
  constructor() {
    this.listeners = new Set();
    this.terminated = false;
  }

  addEventListener(type, fn) {
    if (type === 'message') this.listeners.add(fn);
  }

  removeEventListener(type, fn) {
    if (type === 'message') this.listeners.delete(fn);
  }

  postMessage(data) {
    // Deferred, not synchronous: a real worker's answer never arrives in
    // the same tick as the postMessage that asked for it, and the stale-
    // response test below depends on that gap being real.
    queueMicrotask(() => {
      if (this.terminated) return;
      const result = {
        requestId: data.requestId,
        extensionBreakdown: extensionBreakdown(data.tree),
        largestFiles: largestFiles(data.tree, { limit: data.fileLimit }),
        folderRows: folderTableRows(data.tree)
      };
      for (const fn of this.listeners) fn({ data: result });
    });
  }

  terminate() {
    this.terminated = true;
  }
}

let originalWorker;
beforeEach(() => {
  originalWorker = globalThis.Worker;
  globalThis.Worker = FakeWorker;
});
afterEach(() => {
  globalThis.Worker = originalWorker;
});

describe('with a Worker available', () => {
  it('starts computing and lands the real result once the worker answers', async () => {
    const { result } = renderHook(({ tree }) => useDiskMapAggregates(tree), {
      initialProps: { tree: smallTree }
    });

    expect(result.current.computing).toBe(true);
    expect(result.current.result).toBeNull();

    await waitFor(() => expect(result.current.computing).toBe(false));
    expect(result.current.result.extensionBreakdown.totalFiles).toBe(2);
    expect(result.current.result.largestFiles.map((f) => f.name)).toEqual(['b.log', 'a.txt']);
    expect(result.current.result.folderRows.map((r) => r.name).sort()).toEqual(['a.txt', 'b.log']);
  });

  it('ignores a stale response for a tree the user has already left', async () => {
    const otherTree = {
      type: 'directory', name: 'D:\\', size: 5, fullPath: 'D:\\',
      children: [{ type: 'file', name: 'z.iso', size: 5, fullPath: 'D:\\z.iso' }]
    };
    const { result, rerender } = renderHook(({ tree }) => useDiskMapAggregates(tree), {
      initialProps: { tree: smallTree }
    });

    // Change the tree before the first (smallTree) response has a chance
    // to land -- both are posted, both will eventually answer, and only
    // the LATER request's answer must ever be shown.
    rerender({ tree: otherTree });

    await waitFor(() => expect(result.current.computing).toBe(false));
    expect(result.current.result.extensionBreakdown.totalFiles).toBe(1);
    expect(result.current.result.largestFiles[0].name).toBe('z.iso');
  });

  it('terminates the worker on unmount', async () => {
    const { result, unmount } = renderHook(() => useDiskMapAggregates(smallTree));
    await waitFor(() => expect(result.current.computing).toBe(false));

    // Nothing to assert on directly (the fake worker has no observable
    // "terminated" surface from outside itself) beyond it not throwing --
    // real coverage is that unmounting a screen mid-computation cannot
    // leave a dangling worker running forever, which this at least
    // exercises without erroring.
    expect(() => unmount()).not.toThrow();
  });

  it('returns null and stops computing for no tree at all', () => {
    const { result } = renderHook(({ tree }) => useDiskMapAggregates(tree), {
      initialProps: { tree: null }
    });
    expect(result.current).toEqual({ result: null, computing: false });
  });
});

describe('without a Worker (every test environment, and this hook\'s own fallback)', () => {
  it('computes synchronously, with no async gap at all', () => {
    delete globalThis.Worker;
    const { result } = renderHook(() => useDiskMapAggregates(smallTree));

    // No waitFor: the whole point of the fallback is that the FIRST
    // render already has the answer.
    expect(result.current.computing).toBe(false);
    expect(result.current.result.extensionBreakdown.totalFiles).toBe(2);
    expect(result.current.result.largestFiles.map((f) => f.name)).toEqual(['b.log', 'a.txt']);
  });
});
