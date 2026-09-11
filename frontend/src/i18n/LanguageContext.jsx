import { createContext, useContext, useMemo } from 'react';
import { useSettings } from '../hooks/useSystemQueries.js';
import { CATALOG } from './catalog.js';
import { LANGUAGES, isSupportedLanguage } from './languages.js';

const LanguageContext = createContext(null);

/** Walks a dotted path ("settings.language.title") down a catalog object.
 * Undefined at any step, rather than throwing -- callers decide what a
 * missing key means. */
function resolve(node, path) {
  return path.split('.').reduce((current, key) => current?.[key], node);
}

/** The string (or, for a parameterised key, the function) at `path` in
 * `language`'s catalog, falling back to English for a key that language
 * does not have. That fallback is a safety net for a translation still
 * being written, not a substitute for catalog.test.js's own completeness
 * check -- every shipped key must be real in every language. */
export function translate(language, path) {
  const value = resolve(CATALOG[language], path) ?? resolve(CATALOG.en, path);
  if (value === undefined) throw new Error(`No translation for "${path}"`);
  return value;
}

/** What Prune's own screens are shown in.
 *
 * Reads settings.language the same way every other persisted choice does
 * (useSettings()) rather than keeping a second copy of it, so it follows
 * whatever the installer picked or Windows' own display language the
 * moment a fresh settings.json says so -- see
 * backend/src/services/settings.js's detectDefaultLanguage() and
 * services/installerChoices.js for where that value first arrives. */
export function LanguageProvider({ children }) {
  const { settings } = useSettings();
  const language = isSupportedLanguage(settings?.language) ? settings.language : 'en';

  const value = useMemo(() => ({
    language,
    /** `t('settings.language.title')` for a plain string; `t('update.ariaLabel', version)`
     * for a key whose catalog value is a function -- called with
     * whatever arguments follow the path. */
    t: (path, ...args) => {
      const entry = translate(language, path);
      return typeof entry === 'function' ? entry(...args) : entry;
    }
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside a LanguageProvider');
  return context;
}

export { LANGUAGES };
