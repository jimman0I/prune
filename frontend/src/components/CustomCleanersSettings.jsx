import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchCustomCleaners, addCustomLocation, removeCustomLocation, importCleaner, removeImportedCleaner
} from '../lib/api.js';
import { keys } from '../lib/queryClient.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

/** Settings -> Cleanup: "Custom locations" and "Imported cleaners".
 *
 * Two panels for the two ways someone adds their own rules to Deep Clean:
 * typing a path (or a pattern) and importing a BleachBit cleaner file. Both
 * end up as ordinary rules in the Deep Clean list, never ticked by default.
 * What this screen owes the person is the truth about each: why a location
 * was refused, and, after an import, exactly how much of the file was
 * brought over and what was skipped and why.
 *
 * The backend decides what is acceptable (lib/customLocations.js,
 * lib/bleachbitImport.js); it answers with a machine-readable reason or
 * code and this turns it into a sentence in the person's language. */

const MAX_FILE_BYTES = 512 * 1024; // the same limit the importer enforces

const HEADING_CLASS = 'text-[11px] font-mono uppercase tracking-[0.14em] text-[color:var(--text-muted)]';
const LOCATION_REASONS = new Set(['empty', 'relative', 'climb', 'protected', 'wildcard', 'long']);
const IMPORT_CODES = new Set(['tooLarge', 'notXml', 'notCleaner', 'noId']);
const SKIP_KINDS = new Set(['command', 'search', 'filter', 'os', 'variable', 'path']);

function readText(file) {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export default function CustomCleanersSettings() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: keys.customCleaners, queryFn: fetchCustomCleaners });
  const [typed, setTyped] = useState('');
  const [locationError, setLocationError] = useState(null);
  const [importResult, setImportResult] = useState(null); // { ok, ... } | { error }
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const locations = data?.locations ?? [];
  const imported = data?.imported ?? [];

  /** Both lists, and Deep Clean's own: its tree must show the change. */
  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: keys.customCleaners }),
    queryClient.invalidateQueries({ queryKey: keys.deepCleanRules })
  ]);

  const add = async () => {
    if (typed.trim() === '' || busy) return;
    setLocationError(null);
    setBusy(true);
    try {
      await addCustomLocation(typed);
      setTyped('');
      await refresh();
    } catch (err) {
      setLocationError(LOCATION_REASONS.has(err.reason)
        ? t(`deepCleanV3.custom.error.${err.reason}`)
        : t('deepCleanV3.custom.error.failed', err.message));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (path) => {
    setLocationError(null);
    try {
      await removeCustomLocation(path);
      await refresh();
    } catch (err) {
      setLocationError(t('deepCleanV3.custom.error.failed', err.message));
    }
  };

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    // So choosing the same file again still fires a change.
    event.target.value = '';
    if (!file) return;
    setImportResult(null);
    if (file.size > MAX_FILE_BYTES) {
      setImportResult({ error: t('deepCleanV3.imported.error.tooLarge') });
      return;
    }
    setBusy(true);
    try {
      const response = await importCleaner(file.name, await readText(file));
      setImportResult({ ok: true, ...response });
      await refresh();
    } catch (err) {
      setImportResult({
        error: IMPORT_CODES.has(err.code) ? t(`deepCleanV3.imported.error.${err.code}`) : t('deepCleanV3.imported.error.failed', err.message)
      });
    } finally {
      setBusy(false);
    }
  };

  const removeImported = async (id) => {
    setImportResult(null);
    try {
      await removeImportedCleaner(id);
      await refresh();
    } catch (err) {
      setImportResult({ error: t('deepCleanV3.imported.error.failed', err.message) });
    }
  };

  return (
    <>
      <div className="glass-panel p-6">
        <h2 className={`${HEADING_CLASS} mb-3`}>{t('deepCleanV3.custom.ruleName')}</h2>
        <p className="text-[12.5px] text-[color:var(--text-secondary)] mb-4 max-w-[62ch]">{t('deepCleanV3.custom.description')}</p>

        <div className="flex items-center gap-2 mb-1">
          <input
            type="text"
            value={typed}
            onChange={(e) => { setTyped(e.target.value); setLocationError(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
            placeholder={'D:\\Games\\Cache   or   %LOCALAPPDATA%\\MyApp\\*.log'}
            aria-label={t('deepCleanV3.custom.ariaLabel')}
            aria-invalid={Boolean(locationError)}
            spellCheck={false}
            className="flex-1 min-w-0 font-mono text-[12.5px] px-3 py-2 rounded-lg bg-[color:var(--surface-hover)] border border-[color:var(--border-subtle)] text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--accent-primary)]/50"
          />
          <button
            type="button"
            className="btn-ghost px-3.5 py-2 rounded-lg text-[12px] font-medium shrink-0 disabled:opacity-50"
            onClick={add}
            disabled={typed.trim() === '' || busy}
          >
            {t('settings.exclusions.add')}
          </button>
        </div>
        {locationError && <p className="text-[12px] text-[color:var(--danger)] mt-1.5 select-text" role="alert">{locationError}</p>}

        {locations.length === 0 ? (
          <p className="text-[12.5px] text-[color:var(--text-muted)] mt-3">{t('deepCleanV3.custom.empty')}</p>
        ) : (
          <ul className="mt-3 divide-y divide-[color:var(--border-subtle)] rounded-lg border border-[color:var(--border-subtle)]">
            {locations.map((path) => (
              <li key={path} className="flex items-center gap-2 px-3 py-1.5">
                <span className="flex-1 min-w-0 font-mono text-[12px] text-[color:var(--text-primary)] break-all select-text">{path}</span>
                <button
                  type="button"
                  aria-label={t('deepCleanV3.custom.remove', path)}
                  onClick={() => remove(path)}
                  className="inline-flex items-center justify-center w-6 h-6 shrink-0 rounded text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--surface-hover)]"
                >
                  <svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <line x1="5" y1="5" x2="19" y2="19" /><line x1="19" y1="5" x2="5" y2="19" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="glass-panel p-6">
        <h2 className={`${HEADING_CLASS} mb-3`}>{t('deepCleanV3.imported.title')}</h2>
        <p className="text-[12.5px] text-[color:var(--text-secondary)] mb-4 max-w-[62ch]">{t('deepCleanV3.imported.description')}</p>

        <input
          ref={fileRef}
          type="file"
          accept=".xml,text/xml,application/xml"
          data-testid="import-cleaner-input"
          className="sr-only"
          tabIndex={-1}
          onChange={onFile}
        />
        <button
          type="button"
          className="btn-ghost px-3.5 py-2 rounded-lg text-[12px] font-medium disabled:opacity-50"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          {t('deepCleanV3.imported.button')}
        </button>

        <div aria-live="polite" className="mt-3">
          {importResult?.error && <p className="text-[12.5px] text-[color:var(--danger)] select-text">{importResult.error}</p>}
          {importResult?.ok && <ImportReport result={importResult} t={t} />}
        </div>

        {imported.length === 0 ? (
          <p className="text-[12.5px] text-[color:var(--text-muted)] mt-3">{t('deepCleanV3.imported.empty')}</p>
        ) : (
          <ul aria-label={t('deepCleanV3.imported.title')} className="mt-3 divide-y divide-[color:var(--border-subtle)] rounded-lg border border-[color:var(--border-subtle)]">
            {imported.map((cleaner) => (
              <li key={cleaner.id} className="flex items-center gap-3 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-[color:var(--text-primary)] truncate">{cleaner.label}</div>
                  <div className="text-[12px] text-[color:var(--text-muted)]">{t('deepCleanV3.imported.meta', cleaner.ruleCount)}</div>
                </div>
                <button
                  type="button"
                  aria-label={t('deepCleanV3.imported.remove', cleaner.label)}
                  onClick={() => removeImported(cleaner.id)}
                  className="inline-flex items-center justify-center w-6 h-6 shrink-0 rounded text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--surface-hover)]"
                >
                  <svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <line x1="5" y1="5" x2="19" y2="19" /><line x1="19" y1="5" x2="5" y2="19" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

/** The honest account of an import: what came over, and every kind of thing
 * that did not, with how many. */
function ImportReport({ result, t }) {
  const { report, cleaner, imported } = result;
  const label = cleaner?.label ?? '';
  return (
    <div className="text-[12.5px] text-[color:var(--text-primary)]">
      <p className="select-text">
        {imported
          ? t('deepCleanV3.imported.reportDone', label, report.options.imported, report.options.skipped, report.actions.imported, report.actions.skipped)
          : t('deepCleanV3.imported.reportNothing', label, report.options.skipped, report.actions.skipped)}
      </p>
      {report.skipped.length > 0 && (
        <ul className="mt-1 space-y-0.5 text-[color:var(--text-secondary)]">
          {report.skipped.filter((s) => SKIP_KINDS.has(s.kind)).map((skip) => (
            <li key={`${skip.kind}:${skip.detail}`} className="font-mono text-[11.5px] select-text">
              {t(`deepCleanV3.imported.skip.${skip.kind}`, skip.detail, skip.count)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
