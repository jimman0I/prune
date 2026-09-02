import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scanDriveFast } from './api.js';

global.fetch = vi.fn();

describe('scanDriveFast', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('posts the drive letter', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ tree: { name: 'C:' }, stats: {} }) });
    await scanDriveFast('C');
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:3101/api/mft-scan');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ driveLetter: 'C' });
  });

  it('returns the tree and stats', async () => {
    const payload = { tree: { name: 'C:', size: 5 }, stats: { recordsRead: 3_270_826 } };
    fetch.mockResolvedValueOnce({ ok: true, json: async () => payload });
    expect(await scanDriveFast('C')).toEqual(payload);
  });

  // A declined UAC prompt comes back 200 with { cancelled: true } -- the
  // user answered the question and the answer was no, which is not an
  // error and must not be shown as one.
  it('passes a declined prompt through rather than throwing', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ cancelled: true }) });
    expect(await scanDriveFast('C')).toEqual({ cancelled: true });
  });

  it('throws the server message on a real failure', async () => {
    fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Not an NTFS volume' }) });
    await expect(scanDriveFast('C')).rejects.toThrow('Not an NTFS volume');
  });
});
