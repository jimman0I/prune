import { describe, it, expect } from 'vitest';
import { nextFocusIndex, visibleFocusable, initialFocusTarget, FOCUSABLE_SELECTOR } from './focusTrap.js';

/** Minimal stand-ins. There is no DOM testing library in this project, and
 * these functions only ever read `hidden`, `offsetParent` and position --
 * which is exactly why they were pulled out of the component. */
const el = ({ hidden = false, offsetParent = {}, position = 'static' } = {}) => ({
  hidden,
  offsetParent,
  __position: position
});

// getComputedStyle is only consulted for the offsetParent === null case.
globalThis.getComputedStyle = (e) => ({ position: e.__position ?? 'static' });

describe('nextFocusIndex', () => {
  it('moves forward and wraps at the end', () => {
    // The wrap IS the trap. Without it, Tab from the last control lands on
    // the page behind a destructive dialog that is still open.
    expect(nextFocusIndex(0, 3)).toBe(1);
    expect(nextFocusIndex(2, 3)).toBe(0);
  });

  it('moves backward and wraps at the start', () => {
    expect(nextFocusIndex(2, 3, true)).toBe(1);
    expect(nextFocusIndex(0, 3, true)).toBe(2);
  });

  it('enters at the first control when focus is outside the set', () => {
    // -1 is "focus is on the dialog container, or was lost".
    expect(nextFocusIndex(-1, 3)).toBe(0);
    expect(nextFocusIndex(-1, 3, true)).toBe(2);
  });

  it('has nowhere to go in an empty dialog', () => {
    expect(nextFocusIndex(0, 0)).toBe(-1);
    expect(nextFocusIndex(-1, 0, true)).toBe(-1);
  });

  it('copes with a single control', () => {
    expect(nextFocusIndex(0, 1)).toBe(0);
    expect(nextFocusIndex(0, 1, true)).toBe(0);
  });

  it('ignores a nonsense count', () => {
    expect(nextFocusIndex(0, NaN)).toBe(-1);
    expect(nextFocusIndex(0, -2)).toBe(-1);
  });
});

describe('visibleFocusable', () => {
  it('keeps an ordinary visible control', () => {
    const button = el();
    expect(visibleFocusable([button])).toEqual([button]);
  });

  it('drops a control inside a collapsed section', () => {
    // In the DOM, matches the selector, cannot be focused. Tabbing to it
    // does nothing, which reads as the trap being broken.
    expect(visibleFocusable([el({ offsetParent: null })])).toEqual([]);
  });

  it('drops an explicitly hidden control', () => {
    expect(visibleFocusable([el({ hidden: true })])).toEqual([]);
  });

  it('keeps a fixed-position control, whose offsetParent is null anyway', () => {
    // A fixed footer inside a dialog is an ordinary thing to tab to.
    const fixed = el({ offsetParent: null, position: 'fixed' });
    expect(visibleFocusable([fixed])).toEqual([fixed]);
  });

  it('copes with nothing', () => {
    expect(visibleFocusable(null)).toEqual([]);
  });
});

describe('initialFocusTarget', () => {
  it('takes the first reachable control, not the primary action', () => {
    // Opening with "Uninstall" focused means Enter, pressed by someone
    // still reading the heading, runs it.
    const close = el();
    const uninstall = el();
    expect(initialFocusTarget([close, uninstall], null)).toBe(close);
  });

  it('skips past a control that cannot actually be focused', () => {
    const hidden = el({ offsetParent: null });
    const real = el();
    expect(initialFocusTarget([hidden, real], null)).toBe(real);
  });

  it('falls back to the dialog itself rather than leaving focus behind it', () => {
    const container = el();
    expect(initialFocusTarget([], container)).toBe(container);
    expect(initialFocusTarget(null, container)).toBe(container);
  });

  it('returns null when there is nothing at all', () => {
    expect(initialFocusTarget([], null)).toBeNull();
  });
});

describe('FOCUSABLE_SELECTOR', () => {
  it('excludes disabled controls', () => {
    // This app disables destructive buttons constantly; cycling onto one
    // would look like the keyboard had stopped responding.
    expect(FOCUSABLE_SELECTOR).toContain('button:not([disabled])');
  });

  it('excludes tabindex="-1", which the dialog container uses itself', () => {
    expect(FOCUSABLE_SELECTOR).toContain('[tabindex]:not([tabindex="-1"])');
  });
});
