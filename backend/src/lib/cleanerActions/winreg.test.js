import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scan, execute } from './winreg.js';

const execFileAsync = promisify(execFile);

// Unique per process, same reasoning quarantine.test.js's own TEST_KEY
// documents: a fixed name means two concurrent runs tear down each
// other's fixture. That covers only the shared-state half of the hazard --
// this file also drives real reg.exe, the same machine-wide tool
// quarantine.test.js's own comment warns about, and two suites racing it
// can still intermittently lose even with non-overlapping keys. Run one
// suite at a time; see CONTRIBUTING.md and quarantine.test.js's TEST_KEY
// comment.
const TEST_KEY_NAME = `prune-winreg-test-${process.pid}`;
const TEST_KEY = `HKCU\\Software\\${TEST_KEY_NAME}`;

let scratchDir;
beforeEach(async () => {
  scratchDir = await mkdtemp(join(tmpdir(), `prune-winreg-test-${process.pid}-`));
  process.env.UNREVO_QUARANTINE_ROOT = scratchDir;
  await execFileAsync('reg', ['add', TEST_KEY, '/v', 'Marker', '/d', 'test-value', '/f']);
});
afterEach(async () => {
  delete process.env.UNREVO_QUARANTINE_ROOT;
  await rm(scratchDir, { recursive: true, force: true });
  try { await execFileAsync('reg', ['delete', TEST_KEY, '/f']); } catch { /* already gone */ }
});

describe('winreg scan', () => {
  it('reports present:true for a key that exists', async () => {
    expect(await scan({ expandedKey: TEST_KEY })).toEqual({ present: true });
  });

  it('reports present:false for a key that does not exist', async () => {
    expect(await scan({ expandedKey: `${TEST_KEY}-does-not-exist` })).toEqual({ present: false });
  });
});

describe('winreg execute', () => {
  it('deletes a real key and reports registryKeysRemoved: 1', async () => {
    const result = await execute({ expandedKey: TEST_KEY }, 'Test Rule');

    expect(result.registryKeysRemoved).toBe(1);
    await expect(execFileAsync('reg', ['query', TEST_KEY])).rejects.toThrow();
  });

  it('is quarantined, not permanently gone -- the .reg backup exists in the batch', async () => {
    const result = await execute({ expandedKey: TEST_KEY }, 'Test Rule');

    expect(result.quarantineBatch).toBeTruthy();
    const files = await readdir(result.quarantineBatch);
    expect(files.some((f) => f.endsWith('.reg'))).toBe(true);
  });

  it('reports registryKeysRemoved: 0 for a key that is already absent, without erroring', async () => {
    const result = await execute({ expandedKey: `${TEST_KEY}-does-not-exist` }, 'Test Rule');
    expect(result.registryKeysRemoved).toBe(0);
    expect(result.freedBytes).toBe(0);
  });

  it('refuses a protected key, the same guard quarantine.js already enforces', async () => {
    // Depth under 3 segments is always protected -- see registryLeftovers.js's
    // isProtectedKey. 'HKCU\Software' alone is exactly that case.
    const result = await execute({ expandedKey: 'HKCU\\Software' }, 'Test Rule');
    expect(result.registryKeysRemoved).toBe(0);
  });
});
