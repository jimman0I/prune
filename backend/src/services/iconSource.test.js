import { describe, it, expect } from 'vitest';
import { parseIconSource, iconSourceForProgram } from './iconSource.js';

describe('parseIconSource', () => {
  it('reads a bare executable path', () => {
    expect(parseIconSource('C:\\Program Files\\7-Zip\\7zFM.exe'))
      .toEqual({ path: 'C:\\Program Files\\7-Zip\\7zFM.exe', index: 0 });
  });

  it('reads a trailing icon index', () => {
    expect(parseIconSource('C:\\Program Files\\PawnIO\\uninstall.exe,0'))
      .toEqual({ path: 'C:\\Program Files\\PawnIO\\uninstall.exe', index: 0 });
    expect(parseIconSource('C:\\Windows\\system32\\shell32.dll,15').index).toBe(15);
  });

  it('reads a negative index, which addresses an icon by resource id', () => {
    expect(parseIconSource('C:\\app\\thing.exe,-101').index).toBe(-101);
  });

  it('strips surrounding quotes', () => {
    expect(parseIconSource('"C:\\Program Files\\Netease\\MuMuPlayer\\MuMuNxMain.ico"').path)
      .toBe('C:\\Program Files\\Netease\\MuMuPlayer\\MuMuNxMain.ico');
  });

  it('handles a quoted path with a trailing index outside the quotes', () => {
    const result = parseIconSource('"C:\\Program Files\\App\\app.exe",2');
    expect(result.path).toBe('C:\\Program Files\\App\\app.exe');
    expect(result.index).toBe(2);
  });

  it('accepts an 8.3 short path unchanged', () => {
    expect(parseIconSource('C:\\PROGRA~1\\DIFX\\D29\\DPInst_x64.exe,0').path)
      .toBe('C:\\PROGRA~1\\DIFX\\D29\\DPInst_x64.exe');
  });

  // A comma is legal in a Windows path ("C:\Program Files\Foo, Inc\app.exe"),
  // so only a comma followed by digits at the very END is an index --
  // splitting on the first comma would truncate the path instead.
  it('keeps a comma that is part of the path', () => {
    expect(parseIconSource('C:\\Program Files\\Foo, Inc\\app.exe').path)
      .toBe('C:\\Program Files\\Foo, Inc\\app.exe');
    const withIndex = parseIconSource('C:\\Program Files\\Foo, Inc\\app.exe,3');
    expect(withIndex.path).toBe('C:\\Program Files\\Foo, Inc\\app.exe');
    expect(withIndex.index).toBe(3);
  });

  it('returns null for missing or empty input', () => {
    expect(parseIconSource(null)).toBeNull();
    expect(parseIconSource('')).toBeNull();
    expect(parseIconSource('   ')).toBeNull();
    expect(parseIconSource(',0')).toBeNull();
  });
});

describe('iconSourceForProgram', () => {
  it('prefers the registry DisplayIcon', () => {
    expect(iconSourceForProgram({
      displayIcon: 'C:\\Program Files\\App\\app.exe,1',
      installLocation: 'C:\\Program Files\\App',
      uninstallString: '"C:\\Program Files\\App\\uninstall.exe"'
    })).toEqual({ path: 'C:\\Program Files\\App\\app.exe', index: 1 });
  });

  // 36 of the 129 programs on this machine register no DisplayIcon at all.
  // Their uninstaller is still a real executable with an icon in it, and a
  // roughly-right icon beats a coloured letter.
  it('falls back to the uninstaller executable', () => {
    expect(iconSourceForProgram({
      uninstallString: '"C:\\Program Files\\App\\uninstall.exe" /S'
    })).toEqual({ path: 'C:\\Program Files\\App\\uninstall.exe', index: 0 });
  });

  it('does not fall back to msiexec, which would give every MSI program the same icon', () => {
    expect(iconSourceForProgram({ uninstallString: 'MsiExec.exe /X{GUID}' })).toBeNull();
  });

  it('does not fall back to a PATH-resolved command', () => {
    expect(iconSourceForProgram({ uninstallString: 'winget uninstall' })).toBeNull();
  });

  it('returns null when there is nothing to extract from', () => {
    expect(iconSourceForProgram({})).toBeNull();
    expect(iconSourceForProgram({ displayIcon: '', uninstallString: null })).toBeNull();
  });
});
