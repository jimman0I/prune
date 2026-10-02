import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  removeScheduledTasks, taskRefusal, buildTaskScript, restoreScheduledTask, taskBackupRoot
} from './scheduledTaskRemoval.js';

/** Removing a scheduled task, with its definition saved first.
 *
 * PowerShell and the elevation layer are stood in for: nothing here touches
 * the machine's real tasks. The script that WOULD run is checked separately,
 * for parsing, against real PowerShell without invoking it. */

let root;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'prune-task-backups-')); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

/** A fake script runner: writes the XML file the real script would write
 * (the second argument is the list of items it was handed) and reports. */
function fakeRunner(behaviour = {}) {
  return vi.fn(async (items) => items.map((item) => {
    const how = behaviour[item.name] || 'ok';
    if (how === 'ok') {
      writeFileSync(item.file, `<Task>${item.name}</Task>`);
      return { name: item.name, path: item.path, exported: true, removed: true };
    }
    if (how === 'denied') {
      return { name: item.name, path: item.path, exported: false, removed: false, denied: true, error: 'Access is denied.' };
    }
    if (how === 'exported-not-removed') {
      writeFileSync(item.file, '<Task/>');
      return { name: item.name, path: item.path, exported: true, removed: false, error: 'locked' };
    }
    return { name: item.name, path: item.path, exported: false, removed: false, error: 'No task found' };
  }));
}

const tasks = [{ name: 'AcmeUpdater', path: '\\Acme\\' }, { name: 'AcmeSync', path: '\\' }];

describe('taskRefusal', () => {
  it('refuses the tasks Windows ships and schedules itself', () => {
    expect(taskRefusal({ name: 'Defrag', path: '\\Microsoft\\Windows\\Defrag\\' })).toBeTruthy();
    expect(taskRefusal({ name: 'X', path: '\\Microsoft\\Windows\\' })).toBeTruthy();
    expect(taskRefusal({ name: 'x', path: '\\microsoft\\windows\\x' })).toBeTruthy();
  });

  it('allows a Microsoft product\'s task outside the Windows folder, and an ordinary one', () => {
    expect(taskRefusal({ name: 'Office', path: '\\Microsoft\\Office\\' })).toBeNull();
    expect(taskRefusal({ name: 'AcmeUpdater', path: '\\' })).toBeNull();
  });

  it('refuses anything that is not a task name and a task path', () => {
    for (const bad of [null, {}, { name: '', path: '\\' }, { name: 'x', path: 'no-leading-slash' }, { name: 5, path: '\\' }, { name: 'a\u0000b', path: '\\' }]) {
      expect(taskRefusal(bad), JSON.stringify(bad)).toBeTruthy();
    }
  });
});

describe('removeScheduledTasks', () => {
  it('saves each task\'s definition to a backup before the script is trusted with removing it', async () => {
    const run = fakeRunner();
    const result = await removeScheduledTasks({ programName: 'Acme', tasks, root, run, runElevated: vi.fn(), now: () => 1000 });

    expect(result.removed).toEqual(tasks);
    expect(result.failed).toEqual([]);
    expect(result.elevated).toBe(false);
    const files = readdirSync(result.backupDir).sort();
    expect(files).toEqual(['backup.json', 'task-0.xml', 'task-1.xml']);

    const manifest = JSON.parse(readFileSync(join(result.backupDir, 'backup.json'), 'utf8'));
    expect(manifest.kind).toBe('scheduled-task');
    expect(manifest.programName).toBe('Acme');
    expect(manifest.createdAt).toBe(1000);
    expect(manifest.tasks).toEqual([
      { name: 'AcmeUpdater', path: '\\Acme\\', file: 'task-0.xml' },
      { name: 'AcmeSync', path: '\\', file: 'task-1.xml' }
    ]);
  });

  it('hands the script a file path inside the backup folder for each task', async () => {
    const run = fakeRunner();
    await removeScheduledTasks({ programName: 'Acme', tasks, root, run, runElevated: vi.fn() });
    const items = run.mock.calls[0][0];
    expect(items.map((i) => i.file.startsWith(root))).toEqual([true, true]);
    expect(items[0].name).toBe('AcmeUpdater');
  });

  it('never passes a Windows task to the script', async () => {
    const run = fakeRunner();
    const result = await removeScheduledTasks({
      programName: 'Acme', root, run, runElevated: vi.fn(),
      tasks: [...tasks, { name: 'ScheduledDefrag', path: '\\Microsoft\\Windows\\Defrag\\' }]
    });
    expect(run.mock.calls[0][0].map((i) => i.name)).toEqual(['AcmeUpdater', 'AcmeSync']);
    expect(result.failed).toEqual([{ name: 'ScheduledDefrag', path: '\\Microsoft\\Windows\\Defrag\\', reason: expect.stringMatching(/Windows/) }]);
  });

  it('retries only the tasks that were denied, once, elevated', async () => {
    const run = fakeRunner({ AcmeSync: 'denied' });
    const runElevated = vi.fn(async (items) => items.map((item) => {
      writeFileSync(item.file, '<Task/>');
      return { name: item.name, path: item.path, exported: true, removed: true };
    }));
    const result = await removeScheduledTasks({ programName: 'Acme', tasks, root, run, runElevated });

    expect(runElevated).toHaveBeenCalledTimes(1);
    expect(runElevated.mock.calls[0][0].map((i) => i.name)).toEqual(['AcmeSync']);
    expect(result.elevated).toBe(true);
    expect(result.removed.map((t) => t.name).sort()).toEqual(['AcmeSync', 'AcmeUpdater']);
    expect(result.failed).toEqual([]);
  });

  it('reports a declined UAC prompt as such, and leaves the task alone', async () => {
    const run = fakeRunner({ AcmeSync: 'denied' });
    const runElevated = vi.fn(async () => { throw Object.assign(new Error('cancelled'), { cancelled: true }); });
    const result = await removeScheduledTasks({ programName: 'Acme', tasks, root, run, runElevated });
    expect(result.removed.map((t) => t.name)).toEqual(['AcmeUpdater']);
    expect(result.failed).toEqual([{ name: 'AcmeSync', path: '\\', reason: expect.stringMatching(/administrator/i), cancelled: true }]);
  });

  it('does not ask for elevation when nothing was denied', async () => {
    const runElevated = vi.fn();
    await removeScheduledTasks({ programName: 'Acme', tasks, root, run: fakeRunner(), runElevated });
    expect(runElevated).not.toHaveBeenCalled();
  });

  it('reports a task that could not be removed with the reason, and keeps its backup', async () => {
    const run = fakeRunner({ AcmeSync: 'exported-not-removed' });
    const result = await removeScheduledTasks({ programName: 'Acme', tasks, root, run, runElevated: vi.fn() });
    expect(result.removed.map((t) => t.name)).toEqual(['AcmeUpdater']);
    expect(result.failed).toEqual([{ name: 'AcmeSync', path: '\\', reason: 'locked' }]);
  });

  it('writes no backup folder at all when nothing could be exported', async () => {
    const run = fakeRunner({ AcmeUpdater: 'missing', AcmeSync: 'missing' });
    const result = await removeScheduledTasks({ programName: 'Acme', tasks, root, run, runElevated: vi.fn() });
    expect(result.removed).toEqual([]);
    expect(result.backupDir).toBeNull();
    expect(readdirSync(root)).toEqual([]);
  });

  it('survives the script failing outright', async () => {
    const run = vi.fn(async () => { throw new Error('powershell died'); });
    const result = await removeScheduledTasks({ programName: 'Acme', tasks, root, run, runElevated: vi.fn() });
    expect(result.removed).toEqual([]);
    expect(result.failed.map((f) => f.reason)).toEqual(['powershell died', 'powershell died']);
  });

  it('does nothing for an empty list', async () => {
    const run = vi.fn();
    const result = await removeScheduledTasks({ programName: 'Acme', tasks: [], root, run, runElevated: vi.fn() });
    expect(run).not.toHaveBeenCalled();
    expect(result).toEqual({ removed: [], failed: [], backupDir: null, elevated: false });
  });
});

describe('buildTaskScript', () => {
  it('exports to the file and checks it before unregistering', () => {
    const script = buildTaskScript([{ name: 'A', path: '\\', file: 'C:\\b\\task-0.xml' }], 'remove');
    expect(script.indexOf('Export-ScheduledTask')).toBeGreaterThan(-1);
    expect(script.indexOf('Export-ScheduledTask')).toBeLessThan(script.indexOf('Unregister-ScheduledTask'));
    expect(script).toContain('-Confirm:$false');
  });

  it('carries the names as data, so an apostrophe or a quote cannot break out', () => {
    const script = buildTaskScript([{ name: "Bob's \"task\"", path: '\\', file: 'C:\\b\\t.xml' }], 'remove');
    expect(script).toContain("Bob''s");
    expect(script).toContain('ConvertFrom-Json');
  });

  it('parses as PowerShell (nothing is run)', async () => {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const file = join(root, 'parse.ps1');
    writeFileSync(file, buildTaskScript([{ name: "A'b", path: '\\X\\', file: 'C:\\b\\t.xml' }], 'remove'), 'utf8');
    writeFileSync(join(root, 'parse2.ps1'), buildTaskScript([{ name: 'A', path: '\\', file: 'C:\\b\\t.xml' }], 'restore'), 'utf8');
    for (const f of ['parse.ps1', 'parse2.ps1']) {
      const { stdout } = await promisify(execFile)('powershell', ['-NoProfile', '-NonInteractive', '-Command',
        `$e = $null; [System.Management.Automation.Language.Parser]::ParseFile('${join(root, f)}', [ref]$null, [ref]$e) | Out-Null; 'errors=' + @($e).Count`], { timeout: 30000 });
      expect(stdout.trim(), f).toBe('errors=0');
    }
  }, 60000);
});

describe('restoreScheduledTask', () => {
  it('re-registers a saved definition by its backup folder', async () => {
    const dir = join(root, '1-Acme');
    const { mkdirSync } = await import('node:fs');
    mkdirSync(dir);
    writeFileSync(join(dir, 'task-0.xml'), '<Task/>');
    writeFileSync(join(dir, 'backup.json'), JSON.stringify({ kind: 'scheduled-task', tasks: [{ name: 'A', path: '\\Acme\\', file: 'task-0.xml' }] }));
    const run = vi.fn(async (items) => items.map((i) => ({ name: i.name, path: i.path, restored: true })));
    const result = await restoreScheduledTask(dir, { run, runElevated: vi.fn() });
    expect(run.mock.calls[0][0]).toEqual([{ name: 'A', path: '\\Acme\\', file: join(dir, 'task-0.xml') }]);
    expect(result.restored).toEqual([{ name: 'A', path: '\\Acme\\' }]);
  });

  it('retries elevated when registering was denied', async () => {
    const dir = join(root, '2-Acme');
    const { mkdirSync } = await import('node:fs');
    mkdirSync(dir);
    writeFileSync(join(dir, 'task-0.xml'), '<Task/>');
    writeFileSync(join(dir, 'backup.json'), JSON.stringify({ kind: 'scheduled-task', tasks: [{ name: 'A', path: '\\', file: 'task-0.xml' }] }));
    const run = vi.fn(async (items) => items.map((i) => ({ name: i.name, path: i.path, restored: false, denied: true, error: 'Access is denied.' })));
    const runElevated = vi.fn(async (items) => items.map((i) => ({ name: i.name, path: i.path, restored: true })));
    const result = await restoreScheduledTask(dir, { run, runElevated });
    expect(runElevated).toHaveBeenCalledTimes(1);
    expect(result.restored).toHaveLength(1);
    expect(result.failed).toEqual([]);
  });

  it('refuses a backup folder that is not a task backup', async () => {
    const dir = join(root, '3-x');
    const { mkdirSync } = await import('node:fs');
    mkdirSync(dir);
    writeFileSync(join(dir, 'backup.json'), JSON.stringify({ kind: 'registry' }));
    await expect(restoreScheduledTask(dir, { run: vi.fn(), runElevated: vi.fn() })).rejects.toThrow(/scheduled task/i);
  });

  it('will not read a file outside its own folder, however the manifest names it', async () => {
    const dir = join(root, '4-evil');
    const { mkdirSync } = await import('node:fs');
    mkdirSync(dir);
    writeFileSync(join(dir, 'backup.json'), JSON.stringify({ kind: 'scheduled-task', tasks: [{ name: 'A', path: '\\', file: '..\\..\\secret.xml' }] }));
    const run = vi.fn(async (items) => items.map((i) => ({ name: i.name, path: i.path, restored: true })));
    const result = await restoreScheduledTask(dir, { run, runElevated: vi.fn() });
    expect(run).not.toHaveBeenCalled();
    expect(result.failed).toHaveLength(1);
  });
});

describe('taskBackupRoot', () => {
  it('sits beside the quarantine, under the same app-data folder', () => {
    process.env.UNREVO_QUARANTINE_ROOT = join(root, 'data', 'quarantine');
    try {
      expect(taskBackupRoot()).toBe(join(root, 'data', 'task-backups'));
    } finally {
      delete process.env.UNREVO_QUARANTINE_ROOT;
    }
  });
});
