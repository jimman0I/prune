import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchDeepCleanRules, streamDeepCleanScan } from '../lib/api.js';
import { mergeScannedRule, scanLogLine } from '../lib/scanLog.js';
import { selectableIds } from '../lib/defaultSelection.js';
import { keys } from '../lib/queryClient.js';

/** The Deep Clean tree, and the scan that measures it.
 *
 * The awkward part of putting a stream behind this library is that a
 * query is shaped around one answer arriving once, and this one delivers
 * about forty over nineteen seconds. The fit is better than it looks:
 * what useQuery actually provides here is the thing the stream needs most
 * -- an AbortSignal with a real lifecycle -- and the partial results go
 * into state as they land, exactly as they did before.
 *
 * Cancellation is not cosmetic and must survive this refactor. Aborting
 * the fetch closes the connection, and the route watches for that, so
 * Stop genuinely halts the filesystem walk server-side rather than
 * ignoring the rest of an answer that is still being computed.
 *
 * The scan is armed rather than automatic. It costs about nineteen
 * seconds of disk walking and must never start because a tab was opened.
 */
export function useDeepCleanScan() {
  const queryClient = useQueryClient();

  // The listed tree: a JSON file the backend reads in ~40ms, so every
  // category and rule is on screen immediately with a dash for its size.
  // Deep Clean used to open on an empty panel and stay there until
  // someone found Preview and waited half a minute, which is how it came
  // to be reported as not working.
  const rulesQuery = useQuery({ queryKey: keys.deepCleanRules, queryFn: fetchDeepCleanRules });

  // What the scan has measured. Kept beside the listed tree rather than
  // overwriting it: a rule's size merges in by id, so the rules stay put
  // and readable while their numbers arrive.
  const [scannedTree, setScannedTree] = useState(null);
  const [log, setLog] = useState([]);
  const [scanned, setScanned] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasScanned, setHasScanned] = useState(false);
  const [streamError, setStreamError] = useState(null);
  const [armed, setArmed] = useState(false);

  const tree = scannedTree ?? rulesQuery.data ?? null;

  const scanQuery = useQuery({
    queryKey: keys.deepCleanScan,
    enabled: armed,
    // A nineteen-second disk walk is never repeated on its own. Not on a
    // retry, not on a remount, not because the window regained focus.
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnMount: false,

    queryFn: async ({ signal }) => {
      setStreamError(null);
      setLog([]);
      setScanned(0);
      setTotal(0);

      // Mirrors the tree outside state: the stream delivers forty events
      // and the selection step afterwards needs the complete set, which a
      // stale closure over React state would not have.
      let built = [];

      await streamDeepCleanScan((type, data) => {
        if (type === 'start') {
          setTotal(data.total);
        } else if (type === 'rule') {
          // Merged through the updater so each result lands on the tree
          // actually on screen. Merging by id is idempotent, so React
          // invoking this twice in development changes nothing.
          setScannedTree((prev) => {
            built = mergeScannedRule(prev ?? rulesQuery.data ?? [], data);
            return built;
          });
          setLog((prev) => [...prev, scanLogLine(data)]);
          setScanned((n) => n + 1);
        } else if (type === 'error') {
          setStreamError(data.message);
        }
      }, signal);

      setHasScanned(true);
      return built;
    }
  });

  /** Stop, and mean it.
   *
   * cancelQueries aborts the signal the queryFn is holding, which closes
   * the connection, which is what the backend is watching for.
   * Disarming afterwards matters as much: an enabled query whose promise
   * was just cancelled will start again immediately.
   */
  const stop = useCallback(async () => {
    setArmed(false);
    await queryClient.cancelQueries({ queryKey: keys.deepCleanScan });
  }, [queryClient]);

  const start = useCallback(async () => {
    // Remove the previous run's cache entry first, or an armed query
    // holding a settled result resolves instantly with the old answer
    // instead of streaming a new one.
    queryClient.removeQueries({ queryKey: keys.deepCleanScan });
    setArmed(true);
  }, [queryClient]);

  const scanning = armed && scanQuery.isFetching;

  // An abort is the user pressing Stop, not a failure. Whatever was
  // measured before that point is real and stays on screen.
  const error = useMemo(() => {
    if (streamError) return streamError;
    const err = scanQuery.error;
    if (!err || err.name === 'AbortError' || /abort/i.test(err.message || '')) return null;
    return err.message;
  }, [streamError, scanQuery.error]);

  return {
    tree,
    scanning,
    hasScanned,
    log,
    scanned,
    total,
    error,
    start,
    stop,
    /** The ids a scan proved are worth cleaning. Before a scan the tree
     * is listed but unmeasured, so the defaults have to tick rules that
     * may turn out to be uninstalled or unreadable. */
    selectableIds: () => selectableIds(scannedTree ?? [])
  };
}
