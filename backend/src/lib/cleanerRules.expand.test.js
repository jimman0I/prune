import { describe, it, expect, afterEach } from 'vitest';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { expandPath } from './cleanerRules.js';

/** The path variables a rule may use. The first group is what the built-in
 * rules always used; the second is what BleachBit's own cleaners add, which
 * an imported cleaner needs resolved the way BleachBit resolves them. */

const saved = { ...process.env };
afterEach(() => { process.env = { ...saved }; });

describe('the variables built-in rules use', () => {
  it('expands APPDATA, LOCALAPPDATA and the Windows folders, in any case', () => {
    process.env.APPDATA = 'C:\\Users\\u\\AppData\\Roaming';
    process.env.LOCALAPPDATA = 'C:\\Users\\u\\AppData\\Local';
    expect(expandPath('%AppData%\\X')).toBe('C:\\Users\\u\\AppData\\Roaming\\X');
    expect(expandPath('%LOCALAPPDATA%\\X')).toBe('C:\\Users\\u\\AppData\\Local\\X');
  });

  it('expands ~ to the home folder', () => {
    expect(expandPath('~/Foo')).toBe(join(homedir(), 'Foo'));
  });
});

describe('the variables BleachBit cleaners use', () => {
  it('%UserProfile% is the profile folder', () => {
    process.env.USERPROFILE = 'C:\\Users\\u';
    expect(expandPath('%UserProfile%\\AppData\\Roaming\\Slack')).toBe('C:\\Users\\u\\AppData\\Roaming\\Slack');
    expect(expandPath('%USERPROFILE%\\x')).toBe('C:\\Users\\u\\x');
  });

  it('%Temp% is the temp folder', () => {
    process.env.TEMP = 'C:\\Users\\u\\AppData\\Local\\Temp';
    expect(expandPath('%Temp%\\*.tmp')).toBe('C:\\Users\\u\\AppData\\Local\\Temp\\*.tmp');
  });

  it('%CommonAppData% is ProgramData', () => {
    process.env.ProgramData = 'C:\\ProgramData';
    expect(expandPath('%CommonAppData%\\Vendor')).toBe('C:\\ProgramData\\Vendor');
  });

  it('%LocalAppDataLow% is the LocalLow folder beside Local', () => {
    process.env.LOCALAPPDATA = 'C:\\Users\\u\\AppData\\Local';
    expect(expandPath('%LocalAppDataLow%\\Sun')).toBe('C:\\Users\\u\\AppData\\LocalLow\\Sun');
  });

  it('%WindowsSystem% is System32', () => {
    process.env.SYSTEMROOT = 'C:\\Windows';
    expect(expandPath('%WindowsSystem%\\x.log')).toBe('C:\\Windows\\System32\\x.log');
  });

  it('%WinDir% and %ProgramFiles% still work', () => {
    process.env.WINDIR = 'C:\\Windows';
    process.env.ProgramFiles = 'C:\\Program Files';
    expect(expandPath('%WinDir%\\Temp')).toBe('C:\\Windows\\Temp');
    expect(expandPath('%ProgramFiles%\\Foo')).toBe('C:\\Program Files\\Foo');
  });

  it('a variable that is not set expands to nothing, so the path matches nothing rather than something else', () => {
    delete process.env.USERPROFILE;
    expect(expandPath('%USERPROFILE%\\x')).toBe('\\x');
  });
});
