import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, readdirSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRegistryBackup, runPreUninstall, REGISTRY_BACKUP_KEYS, KEEP_BACKUPS } from './preUninstall.js';

/** What happens before a program's own uninstaller runs: Revo's "Create a
 * System Restore Point before uninstall" and "Create a full Registry
 * Backup before uninstall". Both off unless the user turns them on.
 *
 * They fail differently on purpose. A restore point needs admin and
 * Windows allows one a day, so it fails routinely -- and stopping every
 * uninstall over it would make the option unusable. A registry backup is
 * what the user explicitly asked to have before anything changes, so if it
 * cannot be made, the uninstall does not run.
 *
 * reg.exe is injected; nothing here touches the real registry.
 */

let root;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'prune-regbackup-')); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

const fakeExport = vi.fn(async (key, file) => { writeFileSync(file, `export of ${key}`); });

describe('createRegistryBackup', () => {
  it('exports the machine and user software hives into one folder per backup', async () => {
    fakeExport.mockClear();
    const result = await createRegistryBackup({ programName: 'Thing', root, exportKey: fakeExport, now: () => 1000 });

    expect(REGISTRY_BACKUP_KEYS).toEqual(['HKLM\\SOFTWARE', 'HKCU\\Software']);
    expect(fakeExport.mock.calls.map((c) => c[0])).toEqual(REGISTRY_BACKUP_KEYS);
    expect(result.ok).toBe(true);
    expect(result.dir.startsWith(root)).toBe(true);
    expect(readdirSync(result.dir).filter((f) => f.endsWith('.reg'))).toHaveLength(2);
    expect(result.sizeBytes).toBeGreaterThan(0);
  });

  it('keeps only the newest few, because each one is about 140 MB', async () => {
    for (const t of [1, 2, 3]) mkdirSync(join(root, `${t}-Old`));
    const result = await createRegistryBackup({ programName: 'Thing', root, exportKey: fakeExport, now: () => 9 });

    const left = readdirSync(root).sort();
    expect(left).toHaveLength(KEEP_BACKUPS);
    expect(KEEP_BACKUPS).toBe(3);
    expect(left).toContain('9-Thing');
    expect(left).not.toContain('1-Old');
    expect(result.pruned).toEqual(['1-Old']);
  });

  it('reports a failed export, and leaves no half-made backup behind', async () => {
    const failing = vi.fn(async (key, file) => {
      if (key.startsWith('HKCU')) throw new Error('Access is denied.');
      writeFileSync(file, 'partial');
    });
    const result = await createRegistryBackup({ programName: 'Thing', root, exportKey: failing, now: () => 5 });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Access is denied/);
    expect(existsSync(join(root, '5-Thing'))).toBe(false);
  });

  it('never prunes the backup it just made, or anything it did not make', async () => {
    mkdirSync(join(root, 'notes'));  // not a timestamped backup folder
    for (const t of [1, 2, 3, 4]) mkdirSync(join(root, `${t}-Old`));
    await createRegistryBackup({ programName: 'Thing', root, exportKey: fakeExport, now: () => 99 });
    const left = readdirSync(root);
    expect(left).toContain('99-Thing');
    expect(left).toContain('notes');
  });
});

describe('runPreUninstall', () => {
  const events = () => { const list = []; return { list, onEvent: (type, data) => list.push([type, data]) }; };
  const restorePoint = vi.fn();
  const registryBackup = vi.fn();
  beforeEach(() => { restorePoint.mockReset(); registryBackup.mockReset(); });

  const run = (settings, onEvent) => runPreUninstall({ programName: 'Thing', settings, onEvent, restorePoint, registryBackup });

  it('does nothing at all with both settings off', async () => {
    const { list, onEvent } = events();
    expect(await run({}, onEvent)).toEqual({ proceed: true });
    expect(restorePoint).not.toHaveBeenCalled();
    expect(registryBackup).not.toHaveBeenCalled();
    expect(list).toEqual([]);
  });

  it('treats anything but an explicit true as off', async () => {
    const { onEvent } = events();
    await run({ restorePointBeforeUninstall: 'true', registryBackupBeforeUninstall: 1 }, onEvent);
    expect(restorePoint).not.toHaveBeenCalled();
    expect(registryBackup).not.toHaveBeenCalled();
  });

  it('makes a restore point named for the program, and reports it', async () => {
    restorePoint.mockResolvedValue({ created: true });
    const { list, onEvent } = events();
    const result = await run({ restorePointBeforeUninstall: true }, onEvent);

    expect(restorePoint).toHaveBeenCalledWith('Prune: before uninstalling Thing');
    expect(list).toContainEqual(['restorePoint', { created: true }]);
    expect(result.proceed).toBe(true);
  });

  it('goes ahead when the restore point fails, and says why', async () => {
    restorePoint.mockResolvedValue({ created: false, reason: 'Access denied' });
    const { list, onEvent } = events();
    expect((await run({ restorePointBeforeUninstall: true }, onEvent)).proceed).toBe(true);
    expect(list).toContainEqual(['restorePoint', { created: false, reason: 'Access denied' }]);
  });

  it('backs up the registry, and reports where', async () => {
    registryBackup.mockResolvedValue({ ok: true, dir: 'D:\\b', sizeBytes: 5 });
    const { list, onEvent } = events();
    const result = await run({ registryBackupBeforeUninstall: true }, onEvent);

    expect(registryBackup).toHaveBeenCalledWith({ programName: 'Thing' });
    expect(list).toContainEqual(['registryBackup', { ok: true, dir: 'D:\\b', sizeBytes: 5 }]);
    expect(result.proceed).toBe(true);
  });

  it('stops the uninstall when the registry backup the user asked for cannot be made', async () => {
    registryBackup.mockResolvedValue({ ok: false, error: 'The disk is full.' });
    const { onEvent } = events();
    const result = await run({ registryBackupBeforeUninstall: true }, onEvent);

    expect(result.proceed).toBe(false);
    expect(result.reason).toMatch(/registry backup/i);
    expect(result.reason).toMatch(/The disk is full/);
  });

  it('makes the restore point before the registry backup', async () => {
    const order = [];
    restorePoint.mockImplementation(async () => { order.push('restorePoint'); return { created: true }; });
    registryBackup.mockImplementation(async () => { order.push('registryBackup'); return { ok: true }; });
    const { onEvent } = events();
    await run({ restorePointBeforeUninstall: true, registryBackupBeforeUninstall: true }, onEvent);
    expect(order).toEqual(['restorePoint', 'registryBackup']);
  });
});
