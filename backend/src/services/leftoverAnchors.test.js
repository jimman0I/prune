import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { anchorDirectories, virtualStoreMirrors } from './leftoverAnchors.js';

describe('anchorDirectories (the program\'s own InstallLocation)', () => {
  it('returns the install location as the one authoritative folder', () => {
    expect(anchorDirectories({ installLocation: 'D:\\Games\\Acme' })).toEqual(['D:\\Games\\Acme']);
  });

  it('drops a trailing separator and quotes, which registry values often carry', () => {
    expect(anchorDirectories({ installLocation: '"D:\\Games\\Acme\\"' })).toEqual(['D:\\Games\\Acme']);
  });

  it('ignores a missing, blank or relative location', () => {
    for (const installLocation of [undefined, null, '', '   ', 'Acme', '.\\Acme', '..\\Acme']) {
      expect(anchorDirectories({ installLocation }), String(installLocation)).toEqual([]);
    }
  });

  it('refuses a location that is Windows, a whole drive, or the folder holding every program', () => {
    // A hand-edited or malicious registry value (or a request body) naming
    // somewhere that must never be offered for removal.
    for (const installLocation of [
      'C:\\Windows',
      'C:\\Windows\\System32',
      'C:\\',
      'C:\\Program Files',
      'C:\\Program Files (x86)',
      'C:\\ProgramData',
      'C:\\Users'
    ]) {
      expect(anchorDirectories({ installLocation }), installLocation).toEqual([]);
    }
  });

  it('also anchors on the folders of the program\'s icon and uninstaller, deduplicated', () => {
    // Most installers register no InstallLocation, but every one registers an
    // uninstaller -- and that sits in the program's own folder.
    const dirs = anchorDirectories({
      installLocation: null,
      displayIcon: '"D:\\Apps\\Acme\\acme.exe",0',
      uninstallString: '"D:\\Apps\\Acme\\unins000.exe" /SILENT'
    });
    expect(dirs).toEqual(['D:\\Apps\\Acme']);
  });

  it('adds a different folder when the icon lives somewhere else', () => {
    const dirs = anchorDirectories({ installLocation: 'D:\\Apps\\Acme', displayIcon: 'D:\\Apps\\AcmeTools\\icon.ico' });
    expect(dirs).toEqual(['D:\\Apps\\Acme', 'D:\\Apps\\AcmeTools']);
  });

  it('gets nothing from a command that has no path, or that lives in Windows', () => {
    expect(anchorDirectories({ uninstallString: 'MsiExec.exe /X{GUID}' })).toEqual([]);
    expect(anchorDirectories({ uninstallString: 'C:\\Windows\\System32\\msiexec.exe /x {GUID}' })).toEqual([]);
  });

  it('refuses a Windows or Microsoft component named as the location', () => {
    for (const installLocation of ['C:\\Program Files\\Windows Defender', 'C:\\ProgramData\\Microsoft', 'C:\\Program Files\\WindowsApps\\X']) {
      expect(anchorDirectories({ installLocation }), installLocation).toEqual([]);
    }
  });

  it('copes with no anchors at all', () => {
    expect(anchorDirectories(undefined)).toEqual([]);
    expect(anchorDirectories({})).toEqual([]);
  });
});

describe('anchorDirectories against the disk', () => {
  it('can keep only the folders that still exist', () => {
    const base = mkdtempSync(join(tmpdir(), 'prune-anchor-'));
    try {
      const present = join(base, 'Present');
      mkdirSync(present);
      const result = anchorDirectories(
        { installLocation: present },
        { existing: true }
      );
      expect(result).toEqual([present]);
      expect(anchorDirectories({ installLocation: join(base, 'Gone') }, { existing: true })).toEqual([]);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});

// UAC file virtualization: an unelevated program that writes into its own
// folder under Program Files has the write redirected to a per-user mirror
// under LocalAppData\VirtualStore. The uninstaller never knows it exists.
describe('virtualStoreMirrors', () => {
  const env = {
    SystemDrive: 'C:',
    ProgramFiles: 'C:\\Program Files',
    'ProgramFiles(x86)': 'C:\\Program Files (x86)',
    ProgramData: 'C:\\ProgramData',
    LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local'
  };

  it('mirrors a folder under Program Files, Program Files (x86) or ProgramData', () => {
    expect(virtualStoreMirrors(['C:\\Program Files (x86)\\Acme', 'C:\\Program Files\\Zed\\bin', 'C:\\ProgramData\\Acme'], env)).toEqual([
      'C:\\Users\\me\\AppData\\Local\\VirtualStore\\Program Files (x86)\\Acme',
      'C:\\Users\\me\\AppData\\Local\\VirtualStore\\Program Files\\Zed\\bin',
      'C:\\Users\\me\\AppData\\Local\\VirtualStore\\ProgramData\\Acme'
    ]);
  });

  it('ignores folders Windows never virtualizes: user folders and other drives', () => {
    expect(virtualStoreMirrors(['C:\\Users\\me\\AppData\\Local\\Programs\\Acme', 'D:\\Program Files\\Acme', 'C:\\Games\\Acme'], env)).toEqual([]);
  });

  it('never mirrors a root itself, which would be the whole VirtualStore folder', () => {
    expect(virtualStoreMirrors(['C:\\Program Files', 'C:\\ProgramData\\'], env)).toEqual([]);
  });

  it('returns nothing without LocalAppData', () => {
    expect(virtualStoreMirrors(['C:\\Program Files\\Acme'], { ...env, LOCALAPPDATA: undefined })).toEqual([]);
  });
});
