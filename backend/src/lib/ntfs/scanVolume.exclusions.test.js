import { describe, it, expect, vi } from 'vitest';
import { scanVolume } from './scanVolume.js';
import { runMftJob } from './mftJob.js';
import { buildFakeVolume } from './fakeVolume.js';

/** Settings -> exclusions, obeyed by the fast scan as well as the folder walk.
 * It used to be the walk alone, so excluding a folder changed nothing the
 * moment the MFT was read. */

const entries = [
  { record: 10, name: 'Games', parent: 5, isDirectory: true },
  { record: 11, name: 'pak0.ucas', parent: 10, size: 8192, isDirectory: false },
  { record: 12, name: 'Users', parent: 5, isDirectory: true },
  { record: 13, name: 'win.iso', parent: 12, size: 4096, isDirectory: false },
  { record: 14, name: 'notes.txt', parent: 12, size: 100, isDirectory: false }
];

describe('scanVolume with exclusions', () => {
  it('counts nothing from an excluded folder, in size or on disk', () => {
    const { readAt } = buildFakeVolume(entries);
    const { tree, stats } = scanVolume({ readAt, exclusions: { excludeFolders: ['C:\\Games'] } });
    expect(tree.size).toBe(4196);
    expect(tree.allocated).toBe(4096 + 4096);
    const games = tree.children.find((n) => n.name === 'Games');
    expect(games).toMatchObject({ excluded: true, size: 0, children: [] });
    expect(stats.totalBytes).toBe(4196);
    expect(stats.excludedItems).toBe(2);
    expect(stats.excludedSizeBytes).toBe(8192);
    expect(stats.excludedAllocatedBytes).toBe(8192);
  });

  it('leaves out files of an excluded type', () => {
    const { readAt } = buildFakeVolume(entries);
    const { tree } = scanVolume({ readAt, exclusions: { excludeExtensions: ['.iso'] } });
    expect(tree.size).toBe(8192 + 100);
  });

  it('is unchanged when nothing is excluded, and says nothing was left out', () => {
    const { readAt } = buildFakeVolume(entries);
    const { tree, stats } = scanVolume({ readAt });
    expect(tree.size).toBe(8192 + 4096 + 100);
    expect(stats.excludedItems).toBe(0);
  });
});

describe('runMftJob exclusions', () => {
  it("passes the job's exclusions to every drive's scan", () => {
    const open = () => ({ readAt: buildFakeVolume(entries).readAt, close: vi.fn() });
    const result = runMftJob(
      { drives: ['C', 'D'], excludeFolders: ['C:\\Games', 'D:\\Games'], excludeExtensions: ['.iso'] },
      { openVolume: open }
    );
    // The same volume image stands in for both letters; each drive's own root
    // label builds its own paths, so only that drive's folder matches.
    expect(result.drives[0].tree.size).toBe(100);
    expect(result.drives[1].tree.size).toBe(100);
  });

  it("ignores exclusions that are not strings rather than crashing the helper", () => {
    const open = () => ({ readAt: buildFakeVolume(entries).readAt, close: vi.fn() });
    const result = runMftJob({ drives: ['C'], excludeFolders: [null, 5, {}], excludeExtensions: 'iso' }, { openVolume: open });
    expect(result.drives[0].tree.size).toBe(8192 + 4096 + 100);
  });
});
