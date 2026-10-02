import { describe, it, expect } from 'vitest';
import { folderTableRows } from './folderTable.js';
import { largestFiles } from './largestFiles.js';
import { extensionBreakdown } from './extensionBreakdown.js';

const saved = {
  name: 'C:', type: 'directory', size: 1000, fullPath: 'C:\\',
  children: [{
    name: 'Games', type: 'directory', size: 900, fullPath: 'C:\\Games', counts: { files: 5000, folders: 40 },
    children: [
      { name: 'big.pak', type: 'file', size: 800, fullPath: 'C:\\Games\\big.pak' },
      { name: '4999 smaller items', type: 'file', size: 100, aggregated: true }
    ]
  }]
};

describe('a reopened saved scan', () => {
  it('reports the saved counts rather than counting the few files it kept', () => {
    const [row] = folderTableRows(saved);
    expect(row.files).toBe(5000);
    expect(row.folders).toBe(40);
    expect(row.items).toBe(5040);
  });

  it('never lists the stand-in block as a file in the File view', () => {
    expect(largestFiles(saved).map((f) => f.name)).toEqual(['big.pak']);
  });

  it('never counts the stand-in block as a file of some type', () => {
    expect(extensionBreakdown(saved).totalFiles).toBe(1);
  });
});
