import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as childProcess from 'node:child_process';
import { readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';

// execFile is promisified at module load, so it has to be mocked before
// elevated.js is imported. The mock stands in for the elevated
// child: the real one writes its JSON to the temp out.json path baked into
// the launcher string, so each test's fake does exactly that.
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, execFile: vi.fn() };
});

const { runElevatedPowerShellJson } = await import('./elevated.js');
const { writeFileSync } = await import('node:fs');

/** Pulls the out.json path back out of the launcher command the code
 * builds, so a fake "elevated" run can write there like the real one. */
function outPathFrom(command) {
  const match = command.match(/-File',\s*'([^']+)'/);
  return match ? match[1].replace(/query\.ps1$/, 'out.json') : null;
}

function mockElevatedRun(behaviour) {
  childProcess.execFile.mockImplementation((file, args, options, callback) => {
    const done = typeof options === 'function' ? options : callback;
    const command = args[args.length - 1];
    try {
      behaviour(outPathFrom(command));
      done(null, '', '');
    } catch (err) {
      done(err, '', '');
    }
  });
}

describe('runElevatedPowerShellJson', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('returns the parsed JSON the elevated script wrote to its temp file', async () => {
    mockElevatedRun((outPath) => {
      writeFileSync(outPath, JSON.stringify([{ deviceId: '0', wearPercent: 7 }]), 'utf8');
    });

    const result = await runElevatedPowerShellJson('echo hi');

    expect(result.ok).toBe(true);
    expect(result.data).toEqual([{ deviceId: '0', wearPercent: 7 }]);
  });

  it('reports a declined UAC prompt as cancelled, not as an error', async () => {
    childProcess.execFile.mockImplementation((file, args, options, callback) => {
      const done = typeof options === 'function' ? options : callback;
      done(new Error('The operation was canceled by the user.'), '', '');
    });

    const result = await runElevatedPowerShellJson('echo hi');

    // Declining elevation is an ordinary answer, not a failure to report
    // as one -- the UI says "not unlocked", never "something went wrong".
    expect(result).toEqual({ ok: false, cancelled: true });
  });

  it('treats a run that produced no output file as cancelled too', async () => {
    mockElevatedRun(() => { /* elevated child never wrote anything */ });

    const result = await runElevatedPowerShellJson('echo hi');

    expect(result).toEqual({ ok: false, cancelled: true });
  });

  it('surfaces an error the elevated script itself reported', async () => {
    mockElevatedRun((outPath) => {
      writeFileSync(outPath, JSON.stringify({ __error: 'Get-StorageReliabilityCounter exploded' }), 'utf8');
    });

    const result = await runElevatedPowerShellJson('echo hi');

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Get-StorageReliabilityCounter exploded');
  });

  it('reports non-JSON output as an error rather than throwing', async () => {
    mockElevatedRun((outPath) => { writeFileSync(outPath, 'not json at all', 'utf8'); });

    const result = await runElevatedPowerShellJson('echo hi');

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/non-JSON/i);
  });

  it('leaves no temp directory behind, on success or failure', async () => {
    const before = readdirSync(tmpdir()).filter((n) => n.startsWith('prune-elevated-')).length;

    mockElevatedRun((outPath) => { writeFileSync(outPath, '{"ok":1}', 'utf8'); });
    await runElevatedPowerShellJson('echo hi');

    childProcess.execFile.mockImplementation((file, args, options, callback) => {
      const done = typeof options === 'function' ? options : callback;
      done(new Error('boom'), '', '');
    });
    await runElevatedPowerShellJson('echo hi');

    const after = readdirSync(tmpdir()).filter((n) => n.startsWith('prune-elevated-')).length;
    expect(after).toBe(before);
  });
});
