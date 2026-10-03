import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runWorker } from './mftWorkerRun.js';
import { readDriveLines } from './driveOutput.js';
import { buildLazyFakeVolume } from './fakeVolume.js';
import { readOutput } from '../elevated.js';
import { SCAN_TOO_LARGE, SCAN_TOO_LARGE_MESSAGE, classifyScanError } from '../scanErrors.js';

let dir;
afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }); dir = null; });

/** A volume of one big folder (so something is folded) and a small one. */
function volume(fileCount) {
  const total = 20 + fileCount;
  return buildLazyFakeVolume({
    recordCount: total,
    entryFor(n) {
      if (n === 16) return { name: 'Big', parent: 5, isDirectory: true, size: 0 };
      if (n === 17) return { name: 'Small', parent: 5, isDirectory: true, size: 0 };
      if (n === 18) return { name: 'tiny.txt', parent: 17, size: 5 };
      if (n >= 20) return { name: `f${n}.dat`, parent: 16, size: n, modified: 1.7e12 };
      return null;
    }
  });
}

function run(job, openVolume) {
  dir = mkdtempSync(join(tmpdir(), 'prune-worker-test-'));
  const jobPath = join(dir, 'job.json');
  const outPath = join(dir, 'out.json');
  writeFileSync(jobPath, JSON.stringify(job));
  const exit = runWorker([jobPath, outPath], { openVolume });
  return { exit, outPath };
}

describe('runWorker', () => {
  it('writes a header line then the tree line for each drive, never one big document', () => {
    const v = volume(400);
    const { exit, outPath } = run({ drives: ['C', 'D'], maxDepth: 12 }, () => ({ readAt: v.readAt, close() {} }));
    expect(exit).toBe(0);

    const lines = readFileSync(outPath, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(4);
    expect(JSON.parse(lines[0])).toMatchObject({ driveLetter: 'C', hasTree: true });
    expect(JSON.parse(lines[0]).stats.foldedFiles).toBeGreaterThan(0);
    expect(JSON.parse(lines[1]).name).toBe('C:');
    expect(JSON.parse(lines[2]).driveLetter).toBe('D');
  });

  it('is read back through the real reader: the tree arrives as bytes, parseable on demand', () => {
    const v = volume(400);
    const { outPath } = run({ drives: ['C'] }, () => ({ readAt: v.readAt, close() {} }));

    const read = readOutput(outPath, { lines: true, who: 'The helper' });
    expect(read.ok).toBe(true);
    const raw = readDriveLines(read.lines);
    expect(Buffer.isBuffer(raw.drives[0].treeJson)).toBe(true);

    const parsed = readDriveLines(read.lines, { parseTrees: true }).drives[0];
    const big = parsed.tree.children.find((c) => c.name === 'Big');
    const expected = Array.from({ length: 400 }, (_, i) => 20 + i).reduce((a, b) => a + b, 0);
    expect(big.size).toBe(expected);
    expect(big.children.reduce((s, c) => s + c.size, 0) + big.folded.size).toBe(expected);
    expect(parsed.tree.size).toBe(expected + 5);
  });

  it('keeps a drive that failed on its own line and the good one beside it', () => {
    const v = volume(30);
    const { exit, outPath } = run({ drives: ['C', 'E'] }, (letter) => {
      if (letter === 'E') throw new Error('Not an NTFS volume');
      return { readAt: v.readAt, close() {} };
    });
    expect(exit).toBe(0);
    const out = readDriveLines(readOutput(outPath, { lines: true, who: 'x' }).lines);
    expect(out.drives[0].driveLetter).toBe('C');
    expect(out.drives[1]).toEqual({ driveLetter: 'E', error: 'Not an NTFS volume' });
  });

  it('turns a drive that outgrew a limit into a plain sentence and a code, not "Invalid string length"', () => {
    const { exit, outPath } = run({ drives: ['C'] }, () => { throw new RangeError('Invalid string length'); });
    expect(exit).toBe(0);
    const out = readDriveLines(readOutput(outPath, { lines: true, who: 'x' }).lines);
    expect(out.drives[0]).toEqual({ driveLetter: 'C', error: SCAN_TOO_LARGE_MESSAGE, code: SCAN_TOO_LARGE });
  });

  it('writes a failure line when the job itself is unusable, and exits non-zero', () => {
    const { exit, outPath } = run({ drives: [] }, () => { throw new Error('unreachable'); });
    expect(exit).toBe(1);
    expect(readOutput(outPath, { lines: true, who: 'The helper' })).toEqual({ ok: false, error: 'No drive letter was given.' });
  });

  it('leaves no file at all when it dies before it has anything to say', () => {
    dir = mkdtempSync(join(tmpdir(), 'prune-worker-test-'));
    const outPath = join(dir, 'out.json');
    // A job file that does not exist: the failure line is the first write.
    const exit = runWorker([join(dir, 'missing.json'), outPath], { openVolume: () => { throw new Error('no'); } });
    expect(exit).toBe(1);
    expect(existsSync(outPath)).toBe(true);
    expect(readFileSync(outPath, 'utf8')).toMatch(/__error/);
  });
});

describe('scan error classification', () => {
  it('recognises the ways a result outgrows a limit', () => {
    expect(classifyScanError(new RangeError('Invalid string length'))).toBe(SCAN_TOO_LARGE);
    expect(classifyScanError(new RangeError('anything'))).toBe(SCAN_TOO_LARGE);
    expect(classifyScanError('FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory')).toBe(SCAN_TOO_LARGE);
    expect(classifyScanError(new Error('Array buffer allocation failed'))).toBe(SCAN_TOO_LARGE);
  });

  it('leaves every other failure alone', () => {
    expect(classifyScanError(new Error('Access is denied'))).toBeNull();
    expect(classifyScanError('')).toBeNull();
    expect(classifyScanError(undefined)).toBeNull();
  });
});

describe('readOutput', () => {
  it('reads the one-document form other helpers write', () => {
    dir = mkdtempSync(join(tmpdir(), 'prune-worker-test-'));
    const p = join(dir, 'o.json');
    writeFileSync(p, JSON.stringify({ a: 1 }));
    expect(readOutput(p, { lines: false, who: 'The helper' })).toEqual({ ok: true, data: { a: 1 } });
  });

  it('reports an empty file as nothing returned, and a failure document as its error with its code', () => {
    dir = mkdtempSync(join(tmpdir(), 'prune-worker-test-'));
    const p = join(dir, 'o.json');
    writeFileSync(p, '  \n');
    expect(readOutput(p, { lines: false, who: 'The helper' })).toEqual({ ok: false, error: 'The helper returned nothing.' });
    writeFileSync(p, JSON.stringify({ __error: 'boom', __code: 'crashed' }));
    expect(readOutput(p, { lines: false, who: 'The helper' })).toEqual({ ok: false, error: 'boom', code: 'crashed' });
  });
});
