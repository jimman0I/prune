import { describe, it, expect } from 'vitest';
import { prepareSnapshot } from './liveSnapshot.js';

const snapshot = {
  name: 'C:', type: 'directory', size: 300, partial: true, truncated: true,
  children: [
    { name: 'Users', type: 'directory', size: 200, children: [
      { name: 'me', type: 'directory', size: 150 },
      { name: '', type: 'file', aggregated: true, count: 12, size: 50 }
    ] },
    { name: 'a.bin', type: 'file', size: 100 }
  ]
};
const label = (n) => `${n} smaller items`;

describe('prepareSnapshot', () => {
  it('gives every folder and file its full path', () => {
    const tree = prepareSnapshot(snapshot, { rootPath: 'C:\\', aggregateLabel: label });
    expect(tree.fullPath).toBe('C:\\');
    expect(tree.children[0].fullPath).toBe('C:\\Users');
    expect(tree.children[0].children[0].fullPath).toBe('C:\\Users\\me');
  });

  it('names the folded-together block in the caller\'s language, from its count', () => {
    const tree = prepareSnapshot(snapshot, { rootPath: 'C:\\', aggregateLabel: label });
    const block = tree.children[0].children[1];
    expect(block.name).toBe('12 smaller items');
    expect(block.aggregated).toBe(true);
    // Not a place, so no path to open or remove.
    expect(block.fullPath).toBeUndefined();
  });

  it('stays a partial, truncated picture', () => {
    const tree = prepareSnapshot(snapshot, { rootPath: 'C:\\', aggregateLabel: label });
    expect(tree).toMatchObject({ partial: true, truncated: true });
  });

  it('does not change what it was given', () => {
    const copy = JSON.parse(JSON.stringify(snapshot));
    prepareSnapshot(snapshot, { rootPath: 'C:\\', aggregateLabel: label });
    expect(snapshot).toEqual(copy);
  });

  it('adds the unread remainder for a drive root, from the real used space', () => {
    const tree = prepareSnapshot(snapshot, { rootPath: 'C:\\', usedBytes: 1000, atDriveRoot: true, aggregateLabel: label });
    const remainder = tree.children.find((c) => c.unscannedRemainder);
    expect(remainder).toMatchObject({ scanned: false, size: 700 });
    expect(tree.size).toBe(1000);
  });

  it('adds nothing for a folder, or when the used space is unknown', () => {
    expect(prepareSnapshot(snapshot, { rootPath: 'C:\\Users', usedBytes: 1000, atDriveRoot: false, aggregateLabel: label }).children.some((c) => c.unscannedRemainder)).toBe(false);
    expect(prepareSnapshot(snapshot, { rootPath: 'C:\\', usedBytes: null, atDriveRoot: true, aggregateLabel: label }).children.some((c) => c.unscannedRemainder)).toBe(false);
  });

  it('is null for no snapshot', () => {
    expect(prepareSnapshot(null, { rootPath: 'C:\\', aggregateLabel: label })).toBeNull();
  });
});
