// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { SHORTCUTS, useKeyboardShortcuts } from './useKeyboardShortcuts.js';
import { SCREEN_ORDER } from '../lib/screenOrder.js';
import { CATALOG } from '../i18n/catalog.js';

describe('SHORTCUTS', () => {
  it('lists the text-zoom keys the Electron shell restores (electron/zoom.cjs)', () => {
    const inOut = SHORTCUTS.find((s) => s.id === 'zoomInOut');
    expect(inOut.keys).toEqual(['Ctrl', '+']);
    expect(inOut.alternative).toEqual(['Ctrl', '-']);
    expect(SHORTCUTS.find((s) => s.id === 'zoomReset').keys).toEqual(['Ctrl', '0']);
  });

  it('has a label in the English catalog for every entry', () => {
    for (const { id } of SHORTCUTS) {
      expect(CATALOG.en.shortcutsModal.actions[id], id).toEqual(expect.any(String));
    }
  });
});

describe('Ctrl+1 to Ctrl+8', () => {
  const press = (key, init = {}, target = document.body) => {
    const event = new KeyboardEvent('keydown', { key, ctrlKey: true, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
  };

  it('hands the Nth screen of the rail order to the caller, in order', () => {
    const onGoToScreen = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onGoToScreen }));
    for (let n = 1; n <= 8; n++) press(String(n));
    expect(onGoToScreen.mock.calls.map((c) => c[0])).toEqual(SCREEN_ORDER);
    expect(SCREEN_ORDER).toHaveLength(8);
  });

  it('takes the key from the browser only when it navigated', () => {
    const onGoToScreen = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onGoToScreen }));
    expect(press('4').defaultPrevented).toBe(true);
    expect(press('9').defaultPrevented).toBe(false);
  });

  it('stays silent while a text field has focus', () => {
    const onGoToScreen = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onGoToScreen }));
    const input = document.createElement('input');
    document.body.appendChild(input);
    press('2', {}, input);
    input.remove();
    expect(onGoToScreen).not.toHaveBeenCalled();
  });

  it('is listed in the shortcuts modal data', () => {
    expect(SHORTCUTS.find((s) => s.id === 'goToScreen').keys).toEqual(['Ctrl', '1–8']);
  });
});
