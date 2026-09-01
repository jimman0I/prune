import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchCleanupScan, executeCleanupCategories } from './api.js';

global.fetch = vi.fn();

describe('fetchCleanupScan', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns the categories on success', async () => {
    const categories = [{ id: 'tempFiles', label: 'Temp Files', sizeBytes: 1000, paths: [] }];
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ categories }) });
    const result = await fetchCleanupScan();
    expect(result).toEqual({ categories });
  });

  it('throws on API error', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: 'boom' }) });
    await expect(fetchCleanupScan()).rejects.toThrow('boom');
  });
});

describe('executeCleanupCategories', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('POSTs the selected category ids and returns the result', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ freedBytes: 500, skipped: [] }) });
    const result = await executeCleanupCategories(['tempFiles', 'recycleBin']);
    expect(result).toEqual({ freedBytes: 500, skipped: [] });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/cleanup-execute'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ categoryIds: ['tempFiles', 'recycleBin'] }) })
    );
  });

  it('throws on API error', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: 'cleanup failed' }) });
    await expect(executeCleanupCategories(['tempFiles'])).rejects.toThrow('cleanup failed');
  });
});
