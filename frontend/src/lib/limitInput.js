/** A number field that also means "no limit".
 *
 * Both quarantine limits are optional, and a number input hands back an
 * empty string constantly -- every time someone clears the box to type a
 * new value. Reading that as 0, and 0 as "keep nothing", would empty this
 * app's only undo mid-keystroke.
 *
 * So: a positive finite number, or null for off. The same rule
 * quarantineRetention.js and quarantineSizeCap.js apply on the other
 * side, kept deliberately identical -- if the two halves disagreed about
 * what 0 means, the setting would read as off on one screen and act as
 * something else entirely.
 */
export function positiveOrOff(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  const number = Number(text);
  if (!Number.isFinite(number) || number <= 0) return null;
  return number;
}
