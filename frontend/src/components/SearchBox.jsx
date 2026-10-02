import { useLanguage } from '../i18n/LanguageContext.jsx';

/** The Disk Map's search box (see lib/searchFilter.js for what it accepts).
 *
 * Plain text field with a clear button, not `type="search"`: the browser's
 * own clear control varies by engine and cannot be labelled in the app's
 * language. Escape clears it. A pattern that does not parse is said so under
 * the box and marked invalid for assistive tech -- nothing is filtered while
 * it is, so a half-typed regex never blanks the screen. */
export function SearchBox({ value, onChange, invalid }) {
  const { t } = useLanguage();
  return (
    <div className="min-w-0">
      <div className="relative">
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)] pointer-events-none">
          <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" />
        </svg>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape' && value !== '') { e.preventDefault(); onChange(''); } }}
          aria-label={t('diskMapV3.search.label')}
          aria-invalid={invalid ? 'true' : undefined}
          placeholder={t('diskMapV3.search.placeholder')}
          spellCheck={false}
          autoComplete="off"
          className={`w-[260px] max-w-full min-h-8 pl-8 pr-8 rounded-lg text-[12.5px] font-mono bg-[color:var(--surface-subtle)] text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)] border outline-none focus-visible:border-[color:var(--accent-primary)] ${
            invalid ? 'border-[color:var(--danger)]' : 'border-[color:var(--border-subtle)]'
          }`}
        />
        {value !== '' && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label={t('diskMapV3.search.clear')}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--surface-hover)] transition-colors"
          >
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        )}
      </div>
      {invalid && (
        <p role="alert" className="mt-1 text-[11.5px] text-[color:var(--danger)]">{t('diskMapV3.search.invalid')}</p>
      )}
    </div>
  );
}
