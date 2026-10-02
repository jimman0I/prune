import { describe, it, expect, vi } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildHunterScript, startHunt, cancelHunt, describeHunt, endHuntedProcess, HUNT_SECONDS } from './hunter.js';

/** The script cannot be clicked from here, so what is checked is everything
 * around the click: that it is valid PowerShell, that it uses the window
 * APIs it is meant to, that it is time-limited, and what is done with its
 * answer. */

describe('buildHunterScript', () => {
  it('uses the window APIs the hunt is built on', () => {
    const script = buildHunterScript();
    for (const api of ['GetCursorPos', 'WindowFromPoint', 'GetAncestor', 'GetWindowThreadProcessId', 'GetAsyncKeyState', 'Add-Type']) {
      expect(script, api).toContain(api);
    }
  });

  it('is time-limited to about thirty seconds, and cancellable with Esc', () => {
    expect(HUNT_SECONDS).toBe(30);
    expect(buildHunterScript()).toContain('AddSeconds(30)');
    expect(buildHunterScript({ timeoutSec: 5 })).toContain('AddSeconds(5)');
    expect(buildHunterScript()).toContain('0x1B');
  });

  it('restores Prune\'s window whatever happens, and only for real process ids', () => {
    const script = buildHunterScript({ selfPids: [1234, 5678, -1, 'x', 0, 2] });
    expect(script).toContain('@(1234,5678)');
    expect(script).toMatch(/finally \{[^}]*ShowWindow\(\$handle, 9\)/);
  });

  it('only counts a press that lands on the overlay, not a click already in progress', () => {
    const script = buildHunterScript();
    expect(script).toContain('Add_MouseDown');
    expect(script).toContain('if (-not $state.down) { return }');
  });

  it('keeps the timeout within sane bounds', () => {
    expect(buildHunterScript({ timeoutSec: 100000 })).toContain('AddSeconds(120)');
    expect(buildHunterScript({ timeoutSec: 0 })).toContain('AddSeconds(1)');
    expect(buildHunterScript({ timeoutSec: 'abc' })).toContain('AddSeconds(30)');
  });

  it('parses as PowerShell (nothing is run)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'prune-hunter-'));
    try {
      const file = join(dir, 'hunter.ps1');
      writeFileSync(file, buildHunterScript({ selfPids: [1234] }), 'utf8');
      const { stdout } = await promisify(execFile)('powershell', ['-NoProfile', '-NonInteractive', '-Command',
        `$e = $null; [System.Management.Automation.Language.Parser]::ParseFile('${file}', [ref]$null, [ref]$e) | Out-Null; 'errors=' + @($e).Count`], { timeout: 30000 });
      expect(stdout.trim()).toBe('errors=0');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 40000);
});

describe('startHunt', () => {
  it('resolves the parsed result of the script', async () => {
    const run = vi.fn(async () => '{"status":"picked","pid":42,"exePath":"C:\\\\a.exe","name":"a.exe","title":"A"}');
    expect(await startHunt({ run })).toMatchObject({ status: 'picked', pid: 42, exePath: 'C:\\a.exe' });
    expect(run.mock.calls[0][0]).toContain('PruneHunter');
  });

  it('allows one hunt at a time, and another afterwards', async () => {
    let release;
    const first = startHunt({ run: () => new Promise((resolve) => { release = () => resolve('{"status":"timeout"}'); }) });
    await expect(startHunt({ run: async () => '{}' })).rejects.toThrow(/already running/);
    release();
    expect(await first).toEqual({ status: 'timeout' });
    expect(await startHunt({ run: async () => '{"status":"cancelled"}' })).toEqual({ status: 'cancelled' });
  });

  it('is a failure, not an exception, when the script prints nonsense', async () => {
    expect(await startHunt({ run: async () => 'garbage' })).toEqual({ status: 'failed' });
  });

  it('cancelHunt says whether there was one to cancel', () => {
    expect(cancelHunt()).toBe(false);
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

  it('passes a cancelled or timed-out hunt through untouched', () => {
    expect(describeHunt({ status: 'timeout' }, {})).toEqual({ status: 'timeout' });
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
