import { useEffect, useState } from 'react';
import { fetchQuarantineBatches, restoreQuarantineBatch, deleteQuarantineBatch, emptyQuarantine } from '../lib/api.js';

// Duplicated locally rather than imported from Dashboard.jsx/DeepClean.jsx
// (both off-limits for this task) -- matches this codebase's own existing
// convention of a small per-component formatBytes copy.
function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// manifest.createdAt (a real backend field -- see quarantine.js's service)
// -- NOT `batch.timestamp`, a field that doesn't exist anywhere in the
// manifest. The pre-existing QuarantinePanel.jsx reads batch.timestamp and
// so has always rendered a blank date; this component deliberately reads
// the real field instead of repeating that bug.
function formatDate(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

export default function QuarantineManager() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busyDir, setBusyDir] = useState(null);
  const [confirmDeleteDir, setConfirmDeleteDir] = useState(null);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [emptying, setEmptying] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    return fetchQuarantineBatches()
      .then((result) => setBatches(result))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleRestore = async (batch) => {
    setActionError(null);
    setBusyDir(batch.batchDir);
    try {
      await restoreQuarantineBatch(batch.batchDir);
      setBatches((prev) => prev.filter((b) => b.batchDir !== batch.batchDir));
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusyDir(null);
    }
  };

  const handleDeletePermanently = async (batch) => {
    setActionError(null);
    setBusyDir(batch.batchDir);
    try {
      await deleteQuarantineBatch(batch.batchDir);
      setBatches((prev) => prev.filter((b) => b.batchDir !== batch.batchDir));
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusyDir(null);
      setConfirmDeleteDir(null);
    }
  };

  const handleEmptyQuarantine = async () => {
    setActionError(null);
    setEmptying(true);
    try {
      await emptyQuarantine();
      setBatches([]);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setEmptying(false);
      setConfirmEmpty(false);
    }
  };

  const totalBytes = batches.reduce((sum, b) => sum + (b.totalSizeBytes || 0), 0);

  return (
    <div className="px-12 py-10 max-w-[1400px]">
      <div className="flex items-baseline justify-between mb-8">
        <div>
          <div className="text-[11px] text-[color:var(--text-muted)] font-mono uppercase tracking-[0.16em] mb-2">
            Recovery
          </div>
          <h1 className="display-heading text-[30px] leading-none">Quarantine</h1>
          {!loading && !error && (
            <p className="text-[13px] text-[color:var(--text-secondary)] mt-2.5">
              <span className="text-[color:var(--text-primary)] font-medium">{batches.length}</span> batch{batches.length === 1 ? '' : 'es'} ·{' '}
              <span className="text-[color:var(--text-primary)] font-medium">{formatBytes(totalBytes)}</span> held
            </p>
          )}
        </div>

        {!loading && !error && (
          confirmEmpty ? (
            <div className="flex items-center gap-2">
              <span className="text-[12.5px] text-[color:var(--danger)]">Permanently delete every batch?</span>
              <button className="btn-ghost px-3.5 py-1.5 rounded-lg text-[12px] font-medium" onClick={() => setConfirmEmpty(false)} disabled={emptying}>
                Cancel
              </button>
              <button className="btn-danger px-3.5 py-1.5 rounded-lg text-[12px] font-medium" onClick={handleEmptyQuarantine} disabled={emptying}>
                {emptying ? 'Emptying…' : 'Confirm'}
              </button>
            </div>
          ) : (
            <button
              className="btn-ghost"
              onClick={() => setConfirmEmpty(true)}
              disabled={batches.length === 0}
            >
              Empty Quarantine
            </button>
          )
        )}
      </div>

      {loading && (
        <div className="glass-panel flex flex-col items-center justify-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-[color:var(--accent-coral)]/10 border border-[color:var(--accent-coral)]/25 flex items-center justify-center mb-5">
            <div className="w-6 h-6 border-2 border-[color:var(--accent-coral)] border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-[13px] text-[color:var(--text-secondary)]">Loading quarantine…</p>
        </div>
      )}

      {!loading && error && (
        <div className="glass-panel p-6">
          <p className="text-[13px] text-[color:var(--danger)]">Couldn't load quarantine: {error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          {actionError && (
            <div className="mb-5 px-3.5 py-3 rounded-xl bg-[color:var(--danger-soft)] border border-[color:var(--danger)]/25">
              <p className="text-[12.5px] text-[color:var(--danger)]">{actionError}</p>
            </div>
          )}

          {batches.length === 0 ? (
            <div className="glass-panel p-10 text-center">
              <p className="text-[13.5px] text-[color:var(--text-secondary)]">Nothing in quarantine.</p>
              <p className="text-[12.5px] text-[color:var(--text-muted)] mt-1.5">
                Files removed via forced uninstall or Smart Cleanup land here first, before anything is permanently deleted.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {batches.map((batch) => {
                const busy = busyDir === batch.batchDir;
                const confirming = confirmDeleteDir === batch.batchDir;
                return (
                  <div key={batch.batchDir} className="glass-panel p-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="min-w-0">
                        <div className="text-[14px] font-medium text-[color:var(--text-primary)] truncate">{batch.programName}</div>
                        <div className="text-[12px] text-[color:var(--text-secondary)] mt-1">
                          {formatDate(batch.createdAt)} · {formatBytes(batch.totalSizeBytes)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {confirming ? (
                          <>
                            <span className="text-[12px] text-[color:var(--danger)] mr-1">Delete forever?</span>
                            <button
                              className="btn-ghost px-3.5 py-1.5 rounded-lg text-[12px] font-medium"
                              onClick={() => setConfirmDeleteDir(null)}
                              disabled={busy}
                            >
                              Cancel
                            </button>
                            <button
                              className="btn-danger px-3.5 py-1.5 rounded-lg text-[12px] font-medium"
                              onClick={() => handleDeletePermanently(batch)}
                              disabled={busy}
                            >
                              {busy ? 'Deleting…' : 'Confirm'}
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="btn-ghost px-3.5 py-1.5 rounded-lg text-[12px] font-medium disabled:opacity-50"
                              onClick={() => handleRestore(batch)}
                              disabled={busy}
                            >
                              {busy ? 'Restoring…' : 'Restore'}
                            </button>
                            <button
                              className="btn-danger px-3.5 py-1.5 rounded-lg text-[12px] font-medium disabled:opacity-50"
                              onClick={() => setConfirmDeleteDir(batch.batchDir)}
                              disabled={busy}
                            >
                              Delete Permanently
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {batch.files?.length > 0 && (
                      <div className="border-t border-[color:var(--border-subtle)] pt-3 flex flex-col gap-1.5">
                        {batch.files.map((f) => (
                          <div key={f.originalPath} className="flex items-center justify-between gap-4">
                            <div className="font-mono text-[11.5px] text-[color:var(--text-muted)] truncate min-w-0">{f.originalPath}</div>
                            <div className="font-mono text-[11px] text-[color:var(--text-secondary)] shrink-0">{formatBytes(f.sizeBytes)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
