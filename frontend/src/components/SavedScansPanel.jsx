import { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { formatBytes } from '../lib/formatBytes.js';
import { signedBytes as signed } from '../lib/growthSummary.js';
import { fetchSavedScans, deleteSavedScan, compareSavedScans } from '../lib/api.js';
import ModalOverlay from './ModalOverlay.jsx';

/** Saved Disk Map scans: keep the current one, open an old one, delete one,
 * and compare two to see which folders grew, shrank, appeared or went.
 *
 * Opening and saving need the live tree, which lives in the Disk Map, so those
 * two are callbacks; listing, deleting and comparing talk to the backend
 * directly. Nothing here acts on the user's files. */
export function SavedScansPanel({ onClose, canSave, defaultLabel, onSave, onOpen }) {
  const { t } = useLanguage();
  const [scans, setScans] = useState(null);
  const [error, setError] = useState(null);
  const [label, setLabel] = useState(defaultLabel);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(null);
  const [picked, setPicked] = useState([]);
  const [comparison, setComparison] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setScans(await fetchSavedScans());
    } catch (err) {
      setError(err.message);
      setScans((current) => current ?? []);
    }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const run = async (action) => {
    setError(null);
    try {
      return await action();
    } catch (err) {
      setError(err.message);
      return undefined;
    }
  };

  const save = async () => {
    setSaving(true);
    await run(async () => { await onSave(label.trim()); await refresh(); });
    setSaving(false);
  };

  const remove = async (id) => {
    setConfirmingDelete(null);
    setPicked((p) => p.filter((x) => x !== id));
    await run(async () => { await deleteSavedScan(id); await refresh(); });
  };

  const togglePicked = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(-2)));

  const compare = async () => {
    setComparison({ loading: true });
    const result = await run(() => compareSavedScans(picked[0], picked[1]));
    setComparison(result ?? null);
  };

  const dateOf = (ms) => new Date(ms).toLocaleString();
  const sourceOf = (scan) => (scan.source === 'crawl' ? t('diskMap.driveRootPrompt.crawlTitle') : t('diskMap.driveRootPrompt.fastTitle'));

  return (
    <ModalOverlay label={t('diskMapV3.saved.title')} onClose={onClose}>
      <div className="glass-panel w-full max-w-[720px] max-h-[85vh] overflow-y-auto p-6">
        <h2 className="display-heading text-[20px] mb-4">{t('diskMapV3.saved.title')}</h2>

        {error && <p role="alert" className="text-[12.5px] text-[color:var(--danger)] mb-3 select-text">{t('diskMapV3.saved.failed', error)}</p>}

        {comparison ? (
          <ComparisonView comparison={comparison} onBack={() => setComparison(null)} />
        ) : (
          <>
            {canSave ? (
              <div className="flex items-end gap-2 mb-5">
                <label className="flex-1 min-w-0 text-[11.5px] text-[color:var(--text-muted)]">
                  {t('diskMapV3.saved.nameField')}
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    maxLength={120}
                    className="mt-1 w-full min-h-8 px-2.5 rounded-lg text-[12.5px] bg-[color:var(--surface-subtle)] text-[color:var(--text-primary)] border border-[color:var(--border-subtle)] outline-none focus-visible:border-[color:var(--accent-primary)]"
                  />
                </label>
                <button type="button" className="btn-primary px-4 py-2 rounded-lg text-[12.5px] font-medium disabled:opacity-50" onClick={save} disabled={saving}>
                  {saving ? t('diskMapV3.saved.saving') : t('diskMapV3.saved.save')}
                </button>
              </div>
            ) : (
              <p className="text-[12.5px] text-[color:var(--text-secondary)] mb-5">{t('diskMapV3.saved.nothingToSave')}</p>
            )}

            {scans && scans.length === 0 && (
              <p className="text-[12.5px] text-[color:var(--text-muted)]">{t('diskMapV3.saved.empty')}</p>
            )}

            <ul className="flex flex-col divide-y divide-[color:var(--border-subtle)]">
              {(scans ?? []).map((scan) => (
                <li key={scan.id} className="flex items-center gap-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={picked.includes(scan.id)}
                    onChange={() => togglePicked(scan.id)}
                    aria-label={t('diskMapV3.saved.selectForCompare', scan.label)}
                    className="accent-[color:var(--accent-primary)]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[13px] text-[color:var(--text-primary)] truncate">{scan.label}</span>
                      {scan.auto === true && (
                        <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full border border-[color:var(--control-border)] text-[color:var(--text-secondary)] shrink-0">
                          {t('diskMapQolV3.auto.badge')}
                        </span>
                      )}
                    </div>
                    <div className="text-[11.5px] font-mono text-[color:var(--text-muted)] truncate">
                      {dateOf(scan.savedAt)} · {sourceOf(scan)} · {formatBytes(scan.totalBytes)}
                      {scan.truncated && <> · {t('diskMapV3.saved.partial')}</>}
                    </div>
                  </div>
                  {confirmingDelete === scan.id ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[12px] text-[color:var(--text-secondary)]">{t('diskMapV3.saved.deleteConfirm', scan.label)}</span>
                      <button type="button" className="btn-danger px-3 py-1.5 rounded-lg text-[12px] font-medium" onClick={() => remove(scan.id)}>
                        {t('diskMapV3.saved.delete')}
                      </button>
                      <button type="button" className="btn-ghost px-3 py-1.5 rounded-lg text-[12px] font-medium" onClick={() => setConfirmingDelete(null)}>
                        {t('diskMap.removeModal.cancel')}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 shrink-0">
                      <button type="button" className="btn-ghost px-3 py-1.5 rounded-lg text-[12px] font-medium" onClick={() => onOpen(scan)}>
                        {t('diskMapV3.saved.load')}
                      </button>
                      <button type="button" className="btn-ghost px-3 py-1.5 rounded-lg text-[12px] font-medium" onClick={() => setConfirmingDelete(scan.id)}>
                        {t('diskMapV3.saved.delete')}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>

            {scans && scans.length > 1 && (
              <div className="flex items-center gap-3 mt-4">
                <button type="button" className="btn-ghost px-4 py-2 rounded-lg text-[12.5px] font-medium disabled:opacity-50" onClick={compare} disabled={picked.length !== 2}>
                  {t('diskMapV3.saved.compare')}
                </button>
                {picked.length !== 2 && <span className="text-[12px] text-[color:var(--text-muted)]">{t('diskMapV3.saved.pickTwo')}</span>}
              </div>
            )}
          </>
        )}

        <div className="flex justify-end mt-6">
          <button type="button" className="btn-ghost px-4 py-2 rounded-lg text-[12.5px] font-medium" onClick={onClose}>
            {t('diskMapV3.props.close')}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

function ComparisonView({ comparison, onBack }) {
  const { t } = useLanguage();
  if (comparison.loading) return <p className="text-[12.5px] text-[color:var(--text-muted)]">{t('diskMapV3.compare.loading')}</p>;

  const groups = [
    ['grew', comparison.grew, (r) => signed(r.delta)],
    ['shrank', comparison.shrank, (r) => signed(r.delta)],
    ['added', comparison.added, (r) => signed(r.size)],
    ['removed', comparison.removed, (r) => signed(-r.size)]
  ];
  return (
    <div>
      <button type="button" className="btn-ghost px-3 py-1.5 rounded-lg text-[12px] font-medium mb-3" onClick={onBack}>
        {t('diskMapV3.compare.back')}
      </button>
      <p className="text-[13px] text-[color:var(--text-primary)]">{t('diskMapV3.compare.title', comparison.older.label, comparison.newer.label)}</p>
      <p className="text-[12.5px] font-mono text-[color:var(--text-secondary)] mb-4">{t('diskMapV3.compare.total', signed(comparison.delta))}</p>
      {groups.map(([key, rows, figure]) => (
        <section key={key} aria-label={t(`diskMapV3.compare.${key}`)} className="mb-4">
          <h3 className="text-[11px] font-mono uppercase tracking-[0.12em] text-[color:var(--text-muted)] mb-1.5">{t(`diskMapV3.compare.${key}`)}</h3>
          {rows.length === 0 ? (
            <p className="text-[12px] text-[color:var(--text-muted)]">{t('diskMapV3.compare.none')}</p>
          ) : (
            <ul className="flex flex-col">
              {rows.map((row) => (
                <li key={row.path} className="flex items-baseline gap-3 py-1 border-b border-[color:var(--border-subtle)] last:border-b-0">
                  <span className="font-mono text-[12px] text-[color:var(--text-primary)] w-[92px] text-right shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>{figure(row)}</span>
                  <span className="font-mono text-[11.5px] text-[color:var(--text-secondary)] truncate select-text">{row.path}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
