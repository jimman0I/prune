import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unregisteredReason, inUseFolders, scanUnregisteredFolders, msiTopFolders } from './unregisteredFolders.js';

const env = { ProgramFiles: 'C:\\Program Files', 'ProgramFiles(x86)': 'C:\\Program Files (x86)', LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local', SystemRoot: 'C:\\Windows' };

describe('unregisteredReason', () => {
  const footprints = [{ dir: 'C:\\Program Files\\NVIDIA Corporation', program: 'NVIDIA app' }];
  const inUse = new Set(['c:\\program files\\realtek']);

  it('offers a folder nothing registered, running or scheduled claims', () => {
    expect(unregisteredReason('C:\\Program Files\\OldTool', { footprints, inUse, env })).toBeNull();
  });

  it('keeps every folder something still claims', () => {
    expect(unregisteredReason('C:\\Program Files\\NVIDIA Corporation', { footprints, inUse, env })).toMatch(/installed/);
    expect(unregisteredReason('C:\\Program Files\\Realtek', { footprints, inUse, env })).toMatch(/in use/);
  });

  it('keeps Windows\' own folders and the shared containers', () => {
    for (const dir of ['C:\\Program Files\\Windows Defender', 'C:\\Program Files\\Common Files', 'C:\\Program Files\\WindowsApps', 'C:\\Program Files\\Microsoft', 'C:\\Program Files\\dotnet', 'C:\\Program Files\\Internet Explorer', 'C:\\Program Files\\Uninstall Information']) {
      expect(unregisteredReason(dir, { footprints, inUse, env }), dir).not.toBeNull();
    }
  });
});

describe('unregisteredReason: ownership the uninstall list does not spell out', () => {
  it('keeps a folder Windows Installer tracks (an MSI install registers no folder in Add/Remove)', () => {
    const msiFolders = new Set(['c:\\users\\me\\appdata\\local\\programs\\python']);
    expect(unregisteredReason('C:\\Users\\me\\AppData\\Local\\Programs\\Python', { footprints: [], inUse: new Set(), msiFolders, env })).toMatch(/Windows Installer/);
  });

  it('keeps a folder whose name is plainly part of an installed program', () => {
    // Real cases: MuMuPlayer (publisher Netease, installed under Netease)
    // also puts MuMuVMMVbox in Program Files; Blitz installs per user and its
    // updater sits beside it as blitz-delta-updater.
    const programs = [{ name: 'MuMuPlayer', publisher: 'Netease' }, { name: 'Blitz', publisher: 'Blitz, Inc.' }, { name: 'Roblox Player for me', publisher: 'Roblox Corporation' }];
    expect(unregisteredReason('C:\\Program Files\\MuMuVMMVbox', { footprints: [], inUse: new Set(), programs, env })).toMatch(/MuMuPlayer/);
    expect(unregisteredReason('C:\\Users\\me\\AppData\\Local\\Programs\\blitz-delta-updater', { footprints: [], inUse: new Set(), programs, env })).toMatch(/Blitz/);
    expect(unregisteredReason('C:\\Program Files (x86)\\Roblox', { footprints: [], inUse: new Set(), programs, env })).toMatch(/Roblox/);
    expect(unregisteredReason('C:\\Program Files\\OldTool', { footprints: [], inUse: new Set(), programs, env })).toBeNull();
  });

  it('keeps the driver-install framework folder', () => {
    expect(unregisteredReason('C:\\Program Files\\DIFX', { footprints: [], inUse: new Set(), env })).not.toBeNull();
  });
});

describe('msiTopFolders', () => {
  it('reduces every folder Windows Installer tracks to its top folder under a programs root', () => {
    const set = msiTopFolders(['C:\\Users\\me\\AppData\\Local\\Programs\\Python\\Python314\\Lib\\', 'C:\\Program Files\\GitHub CLI\\', 'D:\\Elsewhere\\x\\'], env);
    expect([...set].sort()).toEqual(['c:\\program files\\github cli', 'c:\\users\\me\\appdata\\local\\programs\\python']);
  });
});

describe('inUseFolders', () => {
  it('maps each running or registered executable to the top folder it lives in under Program Files', () => {
    const set = inUseFolders([
      'C:\\Program Files\\Realtek\\Audio\\HDA\\RtkAudUService64.exe',
      '"C:\\Program Files (x86)\\Vendor X\\svc.exe" -k',
      'C:\\Users\\me\\AppData\\Local\\Programs\\Tool\\tool.exe',
      'C:\\Windows\\System32\\svchost.exe -k netsvcs',
      null
    ], env);
    expect([...set].sort()).toEqual([
      'c:\\program files (x86)\\vendor x',
      'c:\\program files\\realtek',
      'c:\\users\\me\\appdata\\local\\programs\\tool'
    ]);
  });
});

describe('scanUnregisteredFolders', () => {
  let base;
  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'prune-unreg-'));
    const file = (rel, bytes = 10) => { const p = join(base, rel); mkdirSync(join(p, '..'), { recursive: true }); writeFileSync(p, Buffer.alloc(bytes)); };
    file('PF\\OldTool\\bin\\old.exe', 100);
    file('PF\\Vendor\\product.exe');
    file('PF\\DataOnly\\notes.txt');
    mkdirSync(join(base, 'PF', 'Empty'), { recursive: true });
    file('PF\\Busy\\busy.exe');
  });
  afterEach(() => rmSync(base, { recursive: true, force: true }));

  it('lists the unclaimed folders that hold a program, shaped like program rows', async () => {
    const pf = join(base, 'PF');
    const rows = await scanUnregisteredFolders({
      roots: [pf],
      footprints: [{ dir: join(pf, 'Vendor'), program: 'Vendor App' }],
      inUse: new Set([join(pf, 'Busy').toLowerCase()]),
      env: {}
    });
    expect(rows.map((r) => r.name)).toEqual(['OldTool']);
    expect(rows[0]).toMatchObject({
      id: `unregistered:${join(pf, 'OldTool')}`, installLocation: join(pf, 'OldTool'), source: 'unregistered', publisher: '', version: ''
    });
    expect(rows[0].sizeBytes).toBeGreaterThanOrEqual(100);
  });

  it('is empty when a root does not exist', async () => {
    expect(await scanUnregisteredFolders({ roots: [join(base, 'nope')], footprints: [], inUse: new Set(), env: {} })).toEqual([]);
  });
});

describe('readMachineUse', () => {
  it('returns the commands and the Windows Installer folders', async () => {
    const { readMachineUse } = await import('./unregisteredFolders.js');
    expect(await readMachineUse({ run: async () => ({ commands: ['a.exe'], folders: ['C:\\x\\'] }) })).toEqual({ commands: ['a.exe'], folders: ['C:\\x\\'] });
    expect(await readMachineUse({ run: async () => ({ commands: ['a.exe'] }) })).toEqual({ commands: ['a.exe'], folders: [] });
  });

  it('is null when the machine could not be read, so nothing is offered', async () => {
    const { readMachineUse } = await import('./unregisteredFolders.js');
    expect(await readMachineUse({ run: async () => { throw new Error('x'); } })).toBeNull();
    expect(await readMachineUse({ run: async () => null })).toBeNull();
  });
});
