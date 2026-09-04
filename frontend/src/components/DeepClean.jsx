import { useEffect, useMemo, useRef, useState } from 'react';
import { visibleCategories, hiddenRuleCount } from '../lib/visibleRules.js';
import { fetchDeepCleanRules, streamDeepCleanScan, executeDeepClean, fetchSettings } from '../lib/api.js';
import { defaultSelection, selectableIds } from '../lib/defaultSelection.js';
import { selectionTotal } from '../lib/selectionTotal.js';
import { mergeScannedRule, scanLogLine } from '../lib/scanLog.js';
import DeepCleanTree from './DeepCleanTree.jsx';

const LOG_TONE = {
  size: 'text-[color:var(--accent-coral)]',
  warning: 'text-[color:var(--warning)]',
  muted: 'text-[color:var(--text-muted)]'
};

/** The live scan log. Each rule appears the moment its real size comes
 * back, which is what turns a nineteen-second wait from "is this stuck?"
 * into something you can watch. Auto-scrolls, but only while pinned to
 * the bottom -- yanking the view back down while someone is reading
 * further up is worse than not scrolling at all. */
function ScanLog({ lines, scanning, scanned, total }) {
  const boxRef = useRef(null);
  const pinnedRef = useRef(true);

  useEffect(() => {
    const box = boxRef.current;
    if (box && pinnedRef.current) box.scrollTop = box.scrollHeight;
  }, [lines.length]);

  const onScroll = () => {
    const box = boxRef.current;
    if (!box) return;
    pinnedRef.current = box.scrollHeight - box.scrollTop - box.clientHeight < 24;
  };

  return (
    <div className="glass-panel flex flex-col min-h-0 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[color:var(--border-subtle)] shrink-0">
        <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-[color:var(--text-muted)]">
          Scan output
        </span>
        {total > 0 && (
          <span className="text-[11.5px] font-mono text-[color:var(--text-secondary)]">
            {scanned} / {total}
          </span>
        )}
      </div>

      {total > 0 && (
        <div className="h-[2px] bg-white/[0.06] shrink-0">
          <div
            className="h-full bg-[color:var(--accent-coral)] transition-[width] duration-200"
            style={{ width: `${Math.round((scanned / total) * 100)}%` }}
          />
        </div>
      )}

      <div ref={boxRef} onScroll={onScroll} className="flex-1 overflow-y-auto min-h-0 px-4 py-3 space-y-1">
        {lines.length === 0 && (
          <p className="text-[12px] text-[color:var(--text-muted)] font-mono">
            {scanning ? 'Starting…' : 'Nothing scanned yet.'}
          </p>
        )}
        {lines.map((line, i) => (
          <div key={i} className="flex items-baseline gap-2 text-[11.5px] font-mono leading-relaxed">
            <span className="text-[color:var(--text-secondary)] truncate">{line.label}</span>
            <span className="flex-1 border-b border-dashed border-white/[0.07] translate-y-[-3px]" />
            <span className={`${LOG_TONE[line.tone]} shrink-0`}>{line.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function DeepClean() {
  // No auto-scan on mount, per spec -- the tree stays empty until the
  // user explicitly clicks Preview.
  const [categories, setCategories] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [confirmClean, setConfirmClean] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanResult, setCleanResult] = useState(null);
  const [cleanError, setCleanError] = useState(null);
  const [logLines, setLogLines] = useState([]);
  const [scanned, setScanned] = useState(0);
  // Whether sizes have actually been measured, which is no longer the
  // same question as whether the tree exists.
  const [hasScanned, setHasScanned] = useState(false);
  const [total, setTotal] = useState(0);
  // BleachBit's "hide irrelevant cleaners". Read once on mount rather than
  // watched: it changes on the Settings screen, and coming back to this
  // one remounts it.
  const [hideUnavailable, setHideUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchSettings()
      .then((s) => { if (!cancelled) setHideUnavailable(s?.hideUnavailableRules === true); })
      // The filter is an enhancement, never a blocker -- if settings
      // cannot be read the list simply shows everything.
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const shownCategories = useMemo(
    () => (categories ? visibleCategories(categories, hideUnavailable) : null),
    [categories, hideUnavailable]
  );
  const hiddenCount = useMemo(
    () => hiddenRuleCount(categories, hideUnavailable),
    [categories, hideUnavailable]
  );
  const abortRef = useRef(null);

  // The tree is on screen before anything is measured. It is built from
  // the rule list, which is a JSON file the backend reads in about forty
  // milliseconds, so every category and every rule is there to read and
  // tick immediately -- sizes show a dash until a scan fills them in.
  //
  // Deep Clean used to open on an empty panel and stay there until
  // someone found the Preview button and waited half a minute, which is
  // how it came to be reported as not working. Showing what the feature
  // cleans should not cost thirty seconds of disk walking.
  useEffect(() => {
    let cancelled = false;
    fetchDeepCleanRules()
      .then((listed) => {
        if (cancelled) return;
        // Only as the starting state: a scan already running owns the
        // tree, and this must not overwrite measured sizes with dashes.
        setCategories((prev) => prev ?? listed);
        setSelected((prev) => (prev.size > 0 ? prev : defaultSelection(listed)));
      })
      .catch(() => { /* Preview still builds the tree from scratch */ });
    return () => { cancelled = true; };
  }, []);

  // Aborting the fetch closes the connection, and the route watches for
  // that -- so Stop really does stop the filesystem walk server-side
  // rather than just ignoring the rest of the answer.
  const stopPreview = () => abortRef.current?.abort();

  // Same reason on unmount: navigating away shouldn't leave a scan
  // running for an answer nobody will see.
  useEffect(() => () => abortRef.current?.abort(), []);

  /** `reselect: false` is for the rescan that follows a clean -- the user
   * just acted on those rules, and re-ticking them would invite doing it
   * twice. */
  const runPreview = async ({ reselect = true } = {}) => {
    // Each rule's size streams back as it's measured, so the tree and the
    // log fill in during the scan instead of after it. The whole run takes
    // about nineteen seconds on a real machine and one rule (a 33 GB
    // shader cache) accounts for a big slice of that -- with no output
    // until the end, there was no way to tell it from a hang.
    const controller = new AbortController();
    abortRef.current = controller;

    setScanning(true);
    setScanError(null);
    setCleanResult(null);
    setLogLines([]);
    setScanned(0);
    setTotal(0);

    // Mirrors the tree outside state: the stream delivers 40 events in
    // ~19s and the final selection step needs the complete set, which a
    // stale closure over `categories` would not have.
    let built = [];

    try {
      await streamDeepCleanScan((type, data) => {
        if (type === 'start') {
          setTotal(data.total);
          // Deliberately NOT cleared. The listed tree is already the right
          // shape and each result merges into it by id, so the rules stay
          // put and readable while their sizes arrive.
          setCategories((prev) => prev ?? []);
        } else if (type === 'rule') {
          // Merged through the state updater rather than into a local
          // copy, so each result lands on the tree that is actually on
          // screen -- the listed one. Merging by id is idempotent, so
          // React invoking this twice in development changes nothing.
          setCategories((prev) => {
            built = mergeScannedRule(prev ?? [], data);
            return built;
          });
          setLogLines((prev) => [...prev, scanLogLine(data)]);
          setScanned((n) => n + 1);
        } else if (type === 'error') {
          setScanError(data.message);
        }
      }, controller.signal);

      // Pre-tick the recommended rules that are actually here. Without
      // this, a scan that found 54 GB across 40 rules left the footer
      // reading "Total space to free: 0 B" with Clean disabled -- a
      // nineteen-second wait ending in a dead end, which is how this got
      // reported as the feature not working at all.
      //
      // A rescan after a clean shouldn't silently re-tick everything the
      // user just removed, so an existing selection is kept (minus any id
      // the fresh scan no longer has) rather than replaced.
      setHasScanned(true);

      // Now that the sizes are known, drop anything the scan proved there
      // is no point cleaning. Before a scan the tree is listed but
      // unmeasured, so the defaults have to tick rules that may turn out
      // to be uninstalled or unreadable -- keeping them selected
      // afterwards would put rules in the batch that free nothing.
      const validIds = selectableIds(built);
      setSelected((prev) => {
        const kept = new Set([...prev].filter((id) => validIds.has(id)));
        if (kept.size > 0 || !reselect) return kept;
        return defaultSelection(built);
      });
    } catch (err) {
      // Aborting is the user pressing Stop, not a failure. Whatever was
      // measured before that point is real and stays on screen.
      if (err.name !== 'AbortError') setScanError(err.message);
    } finally {
      abortRef.current = null;
      setScanning(false);
    }
  };

  const handleToggle = (ruleId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ruleId)) next.delete(ruleId); else next.add(ruleId);
      return next;
    });
  };

  const handleToggleCategory = (category, checked) => {
    const group = categories.find((g) => g.category === category);
    if (!group) return;
    setSelected((prev) => {
      const next = new Set(prev);
      for (const item of group.items) {
        // Select All skips rules for software that isn't on this machine.
        // Selecting them is harmless but meaningless -- they'd clean
        // nothing -- and with a rule set this size it would otherwise bury
        // the handful that actually matter under a pile of no-ops.
        if (checked) { if (item.present !== false) next.add(item.id); }
        else next.delete(item.id);
      }
      return next;
    });
  };

  const handleClean = async () => {
    setCleaning(true);
    setCleanError(null);
    try {
      const result = await executeDeepClean([...selected]);
      setCleanResult(result);
      setSelected(new Set());
      setCleaning(false);
      setConfirmClean(false);
      // Re-scan so the numbers on screen reflect what's actually left on
      // disk, not a stale pre-clean snapshot -- same convention Smart
      // Cleanup's own handleClean already follows. Streamed like any other
      // scan, so this one shows its progress too rather than freezing the
      // screen for another nineteen seconds after the clean.
      await runPreview({ reselect: false });
      return;
    } catch (err) {
      setCleanError(err.message);
    } finally {
      setCleaning(false);
      setConfirmClean(false);
    }
  };

  const cleanTotal = selectionTotal(categories, selected);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 flex flex-col min-h-0 px-12 pt-10 pb-6 max-w-[1600px] w-full">
        <div className="text-[11px] text-[color:var(--text-muted)] font-mono uppercase tracking-[0.16em] mb-2">Maintenance</div>
        <h1 className="display-heading text-[30px] leading-none mb-2">Deep Clean</h1>
        <p className="text-[13px] text-[color:var(--text-secondary)] mb-6 max-w-[62ch]">
          Deep application caches, browser code caches, memory dumps, and error reports --
          beyond what Smart Cleanup's own quick pass covers. Nothing is deleted outright:
          everything Clean removes goes to Quarantine first.
        </p>

        {scanError && (
          <div className="mb-5 px-3.5 py-3 rounded-xl bg-[color:var(--danger-soft)] border border-[color:var(--danger)]/25">
            <p className="text-[12.5px] text-[color:var(--danger)]">Couldn't scan: {scanError}</p>
          </div>
        )}

        {cleanError && (
          <div className="mb-5 px-3.5 py-3 rounded-xl bg-[color:var(--danger-soft)] border border-[color:var(--danger)]/25">
            <p className="text-[12.5px] text-[color:var(--danger)]">Couldn't clean: {cleanError}</p>
          </div>
        )}

        {cleanResult && (
          <div className="flex items-center gap-2.5 mb-5 px-3.5 py-3 rounded-xl bg-[color:var(--success)]/10 border border-[color:var(--success)]/25">
            <div className="text-[12.5px] text-[color:var(--success)]">
              Freed {formatBytes(cleanResult.freedBytes)}
              {cleanResult.results.some((r) => r.skipped?.length > 0) &&
                ` — some files were skipped (in use)`}
            </div>
          </div>
        )}

        {/* Tree on the left, live scan output on the right -- so what the
            scan is doing is visible while it does it, instead of a
            spinner that says nothing for nineteen seconds. */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-5 min-h-0">
          <div className="overflow-y-auto min-h-0 pr-1">
            {/* The action lives IN the empty state, not only in the
                footer. Reported as "Deep Clean doesn't work" from exactly
                this screen: the panel says click a button that is a
                corner of the window away, so the screen reads as broken
                rather than as waiting. The scan does take about half a
                minute, which is worth saying up front -- an unexplained
                wait that long is indistinguishable from a hang. */}
            {!categories && !scanError && (
              <div className="glass-panel p-10 text-center">
                <p className="text-[13.5px] text-[color:var(--text-secondary)]">Nothing scanned yet.</p>
                <p className="text-[12.5px] text-[color:var(--text-muted)] mt-1.5 max-w-[380px] mx-auto">
                  Prune measures every category on disk for real rather than estimating,
                  which takes about half a minute.
                </p>
                <button
                  className="btn-primary px-5 py-2 text-[12.5px] font-medium mt-5 disabled:opacity-50"
                  onClick={() => runPreview()}
                  disabled={scanning}
                >
                  {scanning ? 'Scanning…' : 'Preview'}
                </button>
              </div>
            )}

            {categories && hiddenCount > 0 && (
              // Without this the setting is invisible from the screen it
              // affects: someone who turned it on and forgot cannot tell
              // "Prune has no cleaner for this" from "Prune is hiding it".
              <p className="text-[12px] text-[color:var(--text-muted)] mb-2.5">
                {hiddenCount} cleaner{hiddenCount === 1 ? '' : 's'} hidden because the software isn't
                installed. Settings › Cleanup to show them.
              </p>
            )}

            {shownCategories && (
              <DeepCleanTree
                categories={shownCategories}
                selected={selected}
                onToggle={handleToggle}
                onToggleCategory={handleToggleCategory}
              />
            )}
          </div>

          <ScanLog lines={logLines} scanning={scanning} scanned={scanned} total={total} />
        </div>
      </div>

      <div
        className="shrink-0 glass-panel flex items-center justify-between gap-4 px-12 py-4"
        style={{ borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderBottom: 'none' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-[13px] text-[color:var(--text-secondary)]">
            {/* "0 B" would be a claim here, not a result: with the tree
                listed but unmeasured, nothing has been asked of the disk
                yet. Same rule as the version column -- say what is not
                known rather than print a confident zero. */}
            Total space to free:{' '}
            <span className="text-[color:var(--text-primary)] font-medium font-mono">
              {cleanTotal.anyMeasured ? formatBytes(cleanTotal.bytes) : 'not measured yet'}
            </span>
            {cleanTotal.anyMeasured && cleanTotal.unmeasured > 0 && (
              <span className="text-[color:var(--text-muted)]"> · {cleanTotal.unmeasured} not measured</span>
            )}
          </div>
          {categories && (
            // One click to take everything or nothing. Reaching the
            // non-recommended rules used to mean finding the small
            // "Select All" link inside each of the four category headers.
            <div className="flex items-center gap-2 text-[11.5px] shrink-0">
              <span className="text-[color:var(--text-muted)]">·</span>
              <button
                className="text-[color:var(--text-secondary)] hover:text-[color:var(--accent-coral)] transition-colors"
                onClick={() => setSelected(selectableIds(categories))}
              >
                Select everything
              </button>
              <span className="text-[color:var(--border-subtle)]">·</span>
              <button
                className="text-[color:var(--text-secondary)] hover:text-[color:var(--accent-coral)] transition-colors disabled:opacity-40"
                onClick={() => setSelected(new Set())}
                disabled={selected.size === 0}
              >
                Clear
              </button>
              <span className="text-[color:var(--text-muted)] font-mono">{selected.size} selected</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          {confirmClean ? (
            <>
              <span className="text-[12.5px] text-[color:var(--danger)] mr-1">Move {selected.size} item{selected.size === 1 ? '' : 's'} to Quarantine?</span>
              <button className="btn-ghost px-4 py-2 rounded-lg text-[12.5px] font-medium" onClick={() => setConfirmClean(false)} disabled={cleaning}>
                Cancel
              </button>
              <button className="btn-primary px-5 py-2 text-[12.5px] font-medium disabled:opacity-50" onClick={handleClean} disabled={cleaning}>
                {cleaning ? 'Cleaning…' : 'Confirm'}
              </button>
            </>
          ) : (
            <>
              {/* Stop replaces Preview mid-scan rather than sitting beside
                  it greyed out: during those nineteen seconds it's the only
                  thing the button can usefully do. */}
              {scanning ? (
                <button
                  className="btn-ghost px-4 py-2 rounded-lg text-[12.5px] font-medium flex items-center gap-2"
                  onClick={stopPreview}
                >
                  <span className="w-2 h-2 rounded-[2px] bg-[color:var(--danger)]" />
                  Stop
                </button>
              ) : (
                <button
                  className="btn-ghost px-4 py-2 rounded-lg text-[12.5px] font-medium"
                  onClick={() => runPreview()}
                >
                  {hasScanned ? 'Rescan' : 'Preview'}
                </button>
              )}
              <button
                className="btn-primary px-5 py-2 text-[12.5px] font-medium disabled:opacity-50"
                onClick={() => setConfirmClean(true)}
                disabled={!categories || selected.size === 0}
              >
                Clean
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
