import { describe, it, expect } from 'vitest';
import { subtreeForPath } from './mftSubtree.js';

const tree = {
  name: 'C:',
  size: 1000,
  type: 'directory',
  children: [
    {
      name: 'Users',
      size: 900,
      type: 'directory',
      children: [
        { name: 'jim', size: 900, type: 'directory', children: [{ name: 'a.bin', size: 900, type: 'file' }] }
      ]
    },
    { name: 'Windows', size: 100, type: 'directory', children: [] }
  ]
};

describe('subtreeForPath', () => {
  it('returns the whole tree for the drive root', () => {
    expect(subtreeForPath(tree, 'C:\\')).toBe(tree);
    expect(subtreeForPath(tree, 'C:')).toBe(tree);
  });

  it('walks down to a nested directory', () => {
    expect(subtreeForPath(tree, 'C:\\Users\\jim').name).toBe('jim');
  });

  it('is case-insensitive, the way Windows paths are', () => {
    expect(subtreeForPath(tree, 'c:\\users\\JIM').name).toBe('jim');
  });

  it('tolerates a trailing separator', () => {
    expect(subtreeForPath(tree, 'C:\\Users\\').name).toBe('Users');
  });

  // A directory past the scan's depth cap has no `children` key at all.
  // That is genuinely different from "we looked and it was empty", and
  // the caller has to be able to tell so it can fall back to a real scan
  // instead of drawing an empty treemap.
  it('returns null for a directory the scan did not expand', () => {
    const capped = { name: 'C:', size: 5, type: 'directory', children: [{ name: 'deep', size: 5, type: 'directory' }] };
    expect(subtreeForPath(capped, 'C:\\deep')).toBeNull();
  });

  it('returns null for a path that is not in the tree', () => {
    expect(subtreeForPath(tree, 'C:\\Nope\\Missing')).toBeNull();
  });

  it('returns null for a different drive than the one scanned', () => {
    expect(subtreeForPath(tree, 'D:\\Users')).toBeNull();
  });

  it('returns null when there is no tree yet', () => {
    expect(subtreeForPath(null, 'C:\\')).toBeNull();
  });

  it('does not treat a file as a browsable directory', () => {
    expect(subtreeForPath(tree, 'C:\\Users\\jim\\a.bin')).toBeNull();
  });
});
