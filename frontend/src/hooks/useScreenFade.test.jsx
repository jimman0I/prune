// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useScreenFade, SCREEN_FADE_MS } from './useScreenFade.js';

/** The tab-switch fade: opacity only, short, cancelled on the next switch,
 * and skipped entirely under reduced motion. */

function fakeStage() {
  const cancel = vi.fn();
  const animate = vi.fn(() => ({ cancel }));
  return { stage: { animate }, animate, cancel };
}

const withReducedMotion = (reduced) => {
  window.matchMedia = vi.fn(() => ({ matches: reduced }));
};

afterEach(() => { delete window.matchMedia; });

describe('useScreenFade', () => {
  it('fades opacity only: no slide, no transform of any kind', () => {
    withReducedMotion(false);
    const { stage, animate } = fakeStage();
    renderHook(() => useScreenFade({ current: stage }, 'dashboard'));

    expect(animate).toHaveBeenCalledTimes(1);
    const [keyframes] = animate.mock.calls[0];
    expect(keyframes).toEqual([{ opacity: 0 }, { opacity: 1 }]);
    for (const frame of keyframes) expect(Object.keys(frame)).toEqual(['opacity']);
  });

  it('is short: about 160 ms, well under the old 300', () => {
    withReducedMotion(false);
    const { stage, animate } = fakeStage();
    renderHook(() => useScreenFade({ current: stage }, 'dashboard'));

    expect(SCREEN_FADE_MS).toBe(160);
    expect(animate.mock.calls[0][1].duration).toBe(SCREEN_FADE_MS);
  });

  it('cancels the previous fade on the next switch, so they never stack', () => {
    withReducedMotion(false);
    const { stage, animate, cancel } = fakeStage();
    const ref = { current: stage };
    const { rerender, unmount } = renderHook(({ screen }) => useScreenFade(ref, screen), {
      initialProps: { screen: 'dashboard' }
    });

    rerender({ screen: 'diskmap' });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(animate).toHaveBeenCalledTimes(2);

    unmount();
    expect(cancel).toHaveBeenCalledTimes(2);
  });

  it('does not animate at all under reduced motion', () => {
    withReducedMotion(true);
    const { stage, animate } = fakeStage();
    renderHook(() => useScreenFade({ current: stage }, 'dashboard'));

    expect(animate).not.toHaveBeenCalled();
  });

  it('does nothing where the element has no Web Animations support', () => {
    withReducedMotion(false);
    expect(() => renderHook(() => useScreenFade({ current: {} }, 'dashboard'))).not.toThrow();
    expect(() => renderHook(() => useScreenFade({ current: null }, 'dashboard'))).not.toThrow();
  });
});
