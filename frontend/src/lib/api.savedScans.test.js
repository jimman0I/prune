import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchSavedScans, saveDiskScan, loadSavedScan, deleteSavedScan, compareSavedScans } from './api.js';

global.fetch = vi.fn();
const ok = (body) => ({ ok: true, json: async () => body });
const BASE = 'http://127.0.0.1:3101/api/saved-scans';

describe('saved scan requests', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('lists scans', async () => {
    fetch.mockResolvedValueOnce(ok({ scans: [{ id: 'a' }] }));
    expect(await fetchSavedScans()).toEqual([{ id: 'a' }]);
    expect(fetch.mock.calls[0][0]).toBe(BASE);
  });

  it('saves an archive and returns the list entry', async () => {
    fetch.mockResolvedValueOnce(ok({ scan: { id: 'abc123' } }));
    const archive = { v: 1, root: { n: 'C:', s: 1 }, top: [] };
    expect(await saveDiskScan({ label: 'x', source: 'fast', truncated: false, archive })).toEqual({ id: 'abc123' });
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe(BASE);
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ label: 'x', source: 'fast', truncated: false, archive });
  });

  it('opens, deletes and compares by id, encoded', async () => {
    fetch.mockResolvedValue(ok({ scan: {}, archive: {}, deleted: true }));
    await loadSavedScan('a b');
    expect(fetch.mock.calls[0][0]).toBe(`${BASE}/a%20b`);
    await deleteSavedScan('id1');
    expect(fetch.mock.calls[1][0]).toBe(`${BASE}/id1`);
    expect(fetch.mock.calls[1][1].method).toBe('DELETE');
    await compareSavedScans('x', 'y', 10);
    expect(fetch.mock.calls[2][0]).toBe(`${BASE}/compare?a=x&b=y&limit=10`);
  });

  it('throws the server message', async () => {
    fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'That saved scan is not there.' }) });
    await expect(loadSavedScan('zzz')).rejects.toThrow('That saved scan is not there.');
  });
});
