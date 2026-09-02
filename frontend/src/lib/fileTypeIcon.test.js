import { describe, it, expect } from 'vitest';
import { extensionOf, iconKeyForNode, extensionsInCells } from './fileTypeIcon.js';

describe('extensionOf', () => {
  it('reads the last extension, lowercased', () => {
    expect(extensionOf('Holiday.MP4')).toBe('.mp4');
    expect(extensionOf('archive.tar.gz')).toBe('.gz');
  });

  it('returns null when there is no real extension', () => {
    expect(extensionOf('Program Files')).toBeNull();
    // A versioned folder name is not a ".9255 file" -- Squirrel apps put
    // these everywhere, and treating them as types would flood the shell
    // lookup with hundreds of nonexistent extensions.
    expect(extensionOf('app-1.0.9255')).toBeNull();
  });
});

describe('iconKeyForNode', () => {
  it('maps a directory to the folder icon', () => {
    expect(iconKeyForNode({ name: 'Games', type: 'directory' })).toBe('folder');
  });

  it('maps a file to its extension', () => {
    expect(iconKeyForNode({ name: 'movie.mkv', type: 'file' })).toBe('.mkv');
  });

  it('maps an extensionless file to the generic file icon', () => {
    expect(iconKeyForNode({ name: 'LICENSE', type: 'file' })).toBe('file');
  });

  // The unscanned-remainder block is not a real folder, and giving it a
  // folder icon would suggest it is something you can open.
  it('gives the unscanned block no icon at all', () => {
    expect(iconKeyForNode({ name: 'Not scanned', type: 'directory', scanned: false })).toBeNull();
  });
});

describe('extensionsInCells', () => {
  it('collects the distinct extensions worth asking about', () => {
    const cells = [
      { name: 'a.mp4', type: 'file' },
      { name: 'b.MP4', type: 'file' },
      { name: 'c.exe', type: 'file' },
      { name: 'Games', type: 'directory' },
      { name: 'LICENSE', type: 'file' }
    ];
    expect(extensionsInCells(cells).sort()).toEqual(['.exe', '.mp4']);
  });

  it('handles an empty or missing list', () => {
    expect(extensionsInCells([])).toEqual([]);
    expect(extensionsInCells(null)).toEqual([]);
  });
});
