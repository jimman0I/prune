import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { quarantineAndDelete, restoreQuarantine, deletePermanently, emptyQuarantine } from './quarantine.js';

const execFileAsync = promisify(execFile);
const TEST_KEY = 'HKCU\\Software\\unrevo-test';

let scratchDir;
beforeEach(async () => {
  scratchDir = await mkdtemp(join(tmpdir(), 'unrevo-quarantine-test-'));
  process.env.UNREVO_QUARANTINE_ROOT = scratchDir;
  await execFileAsync('reg', ['add', TEST_KEY, '/v', 'Marker', '/d', 'test-value', '/f']);
});

afterEach(async () => {
  delete process.env.UNREVO_QUARANTINE_ROOT;
  await rm(scratchDir, { recursive: true, force: true });
  try { await execFileAsync('reg', ['delete', TEST_KEY, '/f']); } catch { /* already gone */ }
});

describe('quarantineAndDelete', () => {
  it('moves listed files into a quarantine batch folder', async () => {
    const filePath = join(scratchDir, 'leftover.txt');
    await writeFile(filePath, 'leftover content', 'utf8');

    const manifest = await quarantineAndDelete({ programName: 'OldApp', files: [filePath], registryKeys: [] });

    expect(existsSync(filePath)).toBe(false); // moved, not just copied
    expect(manifest.files).toHaveLength(1);
    expect(existsSync(manifest.files[0].quarantinedPath)).toBe(true);
    const content = await readFile(manifest.files[0].quarantinedPath, 'utf8');
    expect(content).toBe('leftover content');
  });

  it('exports and deletes a real registry key, writing a restorable .reg file', async () => {
    const manifest = await quarantineAndDelete({ programName: 'OldApp', files: [], registryKeys: ['HKCU:\\Software\\unrevo-test'] });

    await expect(execFileAsync('reg', ['query', TEST_KEY])).rejects.toThrow();
    expect(manifest.registryKeys).toEqual(['HKCU:\\Software\\unrevo-test']);
    expect(manifest.regFiles).toHaveLength(1);
    // reg.exe writes .reg files as UTF-16LE, not UTF-8 — reading it as utf8
    // would produce mojibake and this assertion would silently never match.
    const regContent = await readFile(manifest.regFiles[0], 'utf16le');
    expect(regContent).toMatch(/unrevo-test/i);
    expect(manifest.failedRegistryKeys).toEqual([]);
  });

  // A key whose `reg export`/`reg delete` fails is skipped so one bad key
  // can't abort the batch -- but silently, which meant callers could only
  // tell by diffing their own request against the manifest, and none did.
  // A forced uninstall reporting a clean removal while the Add/Remove
  // Programs entry is still sitting there is the same class of lie as
  // reporting 0 bytes for a directory we couldn't read.
  it('records a registry key it could not remove instead of dropping it silently', async () => {
    const manifest = await quarantineAndDelete({
      programName: 'OldApp',
      files: [],
      registryKeys: ['HKCU:\\Software\\unrevo-test', 'HKCU:\\Software\\unrevo-does-not-exist']
    });

    expect(manifest.registryKeys).toEqual(['HKCU:\\Software\\unrevo-test']);
    expect(manifest.failedRegistryKeys).toEqual(['HKCU:\\Software\\unrevo-does-not-exist']);
  });

  it('skips a file that no longer exists rather than throwing', async () => {
    const manifest = await quarantineAndDelete({ programName: 'OldApp', files: [join(scratchDir, 'nope.txt')], registryKeys: [] });
    expect(manifest.files).toEqual([]);
  });

  it('records each moved file\'s real byte size and a correct totalSizeBytes', async () => {
    const a = join(scratchDir, 'a.txt');
    const b = join(scratchDir, 'b.txt');
    await writeFile(a, '12345'); // 5 bytes
    await writeFile(b, '1234567890'); // 10 bytes

    const manifest = await quarantineAndDelete({ programName: 'OldApp', files: [a, b], registryKeys: [] });

    const sizeFor = (originalPath) => manifest.files.find(f => f.originalPath === originalPath).sizeBytes;
    expect(sizeFor(a)).toBe(5);
    expect(sizeFor(b)).toBe(10);
    expect(manifest.totalSizeBytes).toBe(15);
  });
});

describe('restoreQuarantine', () => {
  it('moves a quarantined file back to its original path', async () => {
    const filePath = join(scratchDir, 'restore-me.txt');
    await writeFile(filePath, 'restore content', 'utf8');
    const manifest = await quarantineAndDelete({ programName: 'OldApp', files: [filePath], registryKeys: [] });

    await restoreQuarantine(manifest.batchDir);

    expect(existsSync(filePath)).toBe(true);
    expect(await readFile(filePath, 'utf8')).toBe('restore content');
  });

  it('removes the now-empty batch directory so a restored batch stops appearing as quarantined', async () => {
    const filePath = join(scratchDir, 'gone-after-restore.txt');
    await writeFile(filePath, 'x', 'utf8');
    const manifest = await quarantineAndDelete({ programName: 'OldApp', files: [filePath], registryKeys: [] });
    expect(existsSync(manifest.batchDir)).toBe(true); // sanity: it's really there first

    await restoreQuarantine(manifest.batchDir);

    expect(existsSync(manifest.batchDir)).toBe(false);
  });

  it('re-imports a quarantined registry key', async () => {
    const manifest = await quarantineAndDelete({ programName: 'OldApp', files: [], registryKeys: ['HKCU:\\Software\\unrevo-test'] });
    await expect(execFileAsync('reg', ['query', TEST_KEY])).rejects.toThrow();

    await restoreQuarantine(manifest.batchDir);

    const { stdout } = await execFileAsync('reg', ['query', TEST_KEY, '/v', 'Marker']);
    expect(stdout).toMatch(/test-value/);
  });
});

describe('deletePermanently', () => {
  it('really, permanently removes the whole batch directory from disk', async () => {
    const filePath = join(scratchDir, 'gone-forever.txt');
    await writeFile(filePath, '12345'); // 5 bytes
    const manifest = await quarantineAndDelete({ programName: 'OldApp', files: [filePath], registryKeys: [] });
    expect(existsSync(manifest.batchDir)).toBe(true); // sanity: it's really there first

    const result = await deletePermanently(manifest.batchDir);

    expect(result).toEqual({ deleted: true, freedBytes: 5 });
    expect(existsSync(manifest.batchDir)).toBe(false); // the batch dir itself is gone, not just emptied
  });

  it('handles an already-missing batch directory without throwing', async () => {
    const result = await deletePermanently(join(scratchDir, 'never-existed'));
    expect(result.deleted).toBe(false);
  });
});

describe('emptyQuarantine', () => {
  it('permanently removes every batch under quarantineRoot() and sums their sizes', async () => {
    const a = join(scratchDir, 'a.txt');
    const b = join(scratchDir, 'b.txt');
    await writeFile(a, '12345'); // 5 bytes
    await writeFile(b, '1234567890'); // 10 bytes
    const batch1 = await quarantineAndDelete({ programName: 'App1', files: [a], registryKeys: [] });
    const batch2 = await quarantineAndDelete({ programName: 'App2', files: [b], registryKeys: [] });

    const result = await emptyQuarantine();

    expect(result).toEqual({ deletedCount: 2, freedBytes: 15 });
    expect(existsSync(batch1.batchDir)).toBe(false);
    expect(existsSync(batch2.batchDir)).toBe(false);
  });

  it('returns zeros rather than throwing when quarantine is already empty', async () => {
    const result = await emptyQuarantine();
    expect(result).toEqual({ deletedCount: 0, freedBytes: 0 });
  });
});