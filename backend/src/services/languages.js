/** The 40 languages Prune can be shown in -- the same 40 the installer
 * offers (electron-builder.config.cjs), Hindi excluded there for the same
 * reason it stays excluded here: NSIS 3.0.4.1's own Hindi.nsh has an
 * unterminated string, so it never reached the installer's list either.
 *
 * Codes are short: the primary subtag alone, except where two languages
 * would collide without the region (Portuguese, Chinese). They are NOT
 * the installer's own codes (el_GR, not "el") -- those name a Windows
 * locale for NSIS's language files; these name a translation file here.
 * installerLanguage.js carries the one mapping between the two worlds. */
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

/** Maps a locale string as `app.getLocale()` or a browser gives it
 * ("el", "el-GR", "pt-BR", "zh-Hans-CN", "en-US") onto one of the 40, or
 * null. Tried most-specific first, so "pt-BR" matches Brazilian
 * Portuguese rather than falling through to plain Portuguese, and a
 * script subtag ("zh-Hans-CN") does not stop the region beneath it from
 * being read. */
export function matchLanguage(locale) {
  if (typeof locale !== 'string' || !locale) return null;
  const parts = locale.split('-').filter(Boolean);
  if (parts.length === 0) return null;

  // Longest prefix that names a real code, so "pt-BR" wins outright before
  // anything falls back to the bare primary subtag.
  for (let length = parts.length; length > 0; length -= 1) {
    const candidate = parts.slice(0, length).join('-').toLowerCase();
    const exact = LANGUAGES.find((l) => l.code.toLowerCase() === candidate);
    if (exact) return exact.code;
  }

  // No exact tag. Only Chinese has two codes sharing one primary subtag,
  // and BCP-47 usually still carries the region somewhere in the tag
  // ("zh-Hans-CN") even when it is not adjacent to "zh" -- so look for a
  // region-shaped subtag anywhere past the first, not just next to it.
  const primary = parts[0].toLowerCase();
  const candidates = LANGUAGES.filter((l) => l.code.split('-')[0].toLowerCase() === primary);
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0].code;

  const region = parts.slice(1).find((part) => /^([A-Za-z]{2}|\d{3})$/.test(part))?.toUpperCase();
  const byRegion = region && candidates.find((l) => (l.code.split('-')[1] || '').toUpperCase() === region);
  if (byRegion) return byRegion.code;

  // Unknown region for a language that also has a plain, region-less
  // entry (Portuguese): that generic entry is the right fallback, not a
  // guess at which region the specific one belongs to.
  const generic = candidates.find((l) => !l.code.includes('-'));
  return (generic ?? candidates[0]).code;
}
