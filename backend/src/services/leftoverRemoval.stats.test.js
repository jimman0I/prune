import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** An uninstall's leftovers and the lifetime "freed" total: only "Delete
 * permanently" gives space back. Quarantine and the Recycle Bin move it. */

const quarantineAndDelete = vi.fn(async ({ programName, files, registryKeys }) => ({
  programName, batchDir: 'Q:\\batch', files: files.map((p) => ({ originalPath: p, sizeBytes: 100 })),
  registryKeys, failedRegistryKeys: [], totalSizeBytes: files.length * 100
}));
vi.mock('./quarantine.js', async (importOriginal) => ({
  quarantineRoot: (await importOriginal()).quarantineRoot,
  quarantineAndDelete: (...a) => quarantineAndDelete(...a)
}));
const sendToRecycleBin = vi.fn();
vi.mock('./recycleBin.js', () => ({ sendToRecycleBin: (...a) => sendToRecycleBin(...a) }));
vi.mock('./scheduledTaskRemoval.js', () => ({ removeScheduledTasks: vi.fn() }));

const { removeLeftovers } = await import('./leftoverRemoval.js');
const { getStats } = await import('./stats.js');

let dir;
let previous;
beforeEach(() => {
  vi.clearAllMocks();
  dir = mkdtempSync(join(tmpdir(), 'prune-lo-stats-'));
  previous = process.env.UNREVO_STATS_PATH;
  process.env.UNREVO_STATS_PATH = join(dir, 'stats.json');
});
afterEach(() => {
  if (previous === undefined) delete process.env.UNREVO_STATS_PATH; else process.env.UNREVO_STATS_PATH = previous;
  rmSync(dir, { recursive: true, force: true });
});

function makeFolder(name = 'Vendor') {
  const folder = join(dir, name);
  mkdirSync(join(folder, 'cache'), { recursive: true });
  writeFileSync(join(folder, 'settings.ini'), 'abc');
  writeFileSync(join(folder, 'cache', 'blob.bin'), '12345');
  return folder;
}

describe('leftovers removed permanently', () => {
  it('count the bytes that were deleted', async () => {
    const folder = makeFolder();
    await removeLeftovers({ programName: 'Thing', files: [folder], registryKeys: [], destination: 'permanent' });
    expect((await getStats()).freedBytes).toBe(8);
  });

  it('count only what was actually removed, not what was refused', async () => {
    const folder = makeFolder();
    const windows = process.env.SystemRoot || 'C:\\Windows';
    await removeLeftovers({ programName: 'Thing', files: [windows, folder], registryKeys: [], destination: 'permanent' });
    expect((await getStats()).freedBytes).toBe(8);
  });

  it('count nothing when nothing was there', async () => {
    await removeLeftovers({ programName: 'Thing', files: [join(dir, 'nope')], registryKeys: [], destination: 'permanent' });
    expect((await getStats()).freedBytes).toBe(0);
  });
});

describe('leftovers that were only moved', () => {
  it('to Quarantine count nothing', async () => {
    await removeLeftovers({ programName: 'Thing', files: [makeFolder()], registryKeys: [], destination: 'quarantine' });
    expect((await getStats()).freedBytes).toBe(0);
  });

  it('to the Recycle Bin count nothing', async () => {
    const folder = makeFolder();
    sendToRecycleBin.mockResolvedValue({ recycled: [folder], failed: [] });
    await removeLeftovers({ programName: 'Thing', files: [folder], registryKeys: [], destination: 'recycle' });
    expect((await getStats()).freedBytes).toBe(0);
  });
});
