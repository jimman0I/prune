import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scanDriveFast, fetchDrives } from './api.js';

global.fetch = vi.fn();

describe('scanDriveFast', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('posts the drive letter as a one-drive list', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ tree: { name: 'C:' }, stats: {} }) });
    await scanDriveFast('C');
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:3101/api/mft-scan');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ driveLetters: ['C'] });
  });

  // One request, so one elevation prompt, however many drives are chosen.
  it('posts several drives in a single request', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ drives: [] }) });
    await scanDriveFast(['C', 'D']);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ driveLetters: ['C', 'D'] });
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

describe('fetchDrives', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('reads the drive list', async () => {
    const payload = { systemDrive: 'C', drives: [{ letter: 'C' }] };
    fetch.mockResolvedValueOnce({ ok: true, json: async () => payload });
    expect(await fetchDrives()).toEqual(payload);
    expect(fetch.mock.calls[0][0]).toBe('http://127.0.0.1:3101/api/drives');
  });

  it('throws the server message on failure', async () => {
    fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'PowerShell failed' }) });
    await expect(fetchDrives()).rejects.toThrow('PowerShell failed');
  });
});
