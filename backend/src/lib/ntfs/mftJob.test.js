import { describe, it, expect, vi } from 'vitest';
import { runMftJob } from './mftJob.js';
import { buildFakeVolume } from './fakeVolume.js';

/** The elevated worker's whole job, minus the raw volume handle. Everything
 * Windows would only hand to an Administrator is injected as `openVolume`,
 * so the multi-drive behaviour is tested against synthetic volumes. */

function volumeFor(entries) {
  const { readAt } = buildFakeVolume(entries);
  return { readAt, close: vi.fn() };
}

describe('runMftJob', () => {
  it('scans every requested drive in one pass and labels each tree with its letter', () => {
    const volumes = {
      C: volumeFor([{ record: 10, name: 'a.bin', parent: 5, size: 100, isDirectory: false }]),
      D: volumeFor([{ record: 10, name: 'b.bin', parent: 5, size: 7, isDirectory: false }])
    };
    const result = runMftJob({ drives: ['C', 'D'] }, { openVolume: (letter) => volumes[letter] });

    expect(result.drives.map((d) => d.driveLetter)).toEqual(['C', 'D']);
    expect(result.drives[0].tree.name).toBe('C:');
    expect(result.drives[0].tree.size).toBe(100);
    expect(result.drives[1].tree.name).toBe('D:');
    expect(result.drives[1].tree.size).toBe(7);
  });

  it('closes each volume handle, even for a drive that fails', () => {
    const good = volumeFor([]);
    const bad = volumeFor([]);
    bad.readAt = () => { throw new Error('boom'); };
    runMftJob({ drives: ['C', 'D'] }, { openVolume: (l) => (l === 'C' ? good : bad) });
    expect(good.close).toHaveBeenCalledTimes(1);
    expect(bad.close).toHaveBeenCalledTimes(1);
  });

  // One USB stick formatted FAT32 must not throw away the C: scan the user
  // just approved a UAC prompt for.
  it('reports one drive failing as that drive\'s error and keeps the others', () => {
    const fat = volumeFor([]);
    fat.volume = null;
    const ok = volumeFor([{ record: 10, name: 'a.bin', parent: 5, size: 1, isDirectory: false }]);
    const notNtfs = { readAt: (buffer) => { buffer.fill(0); buffer.write('FAT32   ', 3, 'latin1'); }, close: vi.fn() };

    const result = runMftJob({ drives: ['C', 'E'] }, { openVolume: (l) => (l === 'C' ? ok : notNtfs) });

    expect(result.drives[0].tree.size).toBe(1);
    expect(result.drives[1].driveLetter).toBe('E');
    expect(result.drives[1].error).toMatch(/NTFS/i);
    expect(result.drives[1].tree).toBeUndefined();
  });

  it('reports a drive that cannot be opened as that drive\'s error', () => {
    const result = runMftJob({ drives: ['Z'] }, {
      openVolume: () => { throw new Error('EPERM: operation not permitted'); }
    });
    expect(result.drives).toEqual([{ driveLetter: 'Z', error: 'EPERM: operation not permitted' }]);
  });

  it('normalises letters and ignores duplicates and junk', () => {
    const opened = [];
    runMftJob({ drives: ['c', 'C', 'c:', '1', '', 'D:\\'] }, {
      openVolume: (letter) => { opened.push(letter); return volumeFor([]); }
    });
    expect(opened).toEqual(['C', 'D']);
  });

  it('refuses a job that names no usable drive', () => {
    expect(() => runMftJob({ drives: [] }, { openVolume: () => volumeFor([]) })).toThrow(/drive letter/i);
    expect(() => runMftJob({ drives: ['9', '??'] }, { openVolume: () => volumeFor([]) })).toThrow(/drive letter/i);
    expect(() => runMftJob({}, { openVolume: () => volumeFor([]) })).toThrow(/drive letter/i);
  });

  it('passes the depth cap through to the scan', () => {
    const entries = [
      { record: 10, name: 'a', parent: 5, size: 0, isDirectory: true },
      { record: 11, name: 'b', parent: 10, size: 0, isDirectory: true },
      { record: 12, name: 'c.bin', parent: 11, size: 9, isDirectory: false }
    ];
    const result = runMftJob({ drives: ['C'], maxDepth: 1 }, { openVolume: () => volumeFor(entries) });
    expect(result.drives[0].tree.size).toBe(9);
    expect(result.drives[0].tree.children[0].children).toBeUndefined();
  });
});
