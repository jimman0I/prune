import { THEME_CHOICES } from '../lib/theme.js';
import { useTheme } from '../hooks/useTheme.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';

/** System / Light / Dark.
 *
 * Replaces the single sun/moon flip. The flip wrote an explicit value on
 * its first click, so an install could never get back to "whatever Windows
 * is set to" -- the one behaviour every untouched install starts with. Here
 * System is a real third choice, and it is the one marked when nothing has
 * been picked.
 *
 * Plain buttons with `aria-pressed` in a named group rather than a radio
 * group: it is one choice from three, which either would express, but the
 * forced-colors block in index.css already outlines `button[aria-pressed=true]`,
 * so the selected option stays visible in Windows high contrast for free.
 *
 * What is marked is the CHOICE, not the palette on screen. System resolving
 * to dark must not light up Dark: the two behave differently the next time
 * Windows switches.
 */
export default function ThemeToggle() {
  const { choice, setChoice } = useTheme();
  const { t } = useLanguage();

  const LABELS = {
    system: t('themeToggle.optionSystem'),
    light: t('themeToggle.optionLight'),
    dark: t('themeToggle.optionDark')
  };

  return (
    <div
      role="group"
      aria-label={t('settings.appearance.title')}
      className="flex items-center gap-1 p-1 rounded-xl shrink-0 bg-[color:var(--surface-hover)] border border-[color:var(--border-subtle)]"
    >
      {THEME_CHOICES.map((id) => {
        const on = choice === id;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={on}
            onClick={() => setChoice(id)}
            className={`px-3.5 py-1.5 rounded-lg text-[12.5px] font-medium transition-colors ${
              on
                ? 'pill-selected bg-[color:var(--accent-primary-soft)] text-[color:var(--accent-primary)]'
                : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--surface-strong)]'
            }`}
          >
            {LABELS[id]}
          </button>
        );
      })}
    </div>
  );
}
