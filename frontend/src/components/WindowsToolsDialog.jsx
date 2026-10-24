import { useEffect, useState } from 'react';
import { fetchWindowsTools, launchWindowsTool } from '../lib/api.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { useToasts } from '../hooks/useToasts.jsx';

/** Windows' own tools, one click away (backend services/windowsTools.js).
 *
 * Opened from the Dashboard, the screen about this PC as a whole: these are
 * system tools, not tools for one program, so the Applications toolbar is
 * the wrong home for them and Settings -- Prune's own preferences -- is a
 * worse one.
 *
 * Only what the backend found on this PC is listed, grouped the way someone
 * looks for them (repair, diagnose, manage...). The window sends an id and
 * nothing else; what runs is the backend's fixed list. The ones that raise a
 * UAC dialog say so before the click, with a shield, because a consent
 * dialog nobody was warned about is how people learn to click Yes unread.
 * A declined dialog is said in words, quietly; Flush DNS, which has no
 * window of its own to show for itself, reports with a toast. */

const GROUP_ORDER = ['repair', 'diagnose', 'manage', 'programs', 'network', 'access'];

/** The shield Windows itself puts beside a control that asks for
 * administrator -- drawn, not an emoji, so it takes the text colour. */
function Shield() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d="M12 3l7 3v6c0 4.2-2.9 7.8-7 9-4.1-1.2-7-4.8-7-9V6l7-3z"></path>
    </svg>
  );
}

export default function WindowsToolsDialog({ onClose }) {
  const { t } = useLanguage();
  const toasts = useToasts();
  const [tools, setTools] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [starting, setStarting] = useState(null);
  const [note, setNote] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchWindowsTools()
      .then((list) => { if (!cancelled) setTools(list); })
      .catch((err) => { if (!cancelled) setLoadError(err.message); });
    return () => { cancelled = true; };
  }, []);

  const start = async (tool) => {
    if (starting) return;
    setStarting(tool.id);
    setNote(null);
    setError(null);
    const name = t(`windowsToolsV1.tools.${tool.id}.name`);
    try {
      const result = await launchWindowsTool(tool.id);
      if (result?.ok) {
        if (tool.kind === 'action') toasts.success(t('windowsToolsV1.flushed'));
      } else if (result?.cancelled) {
        setNote(t('windowsToolsV1.cancelled'));
      } else {
        setError(`${name}: ${t('windowsToolsV1.failed', result?.error ?? '')}`);
      }
    } finally {
      setStarting(null);
    }
  };

  const groups = GROUP_ORDER
    .map((group) => ({ group, items: (tools ?? []).filter((tool) => tool.group === group) }))
    .filter(({ items }) => items.length > 0);

  return (
    <div className="glass-panel w-full max-w-[680px] max-h-[85vh] flex flex-col p-6 rounded-xl">
      <h2 className="display-heading text-[19px] mb-2">{t('windowsToolsV1.title')}</h2>
      <p className="text-[13px] text-[color:var(--text-secondary)] leading-relaxed mb-4 max-w-[70ch]">{t('windowsToolsV1.intro')}</p>

      <div className="min-h-0 overflow-y-auto -mx-2 px-2">
        {!tools && !loadError && (
          <p role="status" className="text-[12.5px] text-[color:var(--text-muted)] py-6">{t('windowsToolsV1.loading')}</p>
        )}
        {loadError && (
          <p role="alert" className="text-[12.5px] text-[color:var(--danger)] py-6 select-text">{t('windowsToolsV1.loadError', loadError)}</p>
        )}
        {groups.map(({ group, items }) => (
          <section key={group} aria-labelledby={`windows-tools-${group}`} className="mb-4 last:mb-0">
            <h3 id={`windows-tools-${group}`} className="text-[11px] font-mono uppercase tracking-[0.14em] text-[color:var(--text-muted)] mb-1.5">
              {t(`windowsToolsV1.groups.${group}`)}
            </h3>
            <ul className="divide-y divide-[color:var(--border-subtle)]">
              {items.map((tool) => {
                const name = t(`windowsToolsV1.tools.${tool.id}.name`);
                const busy = starting === tool.id;
                return (
                  <li key={tool.id} className="flex items-center justify-between gap-4 py-2.5">
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-[color:var(--text-primary)]">{name}</div>
                      <p className="text-[12px] text-[color:var(--text-secondary)] mt-0.5 leading-snug">{t(`windowsToolsV1.tools.${tool.id}.description`)}</p>
                      {(tool.command || tool.elevated) && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11.5px] text-[color:var(--text-muted)]">
                          {tool.command && <code className="font-mono select-text">{tool.command}</code>}
                          {tool.elevated && (
                            <span className="inline-flex items-center gap-1 text-[color:var(--warning)]" data-testid={`elevated-${tool.id}`}>
                              <Shield />
                              {t('windowsToolsV1.admin')}
                            </span>
                          )}
                          {tool.elevated && tool.kind === 'window' && tool.command && <span>{t('windowsToolsV1.console')}</span>}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn-ghost shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-medium min-h-[28px] disabled:opacity-50"
                      aria-label={`${tool.kind === 'action' ? t('windowsToolsV1.run') : t('windowsToolsV1.open')} ${name}`}
                      aria-busy={busy || undefined}
                      disabled={Boolean(starting) && !busy}
                      onClick={() => start(tool)}
                    >
                      {busy ? t('windowsToolsV1.opening') : tool.kind === 'action' ? t('windowsToolsV1.run') : t('windowsToolsV1.open')}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {note && <p role="status" className="text-[12px] text-[color:var(--text-secondary)] leading-snug mt-4">{note}</p>}
      {error && <p role="alert" className="text-[12px] text-[color:var(--danger)] leading-snug mt-4 select-text">{error}</p>}

      <div className="flex justify-end mt-5">
        {/* Focused first (see Dashboard's ModalOverlay initialFocus): the
            first tool's button would otherwise take it, and an Enter meant
            for something else would start System Restore. */}
        <button type="button" data-windows-tools-close className="btn-ghost px-3 py-1.5 rounded-md text-[12.5px]" onClick={onClose}>
          {t('windowsToolsV1.close')}
        </button>
      </div>
    </div>
  );
}
