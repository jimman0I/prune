import { describe, it, expect } from 'vitest';
import {
  osComponentRefusal, footprintsOf, buildFootprints, footprintRefusal, anchorRootFromCommand
} from './leftoverProtection.js';

/** Regression tests for the protections, not for the matching.
 *
 * Every one of these is a path that a plausible scan COULD name -- through a
 * publisher called "Microsoft", a program whose name is a common word, or a
 * vendor folder shared by several products -- and that must never reach the
 * review as something to remove. A change that breaks one of these is a
 * change that can delete a working program or part of Windows. */

describe('osComponentRefusal: Windows and Microsoft components', () => {
  it.each([
    ['C:\\Windows'],
    ['C:\\Windows\\System32\\drivers'],
    ['C:\\Windows\\Temp\\whatever'],
    ['C:\\Program Files\\Windows Defender'],
    ['C:\\Program Files\\Windows NT\\Accessories'],
    ['C:\\Program Files (x86)\\Windows Mail'],
    ['C:\\Program Files\\WindowsApps\\Microsoft.Paint_1.0_x64'],
    ['C:\\Program Files\\WindowsPowerShell\\Modules'],
    ['C:\\Program Files\\Common Files\\Microsoft Shared\\ink'],
    ['C:\\Program Files\\Reference Assemblies\\Microsoft\\Framework'],
    ['C:\\Program Files\\dotnet\\shared'],
    ['C:\\ProgramData\\Microsoft'],
    ['C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs'],
    ['C:\\ProgramData\\Microsoft\\Crypto\\RSA'],
    ['C:\\Users\\me\\AppData\\Local\\Microsoft'],
    ['C:\\Users\\me\\AppData\\Roaming\\Microsoft'],
    ['C:\\Users\\me\\AppData\\Roaming\\Microsoft\\Windows\\Recent'],
    ['C:\\Users\\me\\AppData\\Roaming\\Microsoft\\Protect'],
    ['C:\\Users\\me\\AppData\\Local\\Microsoft\\Windows\\INetCache'],
    ['C:\\Users\\me\\AppData\\Local\\Microsoft\\WindowsApps']
  ])('refuses %s', (path) => {
    expect(osComponentRefusal(path)).toBeTruthy();
  });

  it.each([
    ['C:\\Program Files\\Microsoft Office'],
    ['C:\\Program Files\\Microsoft SQL Server'],
    ['C:\\Program Files\\Windows Kits\\10'],
    ['C:\\Users\\me\\AppData\\Local\\Microsoft\\VisualStudio\\17.0'],
    ['C:\\Users\\me\\AppData\\Local\\Programs\\Microsoft VS Code'],
    ['D:\\Games\\Acme'],
    // A vendor's own folder inside Common Files is a normal leftover; it is
    // Common Files itself that is shared, and permanentDeletionRefusal holds that.
    ['C:\\Program Files\\Common Files\\Acme'],
    ['C:\\ProgramData\\Acme'],
    ['C:\\Users\\me\\AppData\\Roaming\\Acme']
  ])('allows %s', (path) => {
    expect(osComponentRefusal(path)).toBeNull();
  });

  it('is not fooled by case, slashes or a trailing separator', () => {
    expect(osComponentRefusal('c:/program files/WINDOWS DEFENDER/')).toBeTruthy();
    expect(osComponentRefusal('C:\\PROGRAMDATA\\MICROSOFT')).toBeTruthy();
  });

  it('refuses anything that is not a plain absolute path', () => {
    for (const bad of [undefined, null, '', 'relative\\path', '..\\x']) expect(osComponentRefusal(bad), String(bad)).toBeTruthy();
  });
});

const ENV = {
  SystemRoot: 'C:\\Windows', ProgramFiles: 'C:\\Program Files', 'ProgramFiles(x86)': 'C:\\Program Files (x86)',
  ProgramData: 'C:\\ProgramData', LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local', APPDATA: 'C:\\Users\\me\\AppData\\Roaming'
};
const root = (command) => anchorRootFromCommand(command, { env: ENV });

describe('anchorRootFromCommand: where a program says its files are', () => {
  it('reads the executable out of a quoted uninstall command with arguments', () => {
    expect(root('"C:\\Program Files\\Acme\\uninst.exe" /S')).toBe('C:\\Program Files\\Acme');
  });

  it('reads an unquoted one', () => {
    expect(root('C:\\Program Files\\Acme\\uninstall.exe')).toBe('C:\\Program Files\\Acme');
  });

  it('reads a DisplayIcon with its resource index', () => {
    expect(root('C:\\Program Files (x86)\\Acme\\bin\\acme.exe,0')).toBe('C:\\Program Files (x86)\\Acme');
    expect(root('"D:\\Apps\\Acme\\acme.ico"')).toBe('D:\\Apps\\Acme');
  });

  it('reduces a path below a programs root to the program\'s own folder', () => {
    expect(root('C:\\Users\\me\\AppData\\Local\\Discord\\Update.exe --uninstall'))
      .toBe('C:\\Users\\me\\AppData\\Local\\Discord');
    expect(root('C:\\Users\\me\\AppData\\Local\\Programs\\Thing\\bin\\x.exe'))
      .toBe('C:\\Users\\me\\AppData\\Local\\Programs\\Thing');
  });

  it('gives nothing for a command with no path of its own', () => {
    for (const command of ['MsiExec.exe /X{GUID}', 'rundll32.exe setupapi.dll,InstallHinfSection', '', null, undefined]) {
      expect(root(command), String(command)).toBeNull();
    }
  });

  it('gives nothing when the command lives in a place no program owns', () => {
    // Anchoring on these would offer the operating system, or every
    // program's installer cache, as one program's folder.
    for (const command of [
      'C:\\Windows\\System32\\msiexec.exe /x {GUID}',
      'C:\\Windows\\uninst.exe',
      '"C:\\ProgramData\\Package Cache\\{abc}\\setup.exe" /uninstall',
      'C:\\Users\\me\\AppData\\Local\\Temp\\setup.exe',
      'C:\\setup.exe'
    ]) {
      expect(root(command), command).toBeNull();
    }
  });
});

describe('other installed programs are never offered', () => {
  const programs = [
    { id: 'a', name: 'Alpha', registryKey: 'HKLM:\\SOFTWARE\\Alpha', installLocation: 'C:\\Program Files\\Vendor\\Alpha' },
    { id: 'b', name: 'Beta', registryKey: 'HKLM:\\SOFTWARE\\Beta', installLocation: 'D:\\Games\\Beta', uninstallString: '"D:\\Games\\Beta\\unins000.exe"' },
    { id: 'c', name: 'Gamma', displayIcon: 'C:\\Program Files\\Gamma\\gamma.exe,0' },
    { id: 'd', name: 'No Info' }
  ];

  it('derives every program\'s folders from what it registered', () => {
    expect(footprintsOf(programs[0], { env: ENV })).toEqual(['C:\\Program Files\\Vendor\\Alpha']);
    expect(footprintsOf(programs[1], { env: ENV })).toEqual(['D:\\Games\\Beta']);
    expect(footprintsOf(programs[2], { env: ENV })).toEqual(['C:\\Program Files\\Gamma']);
    expect(footprintsOf(programs[3], { env: ENV })).toEqual([]);
  });

  it('leaves the program being uninstalled out, by id or by registry key', () => {
    expect(buildFootprints(programs, { selfId: 'a' }).map((f) => f.program)).toEqual(['Beta', 'Gamma']);
    expect(buildFootprints(programs, { selfRegistryKey: 'hkey_local_machine\\software\\beta' }).map((f) => f.program)).toEqual(['Alpha', 'Gamma']);
  });

  const footprints = buildFootprints(programs, {});

  it('refuses another program\'s folder', () => {
    expect(footprintRefusal('D:\\Games\\Beta', footprints)).toMatch(/Beta/);
  });

  it('refuses a folder that CONTAINS another program, which a publisher match would offer', () => {
    // "C:\Program Files\Vendor" is what matching the publisher "Vendor"
    // finds, and deleting it takes Alpha with it.
    expect(footprintRefusal('C:\\Program Files\\Vendor', footprints)).toMatch(/Alpha/);
    expect(footprintRefusal('D:\\Games', footprints)).toMatch(/Beta/);
  });

  it('refuses something inside another program\'s folder unless it is certain', () => {
    expect(footprintRefusal('D:\\Games\\Beta\\saves', footprints)).toMatch(/Beta/);
    expect(footprintRefusal('D:\\Games\\Beta\\saves', footprints, { certain: true })).toBeNull();
  });

  it('never lets "certain" excuse a folder that contains or is another program', () => {
    expect(footprintRefusal('D:\\Games\\Beta', footprints, { certain: true })).toMatch(/Beta/);
    expect(footprintRefusal('D:\\Games', footprints, { certain: true })).toMatch(/Beta/);
  });

  it('allows an unrelated folder, and a sibling that only shares a prefix', () => {
    expect(footprintRefusal('D:\\Games\\Betamax', footprints)).toBeNull();
    expect(footprintRefusal('E:\\Anything', footprints)).toBeNull();
  });
});
