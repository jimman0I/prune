import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchDeepCleanScan, executeDeepClean } from './api.js';

global.fetch = vi.fn();

describe('fetchDeepCleanScan', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns the categorized rule tree', async () => {
    const categories = [{ category: 'Applications', items: [{ id: 'discord_cache', sizeBytes: 100 }] }];
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ categories }) });
    const result = await fetchDeepCleanScan();
    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:3101/api/deep-clean/scan');
    expect(result).toEqual(categories);
  });

  it('throws on API error', async () => {
    fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'boom' }) });
    await expect(fetchDeepCleanScan()).rejects.toThrow('boom');
  });
});

describe('executeDeepClean', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('POSTs the selected rule ids and returns the summary', async () => {
    const summary = { freedBytes: 500, results: [{ id: 'discord_cache', freedBytes: 500, skipped: [] }] };
    fetch.mockResolvedValueOnce({ ok: true, json: async () => summary });
    const result = await executeDeepClean(['discord_cache']);
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:3101/api/deep-clean/execute',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ ruleIds: ['discord_cache'] }) })
    );
    expect(result).toEqual(summary);
  });

  it('throws on API error', async () => {
    fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'boom' }) });
    await expect(executeDeepClean(['x'])).rejects.toThrow('boom');
  });
});
