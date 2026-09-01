import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchDiskSpace } from './api.js';

global.fetch = vi.fn();

describe('fetchDiskSpace', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns freeBytes/totalBytes on success', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ freeBytes: 100, totalBytes: 200 }) });
    const result = await fetchDiskSpace();
    expect(result).toEqual({ freeBytes: 100, totalBytes: 200 });
  });

  it('throws on API error', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ error: 'Could not read disk space.' }) });
    await expect(fetchDiskSpace()).rejects.toThrow('Could not read disk space.');
  });
});
