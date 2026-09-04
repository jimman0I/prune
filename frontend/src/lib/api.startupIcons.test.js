import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchStartupIcons } from './api.js';

global.fetch = vi.fn();

describe('fetchStartupIcons', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns the icon map keyed by entry id', async () => {
    const icons = { 'registry:user:Run:Discord': 'data:image/png;base64,AAA' };
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ icons }) });

    expect(await fetchStartupIcons()).toEqual(icons);
    expect(fetch.mock.calls[0][0]).toMatch(/\/programs\/startup\/icons$/);
  });

  it('gives back an empty map rather than throwing when extraction fails', async () => {
    // Icons are decoration on a screen whose job is the list. A failure
    // here must never be the thing that empties the rows -- the lettered
    // tiles are a complete fallback on their own.
    fetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: 'boom' }) });
    expect(await fetchStartupIcons()).toEqual({});
  });

  it('survives the backend not being there', async () => {
    fetch.mockRejectedValueOnce(new Error('Failed to fetch'));
    expect(await fetchStartupIcons()).toEqual({});
  });

  it('survives a response with no icons field', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    expect(await fetchStartupIcons()).toEqual({});
  });
});
