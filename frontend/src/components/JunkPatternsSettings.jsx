import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchJunkPatterns, saveJunkPatterns, resetJunkPatterns } from '../lib/api.js';
import { keys } from '../lib/queryClient.js';
import { patternDescriptionKey } from '../lib/junkFiles.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

/** Settings -> Cleanup: "Junk file patterns", what Deep Clean's Junk files
 * scan looks for.
 *
 * Each pattern can be switched off without losing it, removed, or added; Reset
 * to defaults puts the shipped list back. The backend decides what is
 * acceptable (lib/junkPatterns.js) and answers a refusal with a reason code,
 * which this says in the person's language -- "*" is refused because it would
 * match every file, "*.dll" because it names libraries, desktop.ini because
 * it is what gives a folder its icon and name. The list is saved whole on every
 * change, so what is on screen is always exactly what was saved. */

const HEADING_CLASS = 'text-[11px] font-mono uppercase tracking-[0.14em] text-[color:var(--text-muted)]';
const REASONS = new Set(['empty', 'long', 'separator', 'invalid', 'everything', 'executable', 'desktopIni', 'duplicate', 'tooMany']);

export default function JunkPatternsSettings() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  // Called inside a function rather than handed over by reference (as
  // useDrives does), so the list failing for any reason -- its endpoint
  // missing included -- lands in the query's error state instead of throwing
  // while the rest of the Cleanup tab renders.
  const { data } = useQuery({ queryKey: keys.junkPatterns, queryFn: () => fetchJunkPatterns(), retry: 1 });
  const [typed, setTyped] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const [confirmingReset, setConfirmingReset] = useState(false);
  const cancelResetRef = useRef(null);
  // The harmless answer takes focus: the button that asked is gone.
  useEffect(() => { if (confirmingReset) cancelResetRef.current?.focus(); }, [confirmingReset]);

  const patterns = data?.patterns ?? [];
  const sameList = (a, b) => a.length === b.length
    && a.every((p, i) => p.pattern.toLowerCase() === b[i].pattern.toLowerCase() && p.enabled === b[i].enabled);
  const isDefaults = Boolean(data?.defaults) && sameList(patterns, data.defaults);

  const explain = (err) => (REASONS.has(err?.reason)
    ? t(`junkFiles.settings.error.${err.reason}`)
    : t('junkFiles.settings.error.failed', err?.message ?? ''));

  /** Saves `next` and shows what the backend kept. */
  const save = async (next) => {
    setError(null);
    setBusy(true);
    try {
      const saved = await saveJunkPatterns(next.map(({ pattern, enabled }) => ({ pattern, enabled })));
      queryClient.setQueryData(keys.junkPatterns, (old) => ({ ...(old ?? {}), patterns: saved.patterns }));
      // The saved settings carry the list too; anything reading them must see it.
      queryClient.invalidateQueries({ queryKey: keys.settings });
      return true;
    } catch (err) {
      setError(explain(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    if (typed.trim() === '' || busy) return;
    if (await save([...patterns, { pattern: typed.trim(), enabled: true }])) setTyped('');
  };

  const toggle = (pattern) => save(patterns.map((p) => (p.pattern === pattern ? { ...p, enabled: !p.enabled } : p)));
  const remove = (pattern) => save(patterns.filter((p) => p.pattern !== pattern));

  const reset = async () => {
    setConfirmingReset(false);
    setError(null);
    setBusy(true);
    try {
      const saved = await resetJunkPatterns();
      queryClient.setQueryData(keys.junkPatterns, (old) => ({ ...(old ?? {}), patterns: saved.patterns }));
      queryClient.invalidateQueries({ queryKey: keys.settings });
    } catch (err) {
      setError(explain(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass-panel p-6" data-testid="junk-patterns-settings">
      <h2 className={`${HEADING_CLASS} mb-3`}>{t('junkFiles.settings.title')}</h2>
      <p className="text-[12.5px] text-[color:var(--text-secondary)] mb-4 max-w-[110ch]">{t('junkFiles.settings.description')}</p>

      <div className="flex items-center gap-2 mb-1">
        <input
          type="text"
          value={typed}
          onChange={(e) => { setTyped(e.target.value); setError(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
          placeholder="*.tmp   ~*.*   thumbs.db"
          aria-label={t('junkFiles.settings.ariaLabel')}
          aria-invalid={Boolean(error)}
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
      <p className={`text-[11.5px] mb-3 ${error ? 'text-[color:var(--danger)]' : 'text-[color:var(--text-muted)]'}`} role={error ? 'alert' : undefined}>
        {error || t('junkFiles.settings.formatHint')}
      </p>

      {/* Nothing until the list has loaded: an empty box first and rows a
          moment later reads as the list having been emptied. */}
      {!data ? null : patterns.length === 0 ? (
        <p className="text-[12.5px] text-[color:var(--text-muted)]">{t('junkFiles.settings.empty')}</p>
      ) : (
        <ul aria-label={t('junkFiles.settings.title')} className="divide-y divide-[color:var(--border-subtle)] rounded-lg border border-[color:var(--border-subtle)]">
          {patterns.map((p) => {
            const descriptionKey = patternDescriptionKey(p.pattern);
            return (
              <li key={p.pattern} className="flex items-center gap-3 px-3 py-1.5">
                <label className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer">
                  <input
                    type="checkbox"
                    className="prune-check"
                    checked={p.enabled}
                    onChange={() => toggle(p.pattern)}
                    disabled={busy}
                    aria-label={t('junkFiles.settings.lookFor', p.pattern)}
                  />
                  <span className={`font-mono text-[12.5px] shrink-0 ${p.enabled ? 'text-[color:var(--text-primary)]' : 'text-[color:var(--text-muted)]'}`}>{p.pattern}</span>
                  {descriptionKey && (
                    <span className="text-[12px] text-[color:var(--text-muted)] truncate min-w-0">{t(`junkFiles.describe.${descriptionKey}`)}</span>
                  )}
                </label>
                {p.preselected && (
                  <span className="shrink-0 text-[11px] font-medium px-1.5 py-px rounded-full border border-[color:var(--control-border)] text-[color:var(--text-secondary)]">
                    {t('junkFiles.settings.preselected')}
                  </span>
                )}
                <button
                  type="button"
                  aria-label={t('junkFiles.settings.remove', p.pattern)}
                  onClick={() => remove(p.pattern)}
                  disabled={busy}
                  className="inline-flex items-center justify-center w-6 h-6 shrink-0 rounded text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--surface-hover)] disabled:opacity-50"
                >
                  <svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <line x1="5" y1="5" x2="19" y2="19" /><line x1="19" y1="5" x2="5" y2="19" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Asked first only when it would lose something: a list that already
          is the defaults has nothing to lose, and a question with one
          answer is noise. */}
      <div className="mt-3 flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
        {confirmingReset ? (
          <>
            <p className="text-[12.5px] text-[color:var(--text-primary)] mr-auto" role="alert">{t('junkFiles.settings.resetConfirm')}</p>
            <button ref={cancelResetRef} type="button" className="btn-ghost px-3.5 py-2 rounded-lg text-[12px] font-medium" onClick={() => setConfirmingReset(false)}>
              {t('deepClean.confirm.cancel')}
            </button>
            <button type="button" className="btn-danger px-3.5 py-2 rounded-lg text-[12px] font-medium disabled:opacity-50" onClick={reset} disabled={busy}>
              {t('junkFiles.settings.reset')}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn-ghost px-3.5 py-2 rounded-lg text-[12px] font-medium disabled:opacity-50"
            onClick={() => (isDefaults ? reset() : setConfirmingReset(true))}
            disabled={busy}
          >
            {t('junkFiles.settings.reset')}
          </button>
        )}
      </div>
    </div>
  );
}
