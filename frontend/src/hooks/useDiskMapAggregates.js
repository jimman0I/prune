import { useEffect, useRef, useState } from 'react';
import { createAggregator } from '../lib/aggregator.js';

/** Whether this runtime has a real Worker to hand the heavy lifting to.
 * Exported so tests can force the synchronous fallback path even in an
 * environment that does happen to define one, and so the module doesn't
 * silently disagree with itself about which path a given render took. */
export function hasWorkerSupport() {
  return typeof Worker !== 'undefined';
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
 * `filterText` is the search box: it narrows the largest-files list to the
 * biggest files that match. It travels alone -- the worker already holds the
 * tree -- so typing never re-sends it.
 *
 * Returns `{ result, computing, error, retry }`. `error` is the reason counting
 * failed (the worker threw, or could not be started or reached), and `retry`
 * runs it again on a fresh worker; until one of those happens the screen should
 * say it is counting, never that the folder is empty. `result` is null before the first
 * computation for the current tree has landed; from then on it holds the
 * last COMPLETED computation, which is deliberately not cleared back to
 * null while a newer one for a changed tree is still running -- keeping
 * the last folder's numbers on screen while the next one measures is
 * better than a blank flash between drills, and `computing` is what
 * tells the caller a newer answer is on the way. */
export function useDiskMapAggregates(tree, { fileLimit = 60, filterText = '' } = {}) {
  const workerRef = useRef(null);
  const requestIdRef = useRef(0);
  // The tree the worker (or the sync handler) last received, so it is only
  // sent again when it actually changed.
  const sentTreeRef = useRef(null);
  const syncHandlerRef = useRef(null);

  const syncCompute = () => {
    // A fresh handler per tree: it caches per tree, and a new tree must not
    // be answered from the old one's cache.
    if (sentTreeRef.current !== tree || !syncHandlerRef.current) {
      syncHandlerRef.current = createAggregator();
      sentTreeRef.current = tree;
      return syncHandlerRef.current({ requestId: 0, tree, fileLimit, filterText });
    }
    return syncHandlerRef.current({ requestId: 0, fileLimit, filterText });
  };

  const [state, setState] = useState(() => ({
    result: tree && !hasWorkerSupport() ? syncCompute() : null,
    computing: Boolean(tree) && hasWorkerSupport(),
    error: null
  }));
  // Bumped by retry(): a new value re-runs the effect on a fresh worker.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!tree) {
      sentTreeRef.current = null;
      setState({ result: null, computing: false, error: null });
      return undefined;
    }

    if (!hasWorkerSupport()) {
      try {
        setState({ result: syncCompute(), computing: false, error: null });
      } catch (error) {
        setState({ result: null, computing: false, error: String(error?.message ?? error) });
      }
      return undefined;
    }

    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL('../workers/diskMapAggregates.worker.js', import.meta.url),
        { type: 'module' }
      );
      sentTreeRef.current = null;
    }
    const worker = workerRef.current;
    const requestId = ++requestIdRef.current;

    setState((prev) => ({ result: prev.result, computing: true, error: null }));

    /** A worker that failed is not trusted again: it is thrown away so the next
     * attempt starts a new one, with the tree sent afresh. */
    const fail = (message) => {
      if (requestId !== requestIdRef.current) return;
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
      sentTreeRef.current = null;
      setState((prev) => ({ result: prev.result, computing: false, error: message }));
    };
    const onError = (event) => fail(event?.message || 'the counting worker stopped');
    const onMessageError = () => fail('the result could not be read');

    const onMessage = (event) => {
      // A later tree change bumps requestIdRef before this fires, so a
      // stale worker response for a folder the user has already left
      // never overwrites the answer for the one they are looking at now.
      if (event.data.requestId !== requestIdRef.current) return;
      if (event.data.error) { fail(event.data.error); return; }
      setState({ result: event.data, computing: false, error: null });
    };
    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
    worker.addEventListener('messageerror', onMessageError);
    if (sentTreeRef.current !== tree) {
      sentTreeRef.current = tree;
      worker.postMessage({ requestId, tree, fileLimit, filterText });
    } else {
      worker.postMessage({ requestId, fileLimit, filterText });
    }

    return () => {
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      worker.removeEventListener('messageerror', onMessageError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, fileLimit, filterText, attempt]);

  // The worker outlives any single tree change; it is only torn down
  // when Disk Map itself unmounts, not on every drill-down.
  useEffect(() => () => { workerRef.current?.terminate(); }, []);

  return { ...state, retry: () => setAttempt((n) => n + 1) };
}
