import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ModalOverlay from './ModalOverlay.jsx';
import { DrivePicker } from './DrivePicker.jsx';
import { fetchJunkPatterns, streamJunkScan, removeJunkFiles, revealInExplorer, pickPath } from '../lib/api.js';
import { keys } from '../lib/queryClient.js';
import { useDrives } from '../hooks/useDrives.js';
import { useSettings } from '../hooks/useSystemQueries.js';
import { useToasts } from '../hooks/useToasts.jsx';
import { useQuarantineUndo } from '../hooks/useQuarantineUndo.js';
import { removalModeFrom } from '../lib/cleanOutcome.js';
import { cleanResultText } from '../lib/cleanResultText.js';
import { batchDirsOfResults } from '../lib/undoQuarantine.js';
import { splitPath } from '../lib/pathDisplay.js';
import {
  groupJunkFiles, preselectedPaths, selectionSummary, groupTickState, skippedParts,
  driveRoot, addFolder, patternDescriptionKey
} from '../lib/junkFiles.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { formatBytes } from '../lib/formatBytes.js';

/** Deep Clean's Junk files scan.
 *
 * Deep Clean's rules are curated folders; this is the person's own list of
 * junk NAMES (Settings -> Cleanup -> Junk file patterns), looked for on the
 * drives and folders they pick here. It lives beside Shred files in Deep
 * Clean's heading because, like that tool, it acts on what the person points
 * it at rather than on a preset a "Select everything" could reach.
 *
 * Three things on one sheet, top to bottom: where to look, what was found
 * (filling in while the walk runs, grouped by the pattern that found it), and
 * what removing the ticked files will do. Only results of the patterns that
 * are safe by definition -- scratch files and self-rebuilding caches -- start
 * ticked; everything else waits for the person. Removal is one batch through
 * the same road Deep Clean's Clean takes (Quarantine with Undo, or the Recycle
 * Bin or Delete now if Settings says so), confirmed in place first. */

/** Rows shown per group before "Show all": enough to judge a group by, few
 * enough that a 5,000-file group does not have to render to be skimmed. */
const ROWS_PER_GROUP = 50;

const HEADING_CLASS = 'text-[11px] font-mono uppercase tracking-[0.14em] text-[color:var(--text-muted)]';
const FIELD_CLASS = 'flex-1 min-w-0 font-mono text-[12.5px] px-3 py-2 rounded-lg bg-[color:var(--surface-hover)] border border-[color:var(--border-subtle)] text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--accent-primary)]/50';

const SCAN_REASONS = new Set(['noRoots', 'noPatterns', 'noUsableRoots']);
const ROOT_REASONS = new Set(['missing', 'relative', 'climb', 'protected']);

/** Date and time, short: two leftovers from the same day are told apart by the hour. */
function formatWhen(mtimeMs) {
  return new Date(mtimeMs).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

function isAbort(err) {
  return err?.name === 'AbortError' || /abort/i.test(err?.message ?? '');
}

export default function JunkFilesDialog({ onClose, onEditPatterns }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const toasts = useToasts();
  const offerUndo = useQuarantineUndo();
  const { settings } = useSettings();
  const { drives } = useDrives();
  // Inside a function, as useDrives does: a failure lands in the query's
  // error state rather than throwing during render.
  const patternsQuery = useQuery({ queryKey: keys.junkPatterns, queryFn: () => fetchJunkPatterns(), retry: 1 });

  const [pickedDrives, setPickedDrives] = useState(() => new Set());
  const [folders, setFolders] = useState([]);
  const [typed, setTyped] = useState('');
  const [pickError, setPickError] = useState(null);

  // idle -> scanning -> done; a new scan starts from idle's state again.
  const [phase, setPhase] = useState('idle');
  const [scanPatterns, setScanPatterns] = useState([]);
  const [files, setFiles] = useState([]);
  const [progress, setProgress] = useState(null);
  const [summary, setSummary] = useState(null);
  const [refusedRoots, setRefusedRoots] = useState([]);
  const [scanError, setScanError] = useState(null);
  const [stopped, setStopped] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [expanded, setExpanded] = useState(() => new Set());
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const controllerRef = useRef(null);
  const removeButtonRef = useRef(null);
  const cancelButtonRef = useRef(null);
  // Whether the confirm bar was open on the last render, so focus can follow
  // it: the button that opened it is unmounted while it shows, and focus left
  // on nothing strands a keyboard user at the top of the page.
  const wasConfirming = useRef(false);
  useEffect(() => {
    // The harmless choice takes focus, never the red one.
    if (confirming) cancelButtonRef.current?.focus();
    else if (wasConfirming.current) removeButtonRef.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);

  // Closing the dialog mid-walk stops the walk: nobody is waiting for it.
  useEffect(() => () => controllerRef.current?.abort(), []);

  const scanning = phase === 'scanning';
  const busy = scanning || removing;
  const enabledPatterns = (patternsQuery.data?.patterns ?? []).filter((p) => p.enabled);
  const roots = [...[...pickedDrives].sort().map(driveRoot), ...folders];
  const removalMode = removalModeFrom(settings);
  const hours = Number(settings?.skipRecentHours) || 0;

  const groups = useMemo(() => groupJunkFiles(files, scanPatterns), [files, scanPatterns]);
  const chosen = useMemo(() => selectionSummary(files, selected), [files, selected]);

  const toggleDrive = (letter) => setPickedDrives((prev) => {
    const next = new Set(prev);
    if (next.has(letter)) next.delete(letter); else next.add(letter);
    return next;
  });

  const addTyped = () => {
    setFolders((prev) => addFolder(prev, typed));
    setTyped('');
  };

  /** The native folder chooser, as Duplicates and Forced Uninstall use it. */
  const browse = async () => {
    setPickError(null);
    try {
      const { path } = await pickPath('folder');
      if (path) setFolders((prev) => addFolder(prev, path));
    } catch (err) {
      setPickError(t('uninstallerV3.forced.pickFailed', err.message));
    }
  };

  const startScan = async () => {
    if (roots.length === 0 || busy) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setPhase('scanning');
    setFiles([]);
    setSelected(new Set());
    setExpanded(new Set());
    setSummary(null);
    setProgress(null);
    setRefusedRoots([]);
    setScanError(null);
    setStopped(false);
    setConfirming(false);

    // The 'start' list, for the batches that follow it inside this closure.
    let patterns = [];
    let streamError = null;
    try {
      await streamJunkScan(roots, (type, data) => {
        if (type === 'start') {
          patterns = data.patterns ?? [];
          setScanPatterns(patterns);
          setRefusedRoots(data.refused ?? []);
        } else if (type === 'files') {
          const batch = data.files ?? [];
          setFiles((prev) => prev.concat(batch));
          const ticks = preselectedPaths(batch, patterns);
          if (ticks.length > 0) {
            setSelected((prev) => {
              const next = new Set(prev);
              for (const path of ticks) next.add(path);
              return next;
            });
          }
        } else if (type === 'progress') {
          setProgress(data);
        } else if (type === 'done') {
          setSummary(data);
        } else if (type === 'error') {
          streamError = data?.message ?? '';
        }
      }, controller.signal);
      if (streamError !== null) setScanError(t('junkFiles.errors.failed', streamError));
    } catch (err) {
      if (isAbort(err)) {
        setStopped(true);
      } else if (SCAN_REASONS.has(err.reason)) {
        setScanError(t(`junkFiles.errors.${err.reason}`));
        if (Array.isArray(err.refused)) setRefusedRoots(err.refused);
      } else {
        setScanError(t('junkFiles.errors.failed', err.message));
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      setPhase('done');
    }
  };

  const stopScan = () => controllerRef.current?.abort();

  const toggleFile = (path) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(path)) next.delete(path); else next.add(path);
    return next;
  });

  const toggleGroup = (group) => setSelected((prev) => {
    const next = new Set(prev);
    const all = groupTickState(group, prev) === 'all';
    for (const file of group.files) {
      if (all) next.delete(file.path); else next.add(file.path);
    }
    return next;
  });

  const reveal = async (path) => {
    try {
      const result = await revealInExplorer(path);
      if (result?.ok === false) toasts.warn(result.error);
    } catch (err) {
      toasts.warn(err.message);
    }
  };

  const runRemoval = async () => {
    const chosenFiles = files.filter((f) => selected.has(f.path));
    if (chosenFiles.length === 0) return;
    setConfirming(false);
    setRemoving(true);
    try {
      const result = await removeJunkFiles(chosenFiles.map((f) => f.path));
      const kept = new Set((result.keptPaths ?? []).map((p) => p.toLowerCase()));
      const gone = chosenFiles.filter((f) => !kept.has(f.path.toLowerCase()));
      const goneSet = new Set(gone.map((f) => f.path));
      setFiles((prev) => prev.filter((f) => !goneSet.has(f.path)));
      setSelected((prev) => new Set([...prev].filter((p) => !goneSet.has(p))));
      queryClient.invalidateQueries({ queryKey: keys.quarantine });
      queryClient.invalidateQueries({ queryKey: keys.stats });

      const rule = result.results?.[0] ?? {};
      const message = `${t('junkFiles.toast.removed', result.removedCount ?? gone.length)} ${cleanResultText(result, t)}`;
      offerUndo(message, result.mode === 'delete' ? [] : batchDirsOfResults(result.results), {
        // They are back on disk: back in the list, unticked, if it is still open.
        onRestored: () => setFiles((prev) => {
          const present = new Set(prev.map((f) => f.path));
          return prev.concat(gone.filter((f) => !present.has(f.path)));
        })
      });
      if ((rule.skippedCount ?? 0) > 0) {
        toasts.warn(t('junkFiles.toast.kept', rule.skippedCount), { detail: t('junkFiles.toast.keptDetail') });
      }
    } catch (err) {
      toasts.error(t('junkFiles.errors.removeFailed', err.message));
    } finally {
      setRemoving(false);
    }
  };

  const title = t('junkFiles.title');
  const skipped = summary?.skipped;
  const parts = skippedParts(skipped);
  const folderSkips = (Number(skipped?.protectedFolders) || 0) + (Number(skipped?.excludedFolders) || 0);

  return (
    <ModalOverlay label={title} onClose={onClose} dismissible={!removing}>
      <div className="glass-panel w-[880px] max-w-full max-h-[88vh] flex flex-col overflow-hidden">
        <div className="shrink-0 px-6 pt-6 pb-4 border-b border-[color:var(--border-subtle)] overflow-y-auto max-h-[46vh]">
          <h2 className="text-[15px] font-medium text-[color:var(--text-primary)]">{title}</h2>
          <p className="text-[13px] text-[color:var(--text-secondary)] mt-2 max-w-[90ch]">{t('junkFiles.intro')}</p>

          <h3 className={`${HEADING_CLASS} mt-5 mb-2.5`}>{t('junkFiles.where')}</h3>
          <DrivePicker
            drives={drives}
            current={pickedDrives}
            onSelect={toggleDrive}
            disabled={busy}
            minDrives={1}
            className="mb-3"
          />

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && typed.trim()) addTyped(); }}
              placeholder={t('junkFiles.folderPlaceholder')}
              aria-label={t('junkFiles.folderAria')}
              spellCheck={false}
              disabled={busy}
              className={FIELD_CLASS}
            />
            <button type="button" className="btn-ghost px-3.5 py-2 rounded-lg text-[12.5px] font-medium shrink-0 disabled:opacity-50" onClick={browse} disabled={busy}>
              {t('uninstallerV3.forced.browse')}
            </button>
            <button type="button" className="btn-ghost px-3.5 py-2 rounded-lg text-[12.5px] font-medium shrink-0 disabled:opacity-50" onClick={addTyped} disabled={busy || typed.trim() === ''}>
              {t('junkFiles.addFolder')}
            </button>
          </div>
          {pickError && <p className="text-[12px] text-[color:var(--danger)] mt-1.5 select-text" role="alert">{pickError}</p>}

          {folders.length > 0 && (
            <ul aria-label={t('junkFiles.foldersLabel')} className="mt-2 flex flex-wrap gap-1.5">
              {folders.map((folder) => (
                <li key={folder} className="flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-lg bg-[color:var(--surface-subtle)] border border-[color:var(--border-subtle)] min-w-0 max-w-full">
                  <span className="font-mono text-[12px] text-[color:var(--text-secondary)] truncate select-text">{folder}</span>
                  <button
                    type="button"
                    aria-label={t('junkFiles.removeFolder', folder)}
                    onClick={() => setFolders((prev) => prev.filter((f) => f !== folder))}
                    disabled={busy}
                    className="inline-flex items-center justify-center w-6 h-6 shrink-0 rounded text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--surface-hover)] disabled:opacity-50"
                  >
                    <svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                      <line x1="5" y1="5" x2="19" y2="19" /><line x1="19" y1="5" x2="5" y2="19" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span className={HEADING_CLASS}>{t('junkFiles.lookingFor')}</span>
            {enabledPatterns.length === 0 && patternsQuery.data && (
              <span className="text-[12px] text-[color:var(--warning)]">{t('junkFiles.errors.noPatterns')}</span>
            )}
            {enabledPatterns.map((p) => (
              <span key={p.pattern} className="font-mono text-[11.5px] px-1.5 py-px rounded border border-[color:var(--border-subtle)] text-[color:var(--text-secondary)]">
                {p.pattern}
              </span>
            ))}
            {onEditPatterns && (
              <button type="button" className="text-[12px] font-medium text-[color:var(--accent-primary)] hover:underline px-1 disabled:opacity-50" onClick={onEditPatterns} disabled={removing}>
                {t('junkFiles.editPatterns')}
              </button>
            )}
          </div>

          <div className="mt-4 flex items-center gap-3">
            {scanning ? (
              <button type="button" className="btn-ghost px-4 py-2 rounded-lg text-[12.5px] font-medium flex items-center gap-2" onClick={stopScan}>
                <span aria-hidden="true" className="w-2 h-2 rounded-[2px] bg-[color:var(--danger)]" />
                {t('deepClean.stop')}
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary px-4 py-2 text-[12.5px] font-medium disabled:opacity-50"
                onClick={startScan}
                disabled={roots.length === 0 || removing || enabledPatterns.length === 0}
              >
                {phase === 'done' ? t('junkFiles.scanAgain') : t('junkFiles.scan')}
              </button>
            )}
            {roots.length === 0 && !scanning && (
              <span className="text-[12px] text-[color:var(--text-muted)]">{t('junkFiles.noPlaces')}</span>
            )}
            {scanning && (
              <span className="flex items-center gap-2 text-[12px] font-mono text-[color:var(--text-secondary)]" role="status" aria-live="polite" data-testid="junk-progress">
                <span aria-hidden="true" className="w-3 h-3 border-2 border-[color:var(--accent-primary)] border-t-transparent rounded-full animate-spin shrink-0" />
                {t('junkFiles.progress', (progress?.entries ?? 0).toLocaleString(), files.length.toLocaleString())}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4" data-testid="junk-results">
          {scanError && (
            <div className="mb-3 px-3.5 py-3 rounded-xl bg-[color:var(--danger-soft)] border border-[color:var(--danger)]/25">
              <p className="text-[12.5px] text-[color:var(--danger)] select-text" role="alert">{scanError}</p>
            </div>
          )}

          {refusedRoots.length > 0 && (
            <ul className="mb-3 space-y-1">
              {refusedRoots.map((r) => (
                <li key={r.path} className="text-[12px] text-[color:var(--warning)] select-text">
                  {ROOT_REASONS.has(r.reason) ? t(`junkFiles.refusedRoot.${r.reason}`, r.path) : r.path}
                </li>
              ))}
            </ul>
          )}

          {phase === 'idle' && !scanError && (
            <p className="text-[12.5px] text-[color:var(--text-muted)]">{t('junkFiles.idle')}</p>
          )}

          {phase === 'done' && !scanError && (
            <div className="mb-3 space-y-1" role="status">
              {files.length === 0 ? (
                <p className="text-[13px] text-[color:var(--text-secondary)]">{stopped ? t('junkFiles.stoppedEmpty') : t('junkFiles.empty')}</p>
              ) : (
                <p className="text-[12.5px] text-[color:var(--text-secondary)]">
                  <span className="text-[color:var(--text-primary)] font-medium">{t('junkFiles.found', files.length.toLocaleString(), formatBytes(files.reduce((s, f) => s + (f.sizeBytes || 0), 0)))}</span>
                  {stopped && <span>{' · '}{t('junkFiles.stopped')}</span>}
                </p>
              )}
              {parts.length > 0 && (
                <p className="text-[12px] text-[color:var(--text-muted)]" data-testid="junk-skipped">
                  {t('junkFiles.skipped.lead', parts.reduce((n, p) => n + p.count, 0).toLocaleString())}{' '}
                  {parts.map((p) => t(`junkFiles.skipped.${p.kind}`, p.count.toLocaleString(), hours)).join(' · ')}
                </p>
              )}
              {folderSkips > 0 && (
                <p className="text-[12px] text-[color:var(--text-muted)]">{t('junkFiles.skipped.folders', folderSkips.toLocaleString())}</p>
              )}
              {summary?.truncated && summary.truncated !== 'aborted' && summary.truncated !== 'depth' && (
                <p className="text-[12px] text-[color:var(--warning)]">
                  {summary.truncated === 'matches' ? t('junkFiles.truncatedMatches') : t('junkFiles.truncated')}
                </p>
              )}
              {(summary?.unreadable ?? []).map((root) => (
                <p key={root} className="text-[12px] text-[color:var(--warning)] select-text">{t('junkFiles.unreadable', root)}</p>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-3">
            {groups.map((group) => {
              const state = groupTickState(group, selected);
              const descriptionKey = patternDescriptionKey(group.pattern);
              const showAll = expanded.has(group.pattern);
              const rows = showAll ? group.files : group.files.slice(0, ROWS_PER_GROUP);
              return (
                <section key={group.pattern} aria-label={group.pattern} className="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-subtle)]">
                  <div className="flex items-center gap-3 px-3 py-2.5 border-b border-[color:var(--border-subtle)]">
                    <GroupCheckbox
                      state={state}
                      label={t('junkFiles.group.tickAll', group.pattern)}
                      disabled={removing}
                      onChange={() => toggleGroup(group)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-mono text-[12.5px] font-medium text-[color:var(--text-primary)]">{group.pattern}</span>
                      {descriptionKey && (
                        <span className="ml-2 text-[12px] text-[color:var(--text-muted)]">{t(`junkFiles.describe.${descriptionKey}`)}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-[12px] text-[color:var(--text-secondary)] tabular-nums">
                      {t('junkFiles.found', group.files.length.toLocaleString(), formatBytes(group.totalBytes))}
                    </span>
                  </div>
                  <ul className="py-1">
                    {rows.map((file) => {
                      const { name, head, tail } = splitPath(file.path);
                      return (
                        <li key={file.path} className="flex items-center gap-2 pl-3 pr-2 hover:bg-[color:var(--surface-hover)] rounded-lg">
                          <label className="flex items-center gap-3 py-1.5 min-w-0 flex-1 cursor-pointer">
                            <input
                              type="checkbox"
                              className="prune-check"
                              checked={selected.has(file.path)}
                              onChange={() => toggleFile(file.path)}
                              disabled={removing}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block text-[12.5px] text-[color:var(--text-primary)] truncate select-text">{name}</span>
                              <span className="flex min-w-0 font-mono text-[11px] text-[color:var(--text-muted)] select-text">
                                <span className="truncate min-w-0">{head}</span>
                                <span className="shrink-0">{tail}</span>
                              </span>
                            </span>
                            <span className="shrink-0 text-[12px] text-[color:var(--text-secondary)] tabular-nums w-[72px] text-right">{formatBytes(file.sizeBytes)}</span>
                            <span className="shrink-0 text-[11px] font-mono text-[color:var(--text-muted)] w-[118px] text-right">{formatWhen(file.mtimeMs)}</span>
                          </label>
                          <button
                            type="button"
                            aria-label={t('junkFiles.openFolder', name)}
                            onClick={() => reveal(file.path)}
                            className="inline-flex items-center justify-center w-8 h-8 shrink-0 rounded-lg text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--surface-hover)]"
                          >
                            <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            </svg>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {group.files.length > ROWS_PER_GROUP && (
                    <div className="px-3 pb-2">
                      <button
                        type="button"
                        className="text-[12px] font-medium text-[color:var(--accent-primary)] hover:underline"
                        onClick={() => setExpanded((prev) => {
                          const next = new Set(prev);
                          if (next.has(group.pattern)) next.delete(group.pattern); else next.add(group.pattern);
                          return next;
                        })}
                      >
                        {showAll ? t('junkFiles.group.showFewer') : t('junkFiles.group.showAll', group.files.length.toLocaleString())}
                      </button>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </div>

        <div className="shrink-0 px-6 py-3.5 border-t border-[color:var(--border-subtle)] flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {confirming ? (
            <>
              <p className={`text-[12.5px] max-w-[60ch] ${removalMode === 'delete' ? 'text-[color:var(--danger)]' : 'text-[color:var(--text-primary)]'}`} role="alert">
                {t(`junkFiles.confirm.${removalMode}`, chosen.count.toLocaleString(), formatBytes(chosen.bytes))}
              </p>
              <div className="flex items-center gap-2.5">
                <button ref={cancelButtonRef} type="button" className="btn-ghost px-4 py-2 rounded-lg text-[12.5px] font-medium" onClick={() => setConfirming(false)}>
                  {t('deepClean.confirm.cancel')}
                </button>
                <button type="button" data-testid="junk-confirm" className="btn-danger px-4 py-2 rounded-lg text-[12.5px] font-medium" onClick={runRemoval}>
                  {t(`junkFiles.removeButton.${removalMode}`)}
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="text-[12.5px] text-[color:var(--text-secondary)]" data-testid="junk-selected">
                <span className="text-[color:var(--text-primary)] font-medium">{t('junkFiles.selected', chosen.count.toLocaleString(), formatBytes(chosen.bytes))}</span>
              </span>
              <div className="flex items-center gap-2.5">
                <button type="button" className="btn-ghost px-4 py-2 rounded-lg text-[12.5px] font-medium disabled:opacity-50" onClick={onClose} disabled={removing}>
                  {t('junkFiles.close')}
                </button>
                <button
                  ref={removeButtonRef}
                  type="button"
                  className="btn-danger px-4 py-2 rounded-lg text-[12.5px] font-medium disabled:opacity-50"
                  disabled={chosen.count === 0 || busy}
                  onClick={() => setConfirming(true)}
                >
                  {removing ? t('junkFiles.removing') : t(`junkFiles.removeButton.${removalMode}`)}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}

/** A checkbox with the third, "some ticked" state, which only a script can
 * set on a real input -- kept a real input so it is announced and operated
 * like every other box in the list. */
function GroupCheckbox({ state, label, disabled, onChange }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === 'some';
  }, [state]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className="prune-check"
      aria-label={label}
      checked={state === 'all'}
      disabled={disabled}
      onChange={onChange}
    />
  );
}
