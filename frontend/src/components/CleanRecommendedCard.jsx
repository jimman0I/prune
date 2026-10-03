import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { useCleanRecommended } from '../hooks/useCleanRecommended.js';
import { formatBytes } from '../lib/formatBytes.js';
import { formatRelativeTime } from '../lib/formatRelativeTime.js';
import { cleanOutcome } from '../lib/cleanOutcome.js';
import { cleanResultSentences } from '../lib/cleanResultText.js';

const CONFIRM_PROMPT = {
  quarantine: 'dashboardQolV3.clean.confirmQuarantine',
  recycle: 'dashboardQolV3.clean.confirmRecycle',
  delete: 'dashboardQolV3.clean.confirmDelete'
};
const CONFIRM_BUTTON = {
  quarantine: 'deepClean.confirm.confirmButton',
  recycle: 'deepClean.confirm.recycleButton',
  delete: 'deepClean.confirm.deleteButton'
};
const MODE_TEXT = {
  quarantine: 'deepClean.footer.modeQuarantine',
  recycle: 'deepClean.footer.modeRecycle',
  delete: 'deepClean.footer.modeDelete'
};

const GHOST = 'btn-ghost px-3 py-1.5 rounded-lg text-[12px] font-medium min-h-[28px] disabled:opacity-50';

/** Holds back the card's one network read (the rule listing) until the app has
 * had a moment: the Dashboard is the first screen, the program list is loading
 * behind it, and this card is not what anyone opened the app to see. */
function useArmed(delayMs) {
  const [armed, setArmed] = useState(delayMs <= 0);
  useEffect(() => {
    if (armed) return undefined;
    const handle = setTimeout(() => setArmed(true), delayMs);
    return () => clearTimeout(handle);
  }, [armed, delayMs]);
  return armed;
}

/** The Dashboard's "Clean recommended": the rules Deep Clean marks recommended
 * (and never one that loses data), cleaned in one pass with the removal mode the
 * person chose in Settings.
 *
 * It never acts on a click alone. The first button either measures (when Deep
 * Clean has no remembered scan) or opens a confirmation that names the total and
 * the destination; only that confirmation's own button removes anything. Delete
 * now is styled as the danger it is, exactly as in Deep Clean.
 *
 * Quiet by design -- the Dashboard has no single thing it wants you to do -- so
 * every button on it is a secondary one until a confirmation is open. */
export default function CleanRecommendedCard({ onNavigate = () => {}, armDelayMs = 1200, children = null }) {
  const { t, language } = useLanguage();
  const armed = useArmed(armDelayMs);
  const c = useCleanRecommended({ enabled: armed });

  const primaryRef = useRef(null);
  const cancelRef = useRef(null);
  const wasBusy = useRef(false);
  // Focus follows the card: into the confirmation when it opens (on Cancel, the
  // safe choice), and back to the first button when the card is at rest again,
  // so a keyboard user is never left on a control that has just disappeared.
  useEffect(() => {
    if (c.phase === 'confirm') cancelRef.current?.focus();
    else if (c.phase === 'idle' && wasBusy.current) primaryRef.current?.focus();
    wasBusy.current = c.phase !== 'idle';
  }, [c.phase]);

  const mode = c.removalMode;
  const modeLine = (
    <span
      data-testid="clean-recommended-mode"
      className={`text-[12px] ${mode === 'delete' ? 'text-[color:var(--warning)]' : 'text-[color:var(--text-muted)]'}`}
    >
      {t(MODE_TEXT[mode])}
    </span>
  );

  let body;
  let actions = null;

  if (c.phase === 'measuring') {
    body = (
      <p className="font-mono text-[15px] text-[color:var(--text-muted)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {c.scanTotal > 0 ? t('dashboard.quiet.junkProgress', c.scanned, c.scanTotal) : t('dashboard.quiet.junkMeasuring')}
      </p>
    );
    actions = <button type="button" className={GHOST} onClick={c.stop}>{t('deepClean.stop')}</button>;
  } else if (c.phase === 'confirm') {
    const size = formatBytes(c.confirmPlan.bytes);
    body = (
      <>
        <p className="text-[13px] text-[color:var(--text-primary)]" data-testid="clean-recommended-prompt">
          {t(CONFIRM_PROMPT[mode], size)}
        </p>
        {c.confirmPlan.fromCache && (
          <p data-testid="clean-recommended-cache-note" className="mt-1 text-[12px] text-[color:var(--text-secondary)]">
            {t('deepCleanV3.cache.confirmNote')}
          </p>
        )}
        <p className="mt-1">{modeLine}</p>
      </>
    );
    actions = (
      <>
        <button ref={cancelRef} type="button" className={GHOST} onClick={c.cancel}>{t('deepClean.confirm.cancel')}</button>
        <button
          type="button"
          // Danger, not accent, when it cannot be undone: the accent is for the
          // safe primary action.
          className={`${mode === 'delete' ? 'btn-danger rounded-lg' : 'btn-primary'} px-4 py-1.5 text-[12px] font-medium min-h-[28px]`}
          onClick={c.confirm}
        >
          {t(CONFIRM_BUTTON[mode])}
        </button>
      </>
    );
  } else if (c.phase === 'cleaning') {
    body = (
      <p className="font-mono text-[15px] text-[color:var(--text-muted)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {c.cleanTotal > 0 ? t('dashboardQolV3.clean.progress', c.executed, c.cleanTotal) : t('deepClean.confirm.cleaning')}
      </p>
    );
    actions = <button type="button" className={GHOST} onClick={c.stop}>{t('deepClean.stop')}</button>;
  } else if (c.phase === 'result') {
    const moved = c.result ? cleanOutcome(c.result).movedTo : null;
    body = c.cleanError ? (
      <p className="text-[13px] text-[color:var(--danger)] select-text">{t('deepClean.cleanErrorPrefix', c.cleanError)}</p>
    ) : (
      <div data-testid="clean-recommended-result" className="text-[13px] text-[color:var(--success)]">
        {cleanResultSentences(c.result, t).map((sentence, i) => (
          <p key={i}>{/[.!?]$/.test(sentence) ? sentence : `${sentence}.`}</p>
        ))}
      </div>
    );
    actions = (
      <>
        {/* The space is not back until Quarantine is emptied, so the way there is
            one click away -- a way, not the deed. */}
        {moved === 'quarantine' && (
          <button type="button" className={GHOST} onClick={() => onNavigate('quarantine')}>{t('deepClean.openQuarantine')}</button>
        )}
        <button ref={primaryRef} type="button" className={GHOST} onClick={c.dismiss}>{t('dashboardQolV3.clean.done')}</button>
      </>
    );
  } else if (!c.hasScanned) {
    body = <p className="text-[13px] text-[color:var(--text-secondary)]">{t('dashboardQolV3.clean.measureFirst')}</p>;
    actions = (
      <button ref={primaryRef} type="button" className={GHOST} onClick={c.begin} disabled={!c.ready}>
        {t('dashboardQolV3.clean.measure')}
      </button>
    );
  } else if (c.plan.count > 0) {
    body = (
      <>
        <div className="font-mono text-[18px] font-medium text-[color:var(--text-primary)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {t('dashboardQolV3.clean.found', formatBytes(c.plan.bytes))}
        </div>
        <div className="mt-1 text-[13px] text-[color:var(--text-secondary)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {t('dashboard.quiet.junkBasis', c.plan.count)}
          {c.lastScanAt && (
            <span data-testid="clean-recommended-last-measured">
              {' · '}{t('deepCleanV3.cache.lastMeasured', formatRelativeTime(c.lastScanAt, language))}
            </span>
          )}
        </div>
        <div className="mt-1">{modeLine}</div>
      </>
    );
    actions = (
      <>
        <button type="button" className={GHOST} onClick={c.rescan}>{t('deepClean.rescan')}</button>
        <button ref={primaryRef} type="button" className={GHOST} onClick={c.begin}>{t('dashboardQolV3.clean.review')}</button>
      </>
    );
  } else {
    body = <p className="text-[13px] text-[color:var(--text-secondary)]">{t('dashboardQolV3.clean.nothing')}</p>;
    actions = <button ref={primaryRef} type="button" className={GHOST} onClick={c.rescan}>{t('deepClean.rescan')}</button>;
  }

  const error = c.phase === 'idle' && c.scanError ? t('deepClean.scanErrorPrefix', c.scanError) : null;

  return (
    <section
      className="glass-panel mb-6 overflow-hidden"
      data-testid="clean-recommended"
      aria-labelledby="clean-recommended-title"
    >
      <div className="px-6 py-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1 basis-[260px]">
          <h2 id="clean-recommended-title" className="text-[13px] font-medium text-[color:var(--text-secondary)] mb-2">
            {t('dashboardQolV3.clean.title')}
          </h2>
          {/* Announced as it changes: measuring, asking, cleaning and the result
              all arrive in this one place. Polite, not assertive. */}
          <div role="status" aria-live="polite">{body}</div>
          {c.phase === 'idle' && !c.hasScanned && (
            <p className="mt-1 text-[12px] text-[color:var(--text-muted)]">{t('dashboardQolV3.clean.intro')}</p>
          )}
          {error && <p className="mt-1 text-[12.5px] text-[color:var(--danger)] select-text">{error}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
      </div>
      {children}
    </section>
  );
}
