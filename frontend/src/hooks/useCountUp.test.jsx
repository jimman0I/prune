// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCountUp } from './useCountUp.js';

// A hand-driven clock and frame queue: advance(ms) moves time and runs the
// callbacks that were queued, exactly one frame's worth.
let now;
let queue;
let nextId;

function advance(ms) {
  now += ms;
  const pending = [...queue.entries()];
  queue.clear();
  act(() => { pending.forEach(([, cb]) => cb(now)); });
}

function stubReducedMotion(reduced) {
  window.matchMedia = vi.fn(() => ({ matches: reduced }));
}

beforeEach(() => {
  now = 1000;
  queue = new Map();
  nextId = 1;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', (cb) => { const id = nextId++; queue.set(id, cb); return id; });
  vi.stubGlobal('cancelAnimationFrame', (id) => { queue.delete(id); });
  stubReducedMotion(false);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('useCountUp', () => {
  it('lands exactly on the target, not one epsilon short', () => {
    const { result, rerender } = renderHook(({ v }) => useCountUp(v, { duration: 300 }), { initialProps: { v: 0 } });
    rerender({ v: 1234567 });
    advance(100);
    expect(result.current).toBeGreaterThan(0);
    expect(result.current).toBeLessThan(1234567);
    advance(500);
    expect(result.current).toBe(1234567);
    expect(queue.size).toBe(0);
  });

  it('settles within the duration when frames arrive one at a time', () => {
    const { result, rerender } = renderHook(({ v }) => useCountUp(v, { duration: 300 }), { initialProps: { v: 0 } });
    rerender({ v: 1000 });
    // Each frame re-renders; if that restarted the animation it would never finish on time.
    for (let elapsed = 0; elapsed < 320; elapsed += 16) advance(16);
    expect(result.current).toBe(1000);
    expect(queue.size).toBe(0);
  });

  it('schedules no frames when it mounts already showing the target', () => {
    renderHook(() => useCountUp(42, { duration: 300 }));
    expect(queue.size).toBe(0);
  });

  it('counts down from a higher displayed value', () => {
    const { result, rerender } = renderHook(({ v }) => useCountUp(v, { duration: 300 }), { initialProps: { v: 1000 } });
    expect(result.current).toBe(1000);
    rerender({ v: 200 });
    advance(100);
    expect(result.current).toBeLessThan(1000);
    expect(result.current).toBeGreaterThan(200);
    advance(500);
    expect(result.current).toBe(200);
  });

  it('jumps straight to the target under prefers-reduced-motion', () => {
    stubReducedMotion(true);
    const { result, rerender } = renderHook(({ v }) => useCountUp(v, { duration: 300 }), { initialProps: { v: 0 } });
    rerender({ v: 5000 });
    expect(result.current).toBe(5000);
    expect(queue.size).toBe(0);
  });

  it('continues from the current displayed value when the target changes mid-flight', () => {
    const { result, rerender } = renderHook(({ v }) => useCountUp(v, { duration: 300 }), { initialProps: { v: 0 } });
    rerender({ v: 1000 });
    advance(150);
    const midway = result.current;
    expect(midway).toBeGreaterThan(500);
    expect(midway).toBeLessThan(1000);

    rerender({ v: 2000 });
    advance(1);
    // Restarting from 0 would put it near 0; continuing puts it at or above midway.
    expect(result.current).toBeGreaterThanOrEqual(midway);
    advance(500);
    expect(result.current).toBe(2000);
  });

  it('does not restart when rerendered with the same target', () => {
    const { result, rerender } = renderHook(({ v }) => useCountUp(v, { duration: 300 }), { initialProps: { v: 0 } });
    rerender({ v: 1000 });
    advance(150);
    const midway = result.current;
    const pending = [...queue.keys()];

    rerender({ v: 1000 });
    expect(result.current).toBe(midway);
    expect([...queue.keys()]).toEqual(pending);
    advance(500);
    expect(result.current).toBe(1000);
  });
});
