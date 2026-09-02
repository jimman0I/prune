import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scanForcedUninstall } from './api.js';

global.fetch = vi.fn();

const emptyScan = {
  files: { ok: true, items: [] },
  registryKeys: { ok: true, items: [] },
  scheduledTasks: { ok: true, items: [] }
};

describe('scanForcedUninstall', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('posts the name, publisher and registry key', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => emptyScan });
    await scanForcedUninstall({
      name: 'Dead App',
      publisher: 'Nobody',
      registryKey: 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{X}'
    });
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:3101/api/forced-uninstall/scan');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({
      name: 'Dead App',
      publisher: 'Nobody',
      registryKey: 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{X}'
    });
  });

  it('returns the scan result', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => emptyScan });
    expect(await scanForcedUninstall({ name: 'Dead App' })).toEqual(emptyScan);
  });

  it('throws the server\'s own message on a rejected request', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'A program name is required to scan for leftovers.' })
    });
    await expect(scanForcedUninstall({ name: '' }))
      .rejects.toThrow('A program name is required to scan for leftovers.');
  });
});
