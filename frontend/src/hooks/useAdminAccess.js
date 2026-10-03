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
 * worse surprise. `canRestart` is the opposite kind of claim -- it offers a
 * restart as administrator -- so it needs the status to have been READ and to
 * say "not elevated": while the query is loading or has failed, "not elevated"
 * is only a default, and offering the button then showed it to a Prune that was
 * already running as administrator. It is also true only inside the packaged
 * desktop app. */
export function useAdminAccess() {
  const status = useQuery({
    queryKey: keys.mftStatus,
    // Inside a function so a missing endpoint is a query error, not a throw.
    queryFn: () => fetchMftStatus(),
    retry: false,
    staleTime: Infinity
  });
  const elevated = status.data?.elevated === true;
  // Read and said no: the one state in which restarting would change anything.
  const knownNotElevated = status.isSuccess && status.data?.elevated === false;

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

  return { elevated, canRestart: bridgeCanRestart && knownNotElevated, restarting, outcome, restart };
}
