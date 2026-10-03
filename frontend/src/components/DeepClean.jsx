import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { visibleCategories, hiddenRuleCount } from '../lib/visibleRules.js';
import { fetchCleanerCategoryIcons, executeDeepCleanElevated } from '../lib/api.js';
import { keys } from '../lib/queryClient.js';
import { useDeepCleanScan } from '../hooks/useDeepCleanScan.js';
import { useDeepCleanExecute } from '../hooks/useDeepCleanExecute.js';
import { useSettings } from '../hooks/useSystemQueries.js';
import { useAdminAccess } from '../hooks/useAdminAccess.js';
import { lockedFileSummary } from '../lib/lockedFiles.js';
import { logRuleName } from '../lib/scanLog.js';
import { useToasts } from '../hooks/useToasts.jsx';
import { defaultSelection, dropConfirmEveryTime, restoreSelection, selectableIds } from '../lib/defaultSelection.js';
import { selectionTotal } from '../lib/selectionTotal.js';
import { needsWarning, rememberedWith } from '../lib/cleanWarning.js';
import { categoryTickPlan } from '../lib/categoryTickPlan.js';
import { removalModeFrom, cleanOutcome } from '../lib/cleanOutcome.js';
import DeepCleanTree from './DeepCleanTree.jsx';
import CleanWarningDialog from './CleanWarningDialog.jsx';
import WipeFreeSpaceDialog from './WipeFreeSpaceDialog.jsx';
import ShredDialog from './ShredDialog.jsx';
import { biggestSelected, fileName } from '../lib/biggestFiles.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { useCleanerText } from '../i18n/cleanerText.js';

const LOG_TONE = {
  size: 'text-[color:var(--text-primary)]',
  warning: 'text-[color:var(--warning)]',
  muted: 'text-[color:var(--text-muted)]'
};

/** The live scan log. Each rule appears the moment its real size comes
 * back, which is what turns a nineteen-second wait from "is this stuck?"
 * into something you can watch. Auto-scrolls, but only while pinned to
 * the bottom -- yanking the view back down while someone is reading
 * further up is worse than not scrolling at all. */
function ScanLog({ lines, scanning, scanned, total, progress }) {
  const { t } = useLanguage();
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
    // A fixed short height while stacked (below lg), where it used to have
    // none of its own: the tree above took every pixel and the log
    // collapsed to nothing at 900 px wide. Side by side it fills the column
    // as before.
    <div className="glass-panel flex flex-col min-h-0 overflow-hidden flex-none h-44 lg:h-auto lg:flex-1 min-w-0">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[color:var(--border-subtle)] shrink-0">
        <div className="flex items-center gap-2">
          {/* The rest of this panel already carries the scan's progress --
              a "12 / 74" counter and a determinate bar -- but neither one
              moves on its own between updates, so a scan that pauses
              between two rules looks identical to one that has stopped.
              Disk Map's own loading state solves the same problem with a
              spinner; this is the same glyph at header scale, next to the
              label it is explaining rather than replacing the counter. */}
          {scanning && (
            <span
              aria-hidden="true"
              className="w-3 h-3 border-2 border-[color:var(--accent-primary)] border-t-transparent rounded-full animate-spin shrink-0"
            />
          )}
          <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-[color:var(--text-muted)]">
            {t('deepClean.scanLog.header')}
          </span>
        </div>
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
          ? t('deepClean.scanLog.scanningAnnounce', total)
          : scanned > 0 ? t('deepClean.scanLog.finishedAnnounce', scanned, total) : ''}
      </div>

      {total > 0 && (
        <div className="h-[2px] bg-[color:var(--surface-hover)] shrink-0">
          <div
            className="h-full bg-[color:var(--accent-primary)] transition-[width] duration-200"
            style={{ width: `${Math.round((scanned / total) * 100)}%` }}
          />
        </div>
      )}

      {/* A profile-wide search can run for minutes between two rules, so it
          says what it is doing: honest and live, and Stop still works. */}
      {scanning && progress && (
        <p data-testid="deep-clean-progress" className="px-4 pt-3 text-[12px] font-mono text-[color:var(--text-secondary)] shrink-0">
          {progress.wipe
            ? (progress.passes > 1
              ? t('deepCleanV3.wipe.progressPass', progress.pass, progress.passes, formatBytes(progress.bytesWritten), formatBytes(progress.totalBytes))
              : t('deepClean.scanLog.wiping', formatBytes(progress.bytesWritten), formatBytes(progress.totalBytes)))
            : t('deepClean.scanLog.searching', progress.entries.toLocaleString())}
        </p>
      )}

      <div ref={boxRef} onScroll={onScroll} className="flex-1 overflow-y-auto min-h-0 px-4 py-3 space-y-1">
        {lines.length === 0 && (
          <p className="text-[12px] text-[color:var(--text-muted)] font-mono">
            {scanning ? t('deepClean.scanLog.starting') : t('deepClean.scanLog.idle')}
          </p>
        )}
        {lines.map((line, i) => (
          <div key={i} className="log-line-in flex items-baseline gap-2 text-[11.5px] font-mono leading-relaxed">
            <span className="text-[color:var(--text-secondary)] truncate">{line.label}</span>
            <span className="flex-1 border-b border-dashed border-[color:var(--border-subtle)] translate-y-[-3px]" />
            <span className={`${LOG_TONE[line.tone]} shrink-0`}>{line.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const CONFIRM_PROMPT = {
  quarantine: 'deepClean.confirm.prompt',
  recycle: 'deepClean.confirm.promptRecycle',
  delete: 'deepClean.confirm.promptDelete'
};
const CONFIRM_BUTTON = {
  quarantine: 'deepClean.confirm.confirmButton',
  recycle: 'deepClean.confirm.recycleButton',
  delete: 'deepClean.confirm.deleteButton'
};
const MODE_TEXT = {
  quarantine: 'deepClean.footer.modeQuarantine',
  recycle: 'deepClean.footer.modeRecycle',
  delete: 'deepClean.footer.modeDelete'
};

/** Whether any file was skipped because scheduling its deletion at restart
 * needed administrator rights (see lib/cleanerActions/delete.js). */
function schedulingNeedsAdmin(result) {
  return (result?.results ?? []).some((r) => (r?.skipped ?? []).some((s) => /needs administrator/.test(s?.reason ?? '')));
}

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function DeepClean({ onNavigate }) {
  const { t } = useLanguage();
  const cleaner = useCleanerText();
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
  const [shredOpen, setShredOpen] = useState(false);
  const [cleanResult, setCleanResult] = useState(null);
  const [cleanError, setCleanError] = useState(null);
  const [elevating, setElevating] = useState(false);
  const [elevatedResult, setElevatedResult] = useState(null);
  // True only once the status was read and said so (see useAdminAccess).
  const { elevated } = useAdminAccess();
  // A frozen copy of `selected`, taken the instant Clean actually starts.
  // receiptMode filters the tree against THIS, not the live `selected` --
  // nothing currently stops a checkbox click or "Clear" from mutating
  // `selected` while a clean is in flight, and the backend keeps working
  // through the batch it was actually handed regardless. Filtering the
  // receipt against a live set that can shrink mid-clean would make the
  // row `activeId` is highlighting vanish from its own receipt.
  const [cleaningSelection, setCleaningSelection] = useState(null);
  // The rule a warning dialog is currently open for, or null.
  /* A QUEUE, not one rule. Ticking a whole application can owe the user
   * several questions -- Brave alone has five rules that lose data -- and
   * they are asked one after another rather than collapsed into one
   * dialog or, as before, skipped entirely. warnAbout is the head of it. */
  const [warnQueue, setWarnQueue] = useState([]);
  const warnAbout = warnQueue[0] ?? null;
  const toasts = useToasts();

  // How a rule is named in the two live logs: with its category in front, so
  // the three rules called "Cache" are told apart. A clean's results carry
  // no category, so it is looked up from the tree by id; the hooks call this
  // from inside the stream, hence a ref that is current rather than a value.
  const categoryByRuleRef = useRef(new Map());
  const logName = useCallback((item) => logRuleName(item, {
    ruleName: cleaner.ruleName,
    categoryName: cleaner.categoryName,
    categoryOf: (id) => categoryByRuleRef.current.get(id)
  }), [cleaner.ruleName, cleaner.categoryName]);

  // The tree, the scan and its cancellation all live in the hook now --
  // see hooks/useDeepCleanScan.js. What useQuery buys here is the thing
  // the stream needed most: an AbortSignal with a real lifecycle, so Stop
  // still closes the connection and the backend still stops walking.
  const {
    tree: categories, scanning, hasScanned, log: logLines,
    scanned, total, error: scanError, currentId: scanningId,
    progress: scanProgress,
    start, stop: stopPreview, cleanableIds: scannedIds
  } = useDeepCleanScan(logName, t('deepClean.log'));

  // The clean itself, streamed the same way -- see hooks/useDeepCleanExecute.js.
  // `run` throws on a real failure (same contract the old one-shot
  // executeDeepClean had, so handleClean's own try/catch below needs no
  // change) and resolves quietly on Stop.
  const {
    run: runClean, stop: stopClean, cleaning,
    log: cleanLog, executed: cleanExecuted, total: cleanTotalCount, currentId: cleaningId,
    progress: cleanProgress
  } = useDeepCleanExecute(logName, t('deepClean.log'));

  categoryByRuleRef.current = new Map(
    (categories ?? []).flatMap((group) => group.items.map((item) => [item.id, group.category]))
  );

  // BleachBit's "hide irrelevant cleaners". Most of a 74-rule list is for
  // software this machine does not have.
  const { settings, save: saveSettings } = useSettings();
  const hideUnavailable = settings?.hideUnavailableRules === true;
  // What Clean will do to the files, read from settings only to say so
  // beforehand -- the backend decides for itself and takes no flag from here.
  const removalMode = removalModeFrom(settings);

  const shownCategories = useMemo(
    () => (categories ? visibleCategories(categories, hideUnavailable) : null),
    [categories, hideUnavailable]
  );
  const hiddenCount = useMemo(
    () => hiddenRuleCount(categories, hideUnavailable),
    [categories, hideUnavailable]
  );

  // The listed tree arrives before anything is measured, so the default
  // ticks land as soon as there is something to tick -- unless a real
  // selection was already saved from a previous session, in which case
  // that's what reopens instead of the defaults.
  //
  // Runs exactly once (`seededSelectionRef`), and only once BOTH the tree
  // AND settings have actually loaded. Depending on `settings.
  // deepCleanSelection` directly (rather than gating on `settings` itself)
  // would re-fire this on every settings update -- including the persist
  // effect's own writes just below, which hand back a brand new (if
  // logically identical) array/object each time -- recomputing another
  // reference-distinct empty Set on every pass and feeding the persist
  // effect a stream of redundant writes that raced the initial settings
  // fetch's own cancelQueries() in practice, which was cancelling that
  // fetch before it ever resolved.
  const seededSelectionRef = useRef(false);
  useEffect(() => {
    if (!categories || !settings || seededSelectionRef.current) return;
    seededSelectionRef.current = true;
    setSelected((prev) => {
      if (prev.size > 0) return prev;
      const saved = settings.deepCleanSelection;
      // Minus the free-space wipe, which is never restored ticked: see
      // dropConfirmEveryTime.
      if (Array.isArray(saved) && saved.length > 0) return new Set(dropConfirmEveryTime(saved, categories));
      return defaultSelection(categories);
    });
  }, [categories, settings]);

  // Persists every change to `selected` -- every tick, untick, category
  // toggle, Select Everything/Clear, and the post-scan reconciliation
  // effect's own pruning all funnel through setSelected, so one effect
  // watching the result covers all of them at once rather than a save()
  // call threaded into each individual call site. Gated on `categories`
  // purely so a stray render before anything has loaded can't fire it;
  // the real protection against writing back a premature empty Set is the
  // seeding effect above never changing `selected` at all until it has
  // settled on a real value (saved, or computed defaults).
  useEffect(() => {
    if (!categories) return;
    saveSettings.mutate({ deepCleanSelection: [...dropConfirmEveryTime(selected, categories)] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  /** `reselect: false` is for the rescan that follows a clean -- the user
   * just acted on those rules, and re-ticking them would invite doing it
   * twice. It also gates clearing `cleanResult`: handleClean calls
   * `setCleanResult(result)` and then this, with no `await` between them,
   * so an unconditional `setCleanResult(null)` here ran in the SAME
   * synchronous stack frame and React 18's automatic batching collapsed
   * both into one commit -- the "Freed X" banner was overwritten by its
   * own clear before it ever painted. A manual Preview/Rescan click
   * (`reselect: true`, the default) still clears the stale PREVIOUS
   * result immediately, which is correct there; only the post-clean
   * rescan needs to leave the banner up until the next explicit preview. */
  const runPreview = async ({ reselect = true } = {}) => {
    if (reselect) setCleanResult(null);
    await start();
  };

  // Scans itself, once, the first time the screen has something to scan
  // -- the same scan a manual Preview click starts, just not waiting for
  // that click. Opening Deep Clean used to mean a dead screen until you
  // pressed Preview and sat through it; now that wait happens while
  // you're still reading the screen rather than after you've decided to
  // act on it. Clean itself is untouched -- it still needs a real
  // measured total before it's enabled (see canClean below) and a
  // confirm with that number before anything moves, because scanning
  // automatically is "show me sooner", not "skip deciding".
  const autoScanRef = useRef(false);
  useEffect(() => {
    if (autoScanRef.current || !categories || !settings || hasScanned || scanning) return;
    autoScanRef.current = true;
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, settings, hasScanned, scanning]);

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
  const handleToggleCategory = (category, checked, visibleIds) => {
    const shown = (shownCategories ?? []).find((g) => g.category === category);
    if (!shown) return;
    // While the tree's filter is active it passes the ids it is showing:
    // the heading acts on those and nothing else.
    const group = visibleIds
      ? { ...shown, items: shown.items.filter((item) => visibleIds.includes(item.id)) }
      : shown;

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

  /** What a finished clean says: deleted bytes as "Freed", moved bytes as
   * "Moved to ...". Never "Freed" for files that only changed folders. */
  const resultSentences = (result) => {
    const { freedBytes, movedBytes, movedTo } = cleanOutcome(result);
    const sentences = [];
    const wipe = (result?.results ?? []).map((r) => r?.wiped).find(Boolean);
    // A wipe frees nothing, so "Freed 0 B" beside it would only mislead.
    if (freedBytes > 0 || (movedBytes === 0 && !wipe)) sentences.push(t('deepClean.resultFreed', formatBytes(freedBytes)));
    if (wipe) {
      // Three passes write random data, and the sentence must say so: the
      // zeros wording would be untrue.
      const key = wipe.pattern === 'random'
        ? (wipe.aborted ? 'deepCleanV3.wipe.resultRandomStopped' : 'deepCleanV3.wipe.resultRandom')
        : (wipe.aborted ? 'deepClean.resultWipeStopped' : 'deepClean.resultWiped');
      sentences.push(t(key, formatBytes(wipe.bytesWritten), wipe.passes));
    }
    if (movedBytes > 0) {
      sentences.push(movedTo === 'recycle'
        ? t('deepClean.resultRecycled', formatBytes(movedBytes))
        : t('deepClean.resultMoved', formatBytes(movedBytes)));
    }
    // Locked files handed to Windows to delete at the next restart: still on
    // the disk, so neither freed nor skipped.
    const scheduled = (result?.results ?? []).reduce((n, r) => n + (Number(r?.scheduledForRestart) || 0), 0);
    if (scheduled > 0) sentences.push(t('deepCleanV3.locked.scheduled', scheduled));
    return sentences;
  };
  // Freed and moved read as separate sentences; "Freed 5 KB. Moved 3 MB to ..."
  const resultSentence = (result) => resultSentences(result).map((x) => (/[.!?]$/.test(x) ? x : `${x}.`)).join(' ');
  // The banner leaves a lone "Freed 5 KB" as it always read, and only adds
  // full stops once there are two sentences to tell apart.
  const bannerText = (result) => {
    const sentences = resultSentences(result);
    return sentences.length === 1 ? sentences[0] : resultSentence(result);
  };

  const handleClean = async () => {
    setCleanError(null);
    try {
      // Freeze what's actually being handed to the backend before it can
      // change out from under the receipt -- see cleaningSelection's own
      // comment above.
      setCleaningSelection(new Set(selected));

      // Streamed -- see hooks/useDeepCleanExecute.js. `result` keeps the
      // same {freedBytes, results} shape the old one-shot POST returned,
      // so everything below reads it exactly as it always has.
      const result = await runClean([...selected]);
      setCleanResult(result);

      // Stop is a user action, not a completion: whatever was cleaned
      // before the click already happened (and is reflected below, same
      // as a finished run), but the selection that was still queued is
      // real work the user asked for and hasn't gotten yet -- clearing it
      // here would silently discard that intent, and the next launch
      // would seed back to the defaults instead of what they'd actually
      // picked (the selection persists on every change, including this
      // one -- see the effect below).
      if (result.aborted) {
        toasts.warn(`${t('deepClean.cleanupStopped')} ${resultSentence(result)}`);
        return;
      }

      // Say what happened, and say it in numbers. The freed figure used
      // to be the whole story and the failures were a passive clause
      // appended to it -- "some files were skipped (in use)" -- with no
      // count, no paths, and nothing to act on.
      toasts.success(`${t('deepClean.cleanupComplete')} ${resultSentence(result)}`);
      const locked = lockedFileSummary(result, t('deepClean.locked'));
      if (locked) {
        // A warning, and one that does not expire: the whole point is
        // that these files are still there, and a notice that vanishes
        // after five seconds is how nobody finds out.
        toasts.warn(locked.message, { detail: locked.detail, paths: locked.paths, ttl: 0 });
      }

      setSelected(new Set());
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
      setConfirmClean(false);
      setCleaningSelection(null);
    }
  };

  // What a scan already proved Windows won't even LIST without
  // administrator (accessible: false -- Prefetch, the Defender log
  // folders), as opposed to a file another process has open, which
  // elevation does not fix either way. Only these rules are ever offered
  // the elevated button below; it is not a general "run everything as
  // admin" switch. When Prune is ALREADY elevated the same rules are not
  // fixable by elevating again: Windows refuses even an administrator
  // (SYSTEM / TrustedInstaller folders, Defender's tamper protection), so
  // they are reported as protected and no button is offered.
  const needsAdminIds = useMemo(
    () => (categories ?? []).flatMap((g) => g.items).filter((i) => i.accessible === false).map((i) => i.id),
    [categories]
  );

  const handleElevatedClean = async () => {
    setElevatedResult(null);
    setElevating(true);
    try {
      const result = await executeDeepCleanElevated(needsAdminIds);
      setElevatedResult(result);
      if (result.ok) {
        toasts.success(`${t('deepClean.cleanupComplete')} ${resultSentence(result.data)}`);
        // Same reasoning as the ordinary clean's own re-scan: the numbers
        // on screen should reflect what is actually left on disk, not a
        // stale pre-clean snapshot, and the rules just cleaned no longer
        // need the elevated button once they are gone.
        await runPreview({ reselect: false });
      } else if (!result.cancelled) {
        toasts.warn(result.error || t('deepClean.cleanErrorPrefix', ''));
      }
    } catch (err) {
      setElevatedResult({ ok: false, error: err.message });
      toasts.warn(err.message);
    } finally {
      setElevating(false);
    }
  };

  const cleanTotal = selectionTotal(categories, selected);
  const biggest = useMemo(
    () => (removalMode === 'delete' && confirmClean ? biggestSelected(categories, selected, 3) : []),
    [removalMode, confirmClean, categories, selected]
  );
  // Nothing can be cleaned blind: a completed Preview that measured at least
  // one ticked item is the precondition, and a running scan or clean is not.
  // The free-space wipe frees nothing and so is never "measured"; ticking it
  // is what makes a Clean worth allowing when it is all that is selected.
  const wipeSelected = (categories ?? []).some((g) => g.items.some((i) => i.confirmEveryTime && selected.has(i.id)));
  const canClean = Boolean(categories) && hasScanned && !scanning && !cleaning
    && selected.size > 0 && (cleanTotal.anyMeasured || wipeSelected);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto px-12 pt-10 pb-6 max-w-[1600px] w-full">
        <div className="flex items-start justify-between gap-4 mb-2">
          <h1 className="display-heading text-[30px] leading-none">{t('deepClean.title')}</h1>
          {/* A tool, not a rule: it acts on what the person picks, so it
              lives beside the title rather than in the list of presets
              where a Select everything could reach it. */}
          <button
            type="button"
            className="btn-ghost px-3.5 py-1.5 rounded-lg text-[12.5px] font-medium shrink-0 disabled:opacity-50"
            onClick={() => setShredOpen(true)}
            disabled={cleaning}
          >
            {t('deepCleanV3.shred.open')}
          </button>
        </div>
        <p className="text-[13px] text-[color:var(--text-secondary)] mb-6 max-w-[110ch]">
          {removalMode === 'delete' ? t('deepClean.subtitleDelete') : t('deepClean.subtitle')}
        </p>

        {scanError && (
          <div className="mb-5 px-3.5 py-3 rounded-xl bg-[color:var(--danger-soft)] border border-[color:var(--danger)]/25">
            <p className="text-[12.5px] text-[color:var(--danger)] select-text">{t('deepClean.scanErrorPrefix', scanError)}</p>
          </div>
        )}

        {cleanError && (
          <div className="mb-5 px-3.5 py-3 rounded-xl bg-[color:var(--danger-soft)] border border-[color:var(--danger)]/25">
            <p className="text-[12.5px] text-[color:var(--danger)] select-text">{t('deepClean.cleanErrorPrefix', cleanError)}</p>
          </div>
        )}

        {cleanResult && (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-5 px-3.5 py-3 rounded-xl bg-[color:var(--success)]/10 border border-[color:var(--success)]/25">
            <div className="text-[12.5px] text-[color:var(--success)]" data-testid="deep-clean-result">
              {bannerText(cleanResult)}
              {/* A dedicated catalog phrase rather than reusing
                  lockedFileSummary()'s own `message` lower-cased: that
                  transform is an English-only trick (case has no meaning
                  in Thai, Chinese or Arabic, and works differently in
                  Greek/Cyrillic), so each language writes this clause
                  naturally instead of having a sentence mangled at
                  runtime. */}
              {lockedFileSummary(cleanResult) && t('deepClean.resultLockedSuffix', lockedFileSummary(cleanResult).count)}
              {/* The setting was on but Windows refused the scheduling for
                  want of administrator rights: said here, not left to look
                  like an ordinary skip. */}
              {schedulingNeedsAdmin(cleanResult) && (
                <span className="block mt-1 text-[color:var(--warning)]">{t('deepCleanV3.locked.needsAdmin')}</span>
              )}
            </div>
            {/* The space is not back until Quarantine is emptied, so the
                way there is one click away -- but a way, not the deed:
                emptying is permanent and lives on its own screen. */}
            {cleanOutcome(cleanResult).movedTo === 'quarantine' && onNavigate && (
              <button
                className="btn-ghost px-3.5 py-1.5 rounded-lg text-[12.5px] font-medium shrink-0"
                onClick={() => onNavigate('quarantine')}
              >
                {t('deepClean.openQuarantine')}
              </button>
            )}
          </div>
        )}

        {/* Only for rules a scan already proved need administrator to even
            look inside -- never shown just because a scan is running, and
            gone again once runPreview() (after a successful elevated
            clean) no longer reports any. One UAC prompt, raised only from
            this button, covering only these rules. */}
        {needsAdminIds.length > 0 && !scanning && !cleaning && (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-5 px-3.5 py-3 rounded-xl bg-[color:var(--bg-panel)] border border-[color:var(--border-subtle)]">
            <p className="text-[12.5px] text-[color:var(--text-secondary)]">
              {elevated
                ? t('deepCleanV3.protected.banner', needsAdminIds.length)
                : t('deepClean.needsAdminBanner', needsAdminIds.length)}
            </p>
            {!elevated && (
              <button
                className="btn-ghost px-3.5 py-1.5 rounded-lg text-[12.5px] font-medium shrink-0"
                onClick={handleElevatedClean}
                disabled={elevating}
              >
                {elevating ? t('deepClean.confirm.cleaning') : t('deepClean.cleanAsAdmin')}
              </button>
            )}
          </div>
        )}

        {elevatedResult && !elevatedResult.ok && !elevatedResult.cancelled && (
          <div className="mb-5 px-3.5 py-3 rounded-xl bg-[color:var(--danger-soft)] border border-[color:var(--danger)]/25">
            <p className="text-[12.5px] text-[color:var(--danger)] select-text">
              {t('deepClean.cleanErrorPrefix', elevatedResult.error)}
            </p>
          </div>
        )}

        {/* Tree on the left, live scan output on the right -- so what the
            scan is doing is visible while it does it, instead of a
            spinner that says nothing for nineteen seconds. */}
        <div className="flex-1 flex flex-col lg:flex-row gap-5 min-h-0">
          {/* Column, not a scroller. The tree does its own scrolling now,
              which is what lets its category headings stick: a sticky
              element positions against its nearest SCROLLING ancestor, and
              an `overflow-hidden` wrapper in between silently becomes that
              ancestor without ever scrolling -- so the heading had nowhere
              to move and simply scrolled away. Verified by walking the
              ancestor chain in the running app rather than by reading it
              off the markup.

              A flex row rather than the previous CSS Grid, specifically so
              this column's own `width` can transition smoothly between a
              browsing-wide and a cleaning-narrow state: `grid-template-
              columns` does not reliably animate between mismatched track
              types (`minmax(...)` vs a plain length), but a plain `width`
              on a flex child does. `lg:shrink-0` matters -- without it,
              flexbox lets this explicitly-widthed column shrink to make
              room for ScanLog, undoing the very width just set. Only
              applied at `lg` and above, mirroring the grid's own prior
              `lg:` gate -- on a stacked narrow layout there is no "the
              other column" to steal width from.

              The explicit width itself is also gated to `lg` -- it is set
              as a CSS custom property via inline style (which can hold the
              `calc()`/`px` values that drive the transition) but only
              CONSUMED by the `lg:w-[var(--dc-tree-w)]` class. Below `lg`
              the column stays the plain `w-full` it always was: `calc(100%
              - 380px)` goes negative (clamped to 0) on a narrow window,
              and `260px` would pin a stacked, full-width column to a
              sliver -- both values only make sense once the row is
              actually side-by-side. */}
          <div
            data-testid="deep-clean-tree-column"
            className="flex flex-col min-h-[240px] lg:min-h-0 pr-1 lg:shrink-0 w-full lg:w-[var(--dc-tree-w)] transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ '--dc-tree-w': cleaning ? '260px' : 'calc(100% - 380px)' }}
          >
            {/* The action lives IN the empty state, not only in the
                footer. Reported as "Deep Clean doesn't work" from exactly
                this screen: the panel says click a button that is a
                corner of the window away, so the screen reads as broken
                rather than as waiting. The scan does take about half a
                minute, which is worth saying up front -- an unexplained
                wait that long is indistinguishable from a hang. */}
            {!categories && !scanError && (
              <div className="glass-panel p-10 text-center">
                <p className="text-[13.5px] text-[color:var(--text-secondary)]">{t('deepClean.emptyState')}</p>
                <p className="text-[12.5px] text-[color:var(--text-muted)] mt-1.5 max-w-[380px] mx-auto">
                  {t('deepClean.before.body')}
                </p>
                <button
                  className="btn-primary px-5 py-2 text-[12.5px] font-medium mt-5 disabled:opacity-50"
                  onClick={() => runPreview()}
                  disabled={scanning}
                >
                  {scanning ? t('deepClean.before.scanning') : t('deepClean.before.preview')}
                </button>
              </div>
            )}

            {categories && hiddenCount > 0 && (
              // Without this the setting is invisible from the screen it
              // affects: someone who turned it on and forgot cannot tell
              // "Prune has no cleaner for this" from "Prune is hiding it".
              <p className="text-[12px] text-[color:var(--text-muted)] mb-2.5">
                {t('deepClean.hiddenNote', hiddenCount)}
              </p>
            )}

            {shownCategories && (
              <DeepCleanTree
                categories={shownCategories}
                // The frozen snapshot ONLY while receiptMode is actually
                // filtering the tree to it -- checkbox ticks/clicks below
                // still read and write the live `selected` via onToggle/
                // onToggleCategory regardless, unaffected by this.
                selected={cleaning && cleaningSelection ? cleaningSelection : selected}
                onToggle={handleToggle}
                onToggleCategory={handleToggleCategory}
                icons={categoryIcons.data ?? {}}
                // Whichever is actually running highlights its own row --
                // never both, since a scan and a clean cannot overlap.
                activeId={cleaning ? cleaningId : scanningId}
                // While a clean actually runs the tree column narrows to a
                // receipt -- only `cleaning`, never `scanning`, which stays
                // the full browsable list while deciding what to clean.
                receiptMode={cleaning}
                elevated={elevated}
              />
            )}
          </div>

          {/* Whichever is actually running takes the panel -- BleachBit's
              own output never shows a scan and a clean at once either.
              handleClean always starts the post-clean rescan the moment
              cleaning finishes, so the panel hands itself back to the scan
              log within a render or two of Clean completing -- the same
              brief handoff Preview vs. Rescan already makes with the tree. */}
          <ScanLog
            lines={cleaning ? cleanLog : logLines}
            scanning={cleaning || scanning}
            scanned={cleaning ? cleanExecuted : scanned}
            total={cleaning ? cleanTotalCount : total}
            progress={cleaning ? cleanProgress : scanProgress}
          />
        </div>
      </div>

      <div
        className="shrink-0 glass-panel flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-12 py-4"
        style={{ borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderBottom: 'none' }}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
          <div className="text-[13px] text-[color:var(--text-secondary)] whitespace-nowrap">
            {/* "0 B" would be a claim here, not a result: with the tree
                listed but unmeasured, nothing has been asked of the disk
                yet. Same rule as the version column -- say what is not
                known rather than print a confident zero. */}
            {t('deepClean.footer.totalLabel')}{' '}
            <span className="text-[color:var(--text-primary)] font-medium font-mono">
              {cleanTotal.anyMeasured ? formatBytes(cleanTotal.bytes) : t('deepClean.footer.notMeasuredYet')}
            </span>
            {cleanTotal.anyMeasured && cleanTotal.unmeasured > 0 && (
              <span className="text-[color:var(--text-muted)]">{t('deepClean.footer.unmeasuredSuffix', cleanTotal.unmeasured)}</span>
            )}
          </div>
          {categories && (
            // One click to take everything or nothing. Reaching the
            // non-recommended rules used to mean finding the small
            // "Select All" link inside each of the four category headers.
            <div className="flex items-center gap-2 text-[11.5px] shrink-0">
              <span className="text-[color:var(--text-muted)]">·</span>
              <button
                className="inline-flex items-center min-h-[24px] px-1 text-[color:var(--text-secondary)] hover:text-[color:var(--accent-primary)] transition-colors"
                // Same rule as a category's own Select All: never sweeps
                // in a rule that loses something the user has not already
                // said to stop asking about.
                onClick={() => setSelected(selectableIds(categories, settings?.acknowledgedCleanWarnings))}
              >
                {t('deepClean.footer.selectEverything')}
              </button>
              <span className="text-[color:var(--border-subtle)]">·</span>
              <button
                className="inline-flex items-center min-h-[24px] px-1 text-[color:var(--text-secondary)] hover:text-[color:var(--accent-primary)] transition-colors disabled:opacity-40"
                onClick={() => setSelected(new Set())}
                disabled={selected.size === 0}
              >
                {t('deepClean.footer.clear')}
              </button>
              <span className="text-[color:var(--text-muted)] font-mono">{t('deepClean.footer.selectedCount', selected.size)}</span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {confirmClean ? (
            <>
              {/* The confirm carries the SIZE, not just the count. "Move
                  47 items to Quarantine?" is not a decision anyone can
                  make -- 47 items is a browser cache or most of a game
                  install. And when nothing has been measured it says so
                  rather than omitting the number and letting the reader
                  assume it is small. The prompt is now one translated
                  sentence rather than JSX fragments around an inline
                  <span> -- the same tradeoff every other screen's own
                  confirm bar already made, since a translated catalog
                  function can only return a plain string. */}
              <span className="text-[12.5px] text-[color:var(--text-primary)] mr-1">
                {t(CONFIRM_PROMPT[removalMode], selected.size, cleanTotal.anyMeasured, formatBytes(cleanTotal.bytes))}
                {wipeSelected && <> {t('deepClean.confirm.wipeNote')}</>}
                {/* Only where it cannot be undone: naming the biggest items
                    is what lets someone tell a cache from a game install. */}
                {removalMode === 'delete' && biggest.length > 0 && (
                  <span className="block mt-0.5 text-[11.5px] text-[color:var(--text-secondary)]">
                    {t('deepCleanV3.files.biggest', biggest.map((f) => `${fileName(f.path)} (${formatBytes(f.sizeBytes)})`).join(', '))}
                  </span>
                )}
              </span>
              {/* Once the delete is actually in flight, Cancel no longer
                  means anything -- rules already finished stay cleaned.
                  Stop replaces it the same way it replaces Preview during
                  a scan: the rule in progress still finishes (see
                  executeRulesProgressively's own doc comment for why), but
                  nothing after it starts. */}
              {cleaning ? (
                <button
                  className="btn-ghost px-4 py-2 rounded-lg text-[12.5px] font-medium flex items-center gap-2"
                  onClick={stopClean}
                >
                  <span className="w-2 h-2 rounded-[2px] bg-[color:var(--danger)]" />
                  {t('deepClean.stop')}
                </button>
              ) : (
                <button className="btn-ghost px-4 py-2 rounded-lg text-[12.5px] font-medium" onClick={() => setConfirmClean(false)}>
                  {t('deepClean.confirm.cancel')}
                </button>
              )}
              {/* Danger, not accent, when the confirm cannot be undone: the
                  accent is for the safe primary action. */}
              <button
                className={`${removalMode === 'delete' ? 'btn-danger rounded-lg' : 'btn-primary'} px-5 py-2 text-[12.5px] font-medium disabled:opacity-50`}
                onClick={handleClean}
                disabled={cleaning}
              >
                {cleaning ? t('deepClean.confirm.cleaning') : t(CONFIRM_BUTTON[removalMode])}
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
                  {t('deepClean.stop')}
                </button>
              ) : (
                <button
                  // Until a Preview has measured something, Preview is the
                  // one action worth taking, so it carries the accent.
                  className={`${hasScanned ? 'btn-ghost rounded-lg' : 'btn-primary'} px-4 py-2 text-[12.5px] font-medium`}
                  onClick={() => runPreview()}
                >
                  {hasScanned ? t('deepClean.rescan') : t('deepClean.before.preview')}
                </button>
              )}
              {/* What Clean will do, in plain text next to the button that
                  does it -- not a tooltip, and not only in the confirm. */}
              {categories && (
                <span
                  data-testid="deep-clean-mode"
                  className={`text-[12px] ${removalMode === 'delete' ? 'text-[color:var(--warning)]' : 'text-[color:var(--text-muted)]'}`}
                >
                  {t(MODE_TEXT[removalMode])}
                </span>
              )}
              {/* Visible text rather than a tooltip: the reason Clean is
                  off is worth reading without hovering over it. */}
              {!hasScanned && !scanning && categories && (
                <span id="deep-clean-preview-first" className="text-[11.5px] text-[color:var(--text-muted)]">
                  {t('deepClean.footer.previewFirst')}
                </span>
              )}
              <button
                // Clean is enabled only once a Preview has measured at
                // least one ticked item: 37 pre-ticked rules and a total
                // reading "not measured yet" is not a decision anyone can
                // make. It takes the accent only when it can be pressed.
                className={`${canClean ? 'btn-primary' : 'btn-ghost rounded-lg'} px-5 py-2 text-[12.5px] font-medium disabled:opacity-50`}
                onClick={() => setConfirmClean(true)}
                disabled={!canClean}
                // Must match the span's own render condition exactly --
                // the automatic scan means `!hasScanned` alone is true for
                // a while BEFORE `!scanning` is, and pointing this at an
                // id that isn't in the DOM yet is a dangling
                // aria-describedby, which is worse than none at all.
                aria-describedby={!hasScanned && !scanning ? 'deep-clean-preview-first' : undefined}
              >
                {t('deepClean.clean')}
              </button>
            </>
          )}
        </div>
      </div>

      {shredOpen && <ShredDialog onClose={() => setShredOpen(false)} />}

      {warnAbout && (warnAbout.confirmEveryTime ? (
        <WipeFreeSpaceDialog onCancel={dismissWarning} onConfirm={confirmWarning} />
      ) : (
        <CleanWarningDialog
          item={warnAbout}
          onCancel={dismissWarning}
          onConfirm={confirmWarning}
        />
      ))}
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
 * Safe here because its one prop, `onNavigate`, is App's own `setScreen` --
 * a state setter, whose identity never changes -- so the comparison can
 * never produce a stale screen. A component with unstable props would gain
 * nothing from this and is deliberately left alone. */
export default memo(DeepClean);
