import { describe, it, expect, vi } from 'vitest';
import { memoizeAsync } from './memoizeAsync.js';

describe('memoizeAsync', () => {
  it('shares one run between callers who arrive while it is running', async () => {
    let release;
    const compute = vi.fn(() => new Promise((resolve) => { release = resolve; }));
    const run = memoizeAsync(compute);

    const a = run();
    const b = run();
    release('answer');

    expect(await a).toBe('answer');
    expect(await b).toBe('answer');
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('computes again after the run settles when no ttl is given', async () => {
    const compute = vi.fn(async () => 'x');
    const run = memoizeAsync(compute);
    await run();
    await run();
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('keeps an answer for the ttl and no longer', async () => {
    let t = 1000;
    const compute = vi.fn(async () => t);
    const run = memoizeAsync(compute, { ttlMs: 500, now: () => t });

    expect(await run()).toBe(1000);
    t = 1400;
    expect(await run()).toBe(1000);
    expect(compute).toHaveBeenCalledTimes(1);
    t = 1500;
    expect(await run()).toBe(1500);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('hands a failure to everyone waiting and does not remember it', async () => {
    const compute = vi.fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('fine');
    const run = memoizeAsync(compute, { ttlMs: 10_000 });

    const a = run();
    const b = run();
    await expect(a).rejects.toThrow('boom');
    await expect(b).rejects.toThrow('boom');
    expect(await run()).toBe('fine');
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('clear() drops a kept answer', async () => {
    const compute = vi.fn(async () => 'x');
    const run = memoizeAsync(compute, { ttlMs: 10_000 });
    await run();
    run.clear();
    await run();
    expect(compute).toHaveBeenCalledTimes(2);
  });
});
