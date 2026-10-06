import ModalOverlay from './ModalOverlay.jsx';
import { NAV_ICONS } from './NavRail.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { entryFor, majorMinor } from '../lib/whatsNew.js';

/** A sidebar with its icon column and a panel beside it: the one card whose
 * glyph is not a screen's own. */
const RAIL_ICON = (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="16" rx="2"></rect>
    <path d="M9 4v16"></path>
    <path d="M5.5 8.5h.01"></path>
    <path d="M5.5 12h.01"></path>
    <path d="M5.5 15.5h.01"></path>
  </svg>
);

const ICONS = { ...NAV_ICONS, rail: RAIL_ICON };

/** "What's new in this version": what the update added and where to find it.
 *
 * Presentational. Whether it appears, and what closing it records, is App's
 * and hooks/useWhatsNew.js's business; this only draws the entry for
 * `version` and reports two things: it was dismissed (Got it, Escape, a click
 * on the scrim), or a card's "Show me" was chosen.
 *
 * Focus starts on "Got it": nothing here is destructive, and Enter should
 * simply put it away. The card list scrolls on its own so the buttons never
 * leave the window on a short one. Entrance is the app's screen fade, which
 * the reduced-motion rule in index.css already collapses. */
export default function WhatsNewDialog({ version, onClose, onShowMe }) {
  const { t } = useLanguage();
  const entry = entryFor(version);
  if (!entry) return null;

  const ns = entry.namespace;
  const title = t(`${ns}.ui.title`, majorMinor(version));

  return (
    <ModalOverlay label={title} onClose={onClose} closeOnBackdrop initialFocus="[data-whats-new-primary]">
      <div className="glass-panel w-full max-w-[720px] max-h-[calc(100vh-48px)] flex flex-col p-6 [animation:screen-in_240ms_var(--ease-out-expo)_both]">
        <h2 className="display-heading text-[22px] leading-tight">{title}</h2>
        <p className="text-[13px] text-[color:var(--text-secondary)] mt-1.5">{t(`${ns}.ui.intro`)}</p>

        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5 min-h-0 overflow-y-auto pr-1">
          {entry.cards.map((card) => {
            const headingId = `whats-new-${card.id}`;
            return (
              <li key={card.id} className="rounded-xl border border-[color:var(--border-subtle)] p-4 flex flex-col gap-1.5">
                <div className="flex items-center gap-2.5 text-[color:var(--accent-primary)]">
                  <span className="shrink-0">{ICONS[card.icon]}</span>
                  <h3 id={headingId} className="text-[14px] font-medium text-[color:var(--text-primary)]">{t(`${ns}.cards.${card.id}.title`)}</h3>
                </div>
                <p className="text-[12.5px] text-[color:var(--text-secondary)] leading-relaxed">{t(`${ns}.cards.${card.id}.description`)}</p>
                {card.target && (
                  <button
                    type="button"
                    aria-describedby={headingId}
                    className="btn-ghost self-start mt-auto px-3 py-1.5 rounded-lg text-[12.5px] min-h-[24px]"
                    onClick={() => onShowMe(card.target)}
                  >
                    {t(`${ns}.ui.showMe`)}
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        <p className="text-[12px] text-[color:var(--text-muted)] mt-4">{t(`${ns}.ui.backgroundNote`)}</p>
        <div className="flex justify-end mt-4">
          <button type="button" data-whats-new-primary className="btn-primary px-4 py-1.5 rounded-lg text-[12.5px] min-h-[24px]" onClick={onClose}>
            {t(`${ns}.ui.gotIt`)}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
