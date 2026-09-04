/** Everything the browser will let a keyboard reach, in document order.
 *
 * `:not([disabled])` matters more here than in most apps: this app disables
 * its destructive buttons constantly (Uninstall while a scan runs, Clean
 * with nothing selected), and a trap that cycled onto a disabled control
 * would look like the keyboard had stopped responding.
 *
 * `[tabindex="-1"]` is deliberately excluded. It means "focusable by
 * script, not by Tab", and the dialog container itself carries one so it
 * can take initial focus without becoming a tab stop of its own. */
export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

/** Filters a raw NodeList down to what is actually reachable right now.
 *
 * A control inside a collapsed section is in the DOM, matches the selector,
 * and cannot be focused -- `offsetParent` is null for anything with
 * `display: none` anywhere up its tree. Tabbing to it silently does
 * nothing, which reads as the trap being broken. */
export function visibleFocusable(elements) {
  return [...(elements || [])].filter((el) => {
    if (el.hidden) return false;
    // offsetParent is null for display:none, and also for position:fixed --
    // hence the second check, since a fixed footer inside a dialog is a
    // perfectly ordinary thing to want to tab to.
    return el.offsetParent !== null || getComputedStyle(el).position === 'fixed';
  });
}

/** Where Tab should land next, wrapping at both ends.
 *
 * The wrap IS the trap: without it Tab from the last control moves to the
 * page behind the dialog, which for a destructive dialog means the user is
 * now driving the list they were about to delete from, with the dialog
 * still open on top.
 *
 * `current` of -1 means focus is somewhere outside the tracked set (the
 * dialog container itself, or focus was lost) -- Tab goes to the first
 * control and Shift+Tab to the last, which is what a fresh dialog should
 * do. */
export function nextFocusIndex(current, count, shiftKey = false) {
  if (!Number.isInteger(count) || count <= 0) return -1;
  if (!Number.isInteger(current) || current < 0) return shiftKey ? count - 1 : 0;
  const step = shiftKey ? -1 : 1;
  return (current + step + count) % count;
}

/** The control a freshly opened dialog should focus.
 *
 * Never the primary action. On these dialogs the primary action is
 * "Uninstall" or "Remove selected", and opening a dialog with the
 * destructive button already focused means Enter -- pressed by someone
 * still reading the heading -- runs it. The first control in document
 * order is the close button or the first field, which is the safe default
 * and also where a sighted user's eye already is.
 *
 * Falls back to the dialog container, so focus never stays on whatever
 * was behind the overlay. */
export function initialFocusTarget(elements, container) {
  const focusable = visibleFocusable(elements);
  return focusable[0] || container || null;
}
