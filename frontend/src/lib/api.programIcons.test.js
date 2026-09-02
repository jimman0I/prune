import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchProgramIcons } from './api.js';

global.fetch = vi.fn();

describe('fetchProgramIcons', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns the id-to-data-uri map', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ icons: { a: 'data:image/png;base64,AAA' } }) });
    expect(await fetchProgramIcons()).toEqual({ a: 'data:image/png;base64,AAA' });
  });

  it('hits the icons endpoint', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ icons: {} }) });
    await fetchProgramIcons();
    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:3101/api/programs/icons');
  });

  it('throws the server message on failure', async () => {
    fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'nope' }) });
    await expect(fetchProgramIcons()).rejects.toThrow('nope');
  });
});
