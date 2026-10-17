import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crashArtifactExe, scanCrashArtifacts } from './crashArtifacts.js';
import { osComponentRefusal } from './leftoverProtection.js';
import { permanentDeletionRefusal } from './leftoverRemoval.js';

const env = {
  SystemRoot: 'C:\\Windows',
  ProgramData: 'C:\\ProgramData',
  LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local'
};

describe('crashArtifactExe', () => {
  it('reads the executable out of a Prefetch file', () => {
    expect(crashArtifactExe('C:\\Windows\\Prefetch\\NOTEPAD++.EXE-1A2B3C4D.pf', env)).toBe('notepad++');
  });

  it('reads it out of a Windows Error Reporting folder, machine-wide or per user', () => {
    expect(crashArtifactExe('C:\\ProgramData\\Microsoft\\Windows\\WER\\ReportArchive\\AppCrash_notepad++.exe_5f3c9a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d_d5e0e4a2_1f3b2c4d', env)).toBe('notepad++');
    expect(crashArtifactExe('C:\\Users\\me\\AppData\\Local\\Microsoft\\Windows\\WER\\ReportQueue\\AppHang_acme_tool.exe_0123456789abcdef0123_00000000_abcd', env)).toBe('acme_tool');
  });

  it('reads it out of a crash dump', () => {
    expect(crashArtifactExe('C:\\Users\\me\\AppData\\Local\\CrashDumps\\notepad++.exe.12345.dmp', env)).toBe('notepad++');
  });

  it('recognizes nothing else, including the folders themselves', () => {
    for (const path of [
      'C:\\Windows\\Prefetch',
      'C:\\Windows\\Prefetch\\Layout.ini',
      'C:\\Windows\\Prefetch\\ReadyBoot\\X-1A2B3C4D.pf',
      'C:\\Windows\\System32\\NOTEPAD.EXE-1A2B3C4D.pf',
      'C:\\ProgramData\\Microsoft\\Windows\\WER\\ReportArchive',
      'C:\\ProgramData\\Microsoft\\Windows\\WER\\Temp\\AppCrash_x.exe_0123456789abcdef0123_1',
      'C:\\Users\\me\\AppData\\Local\\CrashDumps',
      'C:\\Users\\me\\AppData\\Local\\CrashDumps\\notes.txt'
    ]) {
      expect(crashArtifactExe(path, env), path).toBeNull();
    }
  });
});

// The scan's Windows guard refuses everything under C:\Windows and under
// ...\Microsoft\Windows. These exact shapes are the one exception: Windows
// regenerates or never reads them again, and they are named for the program.
describe('osComponentRefusal and crash artifacts', () => {
  it('lets a recognized artifact through', () => {
    expect(osComponentRefusal('C:\\Windows\\Prefetch\\NOTEPAD++.EXE-1A2B3C4D.pf', { env })).toBeNull();
    expect(osComponentRefusal('C:\\ProgramData\\Microsoft\\Windows\\WER\\ReportArchive\\AppCrash_notepad++.exe_5f3c9a1b2c3d4e5f6a7b_d5e0e4a2_1f3b', { env })).toBeNull();
  });

  it('still refuses the folders that hold them and anything else nearby', () => {
    for (const path of [
      'C:\\Windows\\Prefetch',
      'C:\\Windows\\Prefetch\\Layout.ini',
      'C:\\ProgramData\\Microsoft\\Windows\\WER',
      'C:\\ProgramData\\Microsoft\\Windows\\WER\\ReportArchive',
      'C:\\Windows\\System32\\NOTEPAD.EXE-1A2B3C4D.pf'
    ]) {
      expect(osComponentRefusal(path, { env }), path).not.toBeNull();
    }
  });
});

describe('permanentDeletionRefusal and crash artifacts', () => {
  const where = { systemRoot: 'C:\\Windows', usersRoot: 'C:\\Users', programData: 'C:\\ProgramData' };

  it('lets a Prefetch trace through, while still refusing Windows itself', () => {
    // Uses the real process environment's Windows folder: the exception is
    // read from the same place the guard reads.
    const windows = process.env.SystemRoot || 'C:\\Windows';
    expect(permanentDeletionRefusal(`${windows}\\Prefetch\\ZEPHYR.EXE-1A2B3C4D.pf`, where)).toBeNull();
    expect(permanentDeletionRefusal(`${windows}\\Prefetch`, where)).not.toBeNull();
    expect(permanentDeletionRefusal(`${windows}\\Prefetch\\Layout.ini`, where)).not.toBeNull();
  });
});

describe('scanCrashArtifacts', () => {
  let base;
  let fakeEnv;
  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'prune-crash-'));
    fakeEnv = {
      SystemRoot: join(base, 'Windows'),
      ProgramData: join(base, 'ProgramData'),
      LOCALAPPDATA: join(base, 'Local')
    };
    const file = (path, bytes = 10) => { mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, Buffer.alloc(bytes)); };
    file(join(fakeEnv.SystemRoot, 'Prefetch', 'ZEPHYR.EXE-1A2B3C4D.pf'));
    file(join(fakeEnv.SystemRoot, 'Prefetch', 'OTHER.EXE-1A2B3C4D.pf'));
    file(join(fakeEnv.ProgramData, 'Microsoft', 'Windows', 'WER', 'ReportArchive', 'AppCrash_zephyr.exe_0123456789abcdef0123_00000000_ab', 'Report.wer'), 20);
    file(join(fakeEnv.LOCALAPPDATA, 'CrashDumps', 'zephyr.exe.4242.dmp'), 30);
    file(join(fakeEnv.LOCALAPPDATA, 'CrashDumps', 'other.exe.4242.dmp'));
  });
  afterEach(() => rmSync(base, { recursive: true, force: true }));

  it('finds the program\'s artifacts by executable name, and nothing else', async () => {
    const result = await scanCrashArtifacts({ matches: (exe) => /zephyr/i.test(exe), env: fakeEnv });
    expect(result.ok).toBe(true);
    expect(result.items.map((i) => i.path).sort()).toEqual([
      join(fakeEnv.LOCALAPPDATA, 'CrashDumps', 'zephyr.exe.4242.dmp'),
      join(fakeEnv.ProgramData, 'Microsoft', 'Windows', 'WER', 'ReportArchive', 'AppCrash_zephyr.exe_0123456789abcdef0123_00000000_ab'),
      join(fakeEnv.SystemRoot, 'Prefetch', 'ZEPHYR.EXE-1A2B3C4D.pf')
    ].sort());
    expect(result.items.every((i) => i.sizeBytes > 0)).toBe(true);
  });

  it('treats a folder it may not read (Prefetch without elevation) as empty, not a failure', async () => {
    const result = await scanCrashArtifacts({ matches: () => true, env: { ...fakeEnv, SystemRoot: join(base, 'Missing') } });
    expect(result.ok).toBe(true);
  });
});
