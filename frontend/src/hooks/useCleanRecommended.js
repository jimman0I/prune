import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { keys } from '../lib/queryClient.js';
import { useDeepCleanScan } from './useDeepCleanScan.js';
import { useDeepCleanExecute } from './useDeepCleanExecute.js';
import { useSettings } from './useSystemQueries.js';
import { useToasts } from './useToasts.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { recommendedPlan } from '../lib/recommendedClean.js';
import { removalModeFrom } from '../lib/cleanOutcome.js';
import { cleanResultText } from '../lib/cleanResultText.js';
import { batchDirsOfResults, ruleIdsOfBatches } from '../lib/undoQuarantine.js';
import { useQuarantineUndo } from './useQuarantineUndo.js';
import { lockedFileSummary } from '../lib/lockedFiles.js';

const NO_PLAN = { ids: [], bytes: 0, count: 0, fromCache: false };
const nameOf = (item) => item?.name ?? item?.id ?? '';

/** The Dashboard's one-click "Clean recommended", built from Deep Clean's own
 * pieces rather than beside them.
 *
 * - What it knows comes from useDeepCleanScan: the remembered scan when there
 *   is one (sizes marked "last measured"), otherwise the same scan stream Deep
 *   Clean runs. It shares the remembered scan with Deep Clean, so measuring
 *   here is measuring there, and a clean here settles the rows there.
 * - What it does comes from useDeepCleanExecute: the same stream, the same
 *   backend guards, and the removal mode the person chose in Settings
 *   (Quarantine by default, Recycle Bin, or Delete now). The backend decides
 *   the mode from settings; nothing is sent from here but rule ids.
 * - Nothing is removed without a confirmation that names the total and where
 *   it goes. The plan shown there is frozen: the ids that get cleaned are the
 *   ids that were on screen when the person said yes.
 *
 * Phases: idle -> (measuring ->) confirm -> cleaning -> result. */
export function useCleanRecommended({ enabled = true } = {}) {
  const { t } = useLanguage();
  const toasts = useToasts();
  const queryClient = useQueryClient();
  const offerUndo = useQuarantineUndo();
  const { settings } = useSettings();
  const scan = useDeepCleanScan(nameOf, undefined, { settings, enabled });
  const exec = useDeepCleanExecute(nameOf, undefined);

  const [phase, setPhase] = useState('idle');
  const [confirmPlan, setConfirmPlan] = useState(NO_PLAN);
  const [result, setResult] = useState(null);
  const [cleanError, setCleanError] = useState(null);
  const sawScanning = useRef(false);
  const startedAt = useRef(0);

  const removalMode = removalModeFrom(settings);
  const plan = useMemo(
    () => (scan.hasScanned ? recommendedPlan(scan.tree) : NO_PLAN),
    [scan.tree, scan.hasScanned]
  );

  // After "Measure and review": wait for the scan to land, then either ask or
  // say there is nothing. A scan that was stopped or failed asks nothing.
  //
  // "Landed" is the remembered-scan time moving past the moment this began, not
  // `hasScanned` (already true on a rescan) and not a glimpse of `scanning`
  // (a fast scan can start and finish between two renders).
  useEffect(() => {
    if (phase !== 'measuring') return;
    if (scan.scanning) { sawScanning.current = true; return; }
    if (scan.error) { setPhase('idle'); return; }
    if (scan.lastScanAt && scan.lastScanAt >= startedAt.current) {
      if (plan.count > 0) { setConfirmPlan(plan); setPhase('confirm'); } else setPhase('idle');
    } else if (sawScanning.current) {
      // It ran and ended without a complete result (cut short): ask nothing.
      setPhase('idle');
    }
  }, [phase, scan.scanning, scan.lastScanAt, scan.error, plan]);

  const begin = useCallback(() => {
    if (!scan.tree || phase !== 'idle') return;
    setResult(null);
    setCleanError(null);
    if (scan.hasScanned) {
      if (plan.count > 0) { setConfirmPlan(plan); setPhase('confirm'); }
      return;
    }
    sawScanning.current = false;
    startedAt.current = Date.now();
    setPhase('measuring');
    scan.start();
  }, [scan, phase, plan]);

  /** Measure again, from the idle card. */
  const rescan = useCallback(() => {
    if (phase !== 'idle') return;
    setResult(null);
    sawScanning.current = false;
    startedAt.current = Date.now();
    setPhase('measuring');
    scan.start();
  }, [phase, scan]);

  const cancel = useCallback(() => {
    if (phase === 'confirm') setPhase('idle');
  }, [phase]);

  const dismiss = useCallback(() => {
    setResult(null);
    setPhase('idle');
  }, []);

  const stop = useCallback(() => {
    if (phase === 'measuring') { scan.stop(); setPhase('idle'); }
    else if (phase === 'cleaning') exec.stop();
  }, [phase, scan, exec]);

  const confirm = useCallback(async () => {
    if (phase !== 'confirm' || confirmPlan.ids.length === 0) return;
    setCleanError(null);
    setPhase('cleaning');
    // The rows as they stand, for an Undo to put back (see revertRows).
    const treeBefore = scan.tree;
    const scanAtBefore = scan.lastScanAt;
    try {
      const outcome = await exec.run(confirmPlan.ids);
      setResult(outcome);
      // The rows settle from what the clean reported, and the remembered scan
      // is updated and announced -- exactly what Deep Clean does after its own.
      scan.applyCleanResults(outcome.results);
      // What a Delete now freed is already in the backend's lifetime total.
      queryClient.invalidateQueries({ queryKey: keys.stats });
      const text = cleanResultText(outcome, t);
      // Undo only where the files can come back: never after Delete now.
      const dirs = removalMode === 'delete' ? [] : batchDirsOfResults(outcome.results);
      const onRestored = (restored) => scan.revertRows(treeBefore, ruleIdsOfBatches(outcome.results, restored), scanAtBefore);
      if (outcome.aborted) {
        offerUndo(`${t('deepClean.cleanupStopped')} ${text}`, dirs, { tone: 'warning', onRestored });
      } else {
        offerUndo(`${t('deepClean.cleanupComplete')} ${text}`, dirs, { onRestored });
        const locked = lockedFileSummary(outcome, t('deepClean.locked'));
        if (locked) toasts.warn(locked.message, { detail: locked.detail, paths: locked.paths });
      }
    } catch (err) {
      setCleanError(err.message);
    } finally {
      setPhase((current) => (current === 'cleaning' ? 'result' : current));
    }
  }, [phase, confirmPlan, exec, scan, t, toasts, queryClient, offerUndo, removalMode]);

  return {
    phase,
    // Rules not listed yet (or the listing failed): nothing to act on.
    ready: Boolean(scan.tree),
    plan,
    confirmPlan,
    removalMode,
    hasScanned: scan.hasScanned,
    lastScanAt: scan.lastScanAt,
    scanned: scan.scanned,
    scanTotal: scan.total,
    scanError: scan.error,
    cleanError,
    executed: exec.executed,
    cleanTotal: exec.total,
    result,
    begin, rescan, cancel, confirm, stop, dismiss
  };
}
