import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchDiskScan } from './api.js';

global.fetch = vi.fn();

describe('fetchDiskScan', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns the scan tree on success', async () => {
    const tree = { name: 'C:\\', size: 1000, children: [{ name: 'a.txt', size: 1000 }] };
    fetch.mockResolvedValueOnce({ ok: true, json: async () => tree });
    const result = await fetchDiskScan('C:\\');
    expect(result).toEqual(tree);
  });

  it('URL-encodes the path query param', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ name: 'x', size: 0 }) });
    await fetchDiskScan('C:\\Users\\Jim\\My Documents');
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent('C:\\Users\\Jim\\My Documents')));
  });

  it('throws on API error', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ error: 'Could not read "X" -- it may not exist or may not be accessible.' }) });
    await expect(fetchDiskScan('X')).rejects.toThrow('Could not read "X"');
  });
});
