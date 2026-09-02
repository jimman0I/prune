import { describe, it, expect, vi, beforeEach } from 'vitest';

const runElevatedNodeJsonMock = vi.fn();
vi.mock('../lib/elevated.js', () => ({
  runElevatedNodeJson: (...args) => runElevatedNodeJsonMock(...args)
}));

let scanDriveViaMft;
beforeEach(async () => {
  runElevatedNodeJsonMock.mockReset();
  ({ scanDriveViaMft } = await import('./mftScan.js'));
});

const okTree = { name: 'C:', size: 1234, type: 'directory', children: [] };

describe('scanDriveViaMft', () => {
  it('passes the drive letter and depth to the elevated worker', async () => {
    runElevatedNodeJsonMock.mockResolvedValue({ ok: true, data: { tree: okTree, stats: {}, driveLetter: 'D' } });
    await scanDriveViaMft({ driveLetter: 'D', maxDepth: 5 });
    const [workerPath, args] = runElevatedNodeJsonMock.mock.calls[0];
    expect(workerPath).toMatch(/mftWorker\.js$/);
    expect(args).toEqual(['D', '5']);
  });

  it('returns the tree and stats on success', async () => {
    runElevatedNodeJsonMock.mockResolvedValue({
      ok: true,
      data: { tree: okTree, stats: { recordsRead: 800000, mftComplete: true }, driveLetter: 'C' }
    });
    const result = await scanDriveViaMft({});
    expect(result.ok).toBe(true);
    expect(result.tree).toEqual(okTree);
    expect(result.stats.recordsRead).toBe(800000);
  });

  // A declined UAC prompt is a normal answer, not a failure. The caller
  // has to be able to tell it apart from a real error so it can say
  // "not approved" instead of showing a broken-scan message.
  it('passes a declined UAC prompt straight through as cancelled', async () => {
    runElevatedNodeJsonMock.mockResolvedValue({ ok: false, cancelled: true });
    expect(await scanDriveViaMft({})).toEqual({ ok: false, cancelled: true });
  });

  it('passes a real failure through as an error', async () => {
    runElevatedNodeJsonMock.mockResolvedValue({ ok: false, error: 'Not an NTFS volume' });
    expect(await scanDriveViaMft({})).toEqual({ ok: false, error: 'Not an NTFS volume' });
  });

  // The worker always writes JSON, including on failure -- but a
  // well-formed payload with no tree in it would otherwise reach the UI
  // as a successful scan of an empty drive.
  it('rejects a well-formed response that carries no tree', async () => {
    runElevatedNodeJsonMock.mockResolvedValue({ ok: true, data: { stats: {} } });
    const result = await scanDriveViaMft({});
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no tree/i);
  });

  it('survives a response with no data at all', async () => {
    runElevatedNodeJsonMock.mockResolvedValue({ ok: true });
    expect((await scanDriveViaMft({})).ok).toBe(false);
  });
});
