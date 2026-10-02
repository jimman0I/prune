import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMftStatus } from '../lib/api.js';
import { keys } from '../lib/queryClient.js';
import { canRestartAsAdmin, restartAsAdmin } from '../lib/adminRelaunch.js';

/** Where Prune stands on administrator rights, for the Disk Map's drive
 * chooser: already elevated (the fast scan needs no prompt), or not (it
 * raises one, and a restart can make that a one-time thing).
 *
 * `elevated` is false while unknown or when the status cannot be read: the
 * safe reading, since claiming "no prompt" and then raising one would be the
 * worse surprise. `canRestart` is true only inside the packaged desktop app
 * and only while not elevated. */
export function useAdminAccess() {
  const status = useQuery({
    queryKey: keys.mftStatus,
    // Inside a function so a missing endpoint is a query error, not a throw.
    queryFn: () => fetchMftStatus(),
    retry: false,
    staleTime: Infinity
  });
  const elevated = status.data?.elevated === true;

  const [bridgeCanRestart, setBridgeCanRestart] = useState(false);
  useEffect(() => {
    let cancelled = false;
    canRestartAsAdmin().then((can) => { if (!cancelled) setBridgeCanRestart(can); });
    return () => { cancelled = true; };
  }, []);

  const [restarting, setRestarting] = useState(false);
  // { kind: 'declined' } | { kind: 'failed', error } | null
  const [outcome, setOutcome] = useState(null);

  const restart = useCallback(async () => {
    setOutcome(null);
    setRestarting(true);
    const result = await restartAsAdmin();
    if (result.ok) return; // the app is closing; stay in "restarting"
    setRestarting(false);
    if (result.cancelled) setOutcome({ kind: 'declined' });
    else setOutcome({ kind: 'failed', error: result.error || '' });
  }, []);

  return { elevated, canRestart: bridgeCanRestart && !elevated, restarting, outcome, restart };
}
