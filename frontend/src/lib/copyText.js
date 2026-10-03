/** Puts text on the clipboard. Resolves true if it got there, false if every
 * way of copying refused.
 *
 * The async Clipboard API first; if it is missing or refuses (it needs a
 * secure, focused document), a hidden textarea selected and copied with the
 * old execCommand, which works without a permission prompt. */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch { /* fall through to the older route */ }

  let field = null;
  try {
    field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.setAttribute('aria-hidden', 'true');
    field.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none';
    document.body.appendChild(field);
    field.select();
    return document.execCommand('copy') === true;
  } catch {
    return false;
  } finally {
    field?.remove();
  }
}
