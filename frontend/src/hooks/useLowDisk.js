import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchLowDisk } from '../lib/api.js';
import { keys } from '../lib/queryClient.js';
import { useSettings } from './useSystemQueries.js';

/** How often the Dashboard asks which drives are short of room. The backend's
 * answer is a statfs per drive, so asking is cheap; a few minutes is often
 * enough for something that changes over hours. */
export const LOW_DISK_POLL_MS = 5 * 60 * 1000;

/** The drives that are low on space, kept current without being fussy.
 *
 * - Nothing is asked while the warning is Off in Settings, and the share is part
 *   of the query key, so choosing another one reads again at once.
 * - It polls lightly, and only while the window is in use (TanStack's own
 *   default: not in the background).
 * - Screens stay mounted once visited, so `active` is how it knows the
 *   Dashboard has come back into view: it reads again then, and not on first
 *   mount, which has just read.
 * - A failed reading is no drives. A warning that cannot be worked out is not a
 *   reason to put a banner on the front page. */
export function useLowDisk({ active = true } = {}) {
  const { settings } = useSettings();
  // Until Settings has answered the share is unknown; an old file without the
  // key is the default, 10.
  const known = settings !== null;
  const percent = [0, 5, 10, 15].includes(settings?.lowDiskWarning) ? settings.lowDiskWarning : 10;

  const query = useQuery({
    queryKey: [...keys.lowDisk, percent],
    // Inside an arrow so a mock without the call defined simply shows nothing.
    queryFn: () => fetchLowDisk(),
    enabled: known && percent > 0,
    refetchInterval: LOW_DISK_POLL_MS,
    retry: false
  });

  const wasActive = useRef(active);
  const { refetch } = query;
  useEffect(() => {
    if (active && !wasActive.current && known && percent > 0) refetch();
    wasActive.current = active;
  }, [active, refetch, known, percent]);

  return {
    drives: percent > 0 && query.data ? query.data.drives : [],
    percent
  };
}
