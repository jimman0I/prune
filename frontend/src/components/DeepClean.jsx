import { useEffect, useMemo, useRef, useState, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { visibleCategories, hiddenRuleCount } from '../lib/visibleRules.js';
import { executeDeepClean, fetchCleanerCategoryIcons } from '../lib/api.js';
import { keys } from '../lib/queryClient.js';
import { useDeepCleanScan } from '../hooks/useDeepCleanScan.js';
import { useSettings } from '../hooks/useSystemQueries.js';
import { lockedFileSummary } from '../lib/lockedFiles.js';
import { useToasts } from '../hooks/useToasts.jsx';
import { defaultSelection } from '../lib/defaultSelection.js';
import { selectionTotal } from '../lib/selectionTotal.js';
import { needsWarning, rememberedWith } from '../lib/cleanWarning.js';
import { categoryTickPlan } from '../lib/categoryTickPlan.js';
import DeepCleanTree from './DeepCleanTree.jsx';
import CleanWarningDialog from './CleanWarningDialog.jsx';

const LOG_TONE = {
  size: 'text-[color:var(--accent-primary)]',
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

      {/* Announced, not just drawn. The scan takes about nineteen seconds
          and its only progress signals were a "12 / 74" counter and a
          2px bar -- both invisible to a screen reader, so the wait was
          indistinguishable from the app having stopped.
          
          `polite` rather than `assertive`: this should be read at a
          natural pause, not interrupt whatever is being spoken. Only the
          start and the end are announced rather than every rule, because
          seventy-four interruptions is not progress, it is noise. */}
      <div className="sr-only" role="status" aria-live="polite">
        {scanning
          ? `Scanning ${total} locations.`
          : scanned > 0 ? `Scan finished. ${scanned} of ${total} locations measured.` : ''}
      </div>

      {total > 0 && (
        <div className="h-[2px] bg-white/[0.06] shrink-0">
          <div
            className="h-full bg-[color:var(--accent-primary)] transition-[width] duration-200"
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

function DeepClean() {
  // No auto-scan on mount, per spec -- the tree stays empty until the
  // user explicitly clicks Preview.
  const [selected, setSelected] = useState(new Set());

  /* The application icon for each heading. Its own query, never blocking
   * the list: the headings render with lettered tiles and swap to real
   * icons if and when these arrive. Usually they have already arrived --
   * useIdlePrefetch warms this key while the app is idle, so opening the
   * tab finds it cached rather than pending. */
  const categoryIcons = useQuery({
    queryKey: keys.deepCleanCategoryIcons,
    queryFn: fetchCleanerCategoryIcons,
    retry: 1
  });
  const [confirmClean, setConfirmClean] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanResult, setCleanResult] = useState(null);
  const [cleanError, setCleanError] = useState(null);
  // The rule a warning dialog is currently open for, or null.
  /* A QUEUE, not one rule. Ticking a whole application can owe the user
   * several questions -- Brave alone has five rules that lose data -- and
   * they are asked one after another rather than collapsed into one
   * dialog or, as before, skipped entirely. warnAbout is the head of it. */
  const [warnQueue, setWarnQueue] = useState([]);
  const warnAbout = warnQueue[0] ?? null;
  const toasts = useToasts();

  // The tree, the scan and its cancellation all live in the hook now --
  // see hooks/useDeepCleanScan.js. What useQuery buys here is the thing
  // the stream needed most: an AbortSignal with a real lifecycle, so Stop
  // still closes the connection and the backend still stops walking.
  const {
    tree: categories, scanning, hasScanned, log: logLines,
    scanned, total, error: scanError, start, stop: stopPreview, cleanableIds: scannedIds
  } = useDeepCleanScan();

  // BleachBit's "hide irrelevant cleaners". Most of a 74-rule list is for
  // software this machine does not have.
  const { settings, save: saveSettings } = useSettings();
  const hideUnavailable = settings?.hideUnavailableRules === true;

  const shownCategories = useMemo(
    () => (categories ? visibleCategories(categories, hideUnavailable) : null),
    [categories, hideUnavailable]
  );
  const hiddenCount = useMemo(
    () => hiddenRuleCount(categories, hideUnavailable),
    [categories, hideUnavailable]
  );

  // The listed tree arrives before anything is measured, so the default
  // ticks land as soon as there is something to tick.
  useEffect(() => {
    if (!categories) return;
    setSelected((prev) => (prev.size > 0 ? prev : defaultSelection(categories)));
  }, [categories]);

  /** `reselect: false` is for the rescan that follows a clean -- the user
   * just acted on those rules, and re-ticking them would invite doing it
   * twice. */
  const runPreview = async ({ reselect = true } = {}) => {
    setCleanResult(null);
    await start();
  };

  // Once a scan has measured everything, drop any tick the scan proved
  // there is no point cleaning. Before a scan the tree is listed but
  // unmeasured, so the defaults have to tick rules that may turn out to be
  // uninstalled or unreadable -- keeping those selected afterwards would
  // put rules in the batch that free nothing.
  //
  // Without this, a scan that found 54 GB across 40 rules left the footer
  // reading "Total space to free: 0 B" with Clean disabled: a nineteen
  // second wait ending in a dead end, which is how this got reported as
  // the feature not working at all.
  useEffect(() => {
    if (!hasScanned || scanning) return;
    const validIds = scannedIds();
    if (validIds.size === 0) return;
    setSelected((prev) => {
      const kept = new Set([...prev].filter((id) => validIds.has(id)));
      return kept.size > 0 ? kept : defaultSelection(categories ?? []);
    });
    // scannedIds and categories are both listed now that the hook returns
    // a stable reader. They were omitted before, which happened to be
    // correct only because of when this effect fires -- the kind of
    // omission that stays right until someone changes the timing.
  }, [hasScanned, scanning, scannedIds, categories]);

  /** One rule by id, from the unfiltered set.
   *
   * `categories` rather than the visible subset: a rule hidden by the
   * "hide cleaners that don't apply" filter cannot be clicked, but
   * looking it up in the filtered list would silently return undefined
   * and skip its warning if it ever could be. */
  const findRule = (ruleId) =>
    (categories ?? []).flatMap((group) => group.items ?? []).find((item) => item.id === ruleId);

  /** Ticks a rule, asking first if ticking it loses something.
   *
   * The question is only ever in front of turning a risky rule ON.
   * Unticking cannot lose anything, and a dialog in front of the safe
   * direction is how people learn to click through the one in front of
   * the unsafe direction. See lib/cleanWarning.js. */
  const handleToggle = (ruleId) => {
    const item = findRule(ruleId);
    const checking = !selected.has(ruleId);
    if (needsWarning(item, { checking, acknowledged: settings?.acknowledgedCleanWarnings })) {
      setWarnQueue([item]);
      return;
    }
    applyToggle(ruleId);
  };

  const applyToggle = (ruleId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ruleId)) next.delete(ruleId); else next.add(ruleId);
      return next;
    });
  };

  /** The user said yes. Tick it, and stop asking about this one rule if
   * they said so -- one rule, not the category: agreeing to lose cookies
   * is not agreeing to lose browsing history. */
  const confirmWarning = (remember) => {
    const rule = warnAbout;
    // Pop the head either way -- the next question, if there is one, is
    // now in front of the user.
    setWarnQueue((queue) => queue.slice(1));
    if (!rule) return;
    // add, not toggle: reached from a bulk tick, the rule is known to be
    // unselected, and toggling would be a coin flip if that ever changed.
    setSelected((prev) => new Set(prev).add(rule.id));
    const updated = rememberedWith(settings?.acknowledgedCleanWarnings, rule.id, remember);
    if (updated) saveSettings.mutate({ acknowledgedCleanWarnings: updated });
  };

  /** Declining one question moves to the next rather than abandoning the
   * rest of the queue. Saying no to losing cookies is not saying no to
   * being asked about history. */
  const dismissWarning = () => setWarnQueue((queue) => queue.slice(1));

  /** Ticks or clears a whole application.
   *
   * Ticking selects EVERY rule under it and asks about each risky one in
   * turn. It used to skip the risky ones outright, on the reasoning that
   * a bulk click is the opposite of the deliberate choice the warning
   * exists to capture -- but the concern there was dialogs being clicked
   * through unread, not dialogs being absent, and skipping meant the box
   * could never fill and the click looked like it had failed. Queuing
   * keeps the questions and fixes the surprise.
   *
   * Read from the VISIBLE groups rather than the full set. With "hide
   * cleaners that don't apply" on, the unfiltered group holds rules that
   * are not on screen, and ticking a heading would silently select rules
   * the user cannot see. */
  const handleToggleCategory = (category, checked) => {
    const group = (shownCategories ?? []).find((g) => g.category === category);
    if (!group) return;

    if (!checked) {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const item of group.items) next.delete(item.id);
        return next;
      });
      // Anything still queued was asked on behalf of this category and is
      // now moot -- leaving it up would ask about rules that have just
      // been cleared.
      setWarnQueue([]);
      return;
    }

    const plan = categoryTickPlan(group.items, selected, settings?.acknowledgedCleanWarnings);
    if (plan.selectNow.length > 0) {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of plan.selectNow) next.add(id);
        return next;
      });
    }
    if (plan.askAbout.length > 0) setWarnQueue(plan.askAbout);
  };

  const handleClean = async () => {
    setCleaning(true);
    setCleanError(null);
    try {
      const result = await executeDeepClean([...selected]);
      setCleanResult(result);

      // Say what happened, and say it in numbers. The freed figure used
      // to be the whole story and the failures were a passive clause
      // appended to it -- "some files were skipped (in use)" -- with no
      // count, no paths, and nothing to act on.
      toasts.success(`Cleanup complete. Freed ${formatBytes(result.freedBytes)}.`);
      const locked = lockedFileSummary(result);
      if (locked) {
        // A warning, and one that does not expire: the whole point is
        // that these files are still there, and a notice that vanishes
        // after five seconds is how nobody finds out.
        toasts.warn(locked.message, { detail: locked.detail, paths: locked.paths, ttl: 0 });
      }

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
        <h1 className="display-heading text-[30px] leading-none mb-2">Deep Clean</h1>
        <p className="text-[13px] text-[color:var(--text-secondary)] mb-6 max-w-[62ch]">
          Every cache, log, dump and leftover Prune knows how to find, measured on this
          machine rather than estimated. Nothing is deleted outright — everything Clean
          takes goes to Quarantine first, where you can put it back.
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
              {lockedFileSummary(cleanResult) &&
                ` — ${lockedFileSummary(cleanResult).message.toLowerCase().replace(/\.$/, '')}`}
            </div>
          </div>
        )}

        {/* Tree on the left, live scan output on the right -- so what the
            scan is doing is visible while it does it, instead of a
            spinner that says nothing for nineteen seconds. */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-5 min-h-0">
          {/* Column, not a scroller. The tree does its own scrolling now,
              which is what lets its category headings stick: a sticky
              element positions against its nearest SCROLLING ancestor, and
              an `overflow-hidden` wrapper in between silently becomes that
              ancestor without ever scrolling -- so the heading had nowhere
              to move and simply scrolled away. Verified by walking the
              ancestor chain in the running app rather than by reading it
              off the markup. */}
          <div className="flex flex-col min-h-0 pr-1">
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
                icons={categoryIcons.data ?? {}}
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
                className="text-[color:var(--text-secondary)] hover:text-[color:var(--accent-primary)] transition-colors"
                // Same rule as a category's own Select All: never sweeps
                // in a rule that loses something the user has not already
                // said to stop asking about.
                onClick={() => setSelected(selectableIds(categories, settings?.acknowledgedCleanWarnings))}
              >
                Select everything
              </button>
              <span className="text-[color:var(--border-subtle)]">·</span>
              <button
                className="text-[color:var(--text-secondary)] hover:text-[color:var(--accent-primary)] transition-colors disabled:opacity-40"
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
              {/* The confirm carries the SIZE, not just the count. "Move
                  47 items to Quarantine?" is not a decision anyone can
                  make -- 47 items is a browser cache or most of a game
                  install. And when nothing has been measured it says so
                  rather than omitting the number and letting the reader
                  assume it is small. */}
              <span className="text-[12.5px] text-[color:var(--danger)] mr-1">
                Move {selected.size} item{selected.size === 1 ? '' : 's'}
                {cleanTotal.anyMeasured
                  ? <> (<span className="font-mono">{formatBytes(cleanTotal.bytes)}</span>)</>
                  : <> (<span className="font-mono">size not measured</span>)</>}
                {' '}to Quarantine?
              </span>
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

      {warnAbout && (
        <CleanWarningDialog
          item={warnAbout}
          onCancel={dismissWarning}
          onConfirm={confirmWarning}
        />
      )}
    </div>
  );
}

/** Memoised because App owns the active-screen state.
 *
 * Screens stay mounted once visited (see Screen.jsx), so every setScreen
 * re-renders App and React then reconciles every screen that has ever
 * been opened -- hidden ones skip layout and paint, not render. Measured
 * before this was added: a hidden Disk Map rendered twice across two tab
 * switches, once per switch, and that cost grows with every tab the user
 * has visited.
 *
 * Safe here specifically because this component takes no props at all, so
 * the comparison is between two empty objects and can never produce a
 * stale screen. A component with unstable props would gain nothing from
 * this and is deliberately left alone. */
export default memo(DeepClean);
