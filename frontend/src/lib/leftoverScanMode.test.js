import { describe, it, expect } from 'vitest';
import { SCAN_MODES, scanModeFrom, anchorsFor } from './leftoverScanMode.js';

describe('scanModeFrom', () => {
  it('knows the three modes, in order of depth', () => {
    expect(SCAN_MODES).toEqual(['safe', 'moderate', 'advanced']);
  });

  it('reads the remembered mode', () => {
    expect(scanModeFrom({ leftoverScanMode: 'advanced' })).toBe('advanced');
    expect(scanModeFrom({ leftoverScanMode: 'safe' })).toBe('safe');
  });

  it('is Moderate when settings are missing or hold something else', () => {
    for (const settings of [null, undefined, {}, { leftoverScanMode: 'turbo' }, { leftoverScanMode: 3 }]) {
      expect(scanModeFrom(settings)).toBe('moderate');
    }
  });
});

describe('anchorsFor', () => {
  it('carries the install location and the program\'s own registry key', () => {
    expect(anchorsFor({ installLocation: 'D:\\Games\\Acme', registryKey: 'HKCU:\\Software\\Acme', name: 'Acme' }))
      .toEqual({ installLocation: 'D:\\Games\\Acme', registryKey: 'HKCU:\\Software\\Acme' });
  });

  it('adds the icon and uninstall command, whose folders are the program\'s when no location was recorded', () => {
    expect(anchorsFor({ displayIcon: 'D:\\A\\a.exe,0', uninstallString: '"D:\\A\\u.exe" /S' }))
      .toEqual({ displayIcon: 'D:\\A\\a.exe,0', uninstallString: '"D:\\A\\u.exe" /S' });
  });

  it('leaves out what the program does not have', () => {
    expect(anchorsFor({ name: 'Acme', installLocation: null, registryKey: '' })).toEqual({});
    expect(anchorsFor(undefined)).toEqual({});
  });
});
