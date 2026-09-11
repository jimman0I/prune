import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const runPowerShellJsonMock = vi.fn();
vi.mock('./powershell.js', () => ({ runPowerShellJson: (...args) => runPowerShellJsonMock(...args) }));

let sendToRecycleBin, normalizeRecycleResult;
beforeEach(async () => {
  runPowerShellJsonMock.mockReset();
  ({ sendToRecycleBin, normalizeRecycleResult } = await import('./recycleBin.js'));
});

describe('normalizeRecycleResult', () => {
  it('reads the ordinary two-array shape', () => {
    expect(normalizeRecycleResult({ recycled: ['a', 'b'], failed: ['c'] }))
      .toEqual({ recycled: ['a', 'b'], failed: ['c'] });
  });

  it('reads a single result, which ConvertTo-Json flattens to a bare value', () => {
    expect(normalizeRecycleResult({ recycled: 'a', failed: 'b' }))
      .toEqual({ recycled: ['a'], failed: ['b'] });
  });

  it('reads an empty run, which ConvertTo-Json omits entirely', () => {
    expect(normalizeRecycleResult({})).toEqual({ recycled: [], failed: [] });
    expect(normalizeRecycleResult(null)).toEqual({ recycled: [], failed: [] });
  });
});

describe('sendToRecycleBin', () => {
  it('never runs PowerShell for an empty list', async () => {
    expect(await sendToRecycleBin([])).toEqual({ recycled: [], failed: [] });
    expect(await sendToRecycleBin(null)).toEqual({ recycled: [], failed: [] });
    expect(runPowerShellJsonMock).not.toHaveBeenCalled();
  });

  it('ignores blanks rather than passing them to the shell', async () => {
    runPowerShellJsonMock.mockResolvedValueOnce({ recycled: [], failed: [] });
    await sendToRecycleBin(['', '   ', null, 'C:\\real.tmp']);
    expect(runPowerShellJsonMock.mock.calls[0][0]).toContain('real.tmp');
  });

  it('escapes an apostrophe instead of breaking the script', async () => {
    runPowerShellJsonMock.mockResolvedValueOnce({ recycled: [], failed: [] });
    await sendToRecycleBin(["C:\\Users\\O'Brien\\a.tmp"]);
    expect(runPowerShellJsonMock.mock.calls[0][0]).toContain("O''Brien");
  });

  it('asks for the Recycle Bin, not a delete', async () => {
    // The whole point of the setting. A DeleteFile without the
    // SendToRecycleBin option is an unrecoverable delete.
    runPowerShellJsonMock.mockResolvedValueOnce({ recycled: [], failed: [] });
    await sendToRecycleBin(['C:\\a.tmp']);
    expect(runPowerShellJsonMock.mock.calls[0][0]).toContain('SendToRecycleBin');
  });

  it('reports everything as failed when the whole call dies', async () => {
    // A caller that assumed success would report freed space that is
    // still sitting on the disk.
    runPowerShellJsonMock.mockRejectedValueOnce(new Error('powershell died'));
    const result = await sendToRecycleBin(['C:\\a.tmp']);
    expect(result.recycled).toEqual([]);
    expect(result.failed).toEqual(['C:\\a.tmp']);
    expect(result.error).toMatch(/powershell died/);
  });
});

/** The mocked tests above cannot see whether the generated script parses
 * or whether it actually recycles anything -- the same blind spot that let
 * a broken leftover-scan script ship for a week. This one runs it. */
describe('sendToRecycleBin (real PowerShell, real Recycle Bin)', () => {
  let dir;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'prune-recycle-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('really moves a file to the Recycle Bin', async () => {
    vi.doUnmock('./powershell.js');
    vi.resetModules();
    const { sendToRecycleBin: real } = await import('./recycleBin.js');

    const file = join(dir, 'prune-recycle-fixture.txt');
    writeFileSync(file, 'recycle me');
    expect(existsSync(file)).toBe(true);

    const result = await real([file]);

    expect(result.failed).toEqual([]);
    expect(result.recycled).toEqual([file]);
    // Gone from where it was, which is what the caller reports as freed.
    expect(existsSync(file)).toBe(false);
  }, 60000);

  it('really moves a folder, with everything in it, to the Recycle Bin', async () => {
    /* Found by a live check of the uninstall leftovers feature: this only
     * ever handled files -- Deep Clean hands it files -- so a FOLDER, which
     * is what most uninstall leftovers are, was skipped without being
     * recycled or reported as failed. */
    vi.doUnmock('./powershell.js');
    vi.resetModules();
    const { sendToRecycleBin: real } = await import('./recycleBin.js');

    const folder = join(dir, 'prune-recycle-folder-fixture');
    mkdirSync(join(folder, 'nested'), { recursive: true });
    writeFileSync(join(folder, 'settings.ini'), 'recycle me');
    writeFileSync(join(folder, 'nested', 'cache.bin'), 'and me');

    const result = await real([folder]);

    expect(result.failed).toEqual([]);
    expect(result.recycled).toEqual([folder]);
    expect(existsSync(folder)).toBe(false);
  }, 60000);

  it('reports a file that is not there rather than throwing', async () => {
    vi.doUnmock('./powershell.js');
    vi.resetModules();
    const { sendToRecycleBin: real } = await import('./recycleBin.js');

    const result = await real([join(dir, 'never-existed.txt')]);
    expect(result.recycled).toEqual([]);
    expect(result.failed).toEqual([]);
  }, 60000);
});
