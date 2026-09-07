/** Which theme the app opens in, and what the toggle does next.
 *
 * Pure, because the interesting part is the precedence rather than the
 * plumbing: a stored choice beats the operating system, the operating
 * system beats the default, and the default is dark -- the theme every
 * screen in this app was designed against first.
 *
 * A stored value that is not one of the two is treated as absent rather
 * than trusted. localStorage survives upgrades and is editable by hand, so
 * "solarized" is a state that can genuinely reach this function, and
 * setting data-theme to it would leave the app with no palette at all.
 */
export const THEMES = ['dark', 'light'];

const DEFAULT_THEME = 'dark';

export function resolveInitialTheme({ stored, prefersDark } = {}) {
  if (THEMES.includes(stored)) return stored;
  if (prefersDark === true) return 'dark';
  if (prefersDark === false) return 'light';
  return DEFAULT_THEME;
}

export function nextTheme(current) {
  return current === 'light' ? 'dark' : 'light';
}

/** Where the choice is kept.
 *
 * localStorage rather than the app's own settings file, and the reason is
 * timing rather than preference: every other setting is read from the
 * backend over HTTP, which takes long enough that the app would paint in
 * dark and then flip. The theme has to be on the root element before the
 * first frame. */
export const THEME_STORAGE_KEY = 'prune.theme';

/** Reads the stored choice, tolerating storage being unavailable.
 *
 * Wrapped because access itself can throw, not just return null -- a
 * packaged Electron renderer with site data blocked raises on the getter.
 * A theme is not worth a blank window. */
export function readStoredTheme(storage) {
  try {
    return storage?.getItem(THEME_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

export function writeStoredTheme(storage, theme) {
  try {
    storage?.setItem(THEME_STORAGE_KEY, theme);
    return true;
  } catch {
    // The theme still applies for this session; it just will not be
    // remembered. Worth not crashing over.
    return false;
  }
}
