import { useEffect, useRef, useState } from 'react';
import { useSingleFlight } from '../hooks/useSingleFlight.js';
import { scanForLeftovers, scanForcedUninstall, streamUninstall, removeQuarantined, appendHistoryEntry } from '../lib/api.js';
import { deriveSearchTerm } from '../lib/searchTerm.js';
import LeftoverReview from './LeftoverReview.jsx';
import { useSettings } from '../hooks/useSystemQueries.js';
import { leftoverDestinationFrom } from '../lib/leftoverDestination.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

/** Shared spinner + live-command UI for both the "running the native
 * uninstaller" and "scanning for leftovers" phases -- same treatment,
 * different label/command text, matching the mockup's own reuse of one
 * progress view for both phases.
 *
 * The bar is indeterminate on purpose. It used to be handed 45, 85 and 95
 * as a width, numbers nobody measured: an uninstaller reports no progress
 * and the scan does not know how many places it has left to look, so those
 * were an invented sense of how far along it was. A sliding segment says
 * "working" and claims nothing, and a progressbar with no value is how that
 * is said to assistive technology. */
function ProgressPhase({ title, command }) {
  return (
    <div className="flex flex-col items-center justify-center py-10" role="status">
      <div className="w-14 h-14 rounded-2xl bg-[color:var(--accent-primary)]/10 border border-[color:var(--accent-primary)]/25 flex items-center justify-center mb-5">
        <div className="w-6 h-6 border-2 border-[color:var(--accent-primary)] border-t-transparent rounded-full animate-spin"></div>
      </div>
      <p className="text-[15px] font-medium mb-1">{title}</p>
      <p className="text-[12.5px] text-[color:var(--text-secondary)] font-mono mb-6 max-w-full truncate px-6">{command}</p>
      <div role="progressbar" aria-label={title} className="relative w-full max-w-sm h-1 rounded-full bg-[color:var(--bg-panel)] overflow-hidden">
        <div className="scan-indeterminate absolute inset-y-0 left-0 rounded-full bg-[color:var(--accent-primary)]" style={{ width: '35%' }}></div>
      </div>
    </div>
  );
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** One sentence for what a removal did, in the words of where it went.
 * Registry keys are backed up in Quarantine whichever destination the
 * files had, and the sentence says so for the two that are not it. */
export const DEFAULT_REMOVAL_SUMMARY_MESSAGES = {
  item: (n) => `${n} item${n === 1 ? '' : 's'}`,
  registryKey: (n) => `${n} registry key${n === 1 ? '' : 's'}`,
  recycle: (files, keys, freed) => `Sent ${files} to the Recycle Bin and removed ${keys}, backed up in Quarantine first. Freed ${freed}.`,
  permanent: (files, keys, freed) => `Deleted ${files} permanently and removed ${keys}, backed up in Quarantine first. Freed ${freed}.`,
  quarantine: (files, keys, freed) => `Moved ${files} and ${keys} to Quarantine, freeing ${freed}. Restore them any time from the Quarantine screen.`
};

export function removalSummary(removal, messages = DEFAULT_REMOVAL_SUMMARY_MESSAGES) {
  const files = messages.item(removal?.files?.length ?? 0);
  const keys = messages.registryKey(removal?.registryKeys?.length ?? 0);
  const freed = formatBytes(removal?.totalSizeBytes);
  if (removal?.destination === 'recycle') return messages.recycle(files, keys, freed);
  if (removal?.destination === 'permanent') return messages.permanent(files, keys, freed);
  return messages.quarantine(files, keys, freed);
}

/** Turns the review's "group:index" selection keys back into the real
 * paths the removal call takes. Scheduled tasks are deliberately absent:
 * the quarantine system moves files and exports registry keys, and there
 * is no equivalent reversible operation for a scheduled task, so they are
 * reported but never removed (LeftoverReview says so on screen). */
export function selectionToRemoval(scanResult, selected) {
  const chosen = (groupKey) =>
    (scanResult[groupKey]?.items || [])
      .filter((_, i) => selected.has(`${groupKey}:${i}`))
      .filter((item) => item.path);

  return {
    files: chosen('files').map((item) => item.path),
    // A whole key travels as a bare path, the way it always has -- there
    // is nothing for an object form to carry, and wrapping it would make
    // new manifests disagree with every quarantine batch already on disk
    // about how the same key is written. A VALUE cannot: a startup entry
    // is one value inside HKCU\...\Run, a key every program that starts
    // with Windows shares, so flattening it to its path would ask the
    // remover to delete all of them.
    registryKeys: chosen('registryKeys').map((item) =>
      item.valueName ? { path: item.path, valueName: item.valueName } : item.path
    )
  };
}

/** How long the real uninstaller may run before the dialog stops insisting on
 * being watched. Vendor uninstallers sometimes wait on a prompt nobody sees
 * (a launcher's "are you sure" window behind this one), and a dialog that can
 * neither be closed nor make progress would trap the person in it. */
export const STALL_MS = 30000;

export default function UninstallModal({ program, running = false, onClose, onBusyChange }) {
  const { t } = useLanguage();

  const REMOVING = {
    quarantine: { title: t('uninstallModal.removing.quarantine.title'), command: t('uninstallModal.removing.quarantine.command') },
    recycle: { title: t('uninstallModal.removing.recycle.title'), command: t('uninstallModal.removing.recycle.command') },
    permanent: { title: t('uninstallModal.removing.permanent.title'), command: t('uninstallModal.removing.permanent.command') }
  };

  // A program whose own uninstaller can't run doesn't get the normal
  // flow's confirm step at all -- there is nothing to confirm running.
  const broken = program.health?.orphaned === true;
  const [step, setStep] = useState('confirm');
  const [scanResult, setScanResult] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [removal, setRemoval] = useState(null);
  const [error, setError] = useState(null);
  // Revo's third checkbox: unticked by default (matching Revo's own
  // default), and read only once, at the moment the scan resolves --
  // ticking it after the scan has already started changes nothing, same
  // as the other two settings this dialog already reads once per run.
  const [autoRemoveLeftovers, setAutoRemoveLeftovers] = useState(false);
  // Editable, because name matching is a heuristic and only the person
  // looking at it knows whether it found the right thing.
  const [searchTerm, setSearchTerm] = useState(() => deriveSearchTerm(program.name));

  // Three settings shape this dialog, each read so that a settings request
  // that failed leaves the dialog behaving exactly as it always did.
  const { settings } = useSettings();
  const destination = leftoverDestinationFrom(settings);
  const preselect = settings?.preselectLeftovers !== false;
  const scanAfter = settings?.scanLeftoversAfterUninstall !== false;
  const [progressTitle, setProgressTitle] = useState(null);

  /* Working, as opposed to waiting on the person. While the real uninstaller
   * runs, or a scan or a removal is in flight, this dialog is the only thing
   * on screen that knows something is happening: closing it does not stop the
   * process, it only hides it. The parent reads this to stop Escape closing
   * the dialog (dismissible={!busy}) and the Close button below refuses for
   * the same reason. Reported through a callback rather than lifted state so
   * the steps stay this component's own business. */
  // After STALL_MS on the uninstaller alone (never on a scan or a removal,
  // which Prune itself is running and which must not be walked away from) the
  // dialog says it is still waiting and lets go of the lock. Closing then only
  // abandons Prune's own follow-up; see `alive` below.
  const [stalled, setStalled] = useState(false);
  useEffect(() => {
    if (step !== 'uninstalling') return undefined;
    const timer = setTimeout(() => setStalled(true), STALL_MS);
    return () => { clearTimeout(timer); setStalled(false); };
  }, [step]);
  const busy = (step === 'uninstalling' && !stalled) || step === 'scanning' || step === 'removing';

  // False once the dialog is gone. The uninstaller outlives a closed dialog;
  // what must not is anything of Prune's: nothing after the process exits may
  // move the dialog on, and the scan and the removal only ever start from a
  // click inside it, so with it unmounted there is nothing left to start them.
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const onBusyChangeRef = useRef(onBusyChange);
  onBusyChangeRef.current = onBusyChange;
  useEffect(() => { onBusyChangeRef.current?.(busy); }, [busy]);
  // A dialog that goes away must not leave the parent believing it is busy.
  useEffect(() => () => onBusyChangeRef.current?.(false), []);

  // Decision 4: the "remove everything without reviewing" shortcut exists
  // only when the leftovers go to Quarantine, where a wrong match can be put
  // back. For the Recycle Bin and permanent deletion the review is the
  // safety, so the shortcut is not offered -- and it is ignored here as well
  // as hidden, so a box ticked before the setting changed cannot skip it.
  const autoRemoveOffered = destination === 'quarantine';

  // Every "group:index" key a scan result contains, regardless of any
  // setting -- the one shape both selectEverythingIn (gated by the
  // preselectLeftovers setting) and the auto-remove path (which ignores
  // that setting on purpose: "remove ALL found leftovers" means literally
  // everything) need to build.
  const allFoundIn = (result) => {
    const keys = [];
    for (const groupKey of ['files', 'registryKeys']) {
      (result[groupKey]?.items || []).forEach((_, i) => keys.push(`${groupKey}:${i}`));
    }
    return new Set(keys);
  };

  const selectEverythingIn = (result) => {
    // Revo's "Check mark all leftovers by default", which it ships off.
    // Prune keeps its behaviour unless the user turns it off.
    if (!preselect) { setSelected(new Set()); return; }
    setSelected(allFoundIn(result));
  };

  /* Single-flight: this runs the program's real uninstaller, and its only
   * protection was the confirm view unmounting on setStep. The most
   * destructive click in the app deserves a guard that does not depend on
   * a re-render winning a race with a second click. */
  const startUninstall = useSingleFlight(async () => {
    setError(null);
    setStep('uninstalling');
    try {
      await streamUninstall(program.id, (type, data) => {
        // The before-uninstall steps announce themselves, so the dialog
        // says what it is waiting on instead of "running the uninstaller"
        // through a registry backup.
        if (type === 'preUninstall') {
          setProgressTitle(data?.step === 'registryBackup' ? t('uninstallModal.progress.backingUpRegistry') : t('uninstallModal.progress.creatingRestorePoint'));
        } else if (type !== 'restorePoint' && type !== 'registryBackup') {
          setProgressTitle(null);
        }
      });
      // Recorded even if the dialog was closed while it ran: the program
      // really was uninstalled, and this is a log of that, not a next step.
      appendHistoryEntry({ programName: program.name, publisher: program.publisher, sizeBytes: program.sizeBytes }).catch(() => {
        // Best-effort logging -- a failed history write must never block
        // or fail the uninstall flow itself, the uninstall already
        // genuinely succeeded by this point.
      });
      if (!alive.current) return;
      if (!scanAfter) { setStep('noScan'); return; }
      // Revo's own screen after the real uninstaller runs: it does not
      // race into a scan the instant the spawned process exits, because
      // that process returning is not proof the program's own uninstall
      // work (background services, async cleanup) is actually done yet.
      // The person confirms readiness themselves with an explicit click.
      setStep('readyToScan');
    } catch (err) {
      if (!alive.current) return;
      setError(err.message);
      setStep('confirm');
    }
  });

  /* Single-flight for the same reason startUninstall is: the click that
   * fires the leftover scan should not be able to fire it twice. Its
   * failure path returns to 'readyToScan', not 'confirm' -- the real
   * uninstall already ran and succeeded; only the scan itself failed and
   * can be retried without touching the program again. */
  const startScan = useSingleFlight(async () => {
    setError(null);
    setStep('scanning');
    try {
      // The derived term, not program.name -- the ordinary flow had the
      // same defect the forced path did: it searched for the full
      // DisplayName ("TriClaude 0.1.0"), which no folder is ever called,
      // so its leftover sweep found registry keys and never files.
      const result = await scanForLeftovers(deriveSearchTerm(program.name), program.publisher);
      setScanResult(result);
      // Revo's "Automatically delete all found leftovers": skip the manual
      // review screen and remove everything the scan just found, straight
      // away. It still goes through the exact same quarantine call the
      // manual review's own confirm button does -- this only skips the
      // SELECTION step, not the safety of the removal itself.
      if (autoRemoveLeftovers && autoRemoveOffered) {
        const full = allFoundIn(result);
        setSelected(full);
        setStep('removing');
        try {
          const { files, registryKeys } = selectionToRemoval(result, full);
          const manifest = await removeQuarantined({ programName: program.name, files, registryKeys, destination });
          setRemoval(manifest);
          setStep('done');
        } catch (err) {
          setError(err.message);
          setStep('review');
        }
        return;
      }
      selectEverythingIn(result);
      setStep('review');
    } catch (err) {
      setError(err.message);
      setStep('readyToScan');
    }
  });

  const startForcedScan = async () => {
    setError(null);
    setStep('scanning');
    try {
      const result = await scanForcedUninstall({
        name: searchTerm.trim(),
        publisher: program.publisher,
        registryKey: program.registryKey
      });
      setScanResult(result);
      selectEverythingIn(result);
      setStep('review');
    } catch (err) {
      setError(err.message);
      setStep('confirm');
    }
  };

  const handleToggle = (key) => {
    const newSelected = new Set(selected);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelected(newSelected);
  };

  /** This used to close the modal without removing anything -- the flow
   * scanned for leftovers, listed them, and then dropped them on the
   * floor. It now performs the removal it has been offering all along,
   * through the same quarantine call (moved and exported, never deleted)
   * that a restore can undo. */
  /* Single-flight for the same reason the batch run is: the only thing
   * stopping a second click was this view unmounting when the phase
   * changed, which is a rendering side effect standing in for a guard.
   * This one creates a quarantine batch, so a second pass would make a
   * second batch and then fail finding the files already moved. */
  const handleConfirm = useSingleFlight(async () => {
    const { files, registryKeys } = selectionToRemoval(scanResult, selected);
    if (files.length === 0 && registryKeys.length === 0) { onClose(); return; }
    setError(null);
    setStep('removing');
    try {
      const manifest = await removeQuarantined({ programName: program.name, files, registryKeys, destination });
      setRemoval(manifest);
      setStep('done');
    } catch (err) {
      setError(err.message);
      setStep('review');
    }
  });

  const command = broken
    ? t('uninstallModal.noWorkingUninstaller')
    : program.uninstallString || t('uninstallModal.noUninstallCommand');

  return (
    /* Height capped and the body scrolls: the leftover review can be as long
       as the scan is thorough, and at 900x600 an uncapped panel pushed its
       own Remove and Skip buttons off the bottom of the window. */
    <div data-modal-panel className="glass-panel rounded-2xl overflow-hidden max-w-[680px] w-full flex flex-col max-h-[85vh]">
      <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-[color:var(--border-subtle)] shrink-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-[color:var(--text-primary)] truncate">
          {broken ? t('uninstallModal.titleForce', program.name) : t('uninstallModal.titleNormal', program.name)}
        </h2>
        <button
          onClick={onClose}
          disabled={busy}
          className="btn-ghost px-3 py-1.5 rounded-lg text-[12px] font-medium disabled:opacity-40"
        >
          {t('uninstallModal.close')}
        </button>
      </div>
      <div data-modal-body className="px-6 py-5 overflow-y-auto min-h-0">
        {step === 'confirm' && (
          <div>
            {/* Where the warning actually bites. Revo warns before
                uninstalling something that is open, because an uninstaller
                for a running program either fails outright or
                half-succeeds and leaves files the next launch recreates.
                Stated, not enforced: only the person looking at it knows
                whether the process it found is the part that matters. */}
            {running && (
              <div className="flex items-start gap-2.5 mb-5 px-3.5 py-3 rounded-xl bg-[color:var(--warning-soft)] border border-[color:var(--warning)]/25">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-[color:var(--warning)] mt-0.5 shrink-0">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <div className="text-[12.5px] text-[color:var(--warning)] leading-relaxed">
                  {t('uninstallModal.runningWarning', program.name)}
                </div>
              </div>
            )}
            {broken ? (
              <>
                <div className="flex items-start gap-2.5 mb-5 px-3.5 py-3 rounded-xl bg-[color:var(--warning-soft)] border border-[color:var(--warning)]/25">
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-[color:var(--warning)] mt-0.5 shrink-0">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  <div className="text-[12.5px] text-[color:var(--warning)] leading-relaxed">
                    {t('uninstallModal.orphanedWarning', program.health.reason)}
                  </div>
                </div>
                <p className="text-[13px] text-[color:var(--text-secondary)] mb-4">
                  {t('uninstallModal.brokenIntro')}
                </p>

                <label className="block text-[11px] text-[color:var(--text-muted)] font-mono uppercase tracking-[0.14em] mb-1.5">
                  {t('uninstallModal.searchForLabel')}
                </label>
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[color:var(--bg-panel)] border border-[color:var(--border-subtle)] rounded-xl px-3.5 py-2.5 text-[13px] font-mono focus:outline-none focus:border-[color:var(--accent-primary)] focus:ring-4 focus:ring-[color:var(--accent-primary)]/10 transition"
                />
                <p className="text-[12px] text-[color:var(--text-muted)] mt-1.5 mb-6">
                  {t('uninstallModal.searchHint', program.name)}
                </p>

                {error && <p className="text-[12.5px] text-[color:var(--danger)] mb-4 select-text">{t('uninstallModal.scanFailed', error)}</p>}
                <button className="btn-primary" onClick={startForcedScan} disabled={!searchTerm.trim()}>
                  {t('uninstallModal.searchButton')}
                </button>
              </>
            ) : (
              <>
                <p className="text-[13px] text-[color:var(--text-secondary)] mb-1">
                  {t('uninstallModal.normalIntro', program.name)}
                </p>
                <p className="text-[11.5px] text-[color:var(--text-muted)] font-mono mb-6 break-all select-text">{command}</p>
                {error && <p className="text-[12.5px] text-[color:var(--danger)] mb-4 select-text">{t('uninstallModal.uninstallFailed', error)}</p>}
                {autoRemoveOffered && (
                  <label className="flex items-center gap-2.5 mb-5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoRemoveLeftovers}
                      onChange={(e) => setAutoRemoveLeftovers(e.target.checked)}
                      className="w-[15px] h-[15px] accent-[color:var(--accent-primary)] cursor-pointer"
                    />
                    <span className="text-[12.5px] text-[color:var(--text-secondary)]">{t('uninstallModal.autoRemoveLeftovers')}</span>
                  </label>
                )}
                <button className="btn-primary" onClick={startUninstall} disabled={!program.uninstallString}>
                  {t('uninstallModal.startButton')}
                </button>
              </>
            )}
          </div>
        )}
        {step === 'uninstalling' && (
          <>
            <ProgressPhase title={progressTitle || t('uninstallModal.progress.runningNative')} command={command} />
            {stalled && (
              <p role="status" data-still-waiting className="text-[12.5px] text-[color:var(--text-secondary)] text-center -mt-4 pb-2 px-4">
                {t('uninstallModal.stillWaiting')}
              </p>
            )}
          </>
        )}
        {step === 'readyToScan' && (
          <div className="py-4">
            <p className="text-[13px] text-[color:var(--text-secondary)] mb-5">
              {t('uninstallModal.readyToScan.body', program.name)}
            </p>
            {error && <p className="text-[12.5px] text-[color:var(--danger)] mb-4 select-text">{t('uninstallModal.scanFailed', error)}</p>}
            <div className="flex items-center gap-2.5">
              <button className="btn-primary" onClick={startScan}>{t('uninstallModal.readyToScan.scanButton')}</button>
              <button className="btn-ghost px-3 py-1.5 rounded-lg text-[12px] font-medium" onClick={onClose}>{t('uninstallModal.close')}</button>
            </div>
          </div>
        )}
        {step === 'scanning' && (
          <ProgressPhase
            title={broken ? t('uninstallModal.progress.searchingLeftovers') : t('uninstallModal.progress.scanningLeftovers')}
            command={t('uninstallModal.progress.checkingCommand')}
          />
        )}
        {step === 'removing' && (
          <ProgressPhase
            title={REMOVING[destination].title}
            command={REMOVING[destination].command}
          />
        )}
        {step === 'noScan' && (
          <div className="py-4">
            <p className="text-[13px] text-[color:var(--text-secondary)] mb-5">
              {t('uninstallModal.noScan', program.name)}
            </p>
            <button className="btn-primary" onClick={onClose}>{t('uninstallModal.done')}</button>
          </div>
        )}
        {step === 'review' && scanResult && (
          <>
            {error && <p className="text-[12.5px] text-[color:var(--danger)] mb-4 select-text">{t('uninstallModal.removalFailed', error)}</p>}
            <LeftoverReview
              scanResult={scanResult}
              selected={selected}
              onToggle={handleToggle}
              onConfirm={handleConfirm}
              onSkip={onClose}
              destination={destination}
            />
          </>
        )}
        {step === 'done' && removal && (
          <div className="py-4">
            <div className="flex items-start gap-2.5 mb-5 px-3.5 py-3 rounded-xl bg-[color:var(--success)]/10 border border-[color:var(--success)]/25">
              <div className="text-[12.5px] text-[color:var(--success)] leading-relaxed">
                {removalSummary(removal, t('uninstallModal.summary'))}
              </div>
            </div>

            {removal.failedFiles?.length > 0 && (
              // Refused by the guard, locked, or already being deleted by
              // something else. Named, never folded into the total.
              <div className="mb-5 px-3.5 py-3 rounded-xl bg-[color:var(--warning-soft)] border border-[color:var(--warning)]/25 text-[12.5px] text-[color:var(--warning)]">
                <p>{t('uninstallModal.failedFilesHeading', removal.failedFiles.length)}</p>
                {removal.failedFiles.map((f) => (
                  <p key={f.path} className="mt-1 font-mono text-[11px] text-[color:var(--text-secondary)] break-all select-text">{`${f.path} — ${f.reason}`}</p>
                ))}
              </div>
            )}

            {removal.failedRegistryKeys?.length > 0 && (
              // The one outcome that must never be rounded up to success:
              // a key that wouldn't delete (HKLM keys need admin) means the
              // program is still listed in Add/Remove Programs.
              <div className="flex items-start gap-2.5 mb-5 px-3.5 py-3 rounded-xl bg-[color:var(--warning-soft)] border border-[color:var(--warning)]/25">
                <div className="text-[12.5px] text-[color:var(--warning)] leading-relaxed">
                  <span className="font-semibold">
                    {t('uninstallModal.failedRegistryKeysHeading', removal.failedRegistryKeys.length)}
                  </span>{' '}
                  {t('uninstallModal.failedRegistryKeysNote')}
                  <div className="mt-1.5 font-mono text-[11px] text-[color:var(--text-secondary)] break-all">
                    {removal.failedRegistryKeys.join(', ')}
                  </div>
                </div>
              </div>
            )}

            {removal.restorePoint?.created === false && (
              <p className="text-[12px] text-[color:var(--text-muted)] mb-5">
                {t('uninstallModal.noRestorePoint', removal.restorePoint.reason)}
                {!removal.destination || removal.destination === 'quarantine' ? ` ${t('uninstallModal.quarantineStillWorks')}` : ''}
              </p>
            )}

            <button className="btn-primary" onClick={onClose}>{t('uninstallModal.done')}</button>
          </div>
        )}
      </div>
    </div>
  );
}
