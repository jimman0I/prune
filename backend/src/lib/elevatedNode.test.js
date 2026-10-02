import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as childProcess from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, execFile: vi.fn() };
});

const { runElevatedNodeJson, runNodeJson } = await import('./elevated.js');

/** The elevated launcher builds a .cmd shim that runs the worker; its text
 * is the one place the real argument list is visible to a test. */
function shimTextFrom(command) {
  const match = command.match(/-FilePath '([^']+)'/);
  return match ? readFileSync(match[1], 'utf8') : '';
}

/** Pulls the quoted arguments back out of the shim's node command line. */
function quotedArgs(shim) {
  return [...shim.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
}

describe('runElevatedNodeJson', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('writes the job to a file and hands the worker its path before the output path', async () => {
    let seenJob;
    let args;
    childProcess.execFile.mockImplementation((file, argv, options, callback) => {
      const done = typeof options === 'function' ? options : callback;
      args = quotedArgs(shimTextFrom(argv[argv.length - 1]));
      const [, , jobPath, outPath] = args; // [node, script, job, out]
      seenJob = JSON.parse(readFileSync(jobPath, 'utf8'));
      writeFileSync(outPath, JSON.stringify({ drives: [] }), 'utf8');
      done(null, '', '');
    });

    const result = await runElevatedNodeJson('worker.js', [], { input: { drives: ['C', 'D'], maxDepth: 4 } });

    expect(result).toEqual({ ok: true, data: { drives: [] } });
    expect(seenJob).toEqual({ drives: ['C', 'D'], maxDepth: 4 });
    expect(args[1]).toBe('worker.js');
    expect(args).toHaveLength(4);
  });

  it('removes the job and output files afterwards', async () => {
    let jobPath;
    childProcess.execFile.mockImplementation((file, argv, options, callback) => {
      const done = typeof options === 'function' ? options : callback;
      const args = quotedArgs(shimTextFrom(argv[argv.length - 1]));
      jobPath = args[2];
      writeFileSync(args[3], '{}', 'utf8');
      done(null, '', '');
    });
    await runElevatedNodeJson('worker.js', [], { input: { a: 1 } });
    expect(existsSync(jobPath)).toBe(false);
  });
});

describe('runNodeJson (already elevated, no prompt)', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  function mockRun(behaviour) {
    childProcess.execFile.mockImplementation((file, argv, options, callback) => {
      const done = typeof options === 'function' ? options : callback;
      try {
        behaviour({ file, argv, options });
        done(null, '', '');
      } catch (err) {
        done(err, '', err.stderr || '');
      }
    });
  }

  it('runs the worker directly with no PowerShell and no RunAs verb', async () => {
    let call;
    let job;
    mockRun(({ file, argv, options }) => {
      call = { file, argv, options };
      job = JSON.parse(readFileSync(argv[1], 'utf8'));
      writeFileSync(argv[argv.length - 1], JSON.stringify({ drives: [{ driveLetter: 'C' }] }), 'utf8');
    });

    const result = await runNodeJson('worker.js', [], { input: { drives: ['C'] } });

    expect(result).toEqual({ ok: true, data: { drives: [{ driveLetter: 'C' }] } });
    expect(call.file).toBe(process.execPath);
    expect(call.argv[0]).toBe('worker.js');
    expect(job).toEqual({ drives: ['C'] });
    expect(call.file).not.toMatch(/powershell/i);
    expect(call.argv.join(' ')).not.toMatch(/RunAs/);
    // Electron's own executable only behaves as plain Node with this set.
    expect(call.options.env.ELECTRON_RUN_AS_NODE).toBe('1');
  });

  it('reports the error the worker wrote even though it exited non-zero', async () => {
    childProcess.execFile.mockImplementation((file, argv, options, callback) => {
      const done = typeof options === 'function' ? options : callback;
      writeFileSync(argv[argv.length - 1], JSON.stringify({ __error: 'Access is denied' }), 'utf8');
      done(Object.assign(new Error('exit 1'), { code: 1 }), '', '');
    });
    expect(await runNodeJson('worker.js', [], {})).toEqual({ ok: false, error: 'Access is denied' });
  });

  it('reports a worker that crashed before writing anything as an error, not a cancel', async () => {
    childProcess.execFile.mockImplementation((file, argv, options, callback) => {
      const done = typeof options === 'function' ? options : callback;
      done(Object.assign(new Error('Command failed'), { code: 1 }), '', 'segfault');
    });
    const result = await runNodeJson('worker.js', [], {});
    expect(result.ok).toBe(false);
    expect(result.cancelled).toBeUndefined();
    expect(result.error).toMatch(/Command failed/);
  });

  it('treats a clean exit with no output file as an error, since nobody could have declined anything', async () => {
    mockRun(() => {});
    const result = await runNodeJson('worker.js', [], {});
    expect(result.ok).toBe(false);
    expect(result.cancelled).toBeUndefined();
  });
});
