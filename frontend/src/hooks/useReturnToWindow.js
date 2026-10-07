import { useEffect, useRef } from 'react';

/** How long the window has to have been away for coming back to count.
 *
 * Alt-tabbing out and straight back changes nothing worth re-reading. A person
 * who went to Windows Settings to remove a program, or ran an installer, was
 * gone for longer than this. */
export const RETURN_MIN_AWAY_MS = 15_000;

/** Calls `onReturn` when the window becomes active again after being away at
 * least `minAwayMs`.
 *
 * Why this exists: the app reads the machine once and keeps it for five minutes
 * (see lib/queryClient.js), and nothing refetches on focus, deliberately -- most
 * of what it reads is slow. The cost was that anything changed outside Prune (a
 * program installed or removed in Windows, an installer finishing) never reached
 * an open window; the screens stay mounted, so not even navigating refreshed it.
 * Coming back to the window after a real absence is the moment that change most
 * likely happened, and it is the moment a refresh is welcome.
 *
 * "Away" is blurred or hidden, the same two sources useWindowActivity reads, and
 * each handler re-reads the real state rather than trusting which event fired. */
export function useReturnToWindow(onReturn, { minAwayMs = RETURN_MIN_AWAY_MS, now = Date.now } = {}) {
  const callback = useRef(onReturn);
  callback.current = onReturn;

  useEffect(() => {
    let leftAt = null;

    const update = () => {
      const inactive = document.hidden || !document.hasFocus();
      if (inactive) {
        if (leftAt === null) leftAt = now();
        return;
      }
      const awayFor = leftAt === null ? 0 : now() - leftAt;
      leftAt = null;
      if (awayFor >= minAwayMs) callback.current?.(awayFor);
    };

    window.addEventListener('blur', update);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.removeEventListener('blur', update);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [minAwayMs, now]);
}
