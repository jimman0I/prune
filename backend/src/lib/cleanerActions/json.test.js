import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scan, execute } from './json.js';

let scratchDir;
let savedEnv;
beforeEach(async () => {
  scratchDir = await mkdtemp(join(tmpdir(), 'prune-json-action-test-'));
  savedEnv = process.env.UNREVO_QUARANTINE_ROOT;
  process.env.UNREVO_QUARANTINE_ROOT = await mkdtemp(join(tmpdir(), 'prune-json-action-qroot-'));
});
afterEach(async () => {
  await rm(scratchDir, { recursive: true, force: true });
  await rm(process.env.UNREVO_QUARANTINE_ROOT, { recursive: true, force: true });
  if (savedEnv === undefined) delete process.env.UNREVO_QUARANTINE_ROOT;
  else process.env.UNREVO_QUARANTINE_ROOT = savedEnv;
});

describe('json scan', () => {
  it('reports present:true when the address genuinely resolves', async () => {
    const filePath = join(scratchDir, 'Preferences');
    await writeFile(filePath, JSON.stringify({ dns_prefetching: { host_referral_list: ['a'] } }));

    const result = scan({ expandedPath: filePath, address: 'dns_prefetching/host_referral_list' });

    expect(result.present).toBe(true);
    expect(result.sizeBytes).toBeGreaterThan(0);
  });

  it('reports present:false when the address does not resolve', async () => {
    const filePath = join(scratchDir, 'Preferences');
    await writeFile(filePath, JSON.stringify({ dns_prefetching: {} }));

    const result = scan({ expandedPath: filePath, address: 'dns_prefetching/host_referral_list' });

    expect(result.present).toBe(false);
  });

  it('reports present:false for a file that does not exist, sizeBytes 0', () => {
    const result = scan({ expandedPath: join(scratchDir, 'nope.json'), address: 'x' });
    expect(result.present).toBe(false);
    expect(result.sizeBytes).toBe(0);
  });

  it('reports present:false (not a throw) for a file that is not valid JSON', async () => {
    const filePath = join(scratchDir, 'Preferences');
    await writeFile(filePath, 'not json at all');

    expect(() => scan({ expandedPath: filePath, address: 'x' })).not.toThrow();
    expect(scan({ expandedPath: filePath, address: 'x' }).present).toBe(false);
  });
});

describe('json scan/execute agreement on a malformed rule', () => {
  it('both throw the same clear error for a rule missing address, rather than scan silently reporting present:false', async () => {
    const filePath = join(scratchDir, 'Preferences');
    await writeFile(filePath, JSON.stringify({ sync: {} }));

    expect(() => scan({ expandedPath: filePath })).toThrow(`json action for ${filePath} is missing 'address'`);
    await expect(execute({ expandedPath: filePath }, 'Test Rule')).rejects.toThrow(
      `json action for ${filePath} is missing 'address'`
    );
  });
});

describe('json execute', () => {
  it('removes the real key, quarantines the original, and reports a real byte delta', async () => {
    const filePath = join(scratchDir, 'Preferences');
    await writeFile(filePath, JSON.stringify({
      dns_prefetching: { host_referral_list: Array.from({ length: 200 }, (_, i) => `host${i}.example.com`) },
      keep_this: true
    }));
    const before = (await readFile(filePath, 'utf8')).length;

    const result = await execute(
      { expandedPath: filePath, address: 'dns_prefetching/host_referral_list' },
      'Test Rule'
    );

    const after = JSON.parse(await readFile(filePath, 'utf8'));
    expect(after.dns_prefetching.host_referral_list).toBeUndefined();
    expect(after.keep_this).toBe(true); // untouched sibling data survives

    expect(result.freedBytes).toBeGreaterThan(0);
    expect(result.freedBytes).toBeLessThanOrEqual(before);
    expect(result.quarantineBatch).toBeTruthy();
    expect(result.skipped).toEqual([]);
  });

  it('the original content is recoverable from the reported quarantine batch', async () => {
    const filePath = join(scratchDir, 'Preferences');
    const originalContent = JSON.stringify({ sync: { enabled: true } });
    await writeFile(filePath, originalContent);

    const result = await execute({ expandedPath: filePath, address: 'sync' }, 'Test Rule');

    const { readdir, readFile: rf } = await import('node:fs/promises');
    const batchFiles = await readdir(result.quarantineBatch);
    const quarantinedFile = batchFiles.find((f) => f.startsWith('file-0-'));
    expect(quarantinedFile).toBeTruthy();
    expect(await rf(join(result.quarantineBatch, quarantinedFile), 'utf8')).toBe(originalContent);
  });

  it('reports 0 freedBytes and no error for a file that does not exist', async () => {
    const result = await execute({ expandedPath: join(scratchDir, 'nope.json'), address: 'x' }, 'Test Rule');
    expect(result.freedBytes).toBe(0);
    expect(result.skipped).toEqual([]);
  });

  it('reports 0 freedBytes, no error, no quarantine batch, when the key is genuinely absent -- nothing to clean is not a failure', async () => {
    const filePath = join(scratchDir, 'Preferences');
    await writeFile(filePath, JSON.stringify({ dns_prefetching: {} }));

    const result = await execute({ expandedPath: filePath, address: 'dns_prefetching/host_referral_list' }, 'Test Rule');

    expect(result.freedBytes).toBe(0);
    expect(result.quarantineBatch).toBeUndefined();
    expect(result.skipped).toEqual([]);
  });

  it('skips a file that is not valid JSON, with a reason, rather than corrupting it', async () => {
    const filePath = join(scratchDir, 'Preferences');
    await writeFile(filePath, 'not json at all');

    const result = await execute({ expandedPath: filePath, address: 'x' }, 'Test Rule');

    expect(result.freedBytes).toBe(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toMatch(/JSON/i);
    expect(await readFile(filePath, 'utf8')).toBe('not json at all'); // untouched
  });

  it('respects excludeFolders', async () => {
    const filePath = join(scratchDir, 'Preferences');
    await writeFile(filePath, JSON.stringify({ sync: {} }));

    const result = await execute(
      { expandedPath: filePath, address: 'sync' }, 'Test Rule', { excludeFolders: [scratchDir] }
    );

    expect(result.freedBytes).toBe(0);
    expect(result.skipped[0].reason).toMatch(/excluded/);
    expect(JSON.parse(await readFile(filePath, 'utf8'))).toEqual({ sync: {} }); // untouched
  });

  it('respects skipRecentHours', async () => {
    const filePath = join(scratchDir, 'Preferences');
    await writeFile(filePath, JSON.stringify({ sync: {} })); // just written -- inside any positive window

    const result = await execute(
      { expandedPath: filePath, address: 'sync' }, 'Test Rule', { skipRecentHours: 24 }
    );

    expect(result.freedBytes).toBe(0);
    expect(result.skipped[0].reason).toMatch(/recently/);
  });

  it('respects autoQuarantine: false -- recycles the original instead of quarantining it', async () => {
    const filePath = join(scratchDir, 'Preferences');
    await writeFile(filePath, JSON.stringify({ sync: { enabled: true }, keep: 1 }));

    const result = await execute(
      { expandedPath: filePath, address: 'sync' }, 'Test Rule', { autoQuarantine: false }
    );

    // Real Recycle Bin interaction is environment-dependent -- assert on
    // the shape this action promises rather than on Explorer's actual
    // bin contents: no quarantine batch was created for this path, and
    // the edit still landed.
    expect(result.recycled).toBe(true);
    expect(result.quarantineBatch).toBeUndefined();
    const after = JSON.parse(await readFile(filePath, 'utf8'));
    expect(after.sync).toBeUndefined();
    expect(after.keep).toBe(1);
  });
});
