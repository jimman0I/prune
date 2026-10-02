import { useState } from 'react';
import { useBackups } from '../hooks/useSystemQueries.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** The Backup Manager: what Prune saved before it changed something that has
 * no Recycle Bin.
 *
 * Two kinds, both made automatically: the full registry exports taken before
 * an uninstall (Settings -> Uninstall), and the definitions of scheduled tasks
 * Prune removed. Quarantine holds the files and registry keys of leftovers;
 * this holds these. Restoring says what it will do first, because a registry
 * import merges rather than rewinds, and a machine-wide key may ask for
 * administrator approval; the result is said back, including what did not
 * go. */
export default function BackupManager() {
  const { t } = useLanguage();
  const { backups, loading, error, restore, remove } = useBackups();
  const [confirming, setConfirming] = useState(null); // { id, action }
  const [outcome, setOutcome] = useState(null);
  const [actionError, setActionError] = useState(null);

  const busyId = (restore.isPending && restore.variables) || (remove.isPending && remove.variables) || null;

  const run = (mutation, id, onSuccess) => {
    setActionError(null);
    setOutcome(null);
    mutation.mutate(id, {
      onSuccess,
      onError: (err) => setActionError(err.message),
      onSettled: () => setConfirming(null)
    });
  };

  const doRestore = (backup) => run(restore, backup.id, (result) => setOutcome({ backup, result }));
  const doDelete = (backup) => run(remove, backup.id);

  if (loading) {
    return <div className="glass-panel p-6"><p className="text-[13px] text-[color:var(--text-secondary)]">{t('quarantine.loading')}</p></div>;
  }
  if (error) {
    return <div className="glass-panel p-6"><p className="text-[13px] text-[color:var(--danger)] select-text">{t('uninstallerV3.backups.loadError', error)}</p></div>;
  }

  return (
    <div>
      <p className="text-[13px] text-[color:var(--text-secondary)] mb-5 max-w-[640px]">{t('uninstallerV3.backups.intro')}</p>

      {outcome && (
        <div role="status" className="mb-5 px-3.5 py-3 rounded-xl bg-[color:var(--success)]/10 border border-[color:var(--success)]/25 text-[12.5px] text-[color:var(--success)]">
          <p>{t('uninstallerV3.backups.restored', outcome.backup.programName, outcome.result.restored)}</p>
          {outcome.result.failed?.length > 0 && (
            <div className="mt-2 text-[color:var(--warning)]">
              <p>{t('uninstallerV3.backups.failedHeading', outcome.result.failed.length)}</p>
              {outcome.result.failed.map((f) => (
                <p key={`${f.file || f.path}${f.name || ''}`} className="mt-1 font-mono text-[11px] text-[color:var(--text-secondary)] break-all select-text">
                  {`${f.file || `${f.path || ''}${f.name || ''}`} — ${f.reason}`}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
      {actionError && (
        <div className="mb-5 px-3.5 py-3 rounded-xl bg-[color:var(--danger-soft)] border border-[color:var(--danger)]/25">
          <p className="text-[12.5px] text-[color:var(--danger)] select-text">{actionError}</p>
        </div>
      )}

      {backups.length === 0 ? (
        <div className="glass-panel p-10 text-center">
          <p className="text-[13.5px] text-[color:var(--text-secondary)]">{t('uninstallerV3.backups.emptyHeading')}</p>
          <p className="text-[12.5px] text-[color:var(--text-muted)] mt-1.5">{t('uninstallerV3.backups.emptyBody')}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4" aria-label={t('uninstallerV3.backups.tab')}>
          {backups.map((backup) => {
            const busy = busyId === backup.id;
            const action = confirming?.id === backup.id ? confirming.action : null;
            return (
              <li key={backup.id} className="glass-panel p-5" data-backup-kind={backup.kind}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-medium text-[color:var(--text-primary)] truncate">{backup.programName}</span>
                      <span className="text-[11px] font-mono uppercase tracking-wider px-1 py-px rounded bg-[color:var(--surface-hover)] text-[color:var(--text-secondary)] border border-[color:var(--control-border)] shrink-0">
                        {backup.kind === 'registry' ? t('uninstallerV3.backups.kindRegistry') : t('uninstallerV3.backups.kindTask')}
                      </span>
                    </div>
                    <div className="text-[12px] text-[color:var(--text-secondary)] mt-1">
                      {formatDate(backup.createdAt)} · {formatBytes(backup.sizeBytes)} · {t('uninstallerV3.backups.items', backup.itemCount)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {action === null && (
                      <>
                        <button
                          className="btn-ghost px-3.5 py-1.5 rounded-lg text-[12px] font-medium disabled:opacity-50"
                          disabled={busy}
                          onClick={() => setConfirming({ id: backup.id, action: 'restore' })}
                        >
                          {busy && restore.isPending ? t('uninstallerV3.backups.restoring') : t('quarantine.restore')}
                        </button>
                        <button
                          className="btn-danger px-3.5 py-1.5 rounded-lg text-[12px] font-medium disabled:opacity-50"
                          disabled={busy}
                          onClick={() => setConfirming({ id: backup.id, action: 'delete' })}
                        >
                          {t('uninstallerV3.monitor.deleteTrace')}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {backup.kind !== 'registry' && backup.items?.length > 0 && (
                  <div className="border-t border-[color:var(--border-subtle)] mt-3 pt-3 flex flex-col gap-1">
                    {backup.items.slice(0, 5).map((item) => (
                      <div key={item} className="font-mono text-[11.5px] text-[color:var(--text-muted)] truncate select-text">{item}</div>
                    ))}
                  </div>
                )}

                {action === 'restore' && (
                  <div className="border-t border-[color:var(--border-subtle)] mt-3 pt-3">
                    <p className="text-[12.5px] text-[color:var(--text-secondary)] mb-3">
                      {backup.kind === 'registry' ? t('uninstallerV3.backups.confirmRestoreRegistry') : t('uninstallerV3.backups.confirmRestoreTask')}
                    </p>
                    <div className="flex items-center gap-2">
                      <button className="btn-primary px-3.5 py-1.5 rounded-lg text-[12px] font-medium" onClick={() => doRestore(backup)}>
                        {t('uninstallerV3.backups.restoreNow')}
                      </button>
                      <button className="btn-ghost px-3.5 py-1.5 rounded-lg text-[12px] font-medium" onClick={() => setConfirming(null)}>
                        {t('quarantine.cancel')}
                      </button>
                    </div>
                  </div>
                )}

                {action === 'delete' && (
                  <div className="border-t border-[color:var(--border-subtle)] mt-3 pt-3">
                    <p className="text-[12.5px] text-[color:var(--danger)] mb-3">{t('uninstallerV3.backups.confirmDelete')}</p>
                    <div className="flex items-center gap-2">
                      <button className="btn-danger px-3.5 py-1.5 rounded-lg text-[12px] font-medium" onClick={() => doDelete(backup)}>
                        {t('uninstallerV3.backups.deleteNow')}
                      </button>
                      <button className="btn-ghost px-3.5 py-1.5 rounded-lg text-[12px] font-medium" onClick={() => setConfirming(null)}>
                        {t('quarantine.cancel')}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
