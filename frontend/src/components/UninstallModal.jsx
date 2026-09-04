import { useState } from 'react';
import { scanForLeftovers, scanForcedUninstall, streamUninstall, removeQuarantined, appendHistoryEntry } from '../lib/api.js';
import { deriveSearchTerm } from '../lib/searchTerm.js';
import LeftoverReview from './LeftoverReview.jsx';

/** Shared spinner + live-command UI for both the "running the native
 * uninstaller" and "scanning for leftovers" phases -- same treatment,
 * different label/command text, matching the mockup's own reuse of one
 * progress view for both phases. */
function ProgressPhase({ title, command, progress }) {
  return (
    <div className="flex flex-col items-center justify-center py-10">
      <div className="w-14 h-14 rounded-2xl bg-[color:var(--accent-coral)]/10 border border-[color:var(--accent-coral)]/25 flex items-center justify-center mb-5">
        <div className="w-6 h-6 border-2 border-[color:var(--accent-coral)] border-t-transparent rounded-full animate-spin"></div>
      </div>
      <p className="text-[15px] font-medium mb-1">{title}</p>
      <p className="text-[12.5px] text-[color:var(--text-secondary)] font-mono mb-6 max-w-full truncate px-6">{command}</p>
      <div className="w-full max-w-sm h-1 rounded-full bg-[color:var(--bg-panel)] overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-[color:var(--accent-coral)] to-[#e8624f] transition-all duration-500" style={{ width: `${progress}%` }}></div>
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

export default function UninstallModal({ program, running = false, onClose }) {
  // A program whose own uninstaller can't run doesn't get the normal
  // flow's confirm step at all -- there is nothing to confirm running.
  const broken = program.health?.orphaned === true;
  const [step, setStep] = useState('confirm');
  const [scanResult, setScanResult] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [removal, setRemoval] = useState(null);
  const [error, setError] = useState(null);
  // Editable, because name matching is a heuristic and only the person
  // looking at it knows whether it found the right thing.
  const [searchTerm, setSearchTerm] = useState(() => deriveSearchTerm(program.name));

  const selectEverythingIn = (result) => {
    const keys = [];
    for (const groupKey of ['files', 'registryKeys']) {
      (result[groupKey]?.items || []).forEach((_, i) => keys.push(`${groupKey}:${i}`));
    }
    setSelected(new Set(keys));
  };

  const startUninstall = async () => {
    setError(null);
    setStep('uninstalling');
    try {
      await streamUninstall(program.uninstallString, () => {});
      appendHistoryEntry({ programName: program.name, publisher: program.publisher, sizeBytes: program.sizeBytes }).catch(() => {
        // Best-effort logging -- a failed history write must never block
        // or fail the uninstall flow itself, the uninstall already
        // genuinely succeeded by this point.
      });
      setStep('scanning');
      // The derived term, not program.name -- the ordinary flow had the
      // same defect the forced path did: it searched for the full
      // DisplayName ("TriClaude 0.1.0"), which no folder is ever called,
      // so its leftover sweep found registry keys and never files.
      const result = await scanForLeftovers(deriveSearchTerm(program.name), program.publisher);
      setScanResult(result);
      selectEverythingIn(result);
      setStep('review');
    } catch (err) {
      setError(err.message);
      setStep('confirm');
    }
  };

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
  const handleConfirm = async () => {
    const { files, registryKeys } = selectionToRemoval(scanResult, selected);
    if (files.length === 0 && registryKeys.length === 0) { onClose(); return; }
    setError(null);
    setStep('removing');
    try {
      const manifest = await removeQuarantined({ programName: program.name, files, registryKeys });
      setRemoval(manifest);
      setStep('done');
    } catch (err) {
      setError(err.message);
      setStep('review');
    }
  };

  const command = broken
    ? 'No working uninstaller — searching by name instead'
    : program.uninstallString || 'No uninstall command registered';

  return (
    <div className="glass-panel rounded-2xl overflow-hidden max-w-[680px] w-full flex flex-col">
      <div className="flex items-center justify-between px-6 py-5 border-b border-[color:var(--border-subtle)]">
        <h2 className="text-[15px] font-semibold tracking-tight text-white truncate">
          {broken ? 'Force remove' : 'Uninstall'} {program.name}
        </h2>
        <button onClick={onClose} className="btn-ghost px-3 py-1.5 rounded-lg text-[12px] font-medium">
          Close
        </button>
      </div>
      <div className="px-6 py-6">
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
                  {program.name} is running right now. Close it first — an uninstaller
                  usually fails on a program that is open, and can leave files behind
                  that the next launch recreates.
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
                    {program.health.reason} Windows will keep listing it until the entry is removed.
                  </div>
                </div>
                <p className="text-[13px] text-[color:var(--text-secondary)] mb-4">
                  Prune will search for files and registry keys matching this name, including its
                  Add/Remove Programs entry, and show you everything before removing anything.
                </p>

                <label className="block text-[11px] text-[color:var(--text-muted)] font-mono uppercase tracking-[0.14em] mb-1.5">
                  Search for
                </label>
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[color:var(--bg-panel)] border border-[color:var(--border-subtle)] rounded-xl px-3.5 py-2.5 text-[13px] font-mono focus:outline-none focus:border-[color:var(--accent-coral)] focus:ring-4 focus:ring-[color:var(--accent-coral)]/10 transition"
                />
                <p className="text-[12px] text-[color:var(--text-muted)] mt-1.5 mb-6">
                  {/* Explaining why this differs from the name above matters:
                      otherwise an edited-looking field reads like a bug. */}
                  Taken from "{program.name}" without its version — installers name folders after the
                  product, not the release. Edit it if the results look wrong.
                </p>

                {error && <p className="text-[12.5px] text-[#f7a8b0] mb-4">Scan failed: {error}</p>}
                <button className="btn-primary" onClick={startForcedScan} disabled={!searchTerm.trim()}>
                  Search for leftovers
                </button>
              </>
            ) : (
              <>
                <p className="text-[13px] text-[color:var(--text-secondary)] mb-1">
                  This runs {program.name}'s own uninstaller, then scans for anything it leaves behind.
                </p>
                <p className="text-[11.5px] text-[color:var(--text-muted)] font-mono mb-6 break-all">{command}</p>
                {error && <p className="text-[12.5px] text-[#f7a8b0] mb-4">Uninstall failed: {error}</p>}
                <button className="btn-primary" onClick={startUninstall} disabled={!program.uninstallString}>
                  Start uninstall
                </button>
              </>
            )}
          </div>
        )}
        {step === 'uninstalling' && (
          <ProgressPhase title="Running native uninstaller" command={command} progress={45} />
        )}
        {step === 'scanning' && (
          <ProgressPhase
            title={broken ? 'Searching for leftovers' : 'Scanning for leftovers'}
            command="Checking filesystem, registry & scheduled tasks…"
            progress={85}
          />
        )}
        {step === 'removing' && (
          <ProgressPhase
            title="Moving to Quarantine"
            command="Nothing is deleted — every item can be restored"
            progress={95}
          />
        )}
        {step === 'review' && scanResult && (
          <>
            {error && <p className="text-[12.5px] text-[#f7a8b0] mb-4">Removal failed: {error}</p>}
            <LeftoverReview
              scanResult={scanResult}
              selected={selected}
              onToggle={handleToggle}
              onConfirm={handleConfirm}
              onSkip={onClose}
            />
          </>
        )}
        {step === 'done' && removal && (
          <div className="py-4">
            <div className="flex items-start gap-2.5 mb-5 px-3.5 py-3 rounded-xl bg-[color:var(--success)]/10 border border-[color:var(--success)]/25">
              <div className="text-[12.5px] text-[color:var(--success)] leading-relaxed">
                Moved {removal.files?.length ?? 0} item{removal.files?.length === 1 ? '' : 's'} and{' '}
                {removal.registryKeys?.length ?? 0} registry key{removal.registryKeys?.length === 1 ? '' : 's'} to
                Quarantine, freeing {formatBytes(removal.totalSizeBytes)}. Restore them any time from the
                Quarantine screen.
              </div>
            </div>

            {removal.failedRegistryKeys?.length > 0 && (
              // The one outcome that must never be rounded up to success:
              // a key that wouldn't delete (HKLM keys need admin) means the
              // program is still listed in Add/Remove Programs.
              <div className="flex items-start gap-2.5 mb-5 px-3.5 py-3 rounded-xl bg-[color:var(--warning-soft)] border border-[color:var(--warning)]/25">
                <div className="text-[12.5px] text-[color:var(--warning)] leading-relaxed">
                  <span className="font-semibold">
                    {removal.failedRegistryKeys.length} registry key
                    {removal.failedRegistryKeys.length === 1 ? '' : 's'} couldn't be removed
                  </span>{' '}
                  — these usually need Prune to be running as administrator:
                  <div className="mt-1.5 font-mono text-[11px] text-[color:var(--text-secondary)] break-all">
                    {removal.failedRegistryKeys.join(', ')}
                  </div>
                </div>
              </div>
            )}

            {removal.restorePoint?.created === false && (
              <p className="text-[12px] text-[color:var(--text-muted)] mb-5">
                No system restore point was created ({removal.restorePoint.reason}). The Quarantine
                restore still works.
              </p>
            )}

            <button className="btn-primary" onClick={onClose}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
