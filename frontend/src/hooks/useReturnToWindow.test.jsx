// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useReturnToWindow, RETURN_MIN_AWAY_MS } from './useReturnToWindow.js';

/** Coming back to the window after a real absence is the moment a program
 * installed or removed in Windows has most likely changed. A quick alt-tab
 * out and back is not. */

let focused;
let hidden;
beforeEach(() => {
  focused = true;
  hidden = false;
  vi.spyOn(document, 'hasFocus').mockImplementation(() => focused);
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
});
afterEach(() => { vi.restoreAllMocks(); });

const leave = () => { focused = false; window.dispatchEvent(new Event('blur')); };
const comeBack = () => { focused = true; window.dispatchEvent(new Event('focus')); };

function mount(onReturn) {
  let t = 1_000_000;
  const clock = { advance: (ms) => { t += ms; } };
  const hook = renderHook(() => useReturnToWindow(onReturn, { now: () => t }));
  return { ...hook, clock };
}

describe('useReturnToWindow', () => {
  it('calls back when the window returns after being away long enough, with how long', () => {
    const onReturn = vi.fn();
    const { clock } = mount(onReturn);
    leave();
    clock.advance(RETURN_MIN_AWAY_MS + 5_000);
    comeBack();
    expect(onReturn).toHaveBeenCalledTimes(1);
    expect(onReturn).toHaveBeenCalledWith(RETURN_MIN_AWAY_MS + 5_000);
  });

  it('ignores a quick alt-tab out and back', () => {
    const onReturn = vi.fn();
    const { clock } = mount(onReturn);
    leave();
    clock.advance(RETURN_MIN_AWAY_MS - 1);
    comeBack();
    expect(onReturn).not.toHaveBeenCalled();
  });

  it('counts minimising and desktop switches, not just blur', () => {
    const onReturn = vi.fn();
    const { clock } = mount(onReturn);
    hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    clock.advance(RETURN_MIN_AWAY_MS * 2);
    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    expect(onReturn).toHaveBeenCalledTimes(1);
  });

  it('measures from when the window first left, however many events say so', () => {
    const onReturn = vi.fn();
    const { clock } = mount(onReturn);
    leave();
    clock.advance(10_000);
    hidden = true;
    document.dispatchEvent(new Event('visibilitychange')); // a second "away" event
    clock.advance(10_000);
    hidden = false;
    comeBack();
    expect(onReturn).toHaveBeenCalledWith(20_000);
  });

  it('does not fire on a focus event that was never preceded by leaving', () => {
    const onReturn = vi.fn();
    mount(onReturn);
    comeBack();
    comeBack();
    expect(onReturn).not.toHaveBeenCalled();
  });

  it('fires once per absence, not again on the next focus', () => {
    const onReturn = vi.fn();
    const { clock } = mount(onReturn);
    leave();
    clock.advance(RETURN_MIN_AWAY_MS);
    comeBack();
    comeBack();
    expect(onReturn).toHaveBeenCalledTimes(1);
  });

  it('uses the latest callback, and stops listening when unmounted', () => {
    const first = vi.fn();
    const second = vi.fn();
    let t = 0;
    const { rerender, unmount } = renderHook(({ cb }) => useReturnToWindow(cb, { now: () => t }), { initialProps: { cb: first } });
    rerender({ cb: second });
    leave();
    t += RETURN_MIN_AWAY_MS;
    comeBack();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);

    unmount();
    leave();
    t += RETURN_MIN_AWAY_MS;
    comeBack();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
