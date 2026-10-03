import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { restoreQuarantineBatch } from '../lib/api.js';
import { keys } from '../lib/queryClient.js';
import { restoreBatches } from '../lib/undoQuarantine.js';
import { useToasts } from './useToasts.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';

/** The success toast for a move into Quarantine, with Undo on it.
 *
 *   const offerUndo = useQuarantineUndo();
 *   offerUndo('Moved 8 MB to Quarantine.', batchDirs, { detail, doneMessage, onRestored });
 *
 * Undo restores every batch through the Quarantine screen's own API, then says
 * what happened in a toast of its own: put back, put back in part, no longer in
 * Quarantine (emptied, purged by the retention window or size cap, or restored
 * already), or why it failed. With no batches there is nothing to undo and it is
 * an ordinary success toast.
 *
 * The toast and its button belong to the event, not to the screen that raised
 * them: the restore closes over this hook's stable pieces, so it still works
 * after that screen has unmounted. `onRestored(dirs)` lets the caller bring its
 * own view back in line (Deep Clean's remembered sizes, the Disk Map picture);
 * the Quarantine list is always refreshed. */
export function useQuarantineUndo() {
  const { t } = useLanguage();
  const toasts = useToasts();
  const queryClient = useQueryClient();

  return useCallback((message, batchDirs, { tone = 'success', detail, doneMessage, onRestored, ...extra } = {}) => {
    const dirs = [...new Set((batchDirs ?? []).filter((d) => typeof d === 'string' && d.length > 0))];
    // The named helpers, as every caller used before: a plain toast is exactly
    // what `toasts.success(...)` / `toasts.warn(...)` made.
    const say = (message, options) => {
      const raise = { warning: toasts.warn, danger: toasts.error, info: toasts.info }[tone] ?? toasts.success;
      raise(message, options);
    };
    if (dirs.length === 0) {
      say(message, { ...(detail ? { detail } : {}), ...extra });
      return;
    }

    const undo = async () => {
      const outcome = await restoreBatches(dirs, (dir) => restoreQuarantineBatch(dir));
      queryClient.invalidateQueries({ queryKey: keys.quarantine });
      if (outcome.restored.length > 0) onRestored?.(outcome.restored);

      const total = dirs.length;
      if (outcome.restored.length === total) {
        toasts.success(doneMessage ?? t('dashboardQolV3.undo.done'));
      } else if (outcome.restored.length > 0) {
        toasts.warn(t('dashboardQolV3.undo.partial', outcome.restored.length, total));
      } else if (outcome.failed.length > 0) {
        toasts.error(t('dashboardQolV3.undo.failed', outcome.failed[0].error));
      } else {
        toasts.warn(t('dashboardQolV3.undo.gone'));
      }
    };

    say(message, {
      ...(detail ? { detail } : {}),
      ...extra,
      action: { label: t('dashboardQolV3.undo.action'), onClick: undo }
    });
  }, [t, toasts, queryClient]);
}
