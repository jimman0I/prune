// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import { THEME_STORAGE_KEY } from '../lib/theme.js';
import ThemeToggle from './ThemeToggle.jsx';

/** The theme control, and the provider behind it.
 *
 * Two things are tested together here on purpose. lib/theme.js is
 * unit-tested (which theme follows which, what a stored value means), and
 * what was not tested anywhere is the wiring in between: that the three
 * choices (System, Light, Dark) say which one is on, that picking one
 * reaches the document and localStorage, that System really does follow
 * Windows again, and that Electron is told to repaint the window buttons
 * CSS cannot reach.
 *
 * That last one has a specific reason to be pinned down. `pruneWindow` is
 * exposed by electron/preload.cjs, and preload.cjs has to be named in the
 * electron-builder `files` allowlist to be packaged at all. Omitted, the
 * app runs, looks right in dark mode, and silently loses the native
 * buttons' light palette -- a failure that cannot happen in dev, where
 * the file is loaded straight off disk.
 *
 * matchMedia is stubbed rather than left absent: the provider subscribes
 * to it to follow the OS, and jsdom does not implement it at all.
 */

const listeners = new Set();
let systemDark = false;

const stubMatchMedia = () => {
  window.matchMedia = (query) => ({
    matches: query.includes('dark') ? systemDark : !systemDark,
    media: query,
    addEventListener: (_, fn) => listeners.add(fn),
    removeEventListener: (_, fn) => listeners.delete(fn),
    addListener: () => {},
    removeListener: () => {}
  });
};

beforeEach(() => {
  listeners.clear();
  systemDark = true;
  stubMatchMedia();
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.style.colorScheme = '';
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  delete window.pruneWindow;
});

const pick = async (name) => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  await user.click(screen.getByRole('button', { name }));
};

const pressed = (name) => screen.getByRole('button', { name }).getAttribute('aria-pressed');

describe('what the control says', () => {
  it('offers System, Light and Dark, in a named group', () => {
    renderScreen(<ThemeToggle />);

    const group = screen.getByRole('group', { name: 'Appearance' });
    const names = within(group).getAllByRole('button').map((b) => b.textContent);
    expect(names).toEqual(['System', 'Light', 'Dark']);
  });

  it('marks System as on for an install that has never chosen', () => {
    // The whole point of the third option: the default is not "dark", it
    // is "whatever Windows is doing", and the control has to say so.
    renderScreen(<ThemeToggle />);

    expect(pressed('System')).toBe('true');
    expect(pressed('Light')).toBe('false');
    expect(pressed('Dark')).toBe('false');
  });

  it('marks the stored choice, not the resolved palette, as the one that is on', () => {
    // System resolving to dark must not light up Dark: they behave
    // differently the next time Windows switches.
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    renderScreen(<ThemeToggle />);

    expect(pressed('Dark')).toBe('true');
    expect(pressed('System')).toBe('false');
  });

  it('treats a junk stored value as System', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'solarized');
    renderScreen(<ThemeToggle />);

    expect(pressed('System')).toBe('true');
  });
});

describe('what picking one changes', () => {
  it('puts the new theme on the root element', async () => {
    // Where every custom property in index.css is switched from. Nothing
    // else in the app reads the React state directly.
    renderScreen(<ThemeToggle />);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    await pick('Light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(pressed('Light')).toBe('true');
  });

  it('sets colorScheme too, for the controls the app does not draw', async () => {
    // Native scrollbars, form controls and focus rings read this and not
    // the attribute above. Left behind, a light app keeps dark scrollbars.
    renderScreen(<ThemeToggle />);
    await pick('Light');

    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('remembers the choice', async () => {
    renderScreen(<ThemeToggle />);
    await pick('Light');

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('tells Electron to repaint the window buttons with the RESOLVED palette', async () => {
    // Minimize/maximize/close are painted by Windows over the app's own
    // title bar, so they are the one part of the UI a stylesheet cannot
    // reach. main.cjs only knows 'dark' and 'light', so 'system' must never
    // be what crosses the bridge.
    const setTheme = vi.fn();
    window.pruneWindow = { setTheme };
    renderScreen(<ThemeToggle />);

    await pick('Light');
    expect(setTheme).toHaveBeenLastCalledWith('light');

    await pick('System');
    expect(setTheme).toHaveBeenLastCalledWith('dark');
    expect(setTheme).not.toHaveBeenCalledWith('system');
  });

  it('works in a browser tab, where there is no Electron to tell', async () => {
    // The dev server has no preload script. Optional by construction
    // rather than by guard, and this proves the optional chain holds.
    expect(window.pruneWindow).toBeUndefined();
    renderScreen(<ThemeToggle />);

    await pick('Light');

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});

describe('the cross-fade', () => {
  it('arms the transition class and takes it off again', async () => {
    /* Scoped to a class rather than written as `*` because the rule puts
     * a 420ms transition on colour everywhere. Left on permanently, every
     * hover in the app would lag by that much; taken off early, the fade
     * is cut off part-way.
     *
     * The class also has to be added BEFORE the attribute changes, or the
     * new palette lands instantly and there is nothing to fade. */
    renderScreen(<ThemeToggle />);
    await pick('Light');

    expect(document.documentElement.classList.contains('theme-switching')).toBe(true);

    await vi.advanceTimersByTimeAsync(500);
    expect(document.documentElement.classList.contains('theme-switching')).toBe(false);
  });
});

describe('System follows Windows', () => {
  it('changes with the OS while System is chosen', () => {
    // Someone who has never touched the control should see the app change
    // when their machine switches at sunset.
    renderScreen(<ThemeToggle />);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    // act() because this arrives from outside React -- the provider's
    // matchMedia subscription, not an event React dispatched.
    act(() => { for (const fn of listeners) fn({ matches: false }); });

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('stops following the moment Light or Dark is chosen', async () => {
    // A choice that the OS can overrule is not a choice. Someone who
    // picked light should not have it taken away at sunset.
    renderScreen(<ThemeToggle />);
    await pick('Light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    act(() => { for (const fn of listeners) fn({ matches: true }); });

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('follows Windows AGAIN after going back to System', async () => {
    // The regression this control exists for: the old flip wrote an
    // explicit value on the first click and there was no way back to
    // "whatever Windows says".
    renderScreen(<ThemeToggle />);
    await pick('Light');
    await pick('System');

    // Windows is dark (beforeEach), so choosing System goes straight back
    // to dark rather than staying on the light the user had picked.
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    act(() => { for (const fn of listeners) fn({ matches: false }); });
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    act(() => { for (const fn of listeners) fn({ matches: true }); });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('is remembered as System', async () => {
    renderScreen(<ThemeToggle />);
    await pick('Light');
    await pick('System');

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
  });
});
