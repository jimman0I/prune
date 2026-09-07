import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  THEMES, resolveInitialTheme, nextTheme, readStoredTheme, writeStoredTheme
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

export function initialTheme() {
  return resolveInitialTheme({
    stored: readStoredTheme(typeof window === 'undefined' ? null : window.localStorage),
    prefersDark: systemPrefersDark()
  });
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(initialTheme);

  useEffect(() => { applyTheme(theme); }, [theme]);

  /** Follows the OS while the user has expressed no preference of their
   * own, and stops the moment they do. Someone who has never touched the
   * toggle should see the app change when their machine switches at
   * sunset; someone who picked light explicitly should not have it
   * taken away. */
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event) => {
      if (readStoredTheme(window.localStorage)) return;
      setTheme(event.matches ? 'dark' : 'light');
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const choose = useCallback((value) => {
    if (!THEMES.includes(value)) return;

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

    setTheme(value);
    writeStoredTheme(typeof window === 'undefined' ? null : window.localStorage, value);
  }, []);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const value = nextTheme(current);
      choose(value);
      return value;
    });
  }, [choose]);

  const value = useMemo(() => ({ theme, setTheme: choose, toggle }), [theme, choose, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside a ThemeProvider');
  return context;
}
