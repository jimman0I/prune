import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { anchorDirectories } from './leftoverAnchors.js';

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
