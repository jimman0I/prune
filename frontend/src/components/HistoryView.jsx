import { useState } from 'react';
import { useUninstallHistory } from '../hooks/useSystemQueries.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const dash = (value) => (value === undefined || value === null || value === '' ? '—' : value);

/** Everything Prune has uninstalled, newest first, with a detail pane.
 *
 * The Dashboard shows the last five. This is the rest: each entry says what
 * was removed, how the leftover scan went, where the leftovers went, and which
 * safety nets existed at the time. Entries written by older versions have only
 * a name, a publisher, a size and a date, and show the rest as a dash rather
 * than guessing. */
export default function HistoryView() {
  const { t } = useLanguage();
  const { entries, loading, error, clear } = useUninstallHistory();
  const [selectedId, setSelectedId] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [actionError, setActionError] = useState(null);

  const selected = entries.find((entry) => entry.id === selectedId) ?? null;

  const kindLabel = (kind) => (kind ? t(`uninstallerV3.history.kind.${kind}`) : t('uninstallerV3.history.kind.uninstall'));
  const outcomeLabel = (outcome) => (outcome ? t(`uninstallerV3.history.outcome.${outcome}`) : null);
  const destinationLabel = (destination) => (destination ? t(`uninstallerV3.history.destination.${destination}`) : null);

  const doClear = () => {
    setActionError(null);
    clear.mutate(undefined, {
      onSuccess: () => { setSelectedId(null); setConfirmClear(false); },
      onError: (err) => { setActionError(err.message); setConfirmClear(false); }
    });
  };

  if (loading) return <div className="glass-panel p-6"><p className="text-[13px] text-[color:var(--text-secondary)]">{t('quarantine.loading')}</p></div>;
  if (error) return <div className="glass-panel p-6"><p className="text-[13px] text-[color:var(--danger)] select-text">{t('uninstallerV3.history.loadError', error)}</p></div>;

  if (entries.length === 0) {
    return (
      <div className="glass-panel p-10 text-center">
        <p className="text-[13.5px] text-[color:var(--text-secondary)]">{t('uninstallerV3.history.emptyHeading')}</p>
        <p className="text-[12.5px] text-[color:var(--text-muted)] mt-1.5">{t('uninstallerV3.history.emptyBody')}</p>
      </div>
    );
  }

  const rows = selected ? [
    [t('applications.columns.application'), selected.programName],
    [t('applications.columns.company'), selected.publisher],
    [t('applications.columns.version'), selected.version],
    [t('uninstallerV3.history.field.date'), formatDate(selected.timestamp)],
    [t('uninstallerV3.history.field.kind'), kindLabel(selected.kind)],
    [t('uninstallerV3.history.field.outcome'), outcomeLabel(selected.outcome)],
    [t('uninstallerV3.scanMode.label'), selected.scanMode ? t(`uninstallerV3.scanMode.${selected.scanMode}`) : null],
    [t('uninstallerV3.history.field.found'), selected.leftoversFound],
    [t('uninstallerV3.history.field.removed'), selected.leftoversRemoved],
    [t('uninstallerV3.history.field.freed'), selected.bytesFreed !== undefined ? formatBytes(selected.bytesFreed) : (selected.sizeBytes !== undefined ? formatBytes(selected.sizeBytes) : null)],
    [t('uninstallerV3.history.field.destination'), destinationLabel(selected.destination)],
    [t('uninstallerV3.history.field.tasks'), selected.tasksRemoved],
    [t('uninstallerV3.history.field.restorePoint'), selected.restorePoint
      ? (selected.restorePoint.created ? t('uninstallerV3.history.restoreCreated') : t('uninstallerV3.history.restoreNotCreated', selected.restorePoint.reason || ''))
      : null],
    [t('uninstallerV3.history.field.registryBackup'), selected.registryBackup, true],
    [t('uninstallerV3.history.field.quarantineBatch'), selected.quarantineBatch, true]
  ] : [];

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-5">
        <p className="text-[13px] text-[color:var(--text-secondary)]">{t('uninstallerV3.history.count', entries.length)}</p>
        {confirmClear ? (
          <div className="flex items-center gap-2">
            <span className="text-[12.5px] text-[color:var(--danger)]">{t('uninstallerV3.history.clearConfirm')}</span>
            <button className="btn-ghost px-3.5 py-1.5 rounded-lg text-[12px] font-medium" onClick={() => setConfirmClear(false)} disabled={clear.isPending}>{t('quarantine.cancel')}</button>
            <button className="btn-danger px-3.5 py-1.5 rounded-lg text-[12px] font-medium" onClick={doClear} disabled={clear.isPending}>{t('uninstallerV3.history.clearNow')}</button>
          </div>
        ) : (
          <button className="btn-ghost" onClick={() => setConfirmClear(true)}>{t('uninstallerV3.history.clear')}</button>
        )}
      </div>

      {actionError && (
        <div className="mb-5 px-3.5 py-3 rounded-xl bg-[color:var(--danger-soft)] border border-[color:var(--danger)]/25">
          <p className="text-[12.5px] text-[color:var(--danger)] select-text">{actionError}</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-start">
        <ul aria-label={t('uninstallerV3.history.tab')} className="glass-panel divide-y divide-[color:var(--border-subtle)] overflow-hidden">
          {entries.map((entry) => {
            const active = entry.id === selectedId;
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  aria-current={active ? 'true' : undefined}
                  onClick={() => setSelectedId(entry.id)}
                  className={`w-full text-left px-4 py-3 transition ${active ? 'bg-[color:var(--surface-hover)]' : 'hover:bg-[color:var(--surface-subtle)]'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px] font-medium truncate">{entry.programName}</span>
                    {entry.outcome && (
                      <span className="text-[11px] font-mono uppercase tracking-wider px-1 py-px rounded bg-[color:var(--surface-hover)] text-[color:var(--text-secondary)] border border-[color:var(--control-border)] shrink-0">
                        {outcomeLabel(entry.outcome)}
                      </span>
                    )}
                  </div>
                  <div className="text-[11.5px] text-[color:var(--text-muted)] mt-0.5">
                    {formatDate(entry.timestamp)}{entry.publisher ? ` · ${entry.publisher}` : ''}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        <section aria-label={t('uninstallerV3.history.details')} className="glass-panel p-5 min-h-[120px]">
          {selected ? (
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-[12.5px]">
              {rows.map(([label, value, mono]) => (
                <div key={label} className="contents">
                  <dt className="text-[color:var(--text-muted)]">{label}</dt>
                  <dd className={`text-[color:var(--text-primary)] break-words select-text ${mono ? 'font-mono text-[11.5px]' : ''}`}>{dash(value)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-[13px] text-[color:var(--text-muted)]">{t('uninstallerV3.history.selectPrompt')}</p>
          )}
        </section>
      </div>
    </div>
  );
}
