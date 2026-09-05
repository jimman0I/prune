import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { quarantinePath } from './quarantinePath.js';
import { listQuarantineBatches, restoreQuarantine } from './quarantine.js';

/** Real files, real moves, real restores.
 *
 * This is the one removal in the app that acts on whatever the user
 * right-clicked rather than on a curated target, so "it is reversible"
 * has to be demonstrated rather than asserted. */
let root;
let work;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'prune-qpath-root-'));
  work = await mkdtemp(join(tmpdir(), 'prune-qpath-work-'));
  process.env.UNREVO_QUARANTINE_ROOT = root;
});
afterEach(async () => {
  delete process.env.UNREVO_QUARANTINE_ROOT;
  await rm(root, { recursive: true, force: true });
  await rm(work, { recursive: true, force: true });
});

describe('quarantinePath', () => {
  it('moves a folder out of the way and can put it back', async () => {
    const target = join(work, 'ShaderCache');
    await mkdir(join(target, 'nested'), { recursive: true });
    await writeFile(join(target, 'a.dat'), 'aaa', 'utf8');
    await writeFile(join(target, 'nested', 'b.dat'), 'bbb', 'utf8');

    const result = await quarantinePath({ path: target, reportedSizeBytes: 6 });
    expect(result.ok).toBe(true);
    expect(existsSync(target)).toBe(false);

    // It shows up in the same list the Quarantine screen reads.
    const batches = await listQuarantineBatches();
    expect(batches).toHaveLength(1);
    expect(batches[0].programName).toBe('ShaderCache');
    expect(batches[0].isDirectory).toBe(true);

    // And the undo actually works, contents and all.
    await restoreQuarantine(batches[0].batchDir);
    expect(existsSync(join(target, 'a.dat'))).toBe(true);
    expect(existsSync(join(target, 'nested', 'b.dat'))).toBe(true);
    expect(await readFile(join(target, 'nested', 'b.dat'), 'utf8')).toBe('bbb');
  }, 30000);

  it('moves a single file too', async () => {
    const target = join(work, 'big.iso');
    await writeFile(target, 'x'.repeat(64), 'utf8');

    const result = await quarantinePath({ path: target, reportedSizeBytes: 64 });
    expect(result.ok).toBe(true);
    expect(result.batch.isDirectory).toBe(false);
    expect(existsSync(target)).toBe(false);
  }, 30000);

  it('refuses a protected path and says why, without creating a batch', async () => {
    const result = await quarantinePath({ path: 'C:\\Windows\\System32' });
    expect(result.ok).toBe(false);
    expect(result.protected).toBe(true);
    expect(result.error).toMatch(/Windows/i);
    // Nothing half-done: no empty batch folder left behind.
    expect(await listQuarantineBatches()).toEqual([]);
  }, 30000);

  it('refuses the quarantine folder itself', async () => {
    const result = await quarantinePath({ path: root });
    expect(result.ok).toBe(false);
    expect(result.protected).toBe(true);
  }, 30000);

  it('says so when the path is already gone', async () => {
    const result = await quarantinePath({ path: join(work, 'never-existed') });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no longer/i);
  }, 30000);

  it('records a reported size as reported rather than as measured', async () => {
    // The manifest must never claim to have measured something it took
    // on trust from the caller.
    const target = join(work, 'Cache');
    await mkdir(target, { recursive: true });
    await quarantinePath({ path: target, reportedSizeBytes: 42 });

    const [batch] = await listQuarantineBatches();
    expect(batch.files[0].sizeBytes).toBe(42);
    expect(batch.files[0].sizeReported).toBe(true);
  }, 30000);

  it('leaves the size null when nothing was reported', async () => {
    const target = join(work, 'Unknown');
    await mkdir(target, { recursive: true });
    await quarantinePath({ path: target });

    const [batch] = await listQuarantineBatches();
    expect(batch.files[0].sizeBytes).toBeNull();
    expect(batch.files[0].sizeReported).toBe(false);
  }, 30000);
});
