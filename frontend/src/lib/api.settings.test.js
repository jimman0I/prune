import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchSettings, updateSettings } from './api.js';

global.fetch = vi.fn();

describe('fetchSettings', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns the settings object on success', async () => {
    const settings = { excludeFolders: [], autoQuarantine: true, theme: 'dark', accentColor: null };
    fetch.mockResolvedValueOnce({ ok: true, json: async () => settings });
    const result = await fetchSettings();
    expect(result).toEqual(settings);
  });

  it('throws on API error', async () => {
    fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'boom' }) });
    await expect(fetchSettings()).rejects.toThrow('boom');
  });
});

describe('updateSettings', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('PUTs the partial update and returns the full settings object', async () => {
    const updated = { excludeFolders: [], autoQuarantine: false, theme: 'dark', accentColor: null };
    fetch.mockResolvedValueOnce({ ok: true, json: async () => updated });
    const result = await updateSettings({ autoQuarantine: false });
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:3101/api/settings',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ autoQuarantine: false }) })
    );
    expect(result).toEqual(updated);
  });

  it('throws on API error', async () => {
    fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'boom' }) });
    await expect(updateSettings({ theme: 'light' })).rejects.toThrow('boom');
  });
});
