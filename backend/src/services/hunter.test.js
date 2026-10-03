import { describe, it, expect, vi } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validatePoint, buildPointScript, huntAtPoint, describeHunt, endHuntedProcess, COORD_LIMIT } from './hunter.js';

/** Hunter asks Windows one question -- "which window is at this point?" --
 * about a point Electron chose. The crosshair cannot be dragged from here, so
 * what is checked is everything around the drop: that the point is validated
 * and bounded, that the script is valid PowerShell, that it uses only the
 * window-lookup calls it is meant to, and what is done with its answer. */

describe('validatePoint', () => {
  it('accepts integers, including the negative coordinates of a monitor left of the main one', () => {
    expect(validatePoint({ x: 100, y: 200 })).toEqual({ x: 100, y: 200 });
    expect(validatePoint({ x: -1920, y: -40 })).toEqual({ x: -1920, y: -40 });
    expect(validatePoint({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('refuses anything that is not a whole number in range', () => {
    for (const bad of [
      null, undefined, 5, 'x', [],
      { x: 1 }, { y: 1 }, { x: '1', y: 2 }, { x: 1.5, y: 2 }, { x: NaN, y: 0 }, { x: Infinity, y: 0 },
      { x: COORD_LIMIT + 1, y: 0 }, { x: 0, y: -COORD_LIMIT - 1 }, { x: {}, y: 1 }, { x: '1; calc', y: 1 }
    ]) {
      expect(validatePoint(bad), JSON.stringify(bad)).toBeNull();
    }
  });
});

describe('buildPointScript', () => {
  it('asks only the window-lookup questions, for the fixed point', () => {
    const script = buildPointScript({ x: 640, y: -12 });
    for (const api of ['WindowFromPoint', 'GetAncestor', 'GetWindowThreadProcessId', 'Add-Type']) {
      expect(script, api).toContain(api);
    }
    expect(script).toContain('$point.X = 640');
    expect(script).toContain('$point.Y = -12');
  });

  it('polls nothing and watches no keys: no loop, no timer, no key state, no form', () => {
    const script = buildPointScript({ x: 1, y: 2 });
    expect(script).not.toMatch(/GetAsyncKeyState|GetCursorPos|GetKeyState|SetWindowsHookEx|Start-Sleep|Timer|ShowDialog|Windows\.Forms|\bwhile\b/i);
  });

  it('declares exactly the user32 calls it needs', () => {
    const imports = [...buildPointScript({ x: 1, y: 2 }).matchAll(/static extern \S+ (\w+)\(/g)].map((m) => m[1]).sort();
    expect(imports).toEqual(['GetAncestor', 'GetClassName', 'GetWindowThreadProcessId', 'SetThreadDpiAwarenessContext', 'WindowFromPoint']);
  });

  it('treats the desktop and the taskbar as "nothing identifiable"', () => {
    const script = buildPointScript({ x: 1, y: 2 });
    for (const cls of ['Progman', 'WorkerW', 'Shell_TrayWnd', 'Shell_SecondaryTrayWnd']) expect(script).toContain(cls);
    expect(script).toContain("status = 'nothing'");
  });

  it('answers unreadable when Windows will not describe the process', () => {
    expect(buildPointScript({ x: 1, y: 2 })).toContain("status = 'unreadable'");
  });

  it('refuses a point that is not a whole number instead of building a script around it', () => {
    expect(() => buildPointScript({ x: '1; calc', y: 2 })).toThrow(/point/i);
    expect(() => buildPointScript(null)).toThrow(/point/i);
  });

  it('parses as PowerShell (nothing is run)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'prune-hunter-'));
    try {
      const file = join(dir, 'hunter.ps1');
      writeFileSync(file, buildPointScript({ x: -300, y: 450 }), 'utf8');
      const { stdout } = await promisify(execFile)('powershell', ['-NoProfile', '-NonInteractive', '-Command',
        `$s = Get-Content -Raw -LiteralPath '${file}'; $null = [scriptblock]::Create($s); 'ok'`], { timeout: 30000 });
      expect(stdout.trim()).toBe('ok');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 40000);
});

describe('huntAtPoint', () => {
  it('runs the script for that point and resolves the parsed answer', async () => {
    const run = vi.fn(async () => '{"status":"picked","pid":42,"exePath":"C:\\\\a.exe","name":"a.exe","title":"A"}');
    expect(await huntAtPoint({ x: 10, y: 20 }, { run })).toMatchObject({ status: 'picked', pid: 42, exePath: 'C:\\a.exe' });
    expect(run.mock.calls[0][0]).toContain('$point.X = 10');
  });

  it('rejects a bad point without running anything', async () => {
    const run = vi.fn();
    await expect(huntAtPoint({ x: 'a', y: 1 }, { run })).rejects.toThrow(/point/i);
    expect(run).not.toHaveBeenCalled();
  });

  it('passes nothing-there and unreadable through', async () => {
    expect(await huntAtPoint({ x: 1, y: 1 }, { run: async () => '{"status":"nothing"}' })).toEqual({ status: 'nothing' });
    expect(await huntAtPoint({ x: 1, y: 1 }, { run: async () => '{"status":"unreadable","pid":7,"name":"x.exe"}' }))
      .toEqual({ status: 'unreadable', pid: 7, name: 'x.exe' });
  });

  it('is a failure, not an exception, when the script prints nonsense', async () => {
    expect(await huntAtPoint({ x: 1, y: 1 }, { run: async () => 'garbage' })).toEqual({ status: 'failed' });
  });

  it('is a failure when PowerShell itself could not run', async () => {
    const result = await huntAtPoint({ x: 1, y: 1 }, { run: async () => { throw new Error('spawn powershell.exe ENOENT'); } });
    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/ENOENT/);
  });
});

describe('describeHunt', () => {
  it('adds the matching program, startup entries and whether it can be ended', () => {
    const picked = { status: 'picked', pid: 4321, exePath: 'D:\\Apps\\Thing\\thing.exe', name: 'thing.exe', title: 'Thing' };
    const described = describeHunt(picked, {
      programs: [{ id: 't', name: 'Thing', installLocation: 'D:\\Apps\\Thing' }],
      startupItems: [{ id: 's', name: 'Thing', executable: 'D:\\Apps\\Thing\\thing.exe', enabled: true }]
    });
    expect(described.program.id).toBe('t');
    expect(described.startupItems).toHaveLength(1);
    expect(described.endRefusal).toBeNull();
  });

  it('says it is Prune when the window was Prune\'s own', () => {
    const described = describeHunt(
      { status: 'picked', pid: process.pid, exePath: 'C:\\Users\\me\\AppData\\Local\\Programs\\Prune\\Prune.exe', name: 'Prune.exe', title: 'Prune' },
      { programs: [], startupItems: [] }
    );
    expect(described.endRefusal).toBe('That is Prune itself.');
  });

  it('passes every other outcome through untouched', () => {
    expect(describeHunt({ status: 'nothing' }, {})).toEqual({ status: 'nothing' });
    expect(describeHunt({ status: 'unreadable', pid: 3, name: null }, {})).toEqual({ status: 'unreadable', pid: 3, name: null });
    expect(describeHunt({ status: 'failed' }, {})).toEqual({ status: 'failed' });
  });
});

describe('endHuntedProcess', () => {
  const self = { pid: 1, ppid: 2, execPath: 'C:\\Prune\\Prune.exe' };

  it('ends a process that is still the same program', async () => {
    const kill = vi.fn(async () => {});
    const result = await endHuntedProcess({ pid: 4321, exePath: 'D:\\Apps\\thing.exe' }, { lookup: async () => 'd:\\apps\\THING.exe', kill, self });
    expect(result).toEqual({ ok: true });
    expect(kill).toHaveBeenCalledWith(4321);
  });

  it('will not end a process whose pid now belongs to another program', async () => {
    const kill = vi.fn();
    const result = await endHuntedProcess({ pid: 4321, exePath: 'D:\\Apps\\thing.exe' }, { lookup: async () => 'D:\\Other\\other.exe', kill, self });
    expect(result.ok).toBe(false);
    expect(kill).not.toHaveBeenCalled();
  });

  it('says so when the process has already gone', async () => {
    const result = await endHuntedProcess({ pid: 4321, exePath: 'D:\\a.exe' }, { lookup: async () => null, kill: vi.fn(), self });
    expect(result).toEqual({ ok: false, error: 'That process is no longer running.' });
  });

  it('refuses Prune and Windows without looking anything up', async () => {
    const lookup = vi.fn();
    expect((await endHuntedProcess({ pid: 1, exePath: 'D:\\a.exe' }, { lookup, kill: vi.fn(), self })).ok).toBe(false);
    expect((await endHuntedProcess({ pid: 99, exePath: 'C:\\Windows\\System32\\svchost.exe' }, { lookup, kill: vi.fn(), self })).ok).toBe(false);
    expect(lookup).not.toHaveBeenCalled();
  });

  it('reports a refusal from Windows', async () => {
    const result = await endHuntedProcess({ pid: 4321, exePath: 'D:\\a.exe' }, { lookup: async () => 'D:\\a.exe', kill: async () => { throw new Error('Access is denied.'); }, self });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Access is denied/);
  });
});
