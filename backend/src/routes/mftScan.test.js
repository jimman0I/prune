import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestServer } from '../testSupport/routeServer.js';

const scanDrivesViaMft = vi.fn();
vi.mock('../services/mftScan.js', () => ({ scanDrivesViaMft: (...a) => scanDrivesViaMft(...a) }));

const isElevated = vi.fn(async () => false);
vi.mock('../lib/privilege.js', () => ({ isElevated: (...a) => isElevated(...a) }));

let settings = { excludeFolders: [], excludeExtensions: [] };
vi.mock('../services/settings.js', () => ({
  getSettings: async () => {
    if (settings instanceof Error) throw settings;
    return settings;
  }
}));

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

describe('POST /mft-scan: the reply', () => {
  const treeBytes = (name) => Buffer.from(JSON.stringify({ name, size: 9, type: 'directory', children: [], folded: { count: 3, size: 4 } }));

  it('writes each tree as the bytes it was handed and still answers valid JSON', async () => {
    scanDrivesViaMft.mockResolvedValueOnce({
      ok: true,
      drives: [
        { driveLetter: 'C', stats: { recordsRead: 5 }, treeJson: treeBytes('C:') },
        { driveLetter: 'E', error: 'Not an NTFS volume' },
        { driveLetter: 'D', stats: {}, treeJson: treeBytes('D:') }
      ],
      driveLetter: 'C',
      stats: { recordsRead: 5 }
    });
    const res = await post({ driveLetters: ['C', 'E', 'D'] });
    expect(res.status).toBe(200);
    expect(res.body.drives.map((d) => d.driveLetter)).toEqual(['C', 'E', 'D']);
    expect(res.body.drives[0].tree.folded).toEqual({ count: 3, size: 4 });
    expect(res.body.drives[0].stats.recordsRead).toBe(5);
    expect(res.body.drives[1].error).toBe('Not an NTFS volume');
    expect(res.body.drives[2].tree.name).toBe('D:');
  });

  it('asks the service for raw trees, so the main process never parses one only to print it again', async () => {
    await post({ driveLetters: ['C'] });
    expect(scanDrivesViaMft.mock.calls[0][0].raw).toBe(true);
  });

  it("no longer repeats the first drive's tree at the top level, which doubled the reply", async () => {
    const res = await post({ driveLetters: ['C'] });
    expect(res.body.tree).toBeUndefined();
    expect(res.body.driveLetter).toBe('C');
  });

  it('passes the reason code on a failure so the screen can word it', async () => {
    scanDrivesViaMft.mockResolvedValueOnce({ ok: false, error: 'The drive has more files than Prune could hold in one scan.', code: 'scan_too_large' });
    const res = await post({ driveLetters: ['C'] });
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('scan_too_large');
  });

  it('turns a RangeError thrown while answering into the same sentence', async () => {
    scanDrivesViaMft.mockRejectedValueOnce(new RangeError('Invalid string length'));
    const res = await post({ driveLetters: ['C'] });
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('scan_too_large');
    expect(res.body.error).not.toMatch(/Invalid string length/);
  });
});

describe('POST /mft-scan exclusions', () => {
  it("passes the user's excluded folders and file types to the scan", async () => {
    settings = { excludeFolders: ['D:\\Games'], excludeExtensions: ['.vhdx'] };
    await post({ driveLetters: ['D'] });
    const call = scanDrivesViaMft.mock.calls[0][0];
    expect(call.excludeFolders).toEqual(['D:\\Games']);
    expect(call.excludeExtensions).toEqual(['.vhdx']);
  });

  it('scans with no exclusions when the settings cannot be read, rather than not scanning', async () => {
    settings = new Error('settings.json is locked');
    const res = await post({ driveLetters: ['C'] });
    expect(res.status).toBe(200);
    expect(scanDrivesViaMft.mock.calls[0][0].excludeFolders).toEqual([]);
    settings = { excludeFolders: [], excludeExtensions: [] };
  });

  it('ignores a setting that is not a list', async () => {
    settings = { excludeFolders: 'D:\\Games', excludeExtensions: null };
    await post({ driveLetters: ['C'] });
    expect(scanDrivesViaMft.mock.calls[0][0].excludeFolders).toEqual([]);
    expect(scanDrivesViaMft.mock.calls[0][0].excludeExtensions).toEqual([]);
    settings = { excludeFolders: [], excludeExtensions: [] };
  });
});

describe('GET /mft-scan/status', () => {
  it('says whether Prune already runs as administrator', async () => {
    isElevated.mockResolvedValueOnce(true);
    expect((await server.call('/mft-scan/status')).body).toEqual({ elevated: true });
    isElevated.mockResolvedValueOnce(false);
    expect((await server.call('/mft-scan/status')).body).toEqual({ elevated: false });
  });

  // Reading the status must never be able to start a scan: the scan itself
  // stays POST-only, because it can raise a consent dialog.
  it('does not make the scan itself reachable by GET', async () => {
    expect([404, 405]).toContain((await server.call('/mft-scan')).status);
    expect(scanDrivesViaMft).not.toHaveBeenCalled();
  });
});