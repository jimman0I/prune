/** Which global shortcut a keypress is, or none.
 *
 * Pure, and separate from the listener, because the decisions here are
 * the part worth getting right: what counts as "the user is typing", why
 * Alt disqualifies a chord, and which shortcuts are allowed to fire
 * anyway. A listener that inlines all of that is a listener nothing
 * tests.
 *
 * Escape is deliberately NOT here. Dialogs close themselves through
 * ModalOverlay, which owns the focus trap and knows whether closing is
 * even allowed -- a dialog mid-uninstall refuses. A second global handler
 * for the same key would race that one.
 */

/** Fields where a chord probably belongs to the field, not the app. */
function isTyping(target) {
  const tag = target?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable === true;
}

export function matchShortcut(event) {
  if (!event) return null;

  const mod = event.ctrlKey || event.metaKey;
  if (!mod) return null;

  // Ctrl+Alt is how AltGr arrives on many Windows layouts, so swallowing
  // it breaks ordinary typing of characters like @ and \. A chord with
  // Alt in it is a different chord and none of ours use it.
  if (event.altKey) return null;

  const key = String(event.key || '').toLowerCase();

  // Settings works from anywhere. Ctrl+comma means nothing to a text box,
  // so there is nothing to shadow -- and being unable to reach settings
  // because focus happens to sit in the search bar would be its own bug.
  if (key === ',') return 'settings';

  // The rest defer to a focused field. Ctrl+F inside the search box
  // should reach the box rather than being swallowed and re-aimed at it,
  // and Ctrl+A there is select-all.
  if (isTyping(event.target)) return null;

  if (key === 'k' || key === 'f') return 'search';
  if (key === '/' || key === '?') return 'help';

  return null;
}
