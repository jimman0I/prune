import { describe, it, expect } from 'vitest';
import { SCAN_MODES, DEFAULT_SCAN_MODE, normalizeScanMode, advancedFileRoots } from './leftoverModes.js';

describe('normalizeScanMode', () => {
  it('knows exactly three modes, Moderate being the default', () => {
    expect(SCAN_MODES).toEqual(['safe', 'moderate', 'advanced']);
    expect(DEFAULT_SCAN_MODE).toBe('moderate');
  });

  it('keeps a valid mode and maps anything else to Moderate', () => {
    for (const mode of SCAN_MODES) expect(normalizeScanMode(mode)).toBe(mode);
    for (const bad of [undefined, null, '', 'ADVANCED', 'deep', 3, {}]) {
      expect(normalizeScanMode(bad)).toBe('moderate');
    }
  });
});

describe('advancedFileRoots', () => {
  const env = {
    ProgramFiles: 'C:\\Program Files',
    'ProgramFiles(x86)': 'C:\\Program Files (x86)',
    ProgramData: 'C:\\ProgramData',
    APPDATA: 'C:\\Users\\me\\AppData\\Roaming',
    LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local',
    USERPROFILE: 'C:\\Users\\me',
    TEMP: 'C:\\Users\\me\\AppData\\Local\\Temp',
    PUBLIC: 'C:\\Users\\Public'
  };

  it('covers the places an uninstaller commonly leaves things in', () => {
    const paths = advancedFileRoots(env).map((r) => r.path.toLowerCase());
    for (const expected of [
      'c:\\program files',
      'c:\\program files (x86)',
      'c:\\programdata',
      'c:\\users\\me\\appdata\\roaming',
      'c:\\users\\me\\appdata\\local',
      'c:\\users\\me\\appdata\\local\\programs',
      'c:\\users\\me\\appdata\\locallow',
      'c:\\users\\me\\appdata\\local\\temp',
      'c:\\program files\\common files',
      'c:\\program files (x86)\\common files',
      'c:\\users\\me\\appdata\\roaming\\microsoft\\windows\\start menu\\programs',
      'c:\\programdata\\microsoft\\windows\\start menu\\programs',
      'c:\\users\\me\\desktop',
      'c:\\users\\public\\desktop'
    ]) {
      expect(paths, expected).toContain(expected);
    }
  });

  it('keeps Temp shallow: it holds everything and an uninstall rarely goes deep in it', () => {
    const temp = advancedFileRoots(env).find((r) => r.path === env.TEMP);
    expect(temp.depth).toBe(1);
  });

  it('only matches shortcuts inside the shortcut roots', () => {
    const roots = advancedFileRoots(env);
    const startMenu = roots.find((r) => /start menu/i.test(r.path));
    const roaming = roots.find((r) => r.path === env.APPDATA);
    expect(startMenu.shortcuts).toBe(true);
    expect(roaming.shortcuts).toBeFalsy();
  });

  it('skips a root whose environment variable is not set rather than emitting "undefined"', () => {
    const roots = advancedFileRoots({ ProgramFiles: 'C:\\Program Files' });
    expect(roots.every((r) => !r.path.includes('undefined'))).toBe(true);
    expect(roots.length).toBeGreaterThan(0);
  });
});
