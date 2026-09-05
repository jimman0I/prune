import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchStartupItems, fetchStartupIcons, setStartupItemEnabled,
  fetchQuarantineBatches, restoreQuarantineBatch, deleteQuarantineBatch, emptyQuarantine,
  fetchSettings, updateSettings,
  fetchDiskSpace, fetchDiskHealth
} from '../lib/api.js';
import { keys } from '../lib/queryClient.js';
import { applyEnabled, toggleOutcome } from '../lib/startupToggleState.js';

/** The screens whose data is one request and a couple of actions.
 *
 * Grouped rather than one file each because they share the pattern
 * exactly: read a list, act on one item, re-read. Splitting four
 * six-line hooks across four files would be filing, not modularity.
 * The two that genuinely differ -- the program list's eight-way merge and
 * the streaming scans -- have their own files.
 */

/* -------------------------------------------------------------- startup */

export function useStartupItems() {
  const items = useQuery({ queryKey: keys.startupItems, queryFn: fetchStartupItems });

  // Its own query, fired alongside rather than after: the backend re-reads
  // the startup locations for the icons anyway, so chaining them would add
  // the list's own second to a wait the rows do not need to serialise on.
  // It never throws -- icons are decoration and must not empty the rows.
  const icons = useQuery({ queryKey: keys.startupIcons, queryFn: fetchStartupIcons, retry: 1 });

  return {
    items: items.data ?? null,
    icons: icons.data ?? {},
    loading: items.isPending,
    error: items.error ? items.error.message : null
  };
}

/** Switching one entry on or off.
 *
 * Optimistic, and it has to be: the write spawns PowerShell, and a
 * machine-wide entry waits on a UAC prompt the user has to read. A switch
 * that only moved on success would sit still for seconds after every
 * click.
 *
 * onMutate moves the row and returns the previous list; onSettled decides
 * whether that optimism held. A declined UAC prompt rolls back silently --
 * it is a decision the user just made, not a failure -- and everything
 * else that did not end in the requested state rolls back with a reason. */
export function useStartupToggle({ onProblem } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, enabled }) => setStartupItemEnabled(id, enabled),

    onMutate: async ({ id, enabled }) => {
      await queryClient.cancelQueries({ queryKey: keys.startupItems });
      const previous = queryClient.getQueryData(keys.startupItems);
      queryClient.setQueryData(keys.startupItems, (current) => applyEnabled(current, id, enabled));
      return { previous, id, enabled };
    },

    onSettled: (result, error, variables, context) => {
      // A thrown error and a { ok: false } result are the same event to
      // the row: it did not change. setStartupItemEnabled deliberately
      // returns rather than throws, so both paths land here.
      const outcome = error
        ? { revert: true, message: error.message }
        : toggleOutcome(result, variables.enabled);

      if (outcome.revert) {
        queryClient.setQueryData(keys.startupItems, (current) =>
          applyEnabled(current, variables.id, !variables.enabled));
      }
      if (outcome.message) onProblem?.(variables.id, outcome.message);
    }
  });
}

/* ----------------------------------------------------------- quarantine */

export function useQuarantine() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: keys.quarantine });

  const batches = useQuery({ queryKey: keys.quarantine, queryFn: fetchQuarantineBatches });

  return {
    batches: batches.data ?? [],
    loading: batches.isPending,
    error: batches.error ? batches.error.message : null,
    refresh: invalidate,
    restore: useMutation({ mutationFn: restoreQuarantineBatch, onSuccess: invalidate }),
    remove: useMutation({ mutationFn: deleteQuarantineBatch, onSuccess: invalidate }),
    empty: useMutation({ mutationFn: emptyQuarantine, onSuccess: invalidate })
  };
}

/* ------------------------------------------------------------- settings */

export function useSettings() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: keys.settings, queryFn: fetchSettings });

  const save = useMutation({
    mutationFn: updateSettings,

    // Optimistic. A toggle that waits on a disk write before moving feels
    // broken, so the change lands in the cache immediately and the
    // previous settings are kept to put back if the write fails.
    onMutate: async (partial) => {
      await queryClient.cancelQueries({ queryKey: keys.settings });
      const previous = queryClient.getQueryData(keys.settings);
      queryClient.setQueryData(keys.settings, (current) => ({ ...current, ...partial }));
      return { previous };
    },

    onError: (error, partial, context) => {
      // Straight back to what was actually persisted, not to a guess at
      // the inverse of the change -- two settings edited quickly would
      // otherwise roll back to a state that never existed.
      if (context?.previous) queryClient.setQueryData(keys.settings, context.previous);
    },

    // The server returns the FULL settings object, not the partial that
    // was sent, so the reply replaces the cache rather than merging into
    // it -- and it is authoritative over the optimistic guess above.
    onSuccess: (updated) => queryClient.setQueryData(keys.settings, updated)
  });

  return { settings: settings.data ?? null, loading: settings.isPending, save };
}

/* ----------------------------------------------------------------- disk */

export function useDiskSpace() {
  const query = useQuery({ queryKey: keys.diskSpace, queryFn: fetchDiskSpace, retry: 1 });
  return { diskSpace: query.data ?? null, loading: query.isPending };
}

export function useDiskHealth() {
  const query = useQuery({ queryKey: keys.diskHealth, queryFn: fetchDiskHealth, retry: 1 });
  return { health: query.data ?? null, loading: query.isPending };
}
