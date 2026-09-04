import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setStartupItemEnabled } from './api.js';

global.fetch = vi.fn();

describe('setStartupItemEnabled', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('POSTs the id and the wanted state', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, enabled: false }) });

    await setStartupItemEnabled('registry:user:Run:Discord', false);

    const [url, options] = fetch.mock.calls[0];
    expect(url).toMatch(/\/programs\/startup\/toggle$/);
    // POST, not GET: it changes the machine and can raise a UAC prompt,
    // neither of which belongs behind something a refresh repeats.
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ id: 'registry:user:Run:Discord', enabled: false });
  });

  it('returns the result as it stands, success or not', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, enabled: true }) });
    expect(await setStartupItemEnabled('x', true)).toEqual({ ok: true, enabled: true });
  });

  it('hands back a declined UAC prompt rather than throwing', async () => {
    // The user saying no is an ordinary outcome of pressing this button.
    // Thrown as an error it would reach the screen as a red banner.
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: false, cancelled: true }) });
    expect(await setStartupItemEnabled('x', false)).toEqual({ ok: false, cancelled: true });
  });

  it('turns a failed request into a result the caller can show', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ ok: false, error: 'That entry is no longer in the startup locations.' })
    });

    const result = await setStartupItemEnabled('gone', false);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('no longer');
  });

  it('survives a response with no body to parse', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => { throw new Error('not json'); } });
    const result = await setStartupItemEnabled('x', false);
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('survives the backend not being there at all', async () => {
    fetch.mockRejectedValueOnce(new Error('Failed to fetch'));
    const result = await setStartupItemEnabled('x', false);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Failed to fetch');
  });
});
