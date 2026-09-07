import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { keys } from '../lib/queryClient.js';
import { fetchStartupItems, fetchStartupIcons, fetchCleanerCategoryIcons } from '../lib/api.js';

/** Reads the startup screen's data before anyone opens the startup screen.
 *
 * Both of its queries are slow, and slow in a way no amount of frontend
 * work fixes: measured against a cold backend on this machine, the list
 * takes 1.19s and the icons 2.30s, and both spawn PowerShell -- once for
 * the registry hives and the Startup folders, once to resolve shortcuts,
 * once to open every executable in the list. Nothing asked for either
 * until the tab was first opened, so the first visit always showed a table
 * of lettered tiles that swapped to real icons a second or two later.
 *
 * The data was never wrong. It just arrived while the user was already
 * looking at the table, which is what makes it read as a bug rather than
 * as loading.
 *
 * Deliberately NOT tied to the program list finishing, which was the
 * obvious hook and the wrong one: usePrograms reports `loading` for the
 * program list alone, while seven sibling queries -- icons, sizes,
 * versions, install dates -- are still running behind it. Starting a
 * PowerShell-heavy read at that moment would compete with the work the
 * user is actually watching.
 *
 * So it waits for the browser to say it is idle instead, with a timeout so
 * a permanently busy app still warms eventually. requestIdleCallback is
 * available in the Electron runtime this ships in; the timer is for jsdom,
 * which has no such thing, and would otherwise leave this untested.
 */
export function useIdlePrefetch({ delayMs = 1200, timeout = 4000 } = {}) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const warm = () => {
      // prefetchQuery, not fetchQuery, and the reason is error handling
      // rather than caching -- both honour staleTime, so both are already
      // a no-op once the screen has loaded this itself. The difference is
      // that fetchQuery REJECTS when the read fails, and there is nobody
      // to catch it here: a backend that cannot reach the registry would
      // surface as an unhandled rejection from a background warm-up the
      // user never asked for. prefetchQuery resolves either way and
      // leaves the error in the cache for the screen to report if and
      // when it is opened.
      //
      // If the screen opens while these are in flight, its own useQuery
      // deduplicates against them rather than asking again.
      queryClient.prefetchQuery({ queryKey: keys.startupItems, queryFn: fetchStartupItems });
      queryClient.prefetchQuery({ queryKey: keys.startupIcons, queryFn: fetchStartupIcons });

      // Deep Clean's application icons, warmed on the same tick and for
      // the same reason: the list groups by app, and the headings pop from
      // lettered tiles to real icons if this is left until the tab opens.
      queryClient.prefetchQuery({
        queryKey: keys.deepCleanCategoryIcons,
        queryFn: fetchCleanerCategoryIcons
      });
    };

    const idle = typeof requestIdleCallback === 'function';
    const handle = idle ? requestIdleCallback(warm, { timeout }) : setTimeout(warm, delayMs);

    // Cancelling the pending callback is what keeps a closing window from
    // starting two PowerShell reads -- the work is deferred by design, so
    // there is a real gap between scheduling it and running it. A
    // `cancelled` flag checked inside `warm` was here too and was removed:
    // once the handle is cancelled the callback cannot run, so the flag
    // could never be observed. Mutation testing caught it, by deleting
    // the flag and watching every test still pass.
    return () => {
      if (idle) cancelIdleCallback(handle); else clearTimeout(handle);
    };
  }, [queryClient, delayMs, timeout]);
}
