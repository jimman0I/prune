/** The 40 languages Prune can be shown in.
 *
 * Deliberately a duplicate of backend/src/services/languages.js's own
 * list rather than a shared import: the frontend and backend are
 * separate npm packages with no code path between them (the same reason
 * formatBytes is re-implemented per component rather than shared). Both
 * lists are covered by catalog.test.js, which fails if this one names a
 * code the catalog has no translations for, or the catalog has a
 * language this one doesn't offer. */
export const LANGUAGES = [
  { code: 'en', english: 'English', native: 'English' },
  { code: 'af', english: 'Afrikaans', native: 'Afrikaans' },
  { code: 'ar', english: 'Arabic', native: 'العربية' },
  { code: 'ca', english: 'Catalan', native: 'Català' },
  { code: 'cs', english: 'Czech', native: 'Čeština' },
  { code: 'cy', english: 'Welsh', native: 'Cymraeg' },
  { code: 'da', english: 'Danish', native: 'Dansk' },
  { code: 'de', english: 'German', native: 'Deutsch' },
  { code: 'el', english: 'Greek', native: 'Ελληνικά' },
  { code: 'es', english: 'Spanish', native: 'Español' },
  { code: 'et', english: 'Estonian', native: 'Eesti' },
  { code: 'fi', english: 'Finnish', native: 'Suomi' },
  { code: 'fr', english: 'French', native: 'Français' },
  { code: 'he', english: 'Hebrew', native: 'עברית' },
  { code: 'hu', english: 'Hungarian', native: 'Magyar' },
  { code: 'id', english: 'Indonesian', native: 'Bahasa Indonesia' },
  { code: 'is', english: 'Icelandic', native: 'Íslenska' },
  { code: 'it', english: 'Italian', native: 'Italiano' },
  { code: 'ja', english: 'Japanese', native: '日本語' },
  { code: 'ko', english: 'Korean', native: '한국어' },
  { code: 'lt', english: 'Lithuanian', native: 'Lietuvių' },
  { code: 'ms', english: 'Malay', native: 'Bahasa Melayu' },
  { code: 'nb', english: 'Norwegian', native: 'Norsk' },
  { code: 'nl', english: 'Dutch', native: 'Nederlands' },
  { code: 'pl', english: 'Polish', native: 'Polski' },
  { code: 'ps', english: 'Pashto', native: 'پښتو' },
  { code: 'pt-BR', english: 'Portuguese (Brazil)', native: 'Português (Brasil)' },
  { code: 'pt', english: 'Portuguese', native: 'Português' },
  { code: 'ro', english: 'Romanian', native: 'Română' },
  { code: 'ru', english: 'Russian', native: 'Русский' },
  { code: 'sk', english: 'Slovak', native: 'Slovenčina' },
  { code: 'sq', english: 'Albanian', native: 'Shqip' },
  { code: 'sr', english: 'Serbian', native: 'Српски' },
  { code: 'sv', english: 'Swedish', native: 'Svenska' },
  { code: 'th', english: 'Thai', native: 'ไทย' },
  { code: 'tr', english: 'Turkish', native: 'Türkçe' },
  { code: 'uk', english: 'Ukrainian', native: 'Українська' },
  { code: 'vi', english: 'Vietnamese', native: 'Tiếng Việt' },
  { code: 'zh-CN', english: 'Chinese (Simplified)', native: '简体中文' },
  { code: 'zh-TW', english: 'Chinese (Traditional)', native: '繁體中文' }
];

const CODES = new Set(LANGUAGES.map((l) => l.code));

export function isSupportedLanguage(code) {
  return typeof code === 'string' && CODES.has(code);
}
