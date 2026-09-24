import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scan, scanSync, execute, executeAll } from './winreg.js';

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

describe('winreg value targeting', () => {
  it('scan reports a single value present or absent', async () => {
    expect(await scan({ expandedKey: TEST_KEY, value: 'Marker' })).toEqual({ present: true });
    expect(await scan({ expandedKey: TEST_KEY, value: 'Nope' })).toEqual({ present: false });
    expect(await scan({ expandedKey: `${TEST_KEY}-missing`, value: 'Marker' })).toEqual({ present: false });
  });

  it('scanSync gives the same answers, plus key-only present/absent', () => {
    expect(scanSync({ expandedKey: TEST_KEY, value: 'Marker' })).toEqual({ present: true });
    expect(scanSync({ expandedKey: TEST_KEY, value: 'Nope' })).toEqual({ present: false });
    expect(scanSync({ expandedKey: `${TEST_KEY}-missing`, value: 'Marker' })).toEqual({ present: false });
    expect(scanSync({ expandedKey: TEST_KEY })).toEqual({ present: true });
    expect(scanSync({ expandedKey: `${TEST_KEY}-missing` })).toEqual({ present: false });
  });

  it('execute removes only the named value, quarantined', async () => {
    await execFileAsync('reg', ['add', TEST_KEY, '/v', 'Other', '/d', 'keep', '/f']);
    const result = await execute({ expandedKey: TEST_KEY, value: 'Marker' }, 'Test Rule');

    expect(result.registryKeysRemoved).toBe(1);
    await expect(execFileAsync('reg', ['query', TEST_KEY, '/v', 'Marker'])).rejects.toThrow();
    await expect(execFileAsync('reg', ['query', TEST_KEY, '/v', 'Other'])).resolves.toBeTruthy();
    const files = await readdir(result.quarantineBatch);
    expect(files.some((f) => f.endsWith('.reg'))).toBe(true);
  });
});

describe('winreg executeAll', () => {
  it('removes every present target through ONE quarantine batch', async () => {
    await execFileAsync('reg', ['add', `${TEST_KEY}\\A`, '/v', 'x', '/d', '1', '/f']);
    await execFileAsync('reg', ['add', `${TEST_KEY}\\B`, '/v', 'x', '/d', '1', '/f']);

    const result = await executeAll([
      { expandedKey: `${TEST_KEY}\\A` },
      { expandedKey: `${TEST_KEY}\\B` },
      { expandedKey: TEST_KEY, value: 'Marker' },
      { expandedKey: `${TEST_KEY}\\Missing` }
    ], 'Test Rule');

    expect(result.registryKeysRemoved).toBe(3);
    const batches = await readdir(scratchDir);
    expect(batches).toHaveLength(1);
    const manifest = JSON.parse(await readFile(join(result.quarantineBatch, 'manifest.json'), 'utf8'));
    expect(manifest.registryKeys).toHaveLength(3);
  });

  it('reports zero and creates no batch when nothing is present', async () => {
    const result = await executeAll([{ expandedKey: `${TEST_KEY}\\Missing` }, { expandedKey: TEST_KEY, value: 'Nope' }], 'Test Rule');
    expect(result).toEqual({ freedBytes: 0, registryKeysRemoved: 0, skipped: [] });
    expect(await readdir(scratchDir)).toHaveLength(0);
  });
});

describe('winreg executeAll overlapping targets', () => {
  const add = (key) => execFileAsync('reg', ['add', key, '/v', 'x', '/d', '1', '/f']);

  // A whole-key parent's export already contains its child, and deleting
  // the parent first makes the child's own export fail -- which would be
  // misreported as "protected or could not be removed". So descendants of
  // a whole-key target are dropped, whatever the order. A dropped
  // descendant is NOT counted: registryKeysRemoved is what
  // quarantineAndDelete recorded, nothing more.
  it('parent then child whole keys -> one removal, nothing skipped', async () => {
    await add(`${TEST_KEY}\\A`); await add(`${TEST_KEY}\\A\\B`);
    const result = await executeAll([{ expandedKey: `${TEST_KEY}\\A` }, { expandedKey: `${TEST_KEY}\\A\\B` }], 'Test Rule');
    expect(result.registryKeysRemoved).toBe(1);
    expect(result.skipped).toEqual([]);
  });

  it('child then parent whole keys -> one removal, nothing skipped', async () => {
    await add(`${TEST_KEY}\\A`); await add(`${TEST_KEY}\\A\\B`);
    const result = await executeAll([{ expandedKey: `${TEST_KEY}\\A\\B` }, { expandedKey: `${TEST_KEY}\\A` }], 'Test Rule');
    expect(result.registryKeysRemoved).toBe(1);
    expect(result.skipped).toEqual([]);
  });

  it('a target listed twice (any case) is removed once', async () => {
    const result = await executeAll([{ expandedKey: TEST_KEY }, { expandedKey: TEST_KEY.toUpperCase() }], 'Test Rule');
    expect(result.registryKeysRemoved).toBe(1);
    expect(result.skipped).toEqual([]);
  });

  it('a value under a subkey of a whole-key target is dropped too', async () => {
    await add(`${TEST_KEY}\\A`); await add(`${TEST_KEY}\\A\\B`);
    const result = await executeAll([{ expandedKey: `${TEST_KEY}\\A\\B`, value: 'x' }, { expandedKey: `${TEST_KEY}\\A` }], 'Test Rule');
    expect(result.registryKeysRemoved).toBe(1);
    expect(result.skipped).toEqual([]);
  });

  it('a value in a key that is not itself a whole-key target is kept', async () => {
    await add(`${TEST_KEY}\\A`);
    const result = await executeAll([{ expandedKey: `${TEST_KEY}\\A`, value: 'x' }], 'Test Rule');
    expect(result.registryKeysRemoved).toBe(1);
  });

  it('a protected target (depth 2, not an ancestor of the scratch key) lands in skipped with its path while a real key is still removed', async () => {
    await add(`${TEST_KEY}\\A`);
    const result = await executeAll([{ expandedKey: 'HKCU\\Environment' }, { expandedKey: `${TEST_KEY}\\A` }], 'Test Rule');
    expect(result.registryKeysRemoved).toBe(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].path).toBe('HKCU\\Environment');
  });
});
