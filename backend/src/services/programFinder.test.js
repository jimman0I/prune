import { describe, it, expect, vi } from 'vitest';
import {
  validateProgramFilePath, resolveShortcutTarget, findProgramForFile
} from './programFinder.js';

/** "Find in Prune (uninstall)" and dropping a program onto the Applications
 * screen both end here: a path to a program (.exe) or a shortcut (.lnk) goes in,
 * and out comes the installed program it belongs to, using the same folder
 * matching as Hunter. It only ever LOOKS: nothing is changed, and a shortcut is
 * read for its target with a short fixed script that is handed the path through
 * the environment, never spliced into the script's text. */

const ENV = { SystemRoot: 'C:\\Windows' };
const file = { isFile: () => true };
const dir = { isFile: () => false };
const statOk = vi.fn(async () => file);
const programs = [
  { id: 'acme', name: 'Acme Studio', installLocation: 'C:\\Program Files\\Acme' },
  { id: 'acme-tools', name: 'Acme Tools', installLocation: 'C:\\Program Files\\Acme\\Tools' }
];
const context = { programs, storeApps: [], env: ENV };
const find = (path, over = {}) => findProgramForFile(path, { stat: statOk, loadContext: async () => context, env: ENV, ...over });

describe('validateProgramFilePath', () => {
  it('accepts a program or a shortcut on a drive, in any case', () => {
    for (const ok of ['C:\\Program Files\\Acme\\acme.exe', 'D:\\Games\\Foo.EXE', 'C:\\Users\\me\\Desktop\\Acme.lnk', 'c:\\x\\y.LNK']) {
      expect(validateProgramFilePath(ok), ok).toBeNull();
    }
  });

  it('refuses anything else: other files, relative and network paths, odd characters, huge paths', () => {
    for (const bad of [
      'C:\\a\\notes.txt', 'C:\\a\\setup.msi', 'C:\\a\\run.bat', 'C:\\a\\x.exe.txt', 'C:\\a\\folder', 'acme.exe', '.\\acme.exe', '..\\acme.exe',
      '\\\\server\\share\\a.exe', 'C:\\a\\..\\b\\a.exe', 'C:\\a\\<b>.exe', 'C:\\a\\b\n.exe', 'C:\\a\\b\u0000.exe', 'C:\\a?.exe', 'C:\\a*.exe',
      `C:\\${'x'.repeat(5000)}.exe`, '', null, undefined, 42, {}
    ]) {
      expect(validateProgramFilePath(bad), String(bad).slice(0, 30)).toEqual(expect.any(String));
    }
  });
});

describe('resolveShortcutTarget', () => {
  it('asks a short fixed script, and hands it the path through the environment', async () => {
    const run = vi.fn(async () => 'C:\\Program Files\\Acme\\acme.exe\r\n');
    const target = await resolveShortcutTarget("C:\\Users\\O'Brien\\Desktop\\Acme $(calc).lnk", { run });
    expect(target).toBe('C:\\Program Files\\Acme\\acme.exe');
    const [script, env] = run.mock.calls[0];
    expect(env.PRUNE_LNK).toBe("C:\\Users\\O'Brien\\Desktop\\Acme $(calc).lnk");
    expect(script).not.toContain('Acme');
    expect(script).not.toContain('calc');
    expect(script).toContain('$env:PRUNE_LNK');
    expect(script).toContain('CreateShortcut');
  });

  it('is null when the shortcut has no target, or the script could not run', async () => {
    expect(await resolveShortcutTarget('C:\\a.lnk', { run: async () => '  \r\n' })).toBeNull();
    expect(await resolveShortcutTarget('C:\\a.lnk', { run: async () => { throw new Error('boom'); } })).toBeNull();
  });

  it('runs powershell.exe with an argv array and no shell (the default runner)', async () => {
    const exec = vi.fn((file, args, options, cb) => cb(null, 'C:\\x\\y.exe'));
    const target = await resolveShortcutTarget('C:\\a.lnk', { exec });
    expect(target).toBe('C:\\x\\y.exe');
    const [file, args, options] = exec.mock.calls[0];
    expect(file).toBe('powershell.exe');
    expect(args.slice(0, 3)).toEqual(['-NoProfile', '-NonInteractive', '-Command']);
    expect(options.shell).toBeUndefined();
    expect(options.windowsHide).toBe(true);
    expect(options.env.PRUNE_LNK).toBe('C:\\a.lnk');
  });
});

describe('findProgramForFile: a program', () => {
  it('matches the installed program whose folder holds it', async () => {
    const result = await find('C:\\Program Files\\Acme\\acme.exe');
    expect(result).toMatchObject({ status: 'matched', via: 'program', exePath: 'C:\\Program Files\\Acme\\acme.exe', program: { id: 'acme' } });
  });

  it('the deepest matching folder wins, as in Hunter', async () => {
    const result = await find('C:\\Program Files\\Acme\\Tools\\t.exe');
    expect(result.program.id).toBe('acme-tools');
  });

  it('is unmatched when nothing installed owns it, and says its name and folder for Forced uninstall', async () => {
    const result = await find('D:\\Portable\\Cool App\\coolapp.exe');
    expect(result).toEqual({ status: 'unmatched', via: 'program', exePath: 'D:\\Portable\\Cool App\\coolapp.exe', name: 'coolapp', folder: 'D:\\Portable\\Cool App' });
  });

  it('is windows, and offers nothing, for a file in Windows itself', async () => {
    expect(await find('C:\\Windows\\System32\\notepad.exe')).toMatchObject({ status: 'windows', via: 'program' });
    expect(await find('c:\\windows\\explorer.exe')).toMatchObject({ status: 'windows' });
  });

  it('is windows for a Windows component outside the Windows folder, when no program owns it', async () => {
    expect(await find('C:\\Program Files\\WindowsApps\\Foo\\foo.exe')).toMatchObject({ status: 'windows' });
  });

  it('is unresolved when the file is not there or is a folder', async () => {
    expect(await find('C:\\gone\\a.exe', { stat: async () => { throw Object.assign(new Error('nope'), { code: 'ENOENT' }); } })).toEqual({ status: 'unresolved', reason: 'missing' });
    expect(await find('C:\\a\\b.exe', { stat: async () => dir })).toEqual({ status: 'unresolved', reason: 'missing' });
  });

  it('never reads the lists for a path it refuses', async () => {
    const loadContext = vi.fn();
    await expect(find('C:\\a\\notes.txt', { loadContext })).rejects.toMatchObject({ invalid: true });
    expect(loadContext).not.toHaveBeenCalled();
  });
});

describe('findProgramForFile: a shortcut', () => {
  const lnk = 'C:\\Users\\me\\Desktop\\Acme.lnk';

  it('follows the shortcut to its target and matches that', async () => {
    const resolveShortcut = vi.fn(async () => 'C:\\Program Files\\Acme\\acme.exe');
    const result = await find(lnk, { resolveShortcut });
    expect(resolveShortcut).toHaveBeenCalledWith(lnk);
    expect(result).toMatchObject({ status: 'matched', via: 'shortcut', shortcutPath: lnk, exePath: 'C:\\Program Files\\Acme\\acme.exe', program: { id: 'acme' } });
  });

  it('an unmatched target is unmatched, whether or not the target still exists', async () => {
    const result = await find(lnk, { resolveShortcut: async () => 'D:\\Gone\\old.exe', stat: async (p) => { if (p.endsWith('old.exe')) throw new Error('ENOENT'); return file; } });
    expect(result).toMatchObject({ status: 'unmatched', via: 'shortcut', name: 'old', folder: 'D:\\Gone' });
  });

  it('is unresolved, with a reason, when the shortcut points at nothing or at something that is not a program', async () => {
    expect(await find(lnk, { resolveShortcut: async () => null })).toEqual({ status: 'unresolved', reason: 'noTarget' });
    expect(await find(lnk, { resolveShortcut: async () => 'C:\\Users\\me\\Documents' })).toEqual({ status: 'unresolved', reason: 'notProgram' });
    expect(await find(lnk, { resolveShortcut: async () => 'C:\\a\\doc.pdf' })).toEqual({ status: 'unresolved', reason: 'notProgram' });
    expect(await find(lnk, { resolveShortcut: async () => '%ProgramFiles%\\a.exe' })).toEqual({ status: 'unresolved', reason: 'notProgram' });
    expect(await find(lnk, { resolveShortcut: async () => '\\\\server\\share\\a.exe' })).toEqual({ status: 'unresolved', reason: 'notProgram' });
  });

  it('is windows for a shortcut to a Windows program', async () => {
    expect(await find(lnk, { resolveShortcut: async () => 'C:\\Windows\\System32\\calc.exe' })).toMatchObject({ status: 'windows', via: 'shortcut' });
  });

  it('does not read a shortcut that is not there', async () => {
    const resolveShortcut = vi.fn();
    const result = await find(lnk, { resolveShortcut, stat: async () => { throw new Error('ENOENT'); } });
    expect(result).toEqual({ status: 'unresolved', reason: 'missing' });
    expect(resolveShortcut).not.toHaveBeenCalled();
  });
});
