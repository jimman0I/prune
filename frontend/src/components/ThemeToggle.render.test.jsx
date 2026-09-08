// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import { THEME_STORAGE_KEY } from '../lib/theme.js';
import ThemeToggle from './ThemeToggle.jsx';

/** The theme switch, and the provider behind it.
 *
 * Two things are tested together here on purpose. lib/theme.js is
 * unit-tested (which theme follows which, what a stored value means), and
 * what was not tested anywhere is the wiring in between: that the button
 * is labelled with the theme it will switch TO, that a click actually
 * reaches the document and localStorage, and that it tells Electron to
 * repaint the window buttons CSS cannot reach.
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

const click = async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  await user.click(screen.getByRole('button'));
};

describe('what the button says', () => {
  it('names the theme it will switch TO, not the one that is on', async () => {
    /* A control labelled with its current state reads as a status light.
     * Someone in dark mode looking at a button that says "dark" has no
     * reason to press it, and someone who does press it is surprised.
     *
     * It is also the accessible name, so this is the entire label for
     * anyone not looking at the glyph. */
    renderScreen(<ThemeToggle />);

    expect(screen.getByRole('button').getAttribute('aria-label')).toBe('Switch to light theme');

    await click();
    expect(screen.getByRole('button').getAttribute('aria-label')).toBe('Switch to dark theme');
  });

  it('draws a moon in the dark and a sun in the light', () => {
    /* The sun is a disc with rays and the moon is a crescent, so the
     * circle is what separates them -- asserted on the shape rather than
     * on a class, since the glyphs swap by content.
     *
     * Two renders rather than a click, deliberately. The glyphs swap
     * through an AnimatePresence with `mode="wait"`, so the incoming one
     * does not mount until the outgoing one has finished leaving, and
     * framer-motion does not run that exit to completion in jsdom. What
     * is being asserted is the mapping from theme to glyph, and starting
     * in each theme tests exactly that without waiting on an animation
     * that will never finish here. */
    const { unmount } = renderScreen(<ThemeToggle />);
    expect(document.querySelector('svg circle')).toBeNull();
    unmount();

    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    renderScreen(<ThemeToggle />);
    expect(document.querySelector('svg circle')).toBeTruthy();
  });
});

describe('what a click actually changes', () => {
  it('puts the new theme on the root element', async () => {
    // Where every custom property in index.css is switched from. Nothing
    // else in the app reads the React state directly.
    renderScreen(<ThemeToggle />);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    await click();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('sets colorScheme too, for the controls the app does not draw', async () => {
    // Native scrollbars, form controls and focus rings read this and not
    // the attribute above. Left behind, a light app keeps dark scrollbars.
    renderScreen(<ThemeToggle />);
    await click();

    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('remembers the choice', async () => {
    renderScreen(<ThemeToggle />);
    await click();

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('tells Electron to repaint the window buttons', async () => {
    // Minimize/maximize/close are painted by Windows over the app's own
    // title bar, so they are the one part of the UI a stylesheet cannot
    // reach. Without this they stay dark on a light app.
    const setTheme = vi.fn();
    window.pruneWindow = { setTheme };
    renderScreen(<ThemeToggle />);

    await click();

    expect(setTheme).toHaveBeenCalledWith('light');
  });

  it('works in a browser tab, where there is no Electron to tell', async () => {
    // The dev server has no preload script. Optional by construction
    // rather than by guard, and this proves the optional chain holds.
    expect(window.pruneWindow).toBeUndefined();
    renderScreen(<ThemeToggle />);

    await click();

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
    await click();

    expect(document.documentElement.classList.contains('theme-switching')).toBe(true);

    await vi.advanceTimersByTimeAsync(500);
    expect(document.documentElement.classList.contains('theme-switching')).toBe(false);
  });
});

describe('following the machine', () => {
  it('changes with the OS while the user has never chosen', () => {
    // Someone who has never touched the toggle should see the app change
    // when their machine switches at sunset.
    renderScreen(<ThemeToggle />);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    // act() because this arrives from outside React -- the provider's
    // matchMedia subscription, not an event React dispatched.
    act(() => { for (const fn of listeners) fn({ matches: false }); });

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('stops the moment they do', async () => {
    // And the other half: a choice that the OS can overrule is not a
    // choice. Someone who picked light should not have it taken away at
    // sunset.
    renderScreen(<ThemeToggle />);
    await click();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    act(() => { for (const fn of listeners) fn({ matches: true }); });

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
