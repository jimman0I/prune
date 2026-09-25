import { useCallback, useMemo } from 'react';
import { useLanguage } from './LanguageContext.jsx';
import { CLEANER_TEXT } from './cleaner/index.js';

/** Deep Clean's rule names, descriptions and category labels in the user's
 * language.
 *
 * The English lives in backend/src/data/cleaners.json and stays there; the
 * translations are keyed by rule id and by the English category string, and
 * anything missing -- an unknown language, a rule added since, a blank
 * entry -- falls back to the item's own English so the screen is never
 * empty. Only the DISPLAYED label is translated: the English category and
 * the id remain the keys for icons, collapse state and selection. */

const usable = (text) => (typeof text === 'string' && text.trim() !== '' ? text : null);

/** `field` is 'name' or 'description'. */
function ruleField(language, item, field) {
  const own = item?.[field] ?? '';
  const rules = CLEANER_TEXT[language]?.rules;
  // hasOwn: an id like "constructor" must not resolve to Object.prototype.
  const translated = item?.id != null && rules && Object.hasOwn(rules, item.id) ? rules[item.id]?.[field] : null;
  return usable(translated) ?? own;
}

export const ruleName = (language, item) => ruleField(language, item, 'name');
export const ruleDescription = (language, item) => ruleField(language, item, 'description');

export function categoryName(language, category) {
  const own = category ?? '';
  const labels = CLEANER_TEXT[language]?.categories;
  return usable(labels && Object.hasOwn(labels, category) ? labels[category] : null) ?? own;
}

/** What a filter should match for one rule (name and description) or one
 * category: the text the user sees plus the English, so typing the English
 * word still finds it. Lower-cased. */
export function ruleSearchText(language, item) {
  return [ruleName(language, item), item.name, ruleDescription(language, item), item.description]
    .filter(Boolean).join(' ').toLowerCase();
}

export function categorySearchText(language, category) {
  return `${categoryName(language, category)} ${category ?? ''}`.toLowerCase();
}

/** The same functions bound to the current language. */
export function useCleanerText() {
  const { language } = useLanguage();
  const ruleNameOf = useCallback((item) => ruleName(language, item), [language]);
  const ruleDescriptionOf = useCallback((item) => ruleDescription(language, item), [language]);
  const categoryNameOf = useCallback((category) => categoryName(language, category), [language]);
  return useMemo(() => ({
    language,
    ruleName: ruleNameOf,
    ruleDescription: ruleDescriptionOf,
    categoryName: categoryNameOf
  }), [language, ruleNameOf, ruleDescriptionOf, categoryNameOf]);
}
