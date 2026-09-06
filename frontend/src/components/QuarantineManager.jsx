import { useState, memo } from 'react';
import { useQuarantine } from '../hooks/useSystemQueries.js';

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
// -- NOT `batch.timestamp`, which does not exist anywhere in the manifest.
// The earlier version of this screen read that name and so rendered a
// blank date on every row for as long as it existed. Worth naming even
// though that file is gone: the two fields are equally plausible, and
// nothing about a blank date says which one was wrong.
function formatDate(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function QuarantineManager() {
  const [actionError, setActionError] = useState(null);
  const [confirmDeleteDir, setConfirmDeleteDir] = useState(null);
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const { batches, totals, loading, error, restore, remove, empty } = useQuarantine();

  // Which row is mid-action. Read off the mutations rather than tracked
  // separately, so it cannot disagree with what is actually running.
  const busyDir = (restore.isPending && restore.variables)
    || (remove.isPending && remove.variables)
    || null;
  const emptying = empty.isPending;

  /** Each action invalidates the list rather than splicing the row out.
   *
   * The old version removed the row locally on success, which is faster
   * to write and quietly wrong: restoring a batch puts files back on disk
   * and the quarantine folder is the source of truth for what is left. A
   * re-read cannot disagree with it; a local splice can. */
  const runAction = (mutation, argument, after) => {
    setActionError(null);
    mutation.mutate(argument, {
      onError: (err) => setActionError(err.message),
      onSettled: after
    });
  };

  const handleRestore = (batch) => runAction(restore, batch.batchDir);
  const handleDeletePermanently = (batch) =>
    runAction(remove, batch.batchDir, () => setConfirmDeleteDir(null));
  const handleEmptyQuarantine = () =>
    runAction(empty, undefined, () => setConfirmEmpty(false));

  // From the backend rather than added up here. It is the same figure the
  // size cap is enforced against, and a second sum on this side could
  // disagree with it about what an unmeasured batch is worth.
  const { totalBytes, unknownSizeCount, exact, maxBytes } = totals;
  const overCap = maxBytes !== null && totalBytes > maxBytes;

  return (
    <div className="px-12 py-10 max-w-[1400px]">
      <div className="flex items-baseline justify-between mb-8">
        <div>
          <h1 className="display-heading text-[30px] leading-none">Quarantine</h1>
          {!loading && !error && (
            <>
            <p className="text-[13px] text-[color:var(--text-secondary)] mt-2.5">
              <span className="text-[color:var(--text-primary)] font-medium">{batches.length}</span> batch{batches.length === 1 ? '' : 'es'} ·{' '}
              {/* "at least" when a batch carries no recorded size. Rounding
                  an unknown down to zero and printing the result as exact
                  would understate the total while looking precise. */}
              {!exact && 'at least '}
              <span className="text-[color:var(--text-primary)] font-medium">{formatBytes(totalBytes)}</span> held
              {maxBytes !== null && <> of {formatBytes(maxBytes)}</>}
              {unknownSizeCount > 0 && (
                <span className="text-[color:var(--text-muted)]">
                  {' '}· {unknownSizeCount} unmeasured
                </span>
              )}
            </p>
            {/* Only when the cap genuinely does not hold, which happens when
                one batch is larger than the whole budget -- the newest is
                never dropped to make room, so a big thing just quarantined
                stays recoverable. Saying so beats a limit that quietly
                does not apply. */}
            {overCap && (
              <p className="text-[12.5px] text-[color:var(--warning,var(--text-secondary))] mt-1.5">
                Over the {formatBytes(maxBytes)} limit. The most recent backup is never removed to
                make room, so this stays until you restore or delete it.
              </p>
            )}
            </>
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
          <div className="w-14 h-14 rounded-2xl bg-[color:var(--accent-primary)]/10 border border-[color:var(--accent-primary)]/25 flex items-center justify-center mb-5">
            <div className="w-6 h-6 border-2 border-[color:var(--accent-primary)] border-t-transparent rounded-full animate-spin"></div>
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
                Anything an uninstall or a Deep Clean removes lands here first. It stays until
                you empty it, so a file taken by mistake is always recoverable.
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
export default memo(QuarantineManager);
