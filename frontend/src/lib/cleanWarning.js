/** The question asked before a rule that loses something is ticked.
 *
 * Sixteen of the seventy-four Deep Clean rules are marked risky in
 * cleanerRules.js -- browsing history, cookies, open tabs, autofill and
 * per-site storage across Brave, Chrome and Edge, plus the Recycle Bin.
 * They already carry a "Loses data" badge and are never selected by
 * default, and that was the whole of the protection: one click on a
 * checkbox and the next Clean signs you out of every site you use.
 *
 * Nothing here is unrecoverable -- Clean moves everything to Quarantine
 * first -- but recoverable is not the same as wanted, and a person who
 * has to go and restore a batch to get their sessions back has still had
 * their afternoon interrupted by a tool that was supposed to help.
 *
 * Kept as plain functions rather than inside the dialog component so the
 * rules about WHEN to ask can be tested without rendering anything, and
 * so the answer cannot quietly depend on what the component happens to
 * have in state.
 */

/** Only a real array counts as a list of acknowledgements.
 *
 * A settings file that lost the key, or has something else under it,
 * must not read as blanket consent. Erring toward asking again is the
 * cheap mistake; erring the other way is a silent one. */
function acknowledgedList(acknowledged) {
  return Array.isArray(acknowledged) ? acknowledged : [];
}

/** Whether ticking this rule should stop and ask first.
 *
 * `checking` is the direction. Unticking never asks: it cannot lose
 * anything, and a dialog in front of the safe direction is how people
 * learn to click through the one in front of the unsafe direction. */
export function needsWarning(item, { checking, acknowledged } = {}) {
  if (!item || !checking || !item.risky) return false;
  return !acknowledgedList(acknowledged).includes(item.id);
}

/** The English this carries when no translated set is passed in -- a
 * plain default rather than the only option, the same pattern
 * lib/lockedFiles.js's `messages` and lib/batchSelection.js's `reasons`
 * both use: this is a plain utility function with no access to the
 * language hook, so the CALLER supplies a translated set
 * (DeepClean.jsx's CleanWarningDialog reads through `t('deepClean.warning')`)
 * and this file stays free of any i18n import of its own. Exported so
 * this file's own tests, which never pass a second argument, keep
 * asserting the exact English wording. */
export const DEFAULT_WARNING_MESSAGES = {
  title: (label) => `Enable ${label}`,
  remember: (label) => `Remember my choice for ${label}`,
  fallbackBody: 'This option removes data you may want to keep.'
};

/** The rule's own English, for callers that pass no translated text. */
const ENGLISH_TEXT = {
  ruleName: (item) => item?.name,
  ruleDescription: (item) => item?.description,
  categoryName: (category) => category
};

/** The dialog's text for one rule. `text` is the useCleanerText() trio, so
 * the dialog reads in the user's language; the default is the rule's own
 * English.
 *
 * Titled with the category as well as the name because that is how the
 * row reads -- "Cookies" under a "Brave" heading -- and three browsers
 * ship a rule called Cookies. */
export function warningFor(item, messages = DEFAULT_WARNING_MESSAGES, text = ENGLISH_TEXT) {
  const name = text.ruleName(item);
  const label = item?.category ? `${text.categoryName(item.category)} — ${name}` : name;
  return {
    id: item?.id,
    title: messages.title(label),
    remember: messages.remember(label),
    // Every shipped rule has a description, and each one is already
    // written as the consequence rather than the mechanism. The fallback
    // exists so a rule added later without one still warns about
    // something rather than showing an empty dialog.
    body: text.ruleDescription(item) || messages.fallbackBody
  };
}

/** The acknowledgement list to save, or null when there is nothing to save.
 *
 * Null rather than an unchanged copy so the caller can skip the write
 * entirely. This is settings, and a write per checkbox click that changed
 * nothing is a disk write per checkbox click. */
export function rememberedWith(acknowledged, ruleId, remember) {
  if (!remember || !ruleId) return null;
  const current = acknowledgedList(acknowledged);
  if (current.includes(ruleId)) return null;
  return [...current, ruleId];
}
