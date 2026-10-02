import { useLanguage } from '../i18n/LanguageContext.jsx';

/** The "..." on a row: the same menu a right-click on the map opens, for
 * people who do not right-click (keyboard, touch, or simply nobody told
 * them). The menu opens beside the button, not at the pointer, so it lands
 * in the same place whatever opened it. 24 px square, the WCAG 2.2 floor. */
export function RowActionsButton({ name, onOpen }) {
  const { t } = useLanguage();
  return (
    <button
      type="button"
      aria-haspopup="menu"
      aria-label={t('diskMap.rowActionsLabel', name)}
      onClick={(e) => {
        e.stopPropagation();
        const box = e.currentTarget.getBoundingClientRect();
        onOpen({ clientX: box.right, clientY: box.bottom });
      }}
      className="w-6 h-6 shrink-0 rounded-md flex items-center justify-center text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--surface-hover)] transition-colors"
    >
      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="5" cy="12" r="2" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="19" cy="12" r="2" />
      </svg>
    </button>
  );
}
