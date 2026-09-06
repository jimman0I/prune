import { useCallback, useRef } from 'react';

/** Wraps an async action so it cannot run twice at once.
 *
 * Every destructive action in this app is one click on one button, and
 * the guards around them were all variations on the same mistake: read
 * some state, call setState to clear it, and rely on that to stop a
 * second call. It does not. setState schedules a re-render; it does not
 * change the value the CURRENT closure captured. Two clicks landing
 * before that re-render both see the old value and both proceed.
 *
 * DiskMap's removal had exactly that shape and a visible symptom: the
 * second call reached the backend, failed with "that path is no longer
 * there" because the first had already moved it, and put an error toast
 * on screen immediately after a removal that worked.
 *
 * A ref instead, because a ref updates synchronously -- the second call
 * sees the flag the first one set, in the same tick, with no render in
 * between.
 *
 * Deliberately NOT a `disabled` prop. Disabling the control under the
 * user's focus drops that focus to the page body, which is worse than a
 * click that quietly does nothing; StartupItems.jsx already made this
 * argument for its own switch and it holds here too.
 */
export function useSingleFlight(action) {
  const inFlight = useRef(false);

  // The action lives in a ref so the returned function can be stable
  // without capturing a stale one. Stability matters because this is
  // handed straight to onClick and used as an effect dependency.
  const actionRef = useRef(action);
  actionRef.current = action;

  return useCallback(async (...args) => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    try {
      return await actionRef.current(...args);
    } finally {
      // finally, not after the await: an action that throws must reopen
      // the gate. Otherwise one failure disables the control for the rest
      // of the session with nothing on screen to explain it.
      inFlight.current = false;
    }
  }, []);
}
