import { useEffect, useRef, useState } from 'react';
import { findProgramByFile } from '../lib/api.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const fileNameOf = (path) => String(path).split(/[\\/]/).pop();

/** "Find in Prune (uninstall)": from a program (.exe) or a shortcut (.lnk) to the
 * installed program it belongs to.
 *
 * Reached from File Explorer's right-click entry and by dropping a file onto the
 * Applications screen. It only LOOKS (the backend matches the file's folder to
 * the installed programs the way Hunter does) and then:
 *
 *   a match     hands the program to the ordinary uninstall dialog at once. That
 *               dialog is where anything is confirmed; this one never removes
 *               anything and has no uninstall button of its own.
 *   no match    says so by the file's name and offers Forced uninstall, seeded
 *               with the name and the folder (the dialog it opens scans, then
 *               asks).
 *   Windows /   a file that is part of Windows, a file that is gone, a shortcut
 *   unreadable  whose program cannot be told: it says so and offers nothing.
 *
 * It is busy while the lookup runs (the installed lists take a few seconds), and
 * an answer that arrives after the dialog was closed is dropped. */
export default function FindProgramDialog({ path, programs = [], onClose, onBusyChange, onUninstall, onForced }) {
  const { t } = useLanguage();
  const [outcome, setOutcome] = useState(null); // null while looking
  const alive = useRef(true);
  const latest = useRef({});
  latest.current = { programs, onUninstall, onBusyChange };

  useEffect(() => {
    alive.current = true;
    findProgramByFile(path).then(
      (result) => {
        if (!alive.current) return;
        if (result.status === 'matched' && result.program) {
          // Prefer the list's own copy of the program (it carries the sizes and
          // icons the uninstall dialog shows), as Hunter does.
          const { programs: list, onUninstall: uninstall } = latest.current;
          uninstall?.(list.find((p) => p.id === result.program.id) ?? result.program);
          return;
        }
        setOutcome(result);
      },
      (err) => { if (alive.current) setOutcome({ status: 'failed', error: err.message }); }
    );
    return () => { alive.current = false; };
  }, [path]);

  const looking = outcome === null;
  useEffect(() => { latest.current.onBusyChange?.(looking); }, [looking]);
  useEffect(() => () => latest.current.onBusyChange?.(false), []);

  let message = null;
  if (outcome?.status === 'unmatched') message = t('explorerV3.find.unmatched', outcome.name || fileNameOf(path));
  else if (outcome?.status === 'windows') message = t('explorerV3.find.windows');
  else if (outcome?.status === 'unresolved') message = t(outcome.reason === 'missing' ? 'explorerV3.find.missing' : 'explorerV3.find.noTarget');
  else if (outcome?.status === 'failed') message = t('explorerV3.find.failed', outcome.error || '');

  return (
    <div data-modal-panel className="glass-panel rounded-2xl overflow-hidden max-w-[560px] w-full flex flex-col max-h-[85vh]">
      <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-[color:var(--border-subtle)] shrink-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-[color:var(--text-primary)]">{t('explorerV3.find.title')}</h2>
        <button type="button" onClick={onClose} disabled={looking} className="btn-ghost px-3 py-1.5 rounded-lg text-[12px] font-medium disabled:opacity-40">
          {t('uninstallModal.close')}
        </button>
      </div>

      <div data-modal-body className="px-6 py-5 overflow-y-auto min-h-0">
        <div className="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-panel)] px-4 py-3 mb-5">
          <div className="text-[13px] font-medium truncate">{fileNameOf(path)}</div>
          <div className="text-[11.5px] text-[color:var(--text-muted)] font-mono break-all select-text mt-0.5">{path}</div>
        </div>

        {looking && (
          <div role="status" className="flex items-center gap-3 py-2">
            <div aria-hidden="true" className="w-5 h-5 border-2 border-[color:var(--accent-primary)] border-t-transparent rounded-full animate-spin shrink-0"></div>
            <p className="text-[13px] text-[color:var(--text-secondary)]">{t('explorerV3.find.looking')}</p>
          </div>
        )}

        {message && (
          <p role={outcome.status === 'failed' ? 'alert' : 'status'} className={`text-[13px] mb-1 select-text ${outcome.status === 'failed' ? 'text-[color:var(--danger)]' : 'text-[color:var(--text-primary)]'}`}>
            {message}
          </p>
        )}

        {outcome?.status === 'unmatched' && (
          <>
            <p className="text-[12.5px] text-[color:var(--text-secondary)] mt-2 mb-5 max-w-[62ch]">{t('explorerV3.find.unmatchedHint')}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-ghost px-3 py-1.5 rounded-lg text-[12px] font-medium"
                onClick={() => onForced?.({ name: outcome.name || fileNameOf(path).replace(/\.[^.]*$/, ''), folder: outcome.folder || '' })}
              >
                {t('uninstallerV3.forced.button')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
