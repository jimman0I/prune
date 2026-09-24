import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  THEME_CHOICES, resolveInitialTheme, resolveChoice, readStoredTheme, writeStoredTheme
} from '../lib/theme.js';

const ThemeContext = createContext(null);

/** How long the cross-fade between palettes runs. Matches the transition
 * declared for `.theme-switching` in index.css -- two numbers describing
 * one animation, so they are commented on both sides. Removing the class
 * early would cut the fade off mid-way; leaving it on permanently would
 * put a 420ms lag on every hover in the app, which is the whole reason
 * that rule is scoped to a class rather than written as `*`. */
const SWITCH_MS = 420;

function systemPrefersDark() {
  if (typeof window === 'undefined' || !window.matchMedia) return undefined;
  // Neither query matching means the OS has expressed no preference, which
  // is different from preferring light -- and the difference decides
  // whether Prune falls back to its own default.
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) return true;
  if (window.matchMedia('(prefers-color-scheme: light)').matches) return false;
  return undefined;
}

/** Puts the theme on the root element.
 *
 * Exported and called from main.jsx BEFORE React renders, as well as from
 * the provider. Waiting for the first effect would paint one frame in the
 * default theme and then flip, which is exactly the flash this is meant
 * to avoid. */
export function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  // The native scrollbars, form controls and focus rings the app does not
  // draw itself read this rather than the attribute above.
  document.documentElement.style.colorScheme = theme;

  /* The window's own buttons, which Windows paints and CSS cannot reach.
   * Absent in a browser tab and on any platform without the overlay, so
   * this is optional by construction rather than by guard. */
  window.pruneWindow?.setTheme?.(theme);
}

function storage() {
  return typeof window === 'undefined' ? null : window.localStorage;
}

export function initialTheme() {
  return resolveInitialTheme({
    stored: resolveChoice(readStoredTheme(storage())),
    prefersDark: systemPrefersDark()
  });
}

export function ThemeProvider({ children }) {
  /* Two separate pieces of state, because they change for different
   * reasons. `choice` is what the person picked (System, Light or Dark)
   * and only they change it. `systemDark` is what Windows is doing right
   * now and only Windows changes it. The palette on screen is derived from
   * both, which is what lets System follow Windows again after a Light or
   * Dark choice: nothing has to remember what the OS said in the meantime. */
  const [choice, setChoice] = useState(() => resolveChoice(readStoredTheme(storage())));
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  const theme = resolveInitialTheme({ stored: choice, prefersDark: systemDark });

  useEffect(() => { applyTheme(theme); }, [theme]);

  /** Tracks the OS unconditionally and lets the derivation above decide
   * whether it matters: someone on System sees the app change when their
   * machine switches at sunset, someone who picked Light does not have it
   * taken away. */
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event) => setSystemDark(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const choose = useCallback((value) => {
    if (!THEME_CHOICES.includes(value)) return;

    /* The cross-fade, armed for exactly as long as it runs.
     *
     * Adding the class before the attribute changes matters: the
     * transition has to be in effect at the moment the custom properties
     * change, or the new palette lands instantly and the fade never
     * happens. */
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.classList.add('theme-switching');
      window.setTimeout(() => root.classList.remove('theme-switching'), SWITCH_MS);
    }

    setChoice(value);
    writeStoredTheme(storage(), value);
  }, []);

  const value = useMemo(() => ({ theme, choice, setChoice: choose }), [theme, choice, choose]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside a ThemeProvider');
  return context;
}
