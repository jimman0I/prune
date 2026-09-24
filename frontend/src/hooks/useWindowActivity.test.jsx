// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { useWindowActivity, INACTIVE_ATTRIBUTE } from './useWindowActivity.js';

/** The aurora only drifts while someone could be looking at it. The hook
 * keeps one attribute on <html> in step with the window's real state. */

const root = document.documentElement;
const inactive = () => root.hasAttribute(INACTIVE_ATTRIBUTE);

let focused = true;
let hidden = false;
vi.spyOn(document, 'hasFocus').mockImplementation(() => focused);
Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });

const setState = ({ focus = focused, hide = hidden }) => { focused = focus; hidden = hide; };

afterEach(() => {
  cleanup();
  setState({ focus: true, hide: false });
  root.removeAttribute(INACTIVE_ATTRIBUTE);
});

describe('useWindowActivity', () => {
  it('is not marked while the window is focused and visible', () => {
    renderHook(() => useWindowActivity());
    expect(inactive()).toBe(false);
  });

  it('marks the window inactive on blur and clears it on focus', () => {
    renderHook(() => useWindowActivity());

    act(() => { setState({ focus: false }); window.dispatchEvent(new Event('blur')); });
    expect(inactive()).toBe(true);

    act(() => { setState({ focus: true }); window.dispatchEvent(new Event('focus')); });
    expect(inactive()).toBe(false);
  });

  it('marks it inactive when the document is hidden, even if focus events never fire', () => {
    renderHook(() => useWindowActivity());

    act(() => { setState({ hide: true }); document.dispatchEvent(new Event('visibilitychange')); });
    expect(inactive()).toBe(true);

    act(() => { setState({ hide: false }); document.dispatchEvent(new Event('visibilitychange')); });
    expect(inactive()).toBe(false);
  });

  it('starts out correct when the window is already unfocused at mount', () => {
    setState({ focus: false });
    renderHook(() => useWindowActivity());
    expect(inactive()).toBe(true);
  });

  it('removes its listeners and its attribute on unmount', () => {
    const removeWin = vi.spyOn(window, 'removeEventListener');
    const removeDoc = vi.spyOn(document, 'removeEventListener');
    const { unmount } = renderHook(() => useWindowActivity());
    act(() => { setState({ focus: false }); window.dispatchEvent(new Event('blur')); });
    expect(inactive()).toBe(true);

    unmount();

    expect(inactive()).toBe(false);
    expect(removeWin).toHaveBeenCalledWith('blur', expect.any(Function));
    expect(removeWin).toHaveBeenCalledWith('focus', expect.any(Function));
    expect(removeDoc).toHaveBeenCalledWith('visibilitychange', expect.any(Function));

    // And a later blur does nothing at all.
    act(() => { setState({ focus: false }); window.dispatchEvent(new Event('blur')); });
    expect(inactive()).toBe(false);
    removeWin.mockRestore();
    removeDoc.mockRestore();
  });
});

describe('the stylesheet side of it', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

  it('pauses both aurora layers while the attribute is present', () => {
    const rule = /:root\[data-window-inactive\] body::before,\s*:root\[data-window-inactive\] body::after\s*\{\s*animation-play-state:\s*paused;\s*\}/;
    expect(css).toMatch(rule);
    expect(INACTIVE_ATTRIBUTE).toBe('data-window-inactive');
  });
});
