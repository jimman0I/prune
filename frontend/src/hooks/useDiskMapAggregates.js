import { useEffect, useRef, useState } from 'react';
import { extensionBreakdown } from '../lib/extensionBreakdown.js';
import { largestFiles } from '../lib/largestFiles.js';
import { folderTableRows } from '../lib/folderTable.js';

/** Whether this runtime has a real Worker to hand the heavy lifting to.
 * Exported so tests can force the synchronous fallback path even in an
 * environment that does happen to define one, and so the module doesn't
 * silently disagree with itself about which path a given render took. */
export function hasWorkerSupport() {
  return typeof Worker !== 'undefined';
}

/** The same three computations diskMapAggregates.worker.js runs, called
 * directly. Used whenever there is no Worker to post to -- every test
 * environment (jsdom has no Worker at all), and, as a defensive fallback,
 * any future runtime that doesn't either. Calling the exact same
 * functions here as the worker does is the whole reason this file exists
 * separately from the worker's own onmessage handler: the two paths must
 * be able to diverge in WHEN they run without ever diverging in WHAT they
 * compute. */
function computeSync(tree, fileLimit) {
  return {
    extensionBreakdown: extensionBreakdown(tree),
    largestFiles: largestFiles(tree, { limit: fileLimit }),
    folderRows: folderTableRows(tree)
  };
}

/** Disk Map's file-type breakdown, largest-files list and folder-table
 * counts, computed off the scanned tree without blocking the render that
 * just received it.
 *
 * `tree` is expected to be referentially stable across renders that
 * don't represent a real change (Disk Map already memoises it), since a
 * new object identity here starts a new computation whether or not the
 * data actually changed.
 *
 * Returns `{ result, computing }`. `result` is null before the first
 * computation for the current tree has landed; from then on it holds the
 * last COMPLETED computation, which is deliberately not cleared back to
 * null while a newer one for a changed tree is still running -- keeping
 * the last folder's numbers on screen while the next one measures is
 * better than a blank flash between drills, and `computing` is what
 * tells the caller a newer answer is on the way. */
export function useDiskMapAggregates(tree, { fileLimit = 60 } = {}) {
  const workerRef = useRef(null);
  const requestIdRef = useRef(0);
  const [state, setState] = useState(() => ({
    result: tree && !hasWorkerSupport() ? computeSync(tree, fileLimit) : null,
    computing: Boolean(tree) && hasWorkerSupport()
  }));

  useEffect(() => {
    if (!tree) {
      setState({ result: null, computing: false });
      return undefined;
    }

    if (!hasWorkerSupport()) {
      setState({ result: computeSync(tree, fileLimit), computing: false });
      return undefined;
    }

    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL('../workers/diskMapAggregates.worker.js', import.meta.url),
        { type: 'module' }
      );
    }
    const worker = workerRef.current;
    const requestId = ++requestIdRef.current;

    setState((prev) => ({ result: prev.result, computing: true }));

    const onMessage = (event) => {
      // A later tree change bumps requestIdRef before this fires, so a
      // stale worker response for a folder the user has already left
      // never overwrites the answer for the one they are looking at now.
      if (event.data.requestId !== requestIdRef.current) return;
      setState({ result: event.data, computing: false });
    };
    worker.addEventListener('message', onMessage);
    worker.postMessage({ requestId, tree, fileLimit });

    return () => worker.removeEventListener('message', onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, fileLimit]);

  // The worker outlives any single tree change; it is only torn down
  // when Disk Map itself unmounts, not on every drill-down.
  useEffect(() => () => { workerRef.current?.terminate(); }, []);

  return state;
}
