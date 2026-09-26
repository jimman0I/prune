import { useCallback, useEffect, useRef, useState } from 'react';
import { streamDeepCleanScan } from '../lib/api.js';

/** The Dashboard's "Measure" for junk files: the Deep Clean scan, run from
 * here, reduced to the one figure the Dashboard has room for.
 *
 * It reuses the streaming scan rather than a second walker, so the number
 * here is the number Deep Clean will show. What it adds up is what Deep Clean
 * ticks by default -- the recommended rules, on software that is present and
 * readable -- and it says so, because "junk" without a definition is a figure
 * nobody can check. Rules that need admin or are not installed have no size
 * and are not counted as 0.
 *
 * Armed by a click only, never on mount: the walk takes about half a minute
 * and the front page must not start it on its own. The total stays null until
 * the scan is DONE -- a running sum that grows for thirty seconds is the
 * "number that changes after it appeared" the Dashboard is built to avoid --
 * while `scanned` / `total` give live progress.
 *
 * Aborted on unmount: the backend stops walking when the connection closes. */
export function useJunkMeasure() {
  const [state, setState] = useState({
    status: 'idle', scanned: 0, total: 0, bytes: null, cleanerCount: 0, error: null
  });
  const controllerRef = useRef(null);
  const runningRef = useRef(false);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const start = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ status: 'measuring', scanned: 0, total: 0, bytes: null, cleanerCount: 0, error: null });

    let bytes = 0;
    let cleanerCount = 0;
    let failure = null;
    try {
      await streamDeepCleanScan((type, data) => {
        if (type === 'start') {
          setState((s) => ({ ...s, total: data.total }));
        } else if (type === 'rule') {
          if (data.recommended && data.present !== false && data.accessible !== false
              && typeof data.sizeBytes === 'number') {
            bytes += data.sizeBytes;
            cleanerCount += 1;
          }
          setState((s) => ({ ...s, scanned: s.scanned + 1 }));
        } else if (type === 'error') {
          failure = data.message;
        }
      }, controller.signal);
    } catch (err) {
      if (controller.signal.aborted) { runningRef.current = false; return; }
      failure = err.message;
    }
    runningRef.current = false;
    if (controller.signal.aborted) return;
    setState((s) => (failure
      ? { ...s, status: 'error', error: failure, bytes: null, cleanerCount: 0 }
      : { ...s, status: 'done', bytes, cleanerCount, error: null }));
  }, []);

  return { ...state, start };
}
