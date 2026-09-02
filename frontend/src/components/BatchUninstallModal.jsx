import { useState } from 'react';
import { streamUninstall, scanForLeftovers, removeQuarantined, appendHistoryEntry } from '../lib/api.js';
import { deriveSearchTerm } from '../lib/searchTerm.js';
import { mergeLeftovers } from '../lib/mergeLeftovers.js';
import { batchSummary } from '../lib/batchSelection.js';
import LeftoverReview from './LeftoverReview.jsx';
import { selectionToRemoval } from './UninstallModal.jsx';

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
  running: 'text-[color:var(--accent-coral)]',
  done: 'text-[color:var(--success)]',
  failed: 'text-[color:var(--danger)]'
};

const STATUS_LABEL = {
  pending: 'waiting',
  running: 'uninstalling…',
  done: 'removed',
  failed: 'failed'
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
  const [phase, setPhase] = useState('confirm');
  const [statuses, setStatuses] = useState(() =>
    Object.fromEntries(programs.map((p) => [p.id, { state: 'pending' }]))
  );
  const [leftovers, setLeftovers] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [removal, setRemoval] = useState(null);
  const [error, setError] = useState(null);

  const summary = batchSummary(programs);
  const setStatus = (id, value) => setStatuses((prev) => ({ ...prev, [id]: value }));

  const runBatch = async () => {
    setPhase('running');
    const scans = [];

    for (const program of programs) {
      setStatus(program.id, { state: 'running' });
      try {
        await streamUninstall(program.uninstallString, () => {});
        appendHistoryEntry({
          programName: program.name,
          publisher: program.publisher,
          sizeBytes: program.sizeBytes
        }).catch(() => { /* logging must never fail an uninstall that worked */ });
        setStatus(program.id, { state: 'done' });

        // Scan straight after each one rather than all at the end: the
        // program's own files are freshest now, and a later uninstaller
        // could remove a shared folder this one still had.
        const scan = await scanForLeftovers(deriveSearchTerm(program.name), program.publisher);
        scans.push({ program: program.name, scan });
      } catch (err) {
        // Recorded and skipped. The rest of the queue still runs.
        setStatus(program.id, { state: 'failed', message: err.message });
      }
    }

    const merged = mergeLeftovers(scans);
    setLeftovers(merged);
    const keys = [];
    for (const group of ['files', 'registryKeys']) {
      (merged[group]?.items || []).forEach((_, i) => keys.push(`${group}:${i}`));
    }
    setSelected(new Set(keys));
    setPhase('review');
  };

  const handleRemoveLeftovers = async () => {
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
        programName: `Batch uninstall: ${programs.length} programs`,
        files,
        registryKeys
      });
      setRemoval(manifest);
      setPhase('done');
    } catch (err) {
      setError(err.message);
      setPhase('review');
    }
  };

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
        <h2 className="text-[15px] font-semibold tracking-tight text-white">
          Uninstall {programs.length} program{programs.length === 1 ? '' : 's'}
        </h2>
        <button
          onClick={onClose}
          disabled={phase === 'running' || phase === 'removing'}
          className="btn-ghost px-3 py-1.5 rounded-lg text-[12px] font-medium disabled:opacity-40"
        >
          Close
        </button>
      </div>

      <div className="px-6 py-5 overflow-y-auto min-h-0">
        {phase === 'confirm' && (
          <>
            <p className="text-[13px] text-[color:var(--text-secondary)] mb-1.5">
              Each program's own uninstaller runs in turn, then Prune scans for what they leave
              behind and shows you everything before removing any of it.
            </p>
            <p className="text-[12px] text-[color:var(--text-muted)] mb-5">
              {/* Worth saying plainly: it is the reason this takes a while
                  and the reason some of them will open their own windows. */}
              One at a time, because Windows only allows one install or uninstall at once. Some
              uninstallers will show their own windows and ask you questions.
            </p>

            <div className="rounded-xl border border-[color:var(--border-subtle)] divide-y divide-[color:var(--border-subtle)] mb-5">
              {programs.map((program) => (
                <div key={program.id} className="flex items-center justify-between gap-4 px-3.5 py-2">
                  <span className="text-[12.5px] truncate">{program.name}</span>
                  <span className="text-[11.5px] font-mono text-[color:var(--text-muted)] shrink-0">
                    {formatBytes(program.sizeBytes)}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-[12.5px] text-[color:var(--text-secondary)]">
                {formatBytes(summary.totalBytes)} reported
                {summary.unknownSizes > 0 && `, ${summary.unknownSizes} of unknown size`}
              </span>
              <button className="btn-primary px-5 py-2 text-[12.5px] font-medium" onClick={runBatch}>
                Start uninstalling
              </button>
            </div>
          </>
        )}

        {(phase === 'running' || phase === 'removing') && (
          <div className="space-y-1.5">
            {programs.map((program) => {
              const status = statuses[program.id] || { state: 'pending' };
              return (
                <div key={program.id} className="flex items-center justify-between gap-4 px-3.5 py-2 rounded-lg bg-white/[0.02]">
                  <span className="text-[12.5px] truncate">{program.name}</span>
                  <span className={`text-[11.5px] font-mono shrink-0 ${STATUS_STYLE[status.state]}`}>
                    {STATUS_LABEL[status.state]}
                  </span>
                </div>
              );
            })}
            {phase === 'removing' && (
              <p className="text-[12.5px] text-[color:var(--text-secondary)] pt-3">
                Moving leftovers to Quarantine…
              </p>
            )}
          </div>
        )}

        {phase === 'review' && leftovers && (
          <>
            <div className="flex items-center gap-2.5 mb-4 px-3.5 py-3 rounded-xl bg-[color:var(--success)]/10 border border-[color:var(--success)]/25">
              <p className="text-[12.5px] text-[color:var(--success)]">
                Uninstalled {removed.length} of {programs.length}.
              </p>
            </div>

            {failed.length > 0 && (
              <div className="mb-4 px-3.5 py-3 rounded-xl bg-[color:var(--danger-soft)] border border-[color:var(--danger)]/25">
                <p className="text-[12.5px] text-[color:var(--danger)] mb-1">
                  {failed.length} couldn't be uninstalled and {failed.length === 1 ? 'was' : 'were'} left alone:
                </p>
                {failed.map((p) => (
                  <p key={p.id} className="text-[11.5px] font-mono text-[color:var(--text-secondary)]">
                    {p.name} — {statuses[p.id]?.message}
                  </p>
                ))}
              </div>
            )}

            {error && (
              <p className="text-[12.5px] text-[#f7a8b0] mb-4">Couldn't remove leftovers: {error}</p>
            )}

            <LeftoverReview
              scanResult={leftovers}
              selected={selected}
              onToggle={handleToggle}
              onConfirm={handleRemoveLeftovers}
              onSkip={() => { onFinished?.(); onClose(); }}
            />
          </>
        )}

        {phase === 'done' && removal && (
          <div>
            <div className="flex items-start gap-2.5 mb-5 px-3.5 py-3 rounded-xl bg-[color:var(--success)]/10 border border-[color:var(--success)]/25">
              <div className="text-[12.5px] text-[color:var(--success)] leading-relaxed">
                Uninstalled {removed.length} program{removed.length === 1 ? '' : 's'} and moved{' '}
                {removal.files?.length ?? 0} leftover item{removal.files?.length === 1 ? '' : 's'} to
                Quarantine, freeing {formatBytes(removal.totalSizeBytes)}.
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
                No system restore point was created ({removal.restorePoint.reason?.trim() || 'not available'}).
                Everything above is still in Quarantine and can be put back.
              </p>
            )}

            {removal.failedRegistryKeys?.length > 0 && (
              <div className="mb-5 px-3.5 py-3 rounded-xl bg-[color:var(--warning-soft)] border border-[color:var(--warning)]/25">
                <p className="text-[12.5px] text-[color:var(--warning)]">
                  {removal.failedRegistryKeys.length} registry key
                  {removal.failedRegistryKeys.length === 1 ? '' : 's'} couldn't be removed — these
                  usually need Prune to be running as administrator.
                </p>
              </div>
            )}

            <button className="btn-primary" onClick={() => { onFinished?.(); onClose(); }}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
