import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchStats } from './api.js';

global.fetch = vi.fn();

describe('fetchStats', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('reads the running total and when it began', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ freedBytes: 1234, since: 1700000000000 }) });
    expect(await fetchStats()).toEqual({ freedBytes: 1234, since: 1700000000000 });
    expect(fetch.mock.calls[0][0]).toBe('http://127.0.0.1:3101/api/stats');
  });

  it('is zero and undated when the reply is not what it expects', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ freedBytes: 'lots', since: 'then' }) });
    expect(await fetchStats()).toEqual({ freedBytes: 0, since: null });
  });

  it('throws on an API error', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: 'no' }) });
    await expect(fetchStats()).rejects.toThrow('no');
  });
});
