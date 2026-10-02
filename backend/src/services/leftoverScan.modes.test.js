import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const runPowerShellJsonMock = vi.fn();
vi.mock('./powershell.js', () => ({ runPowerShellJson: (...args) => runPowerShellJsonMock(...args) }));

let scanForLeftovers;
let base;
beforeEach(async () => {
  runPowerShellJsonMock.mockReset();
  base = mkdtempSync(join(tmpdir(), 'prune-modes-'));
  ({ scanForLeftovers } = await import('./leftoverScan.js'));
});
afterEach(() => { rmSync(base, { recursive: true, force: true }); });

const folder = (...parts) => {
  const p = join(base, ...parts);
  mkdirSync(p, { recursive: true });
  writeFileSync(join(p, 'data.bin'), Buffer.alloc(100));
  return p;
};

describe('scan mode: Safe', () => {
  it('reports the install location and nothing it had to guess', async () => {
    const own = folder('Games', 'Acme');
    folder('Games', 'Acme Other');
    runPowerShellJsonMock.mockResolvedValue(null);

    const result = await scanForLeftovers({
      name: 'Acme', publisher: 'Acme Inc', mode: 'safe', anchors: { installLocation: own }
    });

    expect(result.files).toEqual({ ok: true, items: [{ path: own, sizeBytes: 100, confidence: 'certain' }] });
    expect(result.mode).toBe('safe');
  });

  it('never runs the name sweep: no pattern reaches PowerShell', async () => {
    runPowerShellJsonMock.mockResolvedValue(null);
    await scanForLeftovers({ name: 'Acme', publisher: 'Acme Inc', mode: 'safe', anchors: { registryKey: 'HKCU:\\Software\\Acme' } });
    for (const [script] of runPowerShellJsonMock.mock.calls) {
      expect(script).not.toContain('$pattern');
      expect(script).not.toContain('Acme Inc');
    }
  });

  it('checks the program\'s own registry key', async () => {
    runPowerShellJsonMock.mockResolvedValueOnce({ path: 'HKEY_CURRENT_USER\\Software\\Acme', valueName: null, isUninstallEntry: true });
    const result = await scanForLeftovers({
      name: 'Acme', publisher: '', mode: 'safe', anchors: { registryKey: 'HKCU:\\Software\\Acme' }
    });
    expect(result.registryKeys.items).toEqual([{ path: 'HKEY_CURRENT_USER\\Software\\Acme', isUninstallEntry: true, confidence: 'certain' }]);
  });

  it('finds nothing when the program recorded no anchors, rather than falling back to guessing', async () => {
    const result = await scanForLeftovers({ name: 'Acme', publisher: 'Acme Inc', mode: 'safe', anchors: {} });
    expect(result.files.items).toEqual([]);
    expect(result.registryKeys.items).toEqual([]);
    expect(result.scheduledTasks.items).toEqual([]);
    expect(runPowerShellJsonMock).not.toHaveBeenCalled();
  });

  it('refuses an install location that is Windows itself', async () => {
    const result = await scanForLeftovers({ name: 'Acme', mode: 'safe', anchors: { installLocation: 'C:\\Windows' } });
    expect(result.files.items).toEqual([]);
  });
});

describe('scan mode: Moderate', () => {
  it('is the default, and keeps the existing three scans in their order', async () => {
    runPowerShellJsonMock
      .mockResolvedValueOnce([{ path: 'C:\\ProgramData\\OldApp', sizeBytes: 4096 }])
      .mockResolvedValueOnce([{ path: 'HKCU:\\Software\\OldApp' }])
      .mockResolvedValueOnce([{ name: 'OldAppUpdater', path: '\\OldApp\\' }]);
    const result = await scanForLeftovers({ name: 'OldApp', publisher: 'Old Inc' });
    expect(result.mode).toBe('moderate');
    expect(result.files.items.map((i) => i.path)).toEqual(['C:\\ProgramData\\OldApp']);
    expect(result.registryKeys.items).toHaveLength(1);
    expect(result.scheduledTasks.items).toHaveLength(1);
  });

  it('adds the install location to what the name search finds, once', async () => {
    const own = folder('Elsewhere', 'Acme');
    runPowerShellJsonMock
      .mockResolvedValueOnce([{ path: own, sizeBytes: 100 }])
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    const result = await scanForLeftovers({ name: 'Acme', publisher: '', anchors: { installLocation: own } });
    expect(result.files.items.map((i) => i.path)).toEqual([own]);
  });

  it('treats an unknown mode as Moderate', async () => {
    runPowerShellJsonMock.mockResolvedValue(null);
    const result = await scanForLeftovers({ name: 'Acme', mode: 'turbo' });
    expect(result.mode).toBe('moderate');
  });
});

describe('scan mode: Advanced', () => {
  it('searches recursively below the roots, by name and by a distinctive word of it', async () => {
    const byName = folder('roots', 'Vendor', 'Acme Photo Studio');
    const byWord = folder('roots', 'Suite', 'Sub', 'Studio Cache');
    folder('roots', 'Unrelated', 'Thing');
    runPowerShellJsonMock.mockResolvedValue(null);

    const result = await scanForLeftovers({
      name: 'Acme Photo Studio', publisher: '', mode: 'advanced',
      fileRoots: [{ path: join(base, 'roots'), depth: 3 }]
    });

    const paths = result.files.items.map((i) => i.path).sort();
    expect(paths).toEqual([byName, byWord].sort());
    expect(result.files.items.every((i) => i.sizeBytes === 100)).toBe(true);
  });

  it('does not use PowerShell for the file half (no 15-second ceiling on a deep search)', async () => {
    folder('roots', 'Acme');
    runPowerShellJsonMock.mockResolvedValue(null);
    await scanForLeftovers({ name: 'Acme', mode: 'advanced', fileRoots: [{ path: join(base, 'roots'), depth: 2 }] });
    for (const [script] of runPowerShellJsonMock.mock.calls) expect(script).not.toContain('-Directory');
  });

  it('also reports services, and registry passes use the wide sweep', async () => {
    runPowerShellJsonMock
      .mockResolvedValueOnce([{ path: 'HKEY_CURRENT_USER\\Software\\Acme' }])
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([{ name: 'AcmeSvc', displayName: 'Acme Service', pathName: 'C:\\Acme\\svc.exe' }]);
    const result = await scanForLeftovers({ name: 'Acme', publisher: '', mode: 'advanced', fileRoots: [] });
    expect(runPowerShellJsonMock.mock.calls[0][0]).toContain('CLSID');
    expect(result.services.items).toEqual([{ name: 'AcmeSvc', displayName: 'Acme Service', pathName: 'C:\\Acme\\svc.exe', confidence: 'likely' }]);
  });

  it('leaves services out of Safe and Moderate', async () => {
    runPowerShellJsonMock.mockResolvedValue(null);
    expect((await scanForLeftovers({ name: 'Acme', mode: 'moderate' })).services).toBeUndefined();
    expect((await scanForLeftovers({ name: 'Acme', mode: 'safe' })).services).toBeUndefined();
  });

  it('says so when the walk ran out of budget', async () => {
    runPowerShellJsonMock.mockResolvedValue(null);
    for (let i = 0; i < 4; i += 1) folder('roots', `d${i}`);
    const result = await scanForLeftovers({
      name: 'Acme', mode: 'advanced', fileRoots: [{ path: join(base, 'roots'), depth: 2 }], walkOptions: { maxEntries: 2 }
    });
    expect(result.files.truncated).toBe(true);
  });
});
