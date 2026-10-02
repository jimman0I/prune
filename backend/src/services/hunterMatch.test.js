import { describe, it, expect } from 'vitest';
import { matchHunted, endProcessRefusal, parseHunterOutput } from './hunterMatch.js';

const ENV = { SystemRoot: 'C:\\Windows', ProgramFiles: 'C:\\Program Files', 'ProgramFiles(x86)': 'C:\\Program Files (x86)', ProgramData: 'C:\\ProgramData', LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local', APPDATA: 'C:\\Users\\me\\AppData\\Roaming' };

const programs = [
  { id: 'steam', name: 'Steam', installLocation: 'C:\\Program Files (x86)\\Steam' },
  { id: 'app', name: 'App', installLocation: 'C:\\Program Files\\App' },
  { id: 'appx', name: 'App Extras', installLocation: 'C:\\Program Files\\App\\Extras' },
  { id: 'icon', name: 'By Icon', displayIcon: '"D:\\Tools\\byicon\\byicon.exe",0', uninstallString: '"D:\\Tools\\byicon\\unins000.exe"' },
  { id: 'none', name: 'No Info' }
];
const startup = [
  { id: 'run:user:k:steam', name: 'Steam', executable: 'C:\\Program Files (x86)\\Steam\\steam.exe', enabled: true },
  { id: 'run:user:k:other', name: 'Other', executable: 'C:\\Other\\other.exe', enabled: false }
];

describe('matchHunted', () => {
  it('finds the program whose install folder holds the clicked executable', () => {
    const m = matchHunted({ exePath: 'C:\\Program Files (x86)\\Steam\\bin\\cef\\steamwebhelper.exe' }, { programs, startupItems: startup, env: ENV });
    expect(m.program.id).toBe('steam');
  });

  it('prefers the most specific folder when programs nest', () => {
    const m = matchHunted({ exePath: 'C:\\Program Files\\App\\Extras\\x.exe' }, { programs, startupItems: [], env: ENV });
    expect(m.program.id).toBe('appx');
    expect(matchHunted({ exePath: 'C:\\Program Files\\App\\app.exe' }, { programs, startupItems: [], env: ENV }).program.id).toBe('app');
  });

  it('does not match a folder that merely shares a prefix', () => {
    expect(matchHunted({ exePath: 'C:\\Program Files\\AppleThing\\x.exe' }, { programs, startupItems: [], env: ENV }).program).toBeNull();
  });

  it('finds a program with no install location by the folders of its icon and uninstaller', () => {
    expect(matchHunted({ exePath: 'D:\\Tools\\byicon\\byicon.exe' }, { programs, startupItems: [], env: ENV }).program.id).toBe('icon');
  });

  it('is case- and slash-insensitive', () => {
    expect(matchHunted({ exePath: 'c:/program files/app/APP.EXE' }, { programs, startupItems: [], env: ENV }).program.id).toBe('app');
  });

  it('finds nothing for something that is not an installed program, and never matches Windows', () => {
    expect(matchHunted({ exePath: 'C:\\Windows\\System32\\notepad.exe' }, { programs, startupItems: [], env: ENV }).program).toBeNull();
    expect(matchHunted({ exePath: null }, { programs, startupItems: [], env: ENV }).program).toBeNull();
  });

  it('lists the startup entries that launch the executable', () => {
    const m = matchHunted({ exePath: 'C:\\Program Files (x86)\\Steam\\steam.exe' }, { programs, startupItems: startup, env: ENV });
    expect(m.startupItems.map((s) => s.id)).toEqual(['run:user:k:steam']);
    expect(m.startupItems[0]).toMatchObject({ name: 'Steam', enabled: true });
  });

  it('finds startup entries even when no installed program matches', () => {
    const m = matchHunted({ exePath: 'C:\\Other\\other.exe' }, { programs, startupItems: startup, env: ENV });
    expect(m.program).toBeNull();
    expect(m.startupItems.map((s) => s.name)).toEqual(['Other']);
  });

  it('matches a Store app by its package folder', () => {
    const store = [{ id: 'store:1', name: 'Paint', source: 'store', installLocation: 'C:\\Program Files\\WindowsApps\\Microsoft.Paint_1.0_x64__abc' }];
    const m = matchHunted({ exePath: 'C:\\Program Files\\WindowsApps\\Microsoft.Paint_1.0_x64__abc\\PaintApp.exe' }, { programs, storeApps: store, startupItems: [], env: ENV });
    expect(m.program.name).toBe('Paint');
    expect(m.program.source).toBe('store');
  });
});

describe('endProcessRefusal', () => {
  const self = { pid: 100, ppid: 99, execPath: 'C:\\Users\\me\\AppData\\Local\\Programs\\Prune\\Prune.exe' };
  it('refuses Prune itself, in any of its processes', () => {
    expect(endProcessRefusal({ pid: 100, exePath: 'C:\\x.exe' }, { self, env: ENV })).toMatch(/Prune/);
    expect(endProcessRefusal({ pid: 99, exePath: 'C:\\x.exe' }, { self, env: ENV })).toMatch(/Prune/);
    expect(endProcessRefusal({ pid: 7, exePath: self.execPath }, { self, env: ENV })).toMatch(/Prune/);
  });

  it('refuses Windows\' own processes and anything without a known path', () => {
    expect(endProcessRefusal({ pid: 7, exePath: 'C:\\Windows\\System32\\csrss.exe' }, { self, env: ENV })).toMatch(/Windows/);
    expect(endProcessRefusal({ pid: 7, exePath: null }, { self, env: ENV })).toBeTruthy();
    expect(endProcessRefusal({ pid: 0, exePath: 'C:\\a.exe' }, { self, env: ENV })).toBeTruthy();
    expect(endProcessRefusal({ pid: 4, exePath: 'C:\\a.exe' }, { self, env: ENV })).toBeTruthy();
  });

  it('allows an ordinary program', () => {
    expect(endProcessRefusal({ pid: 7, exePath: 'D:\\Games\\Thing\\thing.exe' }, { self, env: ENV })).toBeNull();
  });
});

describe('parseHunterOutput', () => {
  it('reads a picked window', () => {
    expect(parseHunterOutput('{"status":"picked","pid":42,"exePath":"C:\\\\a\\\\b.exe","name":"b.exe","title":"B"}'))
      .toEqual({ status: 'picked', pid: 42, exePath: 'C:\\a\\b.exe', name: 'b.exe', title: 'B' });
  });

  it('reads cancelled and timed out', () => {
    expect(parseHunterOutput('{"status":"cancelled"}')).toEqual({ status: 'cancelled' });
    expect(parseHunterOutput('{"status":"timeout"}')).toEqual({ status: 'timeout' });
  });

  it('treats garbage, or a pick with no usable pid, as a failure', () => {
    for (const bad of ['', 'nope', '{"status":"picked"}', '{"status":"picked","pid":-1}', '{"status":"weird"}']) {
      expect(parseHunterOutput(bad).status, bad).toBe('failed');
    }
  });
});
