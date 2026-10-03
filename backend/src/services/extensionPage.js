/** The address of a browser extension's own page, for "Copy page address".
 *
 * Prune never starts a browser. An unsigned program that launches a browser
 * with a profile argument looks, to antivirus behaviour engines, exactly like
 * a credential stealer: Microsoft Defender flags it as
 * Behavior:Win32/WebBrowserCredAccess.E2 and terminates the program. So the
 * person gets the address to paste into that browser's address bar, and the
 * browser itself does the managing. See services/noBrowserLaunch.test.js.
 *
 * Pure: it builds a string from a browser name and an extension id and
 * touches nothing. */

/** Chromium extension ids are 32 characters from a to p (a hex encoding of a
 * hash with the digits shifted into letters). Nothing else is an id. */
export function isChromiumId(value) {
  return typeof value === 'string' && /^[a-p]{32}$/.test(value);
}

// browser name -> the scheme its extensions page answers to.
const CHROMIUM = {
  Chrome: 'chrome',
  Edge: 'edge',
  Brave: 'brave',
  Vivaldi: 'vivaldi',
  Opera: 'opera'
};

const GECKO = new Set(['Firefox', 'LibreWolf', 'Waterfox', 'Zen', 'SeaMonkey']);

/** { ok: true, browser, address } or { ok: false, error }. */
export function extensionPageAddress({ browser, extensionId } = {}) {
  if (Object.hasOwn(CHROMIUM, browser)) {
    if (!isChromiumId(extensionId)) return { ok: false, error: 'That is not a valid extension id.' };
    return { ok: true, browser, address: `${CHROMIUM[browser]}://extensions/?id=${extensionId}` };
  }
  if (GECKO.has(browser)) {
    // The add-ons page lists them all; Gecko has no per-add-on address.
    return { ok: true, browser, address: 'about:addons' };
  }
  return { ok: false, error: 'Prune does not know that browser.' };
}
