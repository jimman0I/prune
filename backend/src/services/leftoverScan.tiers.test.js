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
  base = mkdtempSync(join(tmpdir(), 'prune-tiers-'));
  ({ scanForLeftovers } = await import('./leftoverScan.js'));
});
afterEach(() => { rmSync(base, { recursive: true, force: true }); });

const folder = (...parts) => {
  const p = join(base, ...parts);
  mkdirSync(p, { recursive: true });
  writeFileSync(join(p, 'f.bin'), Buffer.alloc(10));
  return p;
};
const psSequence = (files, registry = null, tasks = null) => {
  runPowerShellJsonMock.mockResolvedValueOnce(files).mockResolvedValueOnce(registry).mockResolvedValueOnce(tasks);
};

describe('confidence tiers', () => {
  it('files: the program\'s own folder is certain, its name likely, only its publisher possible', async () => {
    const own = folder('Games', 'Elsewhere');
    psSequence([
      { path: 'C:\\ProgramData\\Acme Tool', sizeBytes: 1 },
      { path: 'C:\\ProgramData\\Acme Corp', sizeBytes: 2 }
    ]);
    const result = await scanForLeftovers({
      name: 'Acme Tool', publisher: 'Acme Corp', anchors: { installLocation: own }
    });
    const tier = Object.fromEntries(result.files.items.map((i) => [i.path, i.confidence]));
    expect(tier[own]).toBe('certain');
    expect(tier['C:\\ProgramData\\Acme Tool']).toBe('likely');
    expect(tier['C:\\ProgramData\\Acme Corp']).toBe('possible');
  });

  it('registry: an entry the program\'s folder vouches for is certain, with the internal fields removed', async () => {
    psSequence(null, [
      { path: 'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', valueName: 'Whatever', how: 'anchor', text: 'Whatever "D:\\Apps\\Acme\\tray.exe"' },
      { path: 'HKEY_CURRENT_USER\\Software\\Acme', how: 'name' },
      { path: 'HKEY_CURRENT_USER\\Software\\AcmeVendor\\Other', how: 'name' }
    ]);
    const result = await scanForLeftovers({ name: 'Acme', publisher: 'Other Inc', anchors: { installLocation: 'D:\\Apps\\Acme' } });
    const byPath = Object.fromEntries(result.registryKeys.items.map((i) => [i.valueName || i.path, i]));
    expect(byPath.Whatever.confidence).toBe('certain');
    expect(byPath['HKEY_CURRENT_USER\\Software\\Acme'].confidence).toBe('likely');
    for (const item of result.registryKeys.items) {
      expect(item).not.toHaveProperty('anchored');
      expect(item).not.toHaveProperty('text');
      expect(item).not.toHaveProperty('how');
    }
  });

  it('registry: the program\'s own Add/Remove key is certain whatever it is called', async () => {
    runPowerShellJsonMock.mockResolvedValue(null);
    runPowerShellJsonMock.mockResolvedValueOnce(null).mockResolvedValueOnce([
      { path: 'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{GUID}', isUninstallEntry: true, text: 'Display' }
    ]);
    const result = await scanForLeftovers({
      name: 'Acme', anchors: { registryKey: 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{GUID}' }
    });
    expect(result.registryKeys.items[0].confidence).toBe('certain');
  });

  it('tasks: a task running something from the program\'s folder is certain, a name match likely', async () => {
    psSequence(null, null, [
      { name: 'Updater', path: '\\Vendor\\', actions: '"D:\\Apps\\Acme\\up.exe"', how: 'anchor' },
      { name: 'Acme sync', path: '\\', actions: 'x', how: 'name' }
    ]);
    const result = await scanForLeftovers({ name: 'Acme', anchors: { installLocation: 'D:\\Apps\\Acme' } });
    expect(result.scheduledTasks.items.map((i) => [i.name, i.confidence])).toEqual([['Updater', 'certain'], ['Acme sync', 'likely']]);
    expect(result.scheduledTasks.items[0]).not.toHaveProperty('how');
  });

  it('hands the registry and task scripts the program\'s folders, even ones no longer on disk', async () => {
    runPowerShellJsonMock.mockResolvedValue(null);
    await scanForLeftovers({ name: 'Acme', anchors: { installLocation: 'D:\\Gone\\Acme' } });
    const scripts = runPowerShellJsonMock.mock.calls.map(([s]) => s);
    expect(scripts.some((s) => s.includes("'d:\\gone\\acme\\'"))).toBe(true);
  });

  it('advanced: a single word of the name is only possible', async () => {
    folder('roots', 'Studio Cache');
    runPowerShellJsonMock.mockResolvedValue(null);
    const result = await scanForLeftovers({
      name: 'Acme Studio', mode: 'advanced', fileRoots: [{ path: join(base, 'roots'), depth: 2 }]
    });
    expect(result.files.items.map((i) => i.confidence)).toEqual(['possible']);
  });
});

describe('shared-component protection', () => {
  it('never returns Windows or Microsoft components, however they matched', async () => {
    psSequence([
      { path: 'C:\\ProgramData\\Microsoft', sizeBytes: 1 },
      { path: 'C:\\Windows\\Temp\\Microsoft', sizeBytes: 1 },
      { path: 'C:\\Users\\me\\AppData\\Local\\Microsoft', sizeBytes: 1 },
      { path: 'C:\\Program Files\\Windows Defender', sizeBytes: 1 },
      { path: 'C:\\Program Files', sizeBytes: 1 },
      { path: 'C:\\Program Files\\Microsoft Office', sizeBytes: 1 }
    ]);
    const result = await scanForLeftovers({ name: 'Microsoft', publisher: 'Microsoft Corporation' });
    expect(result.files.items.map((i) => i.path)).toEqual(['C:\\Program Files\\Microsoft Office']);
    expect(result.files.protected).toBe(5);
  });

  it('never returns another installed program\'s folder, nor a folder that contains one', async () => {
    psSequence([
      { path: 'D:\\Vendor', sizeBytes: 1 },
      { path: 'D:\\Vendor\\Other', sizeBytes: 1 },
      { path: 'D:\\Vendor\\Other\\plugins\\Acme', sizeBytes: 1 },
      { path: 'D:\\Vendor\\Acme Cache', sizeBytes: 1 }
    ]);
    const result = await scanForLeftovers({
      name: 'Acme', publisher: 'Vendor',
      installedPrograms: [{ id: 'other', name: 'Other Product', installLocation: 'D:\\Vendor\\Other' }]
    });
    expect(result.files.items.map((i) => i.path)).toEqual(['D:\\Vendor\\Acme Cache']);
    expect(result.files.protected).toBe(3);
  });

  it('accepts the installed list as a promise, and survives it failing', async () => {
    psSequence([{ path: 'D:\\Acme', sizeBytes: 1 }]);
    const ok = await scanForLeftovers({ name: 'Acme', installedPrograms: Promise.resolve([]) });
    expect(ok.files.items).toHaveLength(1);
    psSequence([{ path: 'D:\\Acme', sizeBytes: 1 }]);
    const failed = await scanForLeftovers({ name: 'Acme', installedPrograms: Promise.reject(new Error('no list')) });
    expect(failed.files.items).toHaveLength(1);
  });

  it('does not treat the program being uninstalled as "another program"', async () => {
    const own = folder('Apps', 'Acme');
    runPowerShellJsonMock.mockResolvedValue(null);
    const result = await scanForLeftovers({
      name: 'Acme', mode: 'safe', anchors: { installLocation: own, registryKey: 'HKLM:\\SOFTWARE\\Acme' },
      installedPrograms: [{ id: 'acme', name: 'Acme', installLocation: own, registryKey: 'HKLM:\\SOFTWARE\\Acme' }]
    });
    expect(result.files.items.map((i) => i.path)).toEqual([own]);
  });

  it('drops the Add/Remove entry of a different installed program', async () => {
    psSequence(null, [
      { path: 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\VS2022', isUninstallEntry: true, text: 'Visual Studio 2022' },
      { path: 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\VS2019', isUninstallEntry: true, text: 'Visual Studio 2019' }
    ]);
    const result = await scanForLeftovers({
      name: 'Visual Studio',
      installedPrograms: [{ id: 'VS2022', name: 'Visual Studio 2022', registryKey: 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\VS2022' }]
    });
    expect(result.registryKeys.items.map((i) => i.path.split('\\').pop())).toEqual(['VS2019']);
    expect(result.registryKeys.protected).toBe(1);
  });

  it('drops scheduled tasks Windows ships', async () => {
    psSequence(null, null, [
      { name: 'Acme', path: '\\Microsoft\\Windows\\Acme\\', how: 'name' },
      { name: 'Acme', path: '\\', how: 'name' }
    ]);
    const result = await scanForLeftovers({ name: 'Acme' });
    expect(result.scheduledTasks.items).toHaveLength(1);
    expect(result.scheduledTasks.protected).toBe(1);
  });
});
