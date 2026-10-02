import { describe, it, expect, vi, beforeEach } from 'vitest';

const runElevatedNodeJsonMock = vi.fn();
const runNodeJsonMock = vi.fn();
vi.mock('../lib/elevated.js', () => ({
  runElevatedNodeJson: (...args) => runElevatedNodeJsonMock(...args),
  runNodeJson: (...args) => runNodeJsonMock(...args)
}));
const isElevatedMock = vi.fn(async () => false);
vi.mock('../lib/privilege.js', () => ({ isElevated: (...a) => isElevatedMock(...a) }));

let scanDrivesViaMft;
beforeEach(async () => {
  runElevatedNodeJsonMock.mockReset();
  runNodeJsonMock.mockReset();
  isElevatedMock.mockReset();
  isElevatedMock.mockResolvedValue(false);
  ({ scanDrivesViaMft } = await import('./mftScan.js'));
});

const okTree = { name: 'C:', size: 1234, type: 'directory', children: [] };
const okDrive = (driveLetter = 'C', extra = {}) => ({ driveLetter, tree: { ...okTree, name: `${driveLetter}:` }, stats: {}, ...extra });

describe('scanDrivesViaMft', () => {
  it('hands the worker one job covering every drive, so there is a single elevation prompt', async () => {
    runElevatedNodeJsonMock.mockResolvedValue({ ok: true, data: { drives: [okDrive('C'), okDrive('D')] } });

    await scanDrivesViaMft({ driveLetters: ['C', 'D'], maxDepth: 5 });

    expect(runElevatedNodeJsonMock).toHaveBeenCalledTimes(1);
    const [workerPath, args, options] = runElevatedNodeJsonMock.mock.calls[0];
    expect(workerPath).toMatch(/mftWorker\.js$/);
    expect(args).toEqual([]);
    expect(options.input).toEqual({ drives: ['C', 'D'], maxDepth: 5, excludeFolders: [], excludeExtensions: [] });
  });

  it('defaults to the C drive', async () => {
    runElevatedNodeJsonMock.mockResolvedValue({ ok: true, data: { drives: [okDrive('C')] } });
    await scanDrivesViaMft({});
    expect(runElevatedNodeJsonMock.mock.calls[0][2].input.drives).toEqual(['C']);
  });

  it('returns every drive\'s tree and stats on success', async () => {
    runElevatedNodeJsonMock.mockResolvedValue({
      ok: true,
      data: { drives: [okDrive('C', { stats: { recordsRead: 800000, mftComplete: true } }), okDrive('D')] }
    });
    const result = await scanDrivesViaMft({ driveLetters: ['C', 'D'] });
    expect(result.ok).toBe(true);
    expect(result.drives).toHaveLength(2);
    expect(result.drives[0].stats.recordsRead).toBe(800000);
    expect(result.drives[1].driveLetter).toBe('D');
  });

  // A single-drive caller written before multi-drive existed reads these.
  it('also exposes the first drive at the top level, for single-drive callers', async () => {
    runElevatedNodeJsonMock.mockResolvedValue({ ok: true, data: { drives: [okDrive('D', { stats: { recordsRead: 5 } })] } });
    const result = await scanDrivesViaMft({ driveLetters: ['D'] });
    expect(result.driveLetter).toBe('D');
    expect(result.tree.name).toBe('D:');
    expect(result.stats.recordsRead).toBe(5);
  });

  it('keeps the drives that worked when one drive failed, and reports the failure on that drive', async () => {
    runElevatedNodeJsonMock.mockResolvedValue({
      ok: true,
      data: { drives: [okDrive('C'), { driveLetter: 'E', error: 'Not an NTFS volume' }] }
    });
    const result = await scanDrivesViaMft({ driveLetters: ['C', 'E'] });
    expect(result.ok).toBe(true);
    expect(result.drives[1]).toEqual({ driveLetter: 'E', error: 'Not an NTFS volume' });
  });

  it('fails as a whole only when every drive failed', async () => {
    runElevatedNodeJsonMock.mockResolvedValue({
      ok: true,
      data: { drives: [{ driveLetter: 'E', error: 'Not an NTFS volume' }] }
    });
    const result = await scanDrivesViaMft({ driveLetters: ['E'] });
    expect(result).toEqual({ ok: false, error: 'Not an NTFS volume' });
  });

  // A declined UAC prompt is a normal answer, not a failure. The caller
  // has to be able to tell it apart from a real error so it can say
  // "not approved" instead of showing a broken-scan message.
  it('passes a declined UAC prompt straight through as cancelled', async () => {
    runElevatedNodeJsonMock.mockResolvedValue({ ok: false, cancelled: true });
    expect(await scanDrivesViaMft({})).toEqual({ ok: false, cancelled: true });
  });

  it('passes a real failure through as an error', async () => {
    runElevatedNodeJsonMock.mockResolvedValue({ ok: false, error: 'The elevated helper failed to start.' });
    expect(await scanDrivesViaMft({})).toEqual({ ok: false, error: 'The elevated helper failed to start.' });
  });

  // The worker always writes JSON, including on failure -- but a
  // well-formed payload with no tree in it would otherwise reach the UI
  // as a successful scan of an empty drive.
  it('rejects a well-formed response that carries no drives', async () => {
    runElevatedNodeJsonMock.mockResolvedValue({ ok: true, data: { stats: {} } });
    const result = await scanDrivesViaMft({});
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no tree|no drives/i);
  });

  it('survives a response with no data at all', async () => {
    runElevatedNodeJsonMock.mockResolvedValue({ ok: true });
    expect((await scanDrivesViaMft({})).ok).toBe(false);
  });
});

describe('scanDrivesViaMft when Prune is already running as administrator', () => {
  beforeEach(() => { isElevatedMock.mockResolvedValue(true); });

  // The point of running Prune elevated. Asking Windows for consent the
  // user gave by starting Prune this way, on every scan, would make the
  // restart pointless.
  it('runs the helper directly and raises no prompt', async () => {
    runNodeJsonMock.mockResolvedValue({ ok: true, data: { drives: [okDrive('C')] } });

    const result = await scanDrivesViaMft({ driveLetters: ['C'] });

    expect(result.ok).toBe(true);
    expect(runElevatedNodeJsonMock).not.toHaveBeenCalled();
    expect(runNodeJsonMock).toHaveBeenCalledTimes(1);
    const [workerPath, args, options] = runNodeJsonMock.mock.calls[0];
    expect(workerPath).toMatch(/mftWorker\.js$/);
    expect(args).toEqual([]);
    expect(options.input).toEqual({ drives: ['C'], maxDepth: 12, excludeFolders: [], excludeExtensions: [] });
  });

  it('reports a real failure of the direct run as an error', async () => {
    runNodeJsonMock.mockResolvedValue({ ok: false, error: 'Access is denied' });
    expect(await scanDrivesViaMft({})).toEqual({ ok: false, error: 'Access is denied' });
  });
});

describe('scanDrivesViaMft when Prune is not elevated', () => {
  it('goes through the UAC prompt as before', async () => {
    runElevatedNodeJsonMock.mockResolvedValue({ ok: true, data: { drives: [okDrive('C')] } });
    await scanDrivesViaMft({});
    expect(runElevatedNodeJsonMock).toHaveBeenCalledTimes(1);
    expect(runNodeJsonMock).not.toHaveBeenCalled();
  });
});
describe('scanDrivesViaMft exclusions', () => {
  it("hands the user's exclusions to the helper, which cannot read Prune's settings itself", async () => {
    runElevatedNodeJsonMock.mockResolvedValue({ ok: true, data: { drives: [okDrive('C')] } });
    await scanDrivesViaMft({ excludeFolders: ['D:\\Games'], excludeExtensions: ['.iso'] });
    const { input } = runElevatedNodeJsonMock.mock.calls[0][2];
    expect(input.excludeFolders).toEqual(['D:\\Games']);
    expect(input.excludeExtensions).toEqual(['.iso']);
  });
});
