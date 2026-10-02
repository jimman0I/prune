import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestServer } from '../testSupport/routeServer.js';

const scanDrivesViaMft = vi.fn();
vi.mock('../services/mftScan.js', () => ({ scanDrivesViaMft: (...a) => scanDrivesViaMft(...a) }));

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => {
  vi.clearAllMocks();
  scanDrivesViaMft.mockResolvedValue({
    ok: true,
    drives: [{ driveLetter: 'C', tree: { name: 'C:' }, stats: {} }],
    driveLetter: 'C',
    tree: { name: 'C:' },
    stats: {}
  });
});

const post = (body) => server.call('/mft-scan', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

describe('POST /mft-scan', () => {
  it('scans every drive named in driveLetters in one call', async () => {
    const res = await post({ driveLetters: ['c', 'D'] });
    expect(res.status).toBe(200);
    expect(scanDrivesViaMft).toHaveBeenCalledTimes(1);
    expect(scanDrivesViaMft.mock.calls[0][0].driveLetters).toEqual(['C', 'D']);
    expect(res.body.drives).toHaveLength(1);
  });

  it('still takes the older single driveLetter', async () => {
    await post({ driveLetter: 'd' });
    expect(scanDrivesViaMft.mock.calls[0][0].driveLetters).toEqual(['D']);
  });

  it('defaults to C', async () => {
    await post({});
    expect(scanDrivesViaMft.mock.calls[0][0].driveLetters).toEqual(['C']);
  });

  it('refuses anything that is not a single drive letter, before any elevation', async () => {
    for (const body of [
      { driveLetters: ['C:\\'] },
      { driveLetters: ['CD'] },
      { driveLetters: ['1'] },
      { driveLetters: [] },
      { driveLetter: '..\\..' }
    ]) {
      const res = await post(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    expect(scanDrivesViaMft).not.toHaveBeenCalled();
  });

  it('answers a declined prompt as 200 cancelled', async () => {
    scanDrivesViaMft.mockResolvedValueOnce({ ok: false, cancelled: true });
    const res = await post({ driveLetters: ['C'] });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ cancelled: true });
  });

  it('answers a real failure as 500 with the reason', async () => {
    scanDrivesViaMft.mockResolvedValueOnce({ ok: false, error: 'Not an NTFS volume' });
    const res = await post({ driveLetters: ['E'] });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Not an NTFS volume');
  });
});
