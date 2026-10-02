import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  captureFiles, diffFiles, diffState, captureSystemState, chooseProgram, buildSystemScript, monitorFileRoots
} from './installSnapshot.js';

let base;
beforeEach(() => { base = mkdtempSync(join(tmpdir(), 'prune-snap-')); });
afterEach(() => { rmSync(base, { recursive: true, force: true }); });

const put = (...parts) => {
  const p = join(base, ...parts);
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, 'data');
  return p;
};
const roots = () => [{ path: join(base, 'root'), depth: 4 }];

describe('captureFiles and diffFiles', () => {
  it('finds a new folder, collapsed to its top-most new directory', async () => {
    put('root', 'Existing', 'old.txt');
    const before = await captureFiles({ roots: roots() });

    put('root', 'NewVendor', 'App', 'app.exe');
    put('root', 'NewVendor', 'App', 'lib', 'a.dll');
    const diff = await diffFiles(before, { roots: roots() });

    expect(diff.added.map((a) => a.path)).toEqual([join(base, 'root', 'NewVendor')]);
    expect(diff.added[0].isDirectory).toBe(true);
    expect(diff.added[0].sizeBytes).toBe(8);
  });

  it('keeps a new file inside an existing folder, as a file', async () => {
    put('root', 'Existing', 'old.txt');
    const before = await captureFiles({ roots: roots() });
    const added = put('root', 'Existing', 'fresh.cfg');
    const diff = await diffFiles(before, { roots: roots() });
    expect(diff.added.map((a) => a.path)).toEqual([added]);
    expect(diff.added[0].isDirectory).toBe(false);
  });

  it('counts a changed file without listing it as an addition', async () => {
    const file = put('root', 'Existing', 'old.txt');
    const before = await captureFiles({ roots: roots() });
    writeFileSync(file, 'much longer content than before');
    utimesSync(file, new Date(Date.now() + 5000), new Date(Date.now() + 5000));
    const diff = await diffFiles(before, { roots: roots() });
    expect(diff.added).toEqual([]);
    expect(diff.modified).toBe(1);
  });

  it('reports nothing when nothing changed', async () => {
    put('root', 'A', 'a.txt');
    const before = await captureFiles({ roots: roots() });
    const diff = await diffFiles(before, { roots: roots() });
    expect(diff.added).toEqual([]);
    expect(diff.modified).toBe(0);
  });

  it('leaves out folders that churn on their own: Temp, caches, Microsoft', async () => {
    const before = await captureFiles({ roots: roots() });
    put('root', 'Temp', 'x.tmp');
    put('root', 'Microsoft', 'Windows', 'x.dat');
    put('root', 'Packages', 'p.dat');
    put('root', 'CrashDumps', 'd.dmp');
    put('root', 'RealProgram', 'p.exe');
    const diff = await diffFiles(before, { roots: roots() });
    expect(diff.added.map((a) => a.path)).toEqual([join(base, 'root', 'RealProgram')]);
  });

  it('does not report a new folder buried deeper than a program would put one', async () => {
    put('root', 'Existing', 'Deep', 'Deeper', 'Deepest', 'x.txt');
    const before = await captureFiles({ roots: [{ path: join(base, 'root'), depth: 6 }] });
    put('root', 'Existing', 'Deep', 'Deeper', 'Deepest', 'NewCache', 'c.bin');
    const diff = await diffFiles(before, { roots: [{ path: join(base, 'root'), depth: 6 }] });
    expect(diff.added).toEqual([]);
  });

  it('says when the walk stopped on a budget, so the trace can say it is partial', async () => {
    for (let i = 0; i < 6; i += 1) put('root', `d${i}`, 'f.txt');
    const before = await captureFiles({ roots: roots(), maxEntries: 3 });
    expect(before.truncated).toBe(true);
  });

  it('caps the number of additions it keeps', async () => {
    const before = await captureFiles({ roots: roots() });
    for (let i = 0; i < 12; i += 1) put('root', `n${i}`, 'f.txt');
    const diff = await diffFiles(before, { roots: roots(), maxAdded: 5 });
    expect(diff.added).toHaveLength(5);
    expect(diff.addedTruncated).toBe(true);
  });

  it('skips a root that does not exist', async () => {
    const before = await captureFiles({ roots: [{ path: join(base, 'nope'), depth: 3 }] });
    expect(before.map.size).toBe(0);
  });
});

describe('monitorFileRoots', () => {
  it('covers the places an installer writes to', () => {
    const paths = monitorFileRoots({
      ProgramFiles: 'C:\\Program Files', 'ProgramFiles(x86)': 'C:\\Program Files (x86)', ProgramData: 'C:\\ProgramData',
      LOCALAPPDATA: 'C:\\U\\AppData\\Local', APPDATA: 'C:\\U\\AppData\\Roaming'
    }).map((r) => r.path.toLowerCase());
    for (const expected of ['c:\\program files', 'c:\\program files (x86)', 'c:\\programdata', 'c:\\u\\appdata\\local', 'c:\\u\\appdata\\roaming',
      'c:\\u\\appdata\\roaming\\microsoft\\windows\\start menu', 'c:\\programdata\\microsoft\\windows\\start menu']) {
      expect(paths).toContain(expected);
    }
  });
});

describe('system state', () => {
  const before = {
    uninstall: [{ key: 'HKLM\\U\\Old', name: 'Old Program' }],
    run: [{ key: 'HKCU\\Run', valueName: 'OldRun', data: 'old.exe' }],
    services: [{ name: 'OldSvc', pathName: 'old.exe' }],
    tasks: [{ name: 'OldTask', path: '\\' }]
  };

  it('diffs: only what is new, and a changed startup command counts as new', () => {
    const after = {
      uninstall: [...before.uninstall, { key: 'HKLM\\U\\New', name: 'New Program' }],
      run: [{ key: 'HKCU\\Run', valueName: 'OldRun', data: 'old2.exe' }, { key: 'HKCU\\Run', valueName: 'NewRun', data: 'new.exe' }],
      services: [...before.services, { name: 'NewSvc', pathName: 'new.exe' }],
      tasks: [...before.tasks, { name: 'NewTask', path: '\\V\\' }]
    };
    const diff = diffState(before, after);
    expect(diff.uninstall.map((u) => u.key)).toEqual(['HKLM\\U\\New']);
    expect(diff.run.map((r) => r.valueName).sort()).toEqual(['NewRun', 'OldRun']);
    expect(diff.services.map((s) => s.name)).toEqual(['NewSvc']);
    expect(diff.tasks.map((t) => t.name)).toEqual(['NewTask']);
  });

  it('compares keys case-insensitively', () => {
    const after = { ...before, uninstall: [{ key: 'hklm\\u\\old', name: 'Old Program' }] };
    expect(diffState(before, after).uninstall).toEqual([]);
  });

  it('is empty for two identical states, and tolerates missing parts', () => {
    expect(diffState(before, before)).toEqual({ uninstall: [], run: [], services: [], tasks: [] });
    expect(diffState({}, {})).toEqual({ uninstall: [], run: [], services: [], tasks: [] });
  });

  it('is read from one PowerShell call, normalised to arrays', async () => {
    const runPs = vi.fn(async () => ({ uninstall: { key: 'K', name: 'N' }, run: null, services: [], tasks: undefined }));
    const state = await captureSystemState({ runPs });
    expect(runPs).toHaveBeenCalledTimes(1);
    expect(state).toEqual({ uninstall: [{ key: 'K', name: 'N' }], run: [], services: [], tasks: [] });
  });

  it('builds a script that parses (nothing is run)', async () => {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const file = join(base, 'state.ps1');
    writeFileSync(file, buildSystemScript(), 'utf8');
    const { stdout } = await promisify(execFile)('powershell', ['-NoProfile', '-NonInteractive', '-Command',
      `$e = $null; [System.Management.Automation.Language.Parser]::ParseFile('${file}', [ref]$null, [ref]$e) | Out-Null; 'errors=' + @($e).Count`], { timeout: 30000 });
    expect(stdout.trim()).toBe('errors=0');
  }, 40000);
});

describe('chooseProgram', () => {
  it('is null when the installer added no Add/Remove entry', () => {
    expect(chooseProgram([], 'C:\\setup.exe')).toBeNull();
  });

  it('takes the one entry there is', () => {
    const chosen = chooseProgram([{ key: 'HKLM\\U\\A', name: 'Acme', publisher: 'Acme Inc' }], 'C:\\dl\\acme-setup.exe');
    expect(chosen.program.name).toBe('Acme');
    expect(chosen.others).toEqual([]);
  });

  it('prefers the entry that looks like the installer when several appeared', () => {
    const chosen = chooseProgram([
      { key: 'K1', name: 'Microsoft Visual C++ 2015 Redistributable' },
      { key: 'K2', name: 'Acme Studio', estimatedSize: 10 },
      { key: 'K3', name: 'Some Runtime', estimatedSize: 999999 }
    ], 'C:\\dl\\AcmeStudio_setup.exe');
    expect(chosen.program.name).toBe('Acme Studio');
    expect(chosen.others.map((o) => o.name).sort()).toEqual(['Microsoft Visual C++ 2015 Redistributable', 'Some Runtime']);
  });

  it('otherwise takes the biggest, and ignores system components', () => {
    const chosen = chooseProgram([
      { key: 'K1', name: 'Hidden', systemComponent: true, estimatedSize: 9999999 },
      { key: 'K2', name: 'Small', estimatedSize: 5 },
      { key: 'K3', name: 'Large', estimatedSize: 500 }
    ], 'C:\\dl\\installer.exe');
    expect(chosen.program.name).toBe('Large');
  });

  it('ignores an entry with no display name', () => {
    expect(chooseProgram([{ key: 'K', name: '' }], 'C:\\a.exe')).toBeNull();
  });
});
