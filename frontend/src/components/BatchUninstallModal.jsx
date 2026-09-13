import { useMemo, useState } from 'react';
import { useSingleFlight } from '../hooks/useSingleFlight.js';
import { streamUninstall, removeStoreApp, scanForLeftovers, removeQuarantined, appendHistoryEntry } from '../lib/api.js';
import { deriveSearchTerm } from '../lib/searchTerm.js';
import { mergeLeftovers } from '../lib/mergeLeftovers.js';
import { batchSummary } from '../lib/batchSelection.js';
import { orderBatch } from '../lib/batchOrder.js';
import LeftoverReview from './LeftoverReview.jsx';
import { selectionToRemoval } from './UninstallModal.jsx';
import { useSettings } from '../hooks/useSystemQueries.js';
import { leftoverDestinationFrom } from '../lib/leftoverDestination.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

/** What a batch did, in the words of where its leftovers went. */
export const DEFAULT_BATCH_SUMMARY_MESSAGES = {
  programs: (n) => `${n} program${n === 1 ? '' : 's'}`,
  items: (n) => `${n} leftover item${n === 1 ? '' : 's'}`,
  recycle: (programs, items, freed) => `Uninstalled ${programs} and sent ${items} to the Recycle Bin, freeing ${freed}.`,
  permanent: (programs, items, freed) => `Uninstalled ${programs} and deleted ${items} permanently, freeing ${freed}.`,
  quarantine: (programs, items, freed) => `Uninstalled ${programs} and moved ${items} to Quarantine, freeing ${freed}.`
};

function batchRemovalSummary(programCount, removal, messages = DEFAULT_BATCH_SUMMARY_MESSAGES) {
  const n = removal?.files?.length ?? 0;
  const programsText = messages.programs(programCount);
  const items = messages.items(n);
  const freed = formatBytes(removal?.totalSizeBytes);
  if (removal?.destination === 'recycle') return messages.recycle(programsText, items, freed);
  if (removal?.destination === 'permanent') return messages.permanent(programsText, items, freed);
  return messages.quarantine(programsText, items, freed);
}

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const STATUS_STYLE = {
  pending: 'text-[color:var(--text-muted)]',
  running: 'text-[color:var(--accent-primary)]',
  done: 'text-[color:var(--success)]',
  failed: 'text-[color:var(--danger)]'
};

/** Runs several uninstallers in turn, then reviews everything they left
 * behind in one pass.
 *
 * Sequential, never parallel, and not as a matter of taste: Windows
 * Installer holds a machine-wide mutex, so a second MSI uninstall
 * starting while one is in flight simply fails. Running these
 * concurrently would produce failures that look like the programs'
 * fault.
 *
 * One program failing doesn't stop the queue. A batch that abandoned the
 * remaining nine because the first one errored would be worse than
 * uninstalling them one at a time. */
export default function BatchUninstallModal({ programs, onClose, onFinished }) {
  const { t } = useLanguage();

  const REMOVING_LINE = {
    quarantine: t('batchUninstallModal.removingLine.quarantine'),
    recycle: t('batchUninstallModal.removingLine.recycle'),
    permanent: t('batchUninstallModal.removingLine.permanent')
  };
  const STATUS_LABEL = {
    pending: t('batchUninstallModal.status.waiting'),
    running: t('batchUninstallModal.status.uninstalling'),
    done: t('batchUninstallModal.status.removed'),
    failed: t('batchUninstallModal.status.failed')
  };

  const [phase, setPhase] = useState('confirm');
  const [statuses, setStatuses] = useState(() =>
    Object.fromEntries(programs.map((p) => [p.id, { state: 'pending' }]))
  );
  const [leftovers, setLeftovers] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [removal, setRemoval] = useState(null);
  const [error, setError] = useState(null);
  // How many leftover scans the batch actually ran. Zero is not the same
  // as "ran and found nothing" -- see the review phase below.
  const [scanCount, setScanCount] = useState(0);

  // The same three settings the single-program dialog follows, read the
  // same way: a failed settings request leaves the batch as it always was.
  const { settings } = useSettings();
  const destination = leftoverDestinationFrom(settings);
  const preselect = settings?.preselectLeftovers !== false;
  const scanAfter = settings?.scanLeftoversAfterUninstall !== false;

  const summary = batchSummary(programs);

  /* Dependents before the program they uninstall through. A Steam game's
   * uninstall command IS steam.exe, so removing Steam first would leave
   * the game with an uninstaller that no longer exists -- see
   * lib/batchOrder.js for how that relationship is recognised.
   *
   * Computed once and used for BOTH the list shown and the loop that runs.
   * A confirm list in one order and a queue in another would be the worst
   * of both: it would promise an order and then not keep it. */
  const { ordered, runsBefore } = useMemo(() => orderBatch(programs), [programs]);
  const storeCount = programs.filter((program) => program.source === 'store').length;
  const registryCount = programs.length - storeCount;
  const setStatus = (id, value) => setStatuses((prev) => ({ ...prev, [id]: value }));

  /* Single-flight, because the only thing stopping a second click was
   * this button unmounting when setPhase('running') re-rendered. That is
   * a rendering side effect standing in for a guard: it holds while the
   * re-render beats the second click and says nothing about what happens
   * when it does not. This is a loop that uninstalls N programs, so a
   * second pass would run every one of them again. */
  const runBatch = useSingleFlight(async () => {
    setPhase('running');
    const scans = [];

    for (const program of ordered) {
      setStatus(program.id, { state: 'running' });
      try {
        // A Store app has no registered uninstall command for the stream to
        // run. It goes through Remove-AppxPackage instead, by package name,
        // the same call the single-app dialog makes.
        if (program.source === 'store') {
          await removeStoreApp(program.packageFullName);
        } else {
          await streamUninstall(program.id, () => {});
        }
        appendHistoryEntry({
          programName: program.name,
          publisher: program.publisher,
          sizeBytes: program.sizeBytes
        }).catch(() => { /* logging must never fail an uninstall that worked */ });
        setStatus(program.id, { state: 'done' });

        // Scan straight after each one rather than all at the end: the
        // program's own files are freshest now, and a later uninstaller
        // could remove a shared folder this one still had.
        //
        // Not for a Store app. The scan matches on publisher, and 68 of the
        // 81 Store apps on the dev machine are published by Microsoft
        // Corporation -- a publisher search for that would offer to
        // quarantine a large part of Windows.
        if (program.source !== 'store' && scanAfter) {
          const scan = await scanForLeftovers(deriveSearchTerm(program.name), program.publisher);
          scans.push({ program: program.name, scan });
        }
      } catch (err) {
        // Recorded and skipped. The rest of the queue still runs.
        setStatus(program.id, { state: 'failed', message: err.message });
      }
    }

    setScanCount(scans.length);
    const merged = mergeLeftovers(scans);
    setLeftovers(merged);
    const keys = [];
    for (const group of ['files', 'registryKeys']) {
      (merged[group]?.items || []).forEach((_, i) => keys.push(`${group}:${i}`));
    }
    setSelected(new Set(preselect ? keys : []));
    setPhase('review');
  });

  /* Single-flight for the same reason the batch run is: the only thing
   * stopping a second click was this view unmounting when the phase
   * changed, which is a rendering side effect standing in for a guard.
   * This one creates a quarantine batch, so a second pass would make a
   * second batch and then fail finding the files already moved. */
  const handleRemoveLeftovers = useSingleFlight(async () => {
    const { files, registryKeys } = selectionToRemoval(leftovers, selected);
    if (files.length === 0 && registryKeys.length === 0) {
      onFinished?.();
      onClose();
      return;
    }
    setPhase('removing');
    setError(null);
    try {
      const manifest = await removeQuarantined({
        programName: t('batchUninstallModal.historyLabel', programs.length),
        files,
        registryKeys,
        destination
      });
      setRemoval(manifest);
      setPhase('done');
    } catch (err) {
      setError(err.message);
      setPhase('review');
    }
  });

  const handleToggle = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const failed = programs.filter((p) => statuses[p.id]?.state === 'failed');
  const removed = programs.filter((p) => statuses[p.id]?.state === 'done');

  return (
    <div className="glass-panel rounded-2xl overflow-hidden max-w-[720px] w-full flex flex-col max-h-[85vh]">
      <div className="flex items-center justify-between px-6 py-5 border-b border-[color:var(--border-subtle)] shrink-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-[color:var(--text-primary)]">
          {t('batchUninstallModal.title', programs.length)}
        </h2>
        <button
          onClick={onClose}
          disabled={phase === 'running' || phase === 'removing'}
          className="btn-ghost px-3 py-1.5 rounded-lg text-[12px] font-medium disabled:opacity-40"
        >
          {t('batchUninstallModal.close')}
        </button>
      </div>

      <div className="px-6 py-5 overflow-y-auto min-h-0">
        {phase === 'confirm' && (
          <>
            {/* What will actually happen, which depends on what was ticked.
                These lines were written for the registry path -- an
                uninstaller, then a leftover scan -- and a Store app gets
                neither, so a batch of only Store apps was promised both. */}
            {registryCount === 0 ? (
              <p className="text-[13px] text-[color:var(--text-secondary)] mb-5">
                {t('batchUninstallModal.registryOnlyIntro')}
              </p>
            ) : (
              <>
                <p className="text-[13px] text-[color:var(--text-secondary)] mb-1.5">
                  {t('batchUninstallModal.mixedIntro', storeCount > 0)}
                </p>
                <p className="text-[12px] text-[color:var(--text-muted)] mb-5">
                  {/* Worth saying plainly: it is the reason this takes a while
                      and the reason some of them will open their own windows. */}
                  {t('batchUninstallModal.oneAtATime')}
                </p>
              </>
            )}

            {/* Everything else here goes through Quarantine, and the line
                above promises Prune shows everything before removing any
                of it. A Store removal is the exception to both, so it is
                said here, where the decision is made. */}
            {storeCount > 0 && (
              <p className="text-[12px] text-[color:var(--warning)] mb-5">
                {t('batchUninstallModal.storeWarning', storeCount)}
              </p>
            )}

            <div className="rounded-xl border border-[color:var(--border-subtle)] divide-y divide-[color:var(--border-subtle)] mb-5">
              {ordered.map((program) => (
                <div key={program.id} className="flex items-center justify-between gap-4 px-3.5 py-2">
                  <span className="flex items-baseline gap-2 min-w-0">
                    <span className="text-[12.5px] truncate">{program.name}</span>
                    {/* Said against the program that moved. A list that comes
                        back in a different order from the one ticked looks
                        like a bug unless it says why. */}
                    {runsBefore[program.id] && (
                      <span className="text-[11px] text-[color:var(--text-muted)] shrink-0">
                        {t('batchUninstallModal.runsBefore', runsBefore[program.id])}
                      </span>
                    )}
                  </span>
                  <span className="text-[11.5px] font-mono text-[color:var(--text-muted)] shrink-0">
                    {formatBytes(program.sizeBytes)}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-[12.5px] text-[color:var(--text-secondary)]">
                {t('batchUninstallModal.reported', formatBytes(summary.totalBytes))}
                {summary.unknownSizes > 0 && t('batchUninstallModal.unknownSizeSuffix', summary.unknownSizes)}
              </span>
              <button className="btn-primary px-5 py-2 text-[12.5px] font-medium" onClick={runBatch}>
                {t('batchUninstallModal.startButton')}
              </button>
            </div>
          </>
        )}

        {(phase === 'running' || phase === 'removing') && (
          <div className="space-y-1.5">
            {ordered.map((program) => {
              const status = statuses[program.id] || { state: 'pending' };
              return (
                <div key={program.id} className="flex items-center justify-between gap-4 px-3.5 py-2 rounded-lg bg-[color:var(--surface-subtle)]">
                  <span className="text-[12.5px] truncate">{program.name}</span>
                  <span className={`text-[11.5px] font-mono shrink-0 ${STATUS_STYLE[status.state]}`}>
                    {STATUS_LABEL[status.state]}
                  </span>
                </div>
              );
            })}
            {phase === 'removing' && (
              <p className="text-[12.5px] text-[color:var(--text-secondary)] pt-3">
                {REMOVING_LINE[destination]}
              </p>
            )}
          </div>
        )}

        {phase === 'review' && leftovers && (
          <>
            <div className="flex items-center gap-2.5 mb-4 px-3.5 py-3 rounded-xl bg-[color:var(--success)]/10 border border-[color:var(--success)]/25">
              <p className="text-[12.5px] text-[color:var(--success)]">
                {t('batchUninstallModal.uninstalledOf', removed.length, programs.length)}
              </p>
            </div>

            {failed.length > 0 && (
              <div className="mb-4 px-3.5 py-3 rounded-xl bg-[color:var(--danger-soft)] border border-[color:var(--danger)]/25">
                <p className="text-[12.5px] text-[color:var(--danger)] mb-1">
                  {t('batchUninstallModal.failedHeading', failed.length)}
                </p>
                {failed.map((p) => (
                  <p key={p.id} className="text-[11.5px] font-mono text-[color:var(--text-secondary)] select-text">
                    {p.name} — {statuses[p.id]?.message}
                  </p>
                ))}
              </div>
            )}

            {error && (
              <p className="text-[12.5px] text-[color:var(--danger)] mb-4 select-text">{t('batchUninstallModal.removeLeftoversFailed', error)}</p>
            )}

            {/* LeftoverReview reads an empty result as "No leftovers found --
                clean uninstall". With no scan run at all -- a batch of only
                Store apps, or one where every uninstall failed -- the result
                is empty for a different reason, and that sentence would
                claim a check that never happened. */}
            {scanCount === 0 ? (
              <div className="text-center py-6">
                {!scanAfter && removed.some((p) => p.source !== 'store') && (
                  <p className="text-[13px] text-[color:var(--text-secondary)] mb-4">
                    {t('batchUninstallModal.noScanSettingsOff')}
                  </p>
                )}
                {removed.some((p) => p.source === 'store') && (
                  <p className="text-[13px] text-[color:var(--text-secondary)] mb-4">
                    {t('batchUninstallModal.noScanStore')}
                  </p>
                )}
                <button className="btn-primary" onClick={() => { onFinished?.(); onClose(); }}>{t('batchUninstallModal.done')}</button>
              </div>
            ) : (
              <LeftoverReview
                scanResult={leftovers}
                selected={selected}
                onToggle={handleToggle}
                onConfirm={handleRemoveLeftovers}
                destination={destination}
                onSkip={() => { onFinished?.(); onClose(); }}
              />
            )}
          </>
        )}

        {phase === 'done' && removal && (
          <div>
            <div className="flex items-start gap-2.5 mb-5 px-3.5 py-3 rounded-xl bg-[color:var(--success)]/10 border border-[color:var(--success)]/25">
              <div className="text-[12.5px] text-[color:var(--success)] leading-relaxed">
                {batchRemovalSummary(removed.length, removal, t('batchUninstallModal.summary'))}
              </div>
            </div>

            {/* Verified by testing the round-trip on this machine: a
                System Restore point needs administrator, so unelevated it
                fails every time with "Access denied". Saying nothing here
                would imply a safety net that isn't there -- the Quarantine
                is, and it restores byte-for-byte, which is what this says
                instead. */}
            {removal.restorePoint?.created === false && (
              <p className="text-[12px] text-[color:var(--text-muted)] mb-5">
                {t('batchUninstallModal.noRestorePoint', removal.restorePoint.reason?.trim() || t('batchUninstallModal.restorePointFallback'))}
                {!removal.destination || removal.destination === 'quarantine' ? t('batchUninstallModal.quarantineNote') : ''}
              </p>
            )}

            {removal.failedRegistryKeys?.length > 0 && (
              <div className="mb-5 px-3.5 py-3 rounded-xl bg-[color:var(--warning-soft)] border border-[color:var(--warning)]/25">
                <p className="text-[12.5px] text-[color:var(--warning)]">
                  {t('batchUninstallModal.failedRegistryKeys', removal.failedRegistryKeys.length)}
                </p>
              </div>
            )}

            <button className="btn-primary" onClick={() => { onFinished?.(); onClose(); }}>{t('batchUninstallModal.done')}</button>
          </div>
        )}
      </div>
    </div>
  );
}
