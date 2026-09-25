import { useEffect, useMemo, useState, memo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchDuplicates, quarantineDiskPath } from '../lib/api.js';
import { selectForRemoval, KEEP } from '../lib/duplicateSelection.js';
import { splitPath } from '../lib/pathDisplay.js';
import { useToasts } from '../hooks/useToasts.jsx';
import ModalOverlay from './ModalOverlay.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';

/** Files that are byte-identical, and which copy to keep.
 *
 * Scoped to a folder the user names rather than the whole drive. Hashing
 * is the expensive part and the honest scope for it is somewhere they
 * chose -- Downloads, a projects folder, a photo library. Pointing it at
 * a whole drive is their decision to make, not the default.
 *
 * Nothing is deleted. Selected copies go to quarantine through the same
 * guarded path the Disk Map's removal uses, so a wrong answer here costs
 * a restore rather than a file.
 */
function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** Shown inside the empty field as an example, not as a value. "C:\Users"
 * on its own looked like a folder already chosen, and the button beside it
 * stayed disabled for reasons nobody could see. */
const EXAMPLE_FOLDER = 'C:\\Users\\you\\Downloads';

/** "mm:ss" for a running scan. */
function formatElapsed(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Seconds since `active` became true, ticking once a second. Hashing can
 * run for minutes with nothing else to show, and time is the one honest
 * figure a scan without a total has. */
function useElapsedSeconds(active) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    setSeconds(0);
    const id = setInterval(() => setSeconds((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
  return seconds;
}

/** Date AND time: two copies written the same day are told apart by the
 * hour, and "which is newer" is the whole question on this screen. */
function formatWhen(mtimeMs) {
  return new Date(mtimeMs).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

function Duplicates() {
  const { t } = useLanguage();
  const [folder, setFolder] = useState('');
  const [armed, setArmed] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  // Set by Stop, cleared by the next search: without it a stopped search left
  // an empty screen, which reads as "found nothing".
  const [stopped, setStopped] = useState(false);
  const toasts = useToasts();
  const queryClient = useQueryClient();

  const scan = useQuery({
    queryKey: ['duplicates', armed],
    enabled: Boolean(armed),
    // Two minutes of hashing is never repeated on its own.
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnMount: false,
    queryFn: ({ signal }) => fetchDuplicates(armed, signal)
  });

  const groups = scan.data?.groups ?? [];
  const elapsed = useElapsedSeconds(scan.isFetching);

  const toggle = (path) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  };

  /** Auto-selection is named for what SURVIVES.
   *
   * "Auto-select oldest" is ambiguous about which end lives, and the
   * surviving copy is the consequential half of the choice on a screen
   * whose job is removing the others. */
  const autoSelect = (strategy) => setSelected(new Set(selectForRemoval(groups, strategy)));

  const selectedBytes = useMemo(() => {
    let total = 0;
    for (const group of groups) {
      for (const file of group.files) if (selected.has(file.path)) total += group.size;
    }
    return total;
  }, [groups, selected]);

  /** Refuses to leave a group with nothing left.
   *
   * The backend guard cannot catch this -- every path here is an ordinary
   * user file and each removal is individually legitimate. Only this
   * screen knows they are copies of one another, so only this screen can
   * notice that all of them were ticked. */
  const emptiedGroups = useMemo(
    () => groups.filter((g) => g.files.every((f) => selected.has(f.path))),
    [groups, selected]
  );

  const runRemoval = async () => {
    setConfirming(false);
    setRemoving(true);
    let moved = 0;
    let failed = 0;

    for (const path of selected) {
      const result = await quarantineDiskPath(path, null);
      if (result.ok) moved++; else failed++;
    }

    setRemoving(false);
    setSelected(new Set());
    queryClient.invalidateQueries({ queryKey: ['duplicates', armed] });
    queryClient.invalidateQueries({ queryKey: ['quarantine'] });

    if (moved > 0) {
      toasts.success(t('duplicates.toasts.moved', moved), {
        detail: t('duplicates.toasts.restoreHint')
      });
    }
    if (failed > 0) {
      toasts.error(t('duplicates.toasts.failed', failed), { detail: t('duplicates.toasts.failedDetail'), ttl: 0 });
    }
  };

  return (
    <div className="px-12 py-10 max-w-[1400px]">
      <h1 className="display-heading text-[30px] leading-none mb-2">{t('duplicates.title')}</h1>
      <p className="text-[13px] text-[color:var(--text-secondary)] mb-6 max-w-[110ch]">
        {t('duplicates.subtitle')}
      </p>

      <div className="flex items-center gap-2 mb-2 max-w-[640px]">
        <input
          type="text"
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && folder.trim()) { setSelected(new Set()); setStopped(false); setArmed(folder.trim()); } }}
          placeholder={t('duplicates.folderPlaceholder', EXAMPLE_FOLDER)}
          data-app-search="duplicates"
          aria-label={t('duplicates.folderInputAriaLabel')}
          className="flex-1 min-w-0 font-mono text-[12.5px] px-3 py-2 rounded-lg bg-[color:var(--surface-hover)] border border-[color:var(--border-subtle)] text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)] focus:outline-none focus:border-[color:var(--accent-primary)]/50"
        />
        {scan.isFetching ? (
          <button
            className="btn-ghost px-3.5 py-2 rounded-lg text-[12.5px] font-medium shrink-0"
            onClick={() => { setArmed(null); setStopped(true); queryClient.cancelQueries({ queryKey: ['duplicates', armed] }); }}
          >
            {t('duplicates.stop')}
          </button>
        ) : (
          <button
            className="btn-primary px-4 py-2 rounded-lg text-[12.5px] font-medium shrink-0 disabled:opacity-50"
            disabled={!folder.trim()}
            onClick={() => { setSelected(new Set()); setStopped(false); setArmed(folder.trim()); }}
          >
            {t('duplicates.findButton')}
          </button>
        )}
      </div>
      <p className="text-[11.5px] text-[color:var(--text-muted)] mb-6">
        {t('duplicates.compareNote')}
      </p>

      {scan.error && (
        <div className="glass-panel p-6 text-[13px] text-[color:var(--danger)] select-text">
          {scan.error.message}
        </div>
      )}

      {scan.isFetching && (
        <div className="glass-panel p-8 text-center">
          <div className="w-6 h-6 border-2 border-[color:var(--accent-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[13px] text-[color:var(--text-primary)]">{t('duplicates.reading', armed)}</p>
          <p className="text-[12.5px] text-[color:var(--text-secondary)] mt-1.5 max-w-[52ch] mx-auto">
            {t('duplicates.readingNote')}
          </p>
          <p className="text-[12.5px] text-[color:var(--text-primary)] mt-3 tabular-nums" data-testid="duplicates-elapsed">
            {t('diskMap.scanProgress.elapsed', formatElapsed(elapsed))}
          </p>
        </div>
      )}

      {/* Stop is not "found nothing": say what happened and what it means. */}
      {stopped && !scan.isFetching && (
        <div role="status" className="glass-panel p-8 text-center">
          <p className="text-[13.5px] text-[color:var(--text-secondary)]">{t('duplicates.stoppedNote')}</p>
        </div>
      )}

      {!scan.isFetching && scan.data && groups.length === 0 && (
        <div role="status" className="glass-panel p-8 text-center">
          <p className="text-[13.5px] text-[color:var(--text-secondary)]">{t('duplicates.empty.heading')}</p>
          <p className="text-[12.5px] text-[color:var(--text-muted)] mt-1.5">
            {t('duplicates.empty.scanned', scan.data.scannedFiles.toLocaleString())}
            {scan.data.truncated && t('duplicates.empty.truncatedSuffix')}
          </p>
        </div>
      )}

      {!scan.isFetching && groups.length > 0 && (
        <>
          <div className="flex items-center flex-wrap gap-3 mb-4">
            {/* The outcome of the search, announced when it lands. */}
            <span role="status" className="text-[12.5px] text-[color:var(--text-secondary)]">
              {/* Each phrase is bolded/accented as one unit rather than
                  just the number within it -- the same tradeoff every
                  other screen's own count line already made, since a
                  translated catalog function can only return a plain
                  string, not JSX with an inline span partway through. */}
              <span className="text-[color:var(--text-primary)] font-medium">{t('duplicates.summarySets', groups.length)}</span>{' · '}
              <span className="text-[color:var(--text-primary)] font-medium">{t('duplicates.recoverable', formatBytes(scan.data.wastedBytes))}</span>
            </span>
            <span className="flex-1" />
            <button className="btn-ghost px-3 py-1.5 rounded-lg text-[12px]" onClick={() => autoSelect(KEEP.OLDEST)}>
              {t('duplicates.keepOldest')}
            </button>
            <button className="btn-ghost px-3 py-1.5 rounded-lg text-[12px]" onClick={() => autoSelect(KEEP.NEWEST)}>
              {t('duplicates.keepNewest')}
            </button>
            <button className="btn-ghost px-3 py-1.5 rounded-lg text-[12px]" onClick={() => setSelected(new Set())}>
              {t('duplicates.clear')}
            </button>
          </div>

          {scan.data.truncated && (
            <p className="text-[12px] text-[color:var(--warning)] mb-4">
              {t('duplicates.truncatedWarning')}
            </p>
          )}

          <div className="flex flex-col gap-3">
            {groups.map((group) => {
              const allTicked = group.files.every((f) => selected.has(f.path));
              return (
                <div key={group.digest} className={`glass-panel p-4 ${allTicked ? 'border-[color:var(--danger)]/40' : ''}`}>
                  <div className="flex items-baseline justify-between mb-2.5">
                    <span className="text-[12.5px] text-[color:var(--text-primary)]">
                      {t('duplicates.group.identicalCopies', group.count, formatBytes(group.size))}
                    </span>
                    <span className="text-[12px] text-[color:var(--text-secondary)]">
                      {t('duplicates.recoverable', formatBytes(group.wastedBytes))}
                    </span>
                  </div>

                  {allTicked && (
                    <p className="text-[11.5px] text-[color:var(--danger)] mb-2">
                      {t('duplicates.group.allTickedWarning')}
                    </p>
                  )}

                  <div className="flex flex-col gap-1">
                    {group.files.map((file) => {
                      // Derived from the selection itself, here, on every render.
                      // There is no second flag to keep in step: the tag can only
                      // ever say what the checkbox beside it says.
                      const toQuarantine = selected.has(file.path);
                      const { name, head, tail } = splitPath(file.path);
                      return (
                        <label key={file.path} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-[color:var(--surface-subtle)] cursor-pointer">
                          <input
                            type="checkbox"
                            className="prune-check"
                            checked={toQuarantine}
                            onChange={() => toggle(file.path)}
                          />
                          {/* The file's name on its own line, the folder beneath it cut in
                              the middle: the end of a path is the part that says which copy
                              this is, and the start is what every copy shares. */}
                          <span className="min-w-0 flex-1">
                            <span className="block text-[12.5px] text-[color:var(--text-primary)] truncate select-text">{name}</span>
                            <span className="flex min-w-0 font-mono text-[11px] text-[color:var(--text-muted)] select-text">
                              <span className="truncate min-w-0">{head}</span>
                              <span className="shrink-0">{tail}</span>
                            </span>
                          </span>
                          {/* aria-hidden: the checkbox already says it. Inside the label the
                              name would otherwise change every time the box is ticked. */}
                          <span
                            aria-hidden="true"
                            className={`shrink-0 text-[10.5px] font-mono uppercase tracking-wider px-1.5 py-px rounded border ${
                              toQuarantine
                                ? 'text-[color:var(--text-primary)] border-[color:var(--control-border)] bg-[color:var(--surface-hover)]'
                                : 'text-[color:var(--text-secondary)] border-[color:var(--border-subtle)]'
                            }`}
                          >
                            {toQuarantine ? t('duplicates.tags.toQuarantine') : t('duplicates.tags.keep')}
                          </span>
                          <span className="text-[11px] font-mono text-[color:var(--text-muted)] shrink-0">
                            {formatWhen(file.mtimeMs)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="sticky bottom-0 mt-4 glass-panel px-5 py-3 flex items-center justify-between gap-4">
            <span className="text-[12.5px] text-[color:var(--text-secondary)]">
              <span className="text-[color:var(--text-primary)] font-medium">{t('duplicates.footer.selected', selected.size, formatBytes(selectedBytes))}</span>
            </span>
            <button
              className="btn-danger px-4 py-2 rounded-lg text-[12.5px] font-medium disabled:opacity-50"
              disabled={selected.size === 0 || emptiedGroups.length > 0 || removing}
              onClick={() => setConfirming(true)}
            >
              {removing ? t('duplicates.footer.moving') : emptiedGroups.length > 0
                ? t('duplicates.footer.wouldLose', emptiedGroups.length)
                : t('duplicates.footer.moveButton')}
            </button>
          </div>
        </>
      )}

      {confirming && (
        <ModalOverlay label={t('duplicates.modal.label')} onClose={() => setConfirming(false)}>
          <div className="glass-panel w-full max-w-[480px] p-6">
            <h2 className="display-heading text-[20px] mb-2">{t('duplicates.modal.heading', selected.size)}</h2>
            <p className="text-[12.5px] text-[color:var(--text-secondary)] mb-5">
              {t('duplicates.modal.body', formatBytes(selectedBytes))}
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button className="btn-ghost px-4 py-2 rounded-lg text-[12.5px]" onClick={() => setConfirming(false)}>
                {t('duplicates.modal.cancel')}
              </button>
              <button className="btn-danger px-4 py-2 rounded-lg text-[12.5px] font-medium" onClick={runRemoval}>
                {t('duplicates.modal.confirmButton')}
              </button>
            </div>
          </div>
        </ModalOverlay>
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
export default memo(Duplicates);
