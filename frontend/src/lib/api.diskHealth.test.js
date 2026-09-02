import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchDiskHealth } from './api.js';

global.fetch = vi.fn();

describe('fetchDiskHealth', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns the disk health payload', async () => {
    const payload = {
      disks: [{ model: 'Micron 2300 NVMe 1024GB', lifeRemainingPercent: 93, healthStatus: 'Healthy' }],
      reliabilityAvailable: true
    };
    fetch.mockResolvedValueOnce({ ok: true, json: async () => payload });
    const result = await fetchDiskHealth();
    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:3101/api/disk-health');
    expect(result).toEqual(payload);
  });

  it('throws the real message when the drive query is unavailable (503)', async () => {
    fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Disk health is unavailable on this machine.' }) });
    await expect(fetchDiskHealth()).rejects.toThrow('Disk health is unavailable on this machine.');
  });
});
