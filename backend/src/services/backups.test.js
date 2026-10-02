import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listBackups, restoreBackup, deleteBackup, parseBackupId } from './backups.js';

let base;
let registryRoot;
let taskRoot;
beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'prune-backups-'));
  process.env.UNREVO_QUARANTINE_ROOT = join(base, 'quarantine');
  registryRoot = join(base, 'registry-backups');
  taskRoot = join(base, 'task-backups');
  mkdirSync(registryRoot, { recursive: true });
  mkdirSync(taskRoot, { recursive: true });
});
afterEach(() => {
  delete process.env.UNREVO_QUARANTINE_ROOT;
  rmSync(base, { recursive: true, force: true });
});

function registryBackup(name, { manifest = true, createdAt = Number(name.split('-')[0]) } = {}) {
  const dir = join(registryRoot, name);
  mkdirSync(dir);
  writeFileSync(join(dir, '1-HKLM_SOFTWARE.reg'), 'x'.repeat(100));
  writeFileSync(join(dir, '2-HKCU_Software.reg'), 'y'.repeat(50));
  if (manifest) {
    writeFileSync(join(dir, 'backup.json'), JSON.stringify({
      kind: 'registry', programName: 'Acme', createdAt, files: ['1-HKLM_SOFTWARE.reg', '2-HKCU_Software.reg']
    }));
  }
  return dir;
}

function taskBackup(name) {
  const dir = join(taskRoot, name);
  mkdirSync(dir);
  writeFileSync(join(dir, 'task-0.xml'), '<Task/>');
  writeFileSync(join(dir, 'backup.json'), JSON.stringify({
    kind: 'scheduled-task', programName: 'Acme', createdAt: Number(name.split('-')[0]),
    tasks: [{ name: 'AcmeUpdater', path: '\\Acme\\', file: 'task-0.xml' }]
  }));
  return dir;
}

describe('listBackups', () => {
  it('lists registry and scheduled-task backups, newest first, with program, date, size and kind', async () => {
    registryBackup('1000-Acme');
    taskBackup('3000-Acme');
    registryBackup('2000-Other');
    const list = await listBackups();
    expect(list.map((b) => b.id)).toEqual(['task:3000-Acme', 'registry:2000-Other', 'registry:1000-Acme']);
    expect(list[0]).toMatchObject({ kind: 'scheduled-task', programName: 'Acme', createdAt: 3000, itemCount: 1 });
    expect(list[2]).toMatchObject({ kind: 'registry', programName: 'Acme', createdAt: 1000, itemCount: 2, sizeBytes: 150 });
    expect(list[0].sizeBytes).toBeGreaterThan(0);
  });

  it('reads an older registry backup that has no manifest, from its folder name and files', async () => {
    registryBackup('1700000000000-My_Program', { manifest: false });
    const [backup] = await listBackups();
    expect(backup).toMatchObject({ kind: 'registry', programName: 'My_Program', createdAt: 1700000000000, itemCount: 2, sizeBytes: 150 });
  });

  it('names what a task backup holds', async () => {
    taskBackup('3000-Acme');
    const [backup] = await listBackups();
    expect(backup.items).toEqual(['\\Acme\\AcmeUpdater']);
  });

  it('skips folders that are not backups, and survives a missing root', async () => {
    mkdirSync(join(registryRoot, 'not-a-backup'));
    writeFileSync(join(registryRoot, 'stray.txt'), 'x');
    rmSync(taskRoot, { recursive: true });
    expect(await listBackups()).toEqual([]);
  });
});

describe('parseBackupId', () => {
  it('accepts kind:folder for the two kinds', () => {
    expect(parseBackupId('registry:1000-Acme')).toMatchObject({ kind: 'registry', name: '1000-Acme' });
    expect(parseBackupId('task:3000-Acme').kind).toBe('scheduled-task');
  });

  it('refuses anything that could leave the backup folders', () => {
    for (const bad of ['registry:..', 'registry:..\\x', 'registry:a/b', 'registry:C:\\Windows', 'registry:', 'other:1000-x', '1000-x', 'registry:1000-x\\..\\..', null, 5]) {
      expect(parseBackupId(bad), String(bad)).toBeNull();
    }
  });
});

describe('restoreBackup', () => {
  it('re-imports each .reg file of a registry backup', async () => {
    registryBackup('1000-Acme');
    const runReg = vi.fn(async () => {});
    const result = await restoreBackup('registry:1000-Acme', { runReg, runElevatedReg: vi.fn() });
    expect(runReg.mock.calls.map(([file]) => file.split('\\').pop())).toEqual(['1-HKLM_SOFTWARE.reg', '2-HKCU_Software.reg']);
    expect(result).toMatchObject({ kind: 'registry', restored: 2, failed: [], elevated: false });
  });

  it('retries only the files that failed, in one elevated pass', async () => {
    registryBackup('1000-Acme');
    const runReg = vi.fn(async (file) => { if (file.includes('HKLM')) throw new Error('Access is denied.'); });
    const runElevatedReg = vi.fn(async (files) => files.map((file) => ({ file, ok: true })));
    const result = await restoreBackup('registry:1000-Acme', { runReg, runElevatedReg });
    expect(runElevatedReg).toHaveBeenCalledTimes(1);
    expect(runElevatedReg.mock.calls[0][0]).toHaveLength(1);
    expect(runElevatedReg.mock.calls[0][0][0]).toContain('HKLM');
    expect(result).toMatchObject({ restored: 2, failed: [], elevated: true });
  });

  it('reports a declined administrator prompt, and what did restore', async () => {
    registryBackup('1000-Acme');
    const runReg = vi.fn(async (file) => { if (file.includes('HKLM')) throw new Error('Access is denied.'); });
    const runElevatedReg = vi.fn(async () => { throw Object.assign(new Error('declined'), { cancelled: true }); });
    const result = await restoreBackup('registry:1000-Acme', { runReg, runElevatedReg });
    expect(result.restored).toBe(1);
    expect(result.failed).toEqual([{ file: '1-HKLM_SOFTWARE.reg', reason: expect.stringMatching(/administrator/i), cancelled: true }]);
  });

  it('does not ask for elevation when nothing failed', async () => {
    registryBackup('1000-Acme');
    const runElevatedReg = vi.fn();
    await restoreBackup('registry:1000-Acme', { runReg: async () => {}, runElevatedReg });
    expect(runElevatedReg).not.toHaveBeenCalled();
  });

  it('puts scheduled tasks back through the task restorer', async () => {
    taskBackup('3000-Acme');
    const restoreTasks = vi.fn(async () => ({ restored: [{ name: 'AcmeUpdater', path: '\\Acme\\' }], failed: [], elevated: false }));
    const result = await restoreBackup('task:3000-Acme', { restoreTasks });
    expect(restoreTasks).toHaveBeenCalledWith(join(taskRoot, '3000-Acme'));
    expect(result).toMatchObject({ kind: 'scheduled-task', restored: 1, failed: [] });
  });

  it('refuses a backup that does not exist or an id that is not one', async () => {
    await expect(restoreBackup('registry:9999-Gone', {})).rejects.toThrow(/no such backup/i);
    await expect(restoreBackup('registry:..', {})).rejects.toThrow(/no such backup/i);
  });
});

describe('deleteBackup', () => {
  it('removes the whole backup folder', async () => {
    const dir = registryBackup('1000-Acme');
    expect(await deleteBackup('registry:1000-Acme')).toEqual({ deleted: true, freedBytes: expect.any(Number) });
    expect(existsSync(dir)).toBe(false);
  });

  it('says there was nothing to delete, and never touches a path outside the roots', async () => {
    expect((await deleteBackup('registry:9999-Gone')).deleted).toBe(false);
    const outside = join(base, 'victim');
    mkdirSync(outside);
    expect((await deleteBackup('registry:..\\victim')).deleted).toBe(false);
    expect(existsSync(outside)).toBe(true);
  });
});
