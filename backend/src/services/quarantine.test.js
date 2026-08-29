import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { quarantineAndDelete, restoreQuarantine } from './quarantine.js';

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
  });

  it('skips a file that no longer exists rather than throwing', async () => {
    const manifest = await quarantineAndDelete({ programName: 'OldApp', files: [join(scratchDir, 'nope.txt')], registryKeys: [] });
    expect(manifest.files).toEqual([]);
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

  it('re-imports a quarantined registry key', async () => {
    const manifest = await quarantineAndDelete({ programName: 'OldApp', files: [], registryKeys: ['HKCU:\\Software\\unrevo-test'] });
    await expect(execFileAsync('reg', ['query', TEST_KEY])).rejects.toThrow();

    await restoreQuarantine(manifest.batchDir);

    const { stdout } = await execFileAsync('reg', ['query', TEST_KEY, '/v', 'Marker']);
    expect(stdout).toMatch(/test-value/);
  });
});