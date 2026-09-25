import { useEffect, useRef, useState } from 'react';
import ModalOverlay from './ModalOverlay.jsx';
import { fetchBugReportInfo, openBugReport } from '../lib/api.js';
import { useSingleFlight } from '../hooks/useSingleFlight.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

/** "Report a bug": writes a report and opens it as a prefilled GitHub issue.
 *
 * Prune sends nothing. The backend builds an issue address from the two
 * fields below and opens it in the user's browser, where GitHub shows the
 * whole thing before anything is posted -- so the dialog's job is to say
 * plainly what will be in it (their words plus three facts about this
 * machine, listed here from the same source the report uses) and that
 * GitHub reports are public.
 *
 * Sits in ModalOverlay like every other dialog, which supplies the focus
 * trap, Escape, initial focus and focus restore. If the browser cannot be
 * opened the error is shown selectable, with "Copy report" as the way to
 * get the text out by hand.
 *
 * Closing with text typed asks first ("Discard this report?"), routed through
 * one guard so Escape, the overlay and Cancel all behave the same. Prune
 * cannot know the browser really opened, so the "opened" view says "should"
 * and keeps Copy report beside Close: the text is never stranded.
 */
const fieldClass =
  'w-full text-[12.5px] px-2.5 py-2 rounded-lg bg-[color:var(--surface-hover)] border border-[color:var(--border-subtle)] text-[color:var(--text-primary)] focus:border-[color:var(--accent-primary)]/50 select-text';

export default function BugReportModal({ onClose }) {
  const { t } = useLanguage();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [info, setInfo] = useState(null);
  const [state, setState] = useState('editing'); // editing | opening | opened
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const keepRef = useRef(null);
  const closeRef = useRef(null);
  const detailsRef = useRef(null);
  const wasConfirming = useRef(false);

  // The three machine facts are informational; if they cannot be read the
  // list just omits their values and the report still opens.
  useEffect(() => {
    let live = true;
    fetchBugReportInfo().then((data) => { if (live) setInfo(data); }).catch(() => {});
    return () => { live = false; };
  }, []);

  const cleanTitle = title.trim();
  const cleanDescription = description.trim();
  const hasDraft = state === 'editing' && (cleanTitle !== '' || cleanDescription !== '');

  // Every way out funnels through here. A draft asks first; Escape while the
  // question is showing answers it the safe way (keep writing). Nothing to
  // lose (empty form, or already sent to the browser) closes at once.
  const requestClose = () => {
    if (confirming) setConfirming(false);
    else if (hasDraft) setConfirming(true);
    else onClose?.();
  };

  useEffect(() => {
    if (confirming) keepRef.current?.focus();
    else if (wasConfirming.current) detailsRef.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);

  useEffect(() => {
    if (state === 'opened') closeRef.current?.focus();
  }, [state]);

  const canOpen = cleanDescription !== '' && state === 'editing';

  const open = useSingleFlight(async () => {
    if (!cleanDescription) return;
    setState('opening');
    setError(null);
    try {
      await openBugReport({ title: cleanTitle, description: cleanDescription });
      setState('opened');
    } catch (err) {
      setState('editing');
      setError(err.message);
    }
  });

  const copyReport = async () => {
    const footer = info ? `\n\n---\nPrune ${info.version} · ${info.windows} · ${info.arch}` : '';
    const text = `${cleanTitle ? `${cleanTitle}\n\n` : ''}${cleanDescription}${footer}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch { /* nothing more to offer; the text is still in the box */ }
  };

  const facts = [
    [t('bugReport.includedVersion'), info?.version],
    [t('bugReport.includedWindows'), info?.windows],
    [t('bugReport.includedArch'), info?.arch]
  ];

  return (
    <ModalOverlay label={t('bugReport.title')} onClose={requestClose} dismissible={state !== 'opening'}>
      <div className="glass-panel w-full max-w-[520px] p-6">
        <h2 className="display-heading text-[20px] mb-1">{t('bugReport.title')}</h2>
        <p className="text-[12.5px] text-[color:var(--text-secondary)] leading-relaxed mb-4">{t('bugReport.intro')}</p>

        {state === 'opened' ? (
          <>
            <p role="status" className="text-[13px] text-[color:var(--text-primary)] leading-relaxed mb-5">
              {t('bugReport.opened')}
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost px-3 py-1.5 rounded-md text-[12.5px] min-h-[24px]" onClick={copyReport}>
                {copied ? t('bugReport.copied') : t('bugReport.copy')}
              </button>
              <button ref={closeRef} type="button" className="btn-primary px-3 py-1.5 rounded-md text-[12.5px] min-h-[24px]" onClick={onClose}>
                {t('bugReport.close')}
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="block mb-3">
              <span className="block text-[12px] font-medium text-[color:var(--text-secondary)] mb-1">{t('bugReport.summaryLabel')}</span>
              <input
                type="text"
                className={fieldClass}
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className="block mb-4">
              <span className="block text-[12px] font-medium text-[color:var(--text-secondary)] mb-1">{t('bugReport.detailsLabel')}</span>
              <textarea
                ref={detailsRef}
                className={`${fieldClass} min-h-[110px] resize-y`}
                value={description}
                maxLength={4000}
                placeholder={t('bugReport.detailsPlaceholder')}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>

            <div className="rounded-lg border border-[color:var(--border-subtle)] p-3 mb-3" role="group" aria-label={t('bugReport.includedHeading')}>
              <div className="text-[11px] font-medium text-[color:var(--text-secondary)] mb-1.5">{t('bugReport.includedHeading')}</div>
              <ul className="text-[11.5px] text-[color:var(--text-muted)] space-y-0.5 list-disc pl-4">
                <li>{t('bugReport.includedText')}</li>
                {facts.map(([label, value]) => (
                  <li key={label}>{value ? `${label}: ${value}` : label}</li>
                ))}
              </ul>
              <p className="text-[11px] text-[color:var(--text-muted)] mt-2 leading-snug">{t('bugReport.includedNothingElse')}</p>
            </div>

            <p className="text-[11.5px] text-[color:var(--text-muted)] leading-snug mb-4">{t('bugReport.publicNote')}</p>

            {error && (
              <div className="mb-4">
                <div role="alert" className="text-[12px] text-[color:var(--danger)] leading-snug select-text">
                  {t('bugReport.failed')}: {error}
                </div>
                <button type="button" className="btn-ghost px-3 py-1.5 rounded-md text-[12px] min-h-[24px] mt-2" onClick={copyReport}>
                  {copied ? t('bugReport.copied') : t('bugReport.copy')}
                </button>
              </div>
            )}

            {confirming ? (
              <div role="group" aria-label={t('bugReport.discardPrompt')} className="flex flex-wrap items-center justify-end gap-2">
                <span className="text-[12.5px] text-[color:var(--text-primary)] mr-auto">{t('bugReport.discardPrompt')}</span>
                <button
                  ref={keepRef}
                  type="button"
                  className="btn-ghost px-3 py-1.5 rounded-md text-[12.5px] min-h-[24px]"
                  onClick={() => setConfirming(false)}
                >
                  {t('bugReport.keepWriting')}
                </button>
                <button
                  type="button"
                  className="btn-danger px-3 py-1.5 rounded-md text-[12.5px] min-h-[24px]"
                  onClick={onClose}
                >
                  {t('bugReport.discard')}
                </button>
              </div>
            ) : (
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="btn-ghost px-3 py-1.5 rounded-md text-[12.5px] min-h-[24px] disabled:opacity-40"
                  onClick={requestClose}
                  disabled={state === 'opening'}
                >
                  {t('bugReport.cancel')}
                </button>
                <button
                  type="button"
                  className="btn-primary px-3 py-1.5 rounded-md text-[12.5px] min-h-[24px] disabled:opacity-40"
                  onClick={open}
                  disabled={!canOpen}
                >
                  {state === 'opening' ? t('bugReport.opening') : t('bugReport.open')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </ModalOverlay>
  );
}
