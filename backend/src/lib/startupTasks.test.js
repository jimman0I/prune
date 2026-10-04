import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  HOUSEKEEPING_DELAY_MS, SCHEDULE_CATCHUP_DELAY_MS, runLater, scheduleHousekeeping
} from './startupTasks.js';

afterEach(() => { vi.useRealTimers(); });

describe('start-up timing', () => {
  it('waits well past the window\'s first load for the upkeep, but picks the schedule up sooner', () => {
    expect(HOUSEKEEPING_DELAY_MS).toBeGreaterThanOrEqual(15_000);
    expect(SCHEDULE_CATCHUP_DELAY_MS).toBeGreaterThan(0);
    expect(SCHEDULE_CATCHUP_DELAY_MS).toBeLessThan(HOUSEKEEPING_DELAY_MS);
  });
});

describe('runLater', () => {
  it('runs once after the delay, and its timer does not keep the process alive', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const timer = runLater(1000, fn);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(999);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10_000);
    expect(fn).toHaveBeenCalledTimes(1);
    // Fake timers expose hasRef like Node's: unref'd means false.
    expect(timer.hasRef()).toBe(false);
  });
});

describe('scheduleHousekeeping', () => {
  it('runs nothing before the delay', async () => {
    vi.useFakeTimers();
    const run = vi.fn();
    scheduleHousekeeping([{ name: 'a', run }]);
    await vi.advanceTimersByTimeAsync(HOUSEKEEPING_DELAY_MS - 1);
    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('runs the tasks one at a time, in order', async () => {
    vi.useFakeTimers();
    const log = [];
    let active = 0;
    let overlapped = false;
    const task = (name) => ({
      name,
      run: async () => {
        active += 1;
        if (active > 1) overlapped = true;
        log.push(`start ${name}`);
        await new Promise((resolve) => setTimeout(resolve, 50));
        log.push(`end ${name}`);
        active -= 1;
      }
    });
    scheduleHousekeeping([task('a'), task('b'), task('c')], { delayMs: 100 });
    await vi.advanceTimersByTimeAsync(1000);
    expect(overlapped).toBe(false);
    expect(log).toEqual(['start a', 'end a', 'start b', 'end b', 'start c', 'end c']);
  });

  it('reports a failing task and still runs the ones after it', async () => {
    vi.useFakeTimers();
    const onError = vi.fn();
    const after = vi.fn();
    scheduleHousekeeping([
      { name: 'sync throw', run: () => { throw new Error('one'); } },
      { name: 'rejects', run: () => Promise.reject(new Error('two')) },
      { name: 'after', run: after }
    ], { delayMs: 10, onError });
    await vi.advanceTimersByTimeAsync(20);
    expect(onError).toHaveBeenCalledTimes(2);
    expect(onError.mock.calls[0][0]).toBe('sync throw');
    expect(onError.mock.calls[1][1].message).toBe('two');
    expect(after).toHaveBeenCalledTimes(1);
  });

  it('survives an onError that itself throws', async () => {
    vi.useFakeTimers();
    const after = vi.fn();
    scheduleHousekeeping([
      { name: 'bad', run: () => { throw new Error('x'); } },
      { name: 'after', run: after }
    ], { delayMs: 10, onError: () => { throw new Error('reporter broke'); } });
    await vi.advanceTimersByTimeAsync(20);
    expect(after).toHaveBeenCalledTimes(1);
  });
});
