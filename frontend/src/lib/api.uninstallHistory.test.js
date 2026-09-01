import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchUninstallHistory } from './api.js';

global.fetch = vi.fn();

describe('fetchUninstallHistory', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns the entries array', async () => {
    const entries = [{ programName: '7-Zip', publisher: 'Igor Pavlov', sizeBytes: 4194304, timestamp: 1700000000000 }];
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ entries }) });
    const result = await fetchUninstallHistory();
    expect(result).toEqual(entries);
  });

  it('throws on API error', async () => {
    fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Server error' }) });
    await expect(fetchUninstallHistory()).rejects.toThrow('Server error');
  });
});
