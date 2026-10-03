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

/** What the helper writes (lib/ntfs/mftWorkerRun.js), as the runner hands it
 * over: a header line then the tree line for a drive that was read, one line
 * for one that was not. */
const asLines = (drives) => drives.flatMap((d) => (d.tree
  ? [Buffer.from(JSON.stringify({ driveLetter: d.driveLetter, stats: d.stats, hasTree: true })), Buffer.from(JSON.stringify(d.tree))]
  : [Buffer.from(JSON.stringify(d))]));
const ran = (...drives) => ({ ok: true, lines: asLines(drives) });

const okTree = { name: 'C:', size: 1234, type: 'directory', children: [] };
const okDrive = (driveLetter = 'C', extra = {}) => ({ driveLetter, tree: { ...okTree, name: `${driveLetter}:` }, stats: {}, ...extra });

describe('scanDrivesViaMft: failures that say why', () => {
  it('words a drive too large for one scan as that, with a code, whatever the helper said', async () => {
    runElevatedNodeJsonMock.mockResolvedValue({ ok: false, error: 'Invalid string length' });
    const result = await scanDrivesViaMft({});
    expect(result).toMatchObject({ ok: false, code: 'scan_too_large' });
    expect(result.error).toMatch(/more files than Prune could hold in one scan/);
    expect(result.error).not.toMatch(/Invalid string length/);
  });

  it('carries the code through when the worker itself named it', async () => {
    runElevatedNodeJsonMock.mockResolvedValue({ ok: false, error: 'x', code: 'scan_too_large' });
    expect(await scanDrivesViaMft({})).toMatchObject({ ok: false, code: 'scan_too_large' });
  });

  it('carries the code of a drive that could not be held when every drive failed', async () => {
    runElevatedNodeJsonMock.mockResolvedValue(ran({ driveLetter: 'C', error: 'too big', code: 'scan_too_large' }));
    expect(await scanDrivesViaMft({})).toMatchObject({ ok: false, code: 'scan_too_large', error: 'too big' });
  });

  it('keeps the code on the failed drive beside the one that worked', async () => {
    runElevatedNodeJsonMock.mockResolvedValue(ran(okDrive('C'), { driveLetter: 'D', error: 'too big', code: 'scan_too_large' }));
    const result = await scanDrivesViaMft({ driveLetters: ['C', 'D'] });
    expect(result.ok).toBe(true);
    expect(result.drives[1]).toEqual({ driveLetter: 'D', error: 'too big', code: 'scan_too_large' });
  });

  it('says a helper that stopped without a word probably ran out of memory, and points at the folder walk', async () => {
    runElevatedNodeJsonMock.mockResolvedValue({ ok: false, error: 'The helper stopped before it finished.', code: 'crashed' });
    const result = await scanDrivesViaMft({});
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/memory/);
    expect(result.error).toMatch(/Walk folders/);
  });

  it('can hand each tree back as the bytes the helper wrote, unparsed', async () => {
    runElevatedNodeJsonMock.mockResolvedValue(ran(okDrive('C')));
    const result = await scanDrivesViaMft({ raw: true });
    expect(Buffer.isBuffer(result.drives[0].treeJson)).toBe(true);
    expect(result.drives[0].tree).toBeUndefined();
    expect(JSON.parse(result.drives[0].treeJson.toString()).name).toBe('C:');
  });

  it('asks the runner for lines, not one document', async () => {
    runElevatedNodeJsonMock.mockResolvedValue(ran(okDrive('C')));
    await scanDrivesViaMft({});
    expect(runElevatedNodeJsonMock.mock.calls[0][2].lines).toBe(true);
  });
});

describe('scanDrivesViaMft', () => {
  it('hands the worker one job covering every drive, so there is a single elevation prompt', async () => {
    runElevatedNodeJsonMock.mockResolvedValue(ran(okDrive('C'), okDrive('D')));

    await scanDrivesViaMft({ driveLetters: ['C', 'D'], maxDepth: 5 });

    expect(runElevatedNodeJsonMock).toHaveBeenCalledTimes(1);
    const [workerPath, args, options] = runElevatedNodeJsonMock.mock.calls[0];
    expect(workerPath).toMatch(/mftWorker\.js$/);
    expect(args).toEqual([]);
    expect(options.input).toEqual({ drives: ['C', 'D'], maxDepth: 5, excludeFolders: [], excludeExtensions: [] });
  });

  it('defaults to the C drive', async () => {
    runElevatedNodeJsonMock.mockResolvedValue(ran(okDrive('C')));
    await scanDrivesViaMft({});
    expect(runElevatedNodeJsonMock.mock.calls[0][2].input.drives).toEqual(['C']);
  });

  it('returns every drive\'s tree and stats on success', async () => {
    runElevatedNodeJsonMock.mockResolvedValue(ran(okDrive('C', { stats: { recordsRead: 800000, mftComplete: true } }), okDrive('D')));
    const result = await scanDrivesViaMft({ driveLetters: ['C', 'D'] });
    expect(result.ok).toBe(true);
    expect(result.drives).toHaveLength(2);
    expect(result.drives[0].stats.recordsRead).toBe(800000);
    expect(result.drives[1].driveLetter).toBe('D');
  });

  // A single-drive caller written before multi-drive existed reads these.
  it('also exposes the first drive at the top level, for single-drive callers', async () => {
    runElevatedNodeJsonMock.mockResolvedValue(ran(okDrive('D', { stats: { recordsRead: 5 } })));
    const result = await scanDrivesViaMft({ driveLetters: ['D'] });
    expect(result.driveLetter).toBe('D');
    expect(result.tree.name).toBe('D:');
    expect(result.stats.recordsRead).toBe(5);
  });

  it('keeps the drives that worked when one drive failed, and reports the failure on that drive', async () => {
    runElevatedNodeJsonMock.mockResolvedValue(ran(okDrive('C'), { driveLetter: 'E', error: 'Not an NTFS volume' }));
    const result = await scanDrivesViaMft({ driveLetters: ['C', 'E'] });
    expect(result.ok).toBe(true);
    expect(result.drives[1]).toEqual({ driveLetter: 'E', error: 'Not an NTFS volume' });
  });

  it('fails as a whole only when every drive failed', async () => {
    runElevatedNodeJsonMock.mockResolvedValue(ran({ driveLetter: 'E', error: 'Not an NTFS volume' }));
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
    runElevatedNodeJsonMock.mockResolvedValue({ ok: true, lines: [Buffer.from(JSON.stringify({ stats: {} }))] });
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
    runNodeJsonMock.mockResolvedValue(ran(okDrive('C')));

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
    runElevatedNodeJsonMock.mockResolvedValue(ran(okDrive('C')));
    await scanDrivesViaMft({});
    expect(runElevatedNodeJsonMock).toHaveBeenCalledTimes(1);
    expect(runNodeJsonMock).not.toHaveBeenCalled();
  });
});
describe('scanDrivesViaMft exclusions', () => {
  it("hands the user's exclusions to the helper, which cannot read Prune's settings itself", async () => {
    runElevatedNodeJsonMock.mockResolvedValue(ran(okDrive('C')));
    await scanDrivesViaMft({ excludeFolders: ['D:\\Games'], excludeExtensions: ['.iso'] });
    const { input } = runElevatedNodeJsonMock.mock.calls[0][2];
    expect(input.excludeFolders).toEqual(['D:\\Games']);
    expect(input.excludeExtensions).toEqual(['.iso']);
  });
});
