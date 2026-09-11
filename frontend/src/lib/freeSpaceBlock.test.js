import { describe, it, expect } from 'vitest';
import { withFreeSpace, FREE_SPACE_LABEL, mapTreeFor } from './freeSpaceBlock.js';
import { withUnscannedRemainder, scanCoverage, UNSCANNED_LABEL } from './unscannedRemainder.js';

/** WizTree's "Show Free Space on Treemap": the drive's free space drawn as
 * one more block, so every folder reads as a share of the whole drive
 * rather than of the part in use. */

const tree = { name: 'C:\\', size: 600, type: 'directory', children: [{ name: 'Users', size: 600, type: 'directory' }] };

describe('withFreeSpace', () => {
  it('adds the free space as a block and grows the total by it', () => {
    const result = withFreeSpace(tree, 400);
    expect(result.size).toBe(1000);
    const block = result.children.at(-1);
    expect(block).toEqual(expect.objectContaining({ name: FREE_SPACE_LABEL, size: 400, free: true, scanned: false }));
    expect(FREE_SPACE_LABEL).toBe('Free space');
  });

  it('leaves the tree alone when there is no usable free-space figure', () => {
    for (const free of [undefined, null, NaN, -5, 0]) {
      expect(withFreeSpace(tree, free)).toBe(tree);
    }
    expect(withFreeSpace(null, 400)).toBeNull();
  });

  it('does not change the original tree', () => {
    withFreeSpace(tree, 400);
    expect(tree.children).toHaveLength(1);
    expect(tree.size).toBe(600);
  });
});

describe('scanCoverage with a free-space block', () => {
  it('measures coverage against space in use, not against free space', () => {
    // 300 measured of 1000 in use: 30%. Adding 500 free must not turn that
    // into 300 of 1500.
    const truncated = { ...tree, size: 300, truncated: true, children: [{ name: 'Users', size: 300 }] };
    const reconciled = withUnscannedRemainder(truncated, 1000);
    const before = scanCoverage(reconciled);
    const after = scanCoverage(withFreeSpace(reconciled, 500));

    expect(before).toEqual({ used: 1000, measured: 300, percent: 30 });
    expect(after).toEqual(before);
    expect(reconciled.children.some((c) => c.name === UNSCANNED_LABEL)).toBe(true);
  });
});

describe('mapTreeFor', () => {
  /* The Disk Map's decision, pulled out of the component so it can be
   * tested: the free-space block goes on the map only with the setting on,
   * and only for a whole drive -- a subfolder's share of the drive's free
   * space is not a thing. */
  it('adds the block with the setting on, at a drive root', () => {
    const result = mapTreeFor(tree, { enabled: true, atDriveRoot: true, freeBytes: 400 });
    expect(result.children.at(-1).name).toBe(FREE_SPACE_LABEL);
  });

  it('leaves the tree alone with the setting off, or anything but an explicit true', () => {
    for (const enabled of [false, undefined, null, 'true', 1]) {
      expect(mapTreeFor(tree, { enabled, atDriveRoot: true, freeBytes: 400 })).toBe(tree);
    }
  });

  it('leaves a subfolder alone', () => {
    expect(mapTreeFor(tree, { enabled: true, atDriveRoot: false, freeBytes: 400 })).toBe(tree);
  });
});
