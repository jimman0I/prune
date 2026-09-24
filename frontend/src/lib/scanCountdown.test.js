import { describe, it, expect } from 'vitest';
import { remainingSeconds } from './scanCountdown.js';

describe('remainingSeconds', () => {
  it('counts down from the figure the server sent', () => {
    expect(remainingSeconds({ remainingMs: 30_000, receivedAt: 1000, now: 1000 })).toBe(30);
    expect(remainingSeconds({ remainingMs: 30_000, receivedAt: 1000, now: 11_000 })).toBe(20);
  });

  it('rounds up, so zero means the time really is up', () => {
    expect(remainingSeconds({ remainingMs: 1500, receivedAt: 0, now: 0 })).toBe(2);
    expect(remainingSeconds({ remainingMs: 1000, receivedAt: 0, now: 1 })).toBe(1);
    expect(remainingSeconds({ remainingMs: 1000, receivedAt: 0, now: 1000 })).toBe(0);
  });

  it('clamps at zero and never goes negative', () => {
    expect(remainingSeconds({ remainingMs: 500, receivedAt: 0, now: 60_000 })).toBe(0);
  });

  it('a clock that went backwards does not add time', () => {
    expect(remainingSeconds({ remainingMs: 5000, receivedAt: 10_000, now: 9000 })).toBe(5);
  });

  it('is null without a real figure, so nothing is shown', () => {
    for (const remainingMs of [null, undefined, NaN, Infinity, '30000']) {
      expect(remainingSeconds({ remainingMs, receivedAt: 0, now: 0 })).toBeNull();
    }
    expect(remainingSeconds({ remainingMs: 1000, receivedAt: NaN, now: 0 })).toBeNull();
  });
});
