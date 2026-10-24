import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolvePropertiesTarget, showFileProperties, mainExecutableFor } from './fileProperties.js';

/** Windows' Properties sheet for a file. The spawn is faked throughout: a
 * test that opened a real sheet would leave a window on whoever runs the
 * suite. The real host was checked by hand (see the module's comment). */

let dir;
let exe;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'prune-props-'));
  exe = join(dir, 'Tool.exe');
  writeFileSync(exe, 'MZ');
  mkdirSync(join(dir, 'sub'));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** A stand-in host: records how it was started, and lets the test say what
 * it printed and when it exited. */
function fakeHost() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stdout.destroy = vi.fn();
  child.unref = vi.fn();
  child.kill = vi.fn();
  const spawnImpl = vi.fn(() => child);
  return { child, spawnImpl };
}

describe('resolvePropertiesTarget', () => {
  it('accepts the full path of a file that exists, normalised', () => {
    expect(resolvePropertiesTarget(`  ${exe}  `)).toEqual({ ok: true, path: exe });
    expect(resolvePropertiesTarget(exe.replaceAll('\\', '/')).path).toBe(exe);
  });

  it('refuses anything that is not a full path', () => {
    for (const bad of ['notepad.exe', 'Tool.exe', '.\\Tool.exe', '\\Windows\\notepad.exe', '', '   ', null, 42, {}]) {
      expect(resolvePropertiesTarget(bad).ok).toBe(false);
    }
  });

  it('refuses command text, quotes, control characters and device paths outright', () => {
    for (const bad of [`"${exe}"`, `${exe}\n& calc.exe`, `${exe}\u0000`, '\\\\.\\PhysicalDrive0', '\\\\?\\C:\\Windows\\notepad.exe']) {
      expect(resolvePropertiesTarget(bad).ok).toBe(false);
    }
  });

  it('refuses a missing file and a folder', () => {
    expect(resolvePropertiesTarget(join(dir, 'gone.exe'))).toEqual({ ok: false, error: 'That file is no longer on disk.' });
    expect(resolvePropertiesTarget(join(dir, 'sub'))).toEqual({ ok: false, error: 'That is a folder, not a file.' });
  });
});

describe('showFileProperties', () => {
  it('never starts anything for a path it refuses', async () => {
    const { spawnImpl } = fakeHost();
    expect((await showFileProperties('calc.exe', { spawnImpl })).ok).toBe(false);
    expect(spawnImpl).not.toHaveBeenCalled();
  });

  it('starts a hidden Windows PowerShell host with the path in its environment, never in the script', async () => {
    const { child, spawnImpl } = fakeHost();
    const pending = showFileProperties(exe, { spawnImpl });
    const [file, args, options] = spawnImpl.mock.calls[0];
    expect(file).toBe('powershell.exe');
    expect(args.slice(0, 3)).toEqual(['-NoProfile', '-NonInteractive', '-Command']);
    expect(args[3]).not.toContain(exe);
    expect(args[3]).toContain("InvokeVerb('properties')");
    expect(options.windowsHide).toBe(true);
    expect(options.env.PRUNE_PROPERTIES_PATH).toBe(exe);
    expect(Object.keys(options.env).some((k) => k.toLowerCase() === 'psmodulepath')).toBe(false);
    child.stdout.emit('data', 'SHOWN\r\n');
    await pending;
  });

  it('answers once the sheet is up, and leaves the host running to keep it open', async () => {
    const { child, spawnImpl } = fakeHost();
    const pending = showFileProperties(exe, { spawnImpl });
    child.stdout.emit('data', 'SHO');
    child.stdout.emit('data', 'WN\r\n');
    expect(await pending).toEqual({ ok: true, path: exe });
    expect(child.kill).not.toHaveBeenCalled();
    expect(child.unref).toHaveBeenCalled();
    // The person closing the sheet later ends the host; that is not news.
    child.emit('exit', 0);
  });

  it('says why when the host could not show it', async () => {
    const { child, spawnImpl } = fakeHost();
    const pending = showFileProperties(exe, { spawnImpl });
    child.stdout.emit('data', 'FAILED nowindow\r\n');
    const result = await pending;
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/did not open \(nowindow\)/);
  });

  it('fails, rather than hanging, when the host exits without a sheet', async () => {
    const { child, spawnImpl } = fakeHost();
    const pending = showFileProperties(exe, { spawnImpl });
    child.emit('exit', 1);
    expect((await pending).ok).toBe(false);
  });

  it('ends a host that never shows a sheet in time', async () => {
    const { child, spawnImpl } = fakeHost();
    const result = await showFileProperties(exe, { spawnImpl, timeoutMs: 20 });
    expect(result).toEqual({ ok: false, error: 'The Properties window did not open.' });
    expect(child.kill).toHaveBeenCalled();
  });

  it('reports a spawn failure instead of throwing', async () => {
    const spawnImpl = () => { throw new Error('spawn powershell.exe ENOENT'); };
    expect(await showFileProperties(exe, { spawnImpl })).toEqual({ ok: false, error: 'spawn powershell.exe ENOENT' });
  });
});

describe('mainExecutableFor', () => {
  it('prefers the vendor\'s own DisplayIcon executable', async () => {
    const findExecutable = vi.fn();
    expect(await mainExecutableFor({ displayIcon: `${exe},0`, installLocation: dir, name: 'Tool' }, { findExecutable })).toBe(exe);
    expect(findExecutable).not.toHaveBeenCalled();
  });

  it('skips a DisplayIcon that is an uninstaller, a Windows tool or missing, and looks in the folder', async () => {
    const findExecutable = vi.fn(async () => exe);
    for (const displayIcon of [join(dir, 'unins000.exe'), join(dir, 'Setup.exe'), 'C:\\Windows\\System32\\msiexec.exe', join(dir, 'gone.exe'), join(dir, 'app.ico')]) {
      expect(await mainExecutableFor({ displayIcon, installLocation: dir, name: 'Tool' }, { findExecutable })).toBe(exe);
    }
    expect(findExecutable).toHaveBeenCalledWith(dir, 'Tool');
  });

  it('is null when nothing names a file', async () => {
    expect(await mainExecutableFor({ name: 'Nothing' }, { findExecutable: vi.fn() })).toBeNull();
    expect(await mainExecutableFor({ installLocation: dir, name: 'X' }, { findExecutable: async () => null })).toBeNull();
    expect(await mainExecutableFor(null)).toBeNull();
  });
});
