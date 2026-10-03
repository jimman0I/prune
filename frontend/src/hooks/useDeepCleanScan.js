import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchDeepCleanRules, streamDeepCleanScan } from '../lib/api.js';
import { mergeScannedRule, scanLogLine } from '../lib/scanLog.js';
import { cleanableIds } from '../lib/defaultSelection.js';
import { keys } from '../lib/queryClient.js';
import { APP_VERSION } from '../lib/appVersion.js';
import {
  rulesSignature, joinFingerprint, readFreshScanCache, saveScanCache
} from '../lib/deepCleanScanCache.js';
import { settleScanAfterClean } from '../lib/deepCleanAfterClean.js';
import { announceScanChange, onScanChange } from '../lib/deepCleanSync.js';

/** What a fresh measurement of a rule overwrites on the row it lands on.
 * A row restored from the remembered scan, or settled after a clean, can carry
 * marks (`fromCache`, `rescanNeeded`) and a stale file list; merged by id, a
 * new result would otherwise inherit them. */
const FRESH = { fromCache: undefined, rescanNeeded: undefined, incomplete: undefined, files: undefined, filesListed: undefined };

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
 * seconds of disk walking and must never start because a tab was opened --
 * and when the last complete scan was remembered (lib/deepCleanScanCache.js)
 * and nothing that affects it has changed, it does not need to start at all:
 * the tree is drawn from that and `hasScanned` is true.
 *
 * `settings` is read only for the fingerprint that says whether a remembered
 * scan still applies; until it has loaded, nothing is restored or saved.
 * `autoStart` is the caller asking for a scan whenever there is no remembered
 * one to open on -- the first look at the screen, as before. `enabled: false`
 * holds back even the (cheap) rule listing, for a caller -- the Dashboard's
 * Clean recommended -- that waits until the app is idle to ask for it.
 */
export function useDeepCleanScan(nameOf, messages, { settings = null, appVersion = APP_VERSION, autoStart = false, enabled = true } = {}) {
  const queryClient = useQueryClient();
  // The log is built inside a long-lived stream callback; a ref keeps it
  // on the language current when each line lands rather than the one the
  // scan started in. `nameOf` shows a rule by its translated name.
  const nameOfRef = useRef(nameOf);
  nameOfRef.current = nameOf;
  // Likewise the wording around the name (deepClean.log). Undefined falls
  // through to scanLog.js's English default.
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // The listed tree: a JSON file the backend reads in ~40ms, so every
  // category and rule is on screen immediately with a dash for its size.
  // Deep Clean used to open on an empty panel and stay there until
  // someone found Preview and waited half a minute, which is how it came
  // to be reported as not working.
  // Called inside an arrow so the import is only touched when the query runs.
  const rulesQuery = useQuery({ queryKey: keys.deepCleanRules, queryFn: () => fetchDeepCleanRules(), enabled });
  const rulesDataRef = useRef(null);
  rulesDataRef.current = rulesQuery.data ?? null;
  // Who is speaking when this instance announces a change to the remembered
  // scan (see lib/deepCleanSync.js).
  const sourceRef = useRef(null);
  if (sourceRef.current === null) sourceRef.current = Symbol('deepCleanScan');

  // What the scan has measured. Kept beside the listed tree rather than
  // overwriting it: a rule's size merges in by id, so the rules stay put
  // and readable while their numbers arrive.
  const [scannedTree, setScannedTree] = useState(null);
  // The raw results; the log lines are worded from them at render time, so a
  // line is always in the language on screen rather than the one that happened
  // to be current when its result arrived.
  const [logItems, setLog] = useState([]);
  const log = useMemo(
    () => logItems.map((item) => scanLogLine(item, nameOfRef.current, messagesRef.current)),
    // nameOf / messages change with the language; the refs hold the same values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [logItems, nameOf, messages]
  );
  const [scanned, setScanned] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasScanned, setHasScanned] = useState(false);
  const [streamError, setStreamError] = useState(null);
  const [armed, setArmed] = useState(false);
  // The rule currently being measured, or null between rules and once the
  // scan is done -- what a tree row highlights against, the same "what is
  // it doing right now" the log line already answers, asked of the tree
  // that sits beside it.
  const [currentId, setCurrentId] = useState(null);
  // What a profile-wide search is doing right now -- { id, dirs, entries,
  // matches } -- or null. It is the only rule kind that takes long enough
  // for silence to look like a hang, so it reports while it works.
  const [progress, setProgress] = useState(null);
  // When the rows on screen were last measured (ms), or null. Rows a clean
  // has since settled are newer than this; rows the clean did not touch are not.
  const [lastScanAt, setLastScanAt] = useState(null);
  const lastScanAtRef = useRef(null);
  lastScanAtRef.current = lastScanAt;
  // True while the tree is the remembered scan and no scan has run since.
  const [restored, setRestored] = useState(false);
  // Bumped whenever a whole scan lands (fresh or remembered), and nothing
  // else: see stableCleanableIds.
  const [scanEpoch, setScanEpoch] = useState(0);

  // Everything that changes what a scan would find, as one string. The rules
  // are hashed apart from the settings because hashing 90 rule definitions on
  // every settings save (each tick saves one) would be work for nothing.
  const rulesSig = useMemo(() => (rulesQuery.data ? rulesSignature(rulesQuery.data) : null), [rulesQuery.data]);
  const fingerprint = useMemo(
    () => (rulesSig && settings ? joinFingerprint({ rulesSig, settings, appVersion }) : null),
    [rulesSig, settings, appVersion]
  );
  const fingerprintRef = useRef(fingerprint);
  fingerprintRef.current = fingerprint;

  // A rule added or removed since the last scan (a Custom location, an
  // imported cleaner) makes that scan out of date: its tree would hide the
  // new rule, or keep showing one that is gone. The listed tree takes over
  // again, unmeasured, until the next Preview.
  const listedIds = (rulesQuery.data ?? []).flatMap((group) => group.items.map((item) => item.id)).sort().join('\n');
  const scannedIds = (scannedTree ?? []).flatMap((group) => group.items.map((item) => item.id)).sort().join('\n');
  const ruleSetChanged = scannedTree !== null && listedIds !== '' && listedIds !== scannedIds;
  useEffect(() => {
    if (!ruleSetChanged) return;
    setScannedTree(null);
    setHasScanned(false);
  }, [ruleSetChanged]);

  const tree = (ruleSetChanged ? null : scannedTree) ?? rulesQuery.data ?? null;
  const scannedTreeRef = useRef(scannedTree);
  scannedTreeRef.current = scannedTree;

  /* Stable identity, so the consumer's effect can list it as a dependency
   * and mean it. Returned as a fresh arrow before this, which forced
   * DeepClean's post-scan effect to omit it from its dependency array --
   * correct only by accident of when that effect happens to fire, and
   * exactly the kind of omission that hides a stale closure until
   * something else changes.
   *
   * It changes when a whole scan lands (fresh or remembered) and NOT when a
   * clean settles rows afterwards: that effect prunes the selection to what a
   * scan proved cleanable, and re-running it after a clean would tick the
   * default rules again on rows that now read 0 B. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableCleanableIds = useCallback(() => cleanableIds(scannedTreeRef.current ?? []), [scanEpoch]);

  /** Brings the rows up to date with what a clean reported (see
   * lib/deepCleanAfterClean.js) and remembers the result, instead of walking
   * the disk again. The measurement time is left alone: rows the clean did not
   * touch were measured when they were. */
  const applyCleanResults = useCallback((results) => {
    const current = scannedTreeRef.current;
    if (!current) return;
    const next = settleScanAfterClean(current, results);
    if (next === current) return;
    scannedTreeRef.current = next;
    setScannedTree(next);
    if (fingerprintRef.current && lastScanAtRef.current) {
      saveScanCache({ tree: next, fingerprint: fingerprintRef.current, savedAt: lastScanAtRef.current });
      announceScanChange(sourceRef.current);
    }
  }, []);


  /** Puts the rows an Undo has just brought back to how they read before the
   * clean: `previousTree` is the tree as it was, `ids` the rules whose files
   * came back. The files are back, so a row that now says 0 B (or "cleaned") is
   * no longer true, and the sizes from before are as good as they were then.
   *
   * Only while the rows are still the ones the clean left. If a scan has
   * finished since (`scanAt` is the measurement time the caller saw when it
   * cleaned), that scan measured the real disk and nothing here may overwrite it
   * with an older picture. */
  const revertRows = useCallback((previousTree, ids, scanAt) => {
    const current = scannedTreeRef.current;
    if (!current || !Array.isArray(previousTree) || ids.length === 0) return;
    if ((lastScanAtRef.current ?? null) !== (scanAt ?? null)) return;
    const wanted = new Set(ids);
    const before = new Map(previousTree.flatMap((group) => group.items.map((item) => [item.id, item])));
    const next = current.map((group) => ({
      ...group,
      items: group.items.map((item) => (wanted.has(item.id) && before.has(item.id) ? before.get(item.id) : item))
    }));
    scannedTreeRef.current = next;
    setScannedTree(next);
    if (fingerprintRef.current && lastScanAtRef.current) {
      saveScanCache({ tree: next, fingerprint: fingerprintRef.current, savedAt: lastScanAtRef.current });
      announceScanChange(sourceRef.current);
    }
  }, []);

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
      setRestored(false);
      setLog([]);
      setScanned(0);
      setTotal(0);
      setCurrentId(null);
      setProgress(null);

      // Mirrors the tree outside state: the stream delivers forty events
      // and both the selection step and the remembered scan afterwards need
      // the complete set, which a stale closure over React state would not
      // have. It starts from what is on screen, so a Rescan replaces rows as
      // their new results land rather than blanking the tree first.
      let built = scannedTreeRef.current ?? rulesQuery.data ?? [];
      let expected = null;
      let received = 0;
      let failed = false;

      await streamDeepCleanScan((type, data) => {
        if (type === 'start') {
          expected = data.total;
          setTotal(data.total);
        } else if (type === 'rule') {
          built = mergeScannedRule(built, { ...FRESH, ...data });
          received += 1;
          setScannedTree(built);
          setLog((prev) => [...prev, data]);
          setScanned((n) => n + 1);
          setCurrentId(data.id);
          setProgress(null);
        } else if (type === 'progress') {
          setProgress(data);
        } else if (type === 'error') {
          failed = true;
          setStreamError(data.message);
        }
      }, signal);

      setHasScanned(true);
      setCurrentId(null);
      setProgress(null);
      // Only a COMPLETE scan is worth remembering: a stream that errored, or
      // ended before every rule reported, would leave rows that were never
      // measured looking as though they had been.
      if (!failed && received > 0 && (expected === null || received >= expected)) {
        const savedAt = Date.now();
        if (fingerprintRef.current && saveScanCache({ tree: built, fingerprint: fingerprintRef.current, savedAt })) {
          announceScanChange(sourceRef.current);
        }
        setLastScanAt(savedAt);
        setScanEpoch((n) => n + 1);
      }
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
  const scanningRef = useRef(false);
  scanningRef.current = scanning;

  // Another part of the app (the Dashboard's Clean recommended, or Deep Clean
  // itself) changed the remembered scan: read it again so the rows here are not
  // left showing sizes it has since cleaned. Never while this one is scanning --
  // a scan in flight is about to say something newer.
  useEffect(() => onScanChange(sourceRef.current, () => {
    if (scanningRef.current || !fingerprintRef.current || !rulesDataRef.current) return;
    const fresh = readFreshScanCache({ fingerprint: fingerprintRef.current, listedTree: rulesDataRef.current });
    if (!fresh) return;
    scannedTreeRef.current = fresh.tree;
    setScannedTree(fresh.tree);
    setHasScanned(true);
    setLastScanAt(fresh.savedAt);
  }), []);

  // Opens on the last complete scan, once, when there is one that still
  // applies. It waits for the settings (they are part of the fingerprint), so
  // "no cache" is only ever concluded once there was something to compare.
  //
  // With `autoStart`, finding none also starts the scan, in this same effect:
  // the screen used to scan the moment its tree loaded, and deciding that a
  // render later (once a "checked" flag had come back through state) left a
  // window with the tree on screen and no scan running yet.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current || !fingerprint || !rulesQuery.data) return;
    restoredRef.current = true;
    const fresh = readFreshScanCache({ fingerprint, listedTree: rulesQuery.data });
    if (fresh) {
      setScannedTree(fresh.tree);
      setHasScanned(true);
      setLastScanAt(fresh.savedAt);
      setScanEpoch((n) => n + 1);
      setRestored(true);
    } else if (autoStart) {
      start();
    }
  }, [fingerprint, rulesQuery.data, autoStart, start]);

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
    currentId,
    progress,
    /** When the rows were last measured (ms), or null before any scan. */
    lastScanAt,
    /** True while the tree shows the remembered scan and nothing has been
     * scanned since: the scan log has nothing of its own to say. */
    restored,
    applyCleanResults,
    revertRows,
    start,
    stop,
    /** The ids a scan proved are worth cleaning. Before a scan the tree
     * is listed but unmeasured, so the defaults have to tick rules that
     * may turn out to be uninstalled or unreadable.
     *
     * cleanableIds, not selectableIds. The two answer different
     * questions and only one of them is right here: this filters what
     * the user has ALREADY chosen, so a rule they deliberately enabled
     * through the warning dialog has to survive it. Select All's
     * narrower answer, which skips rules that lose data, would untick
     * that choice the moment a scan finished. */
    cleanableIds: stableCleanableIds
  };
}
