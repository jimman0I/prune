import { describe, it, expect } from 'vitest';
import { scanVolume } from './scanVolume.js';
import { buildFakeVolume } from './fakeVolume.js';

/** End-to-end over a byte-accurate synthetic NTFS volume: boot sector ->
 * MFT record 0 -> runlist -> per-record fixups and attributes -> tree.
 * Every layer runs on the same bytes a real disk would hand back. */
describe('scanVolume', () => {
  it('reconstructs a directory tree from the MFT alone', () => {
    const { readAt } = buildFakeVolume([
      { record: 10, name: 'Games', parent: 5, size: 0, isDirectory: true },
      { record: 11, name: 'save.dat', parent: 10, size: 4096, isDirectory: false },
      { record: 12, name: 'readme.txt', parent: 5, size: 512, isDirectory: false }
    ]);

    const { tree, stats } = scanVolume({ readAt, driveLabel: 'C:' });

    expect(tree.name).toBe('C:');
    expect(tree.size).toBe(4096 + 512);
    const games = tree.children.find((c) => c.name === 'Games');
    expect(games.type).toBe('directory');
    expect(games.size).toBe(4096);
    expect(games.children[0].name).toBe('save.dat');
    expect(stats.recordsRead).toBeGreaterThanOrEqual(4);
  });

  it('handles nested directories several levels deep', () => {
    const { readAt } = buildFakeVolume([
      { record: 10, name: 'a', parent: 5, size: 0, isDirectory: true },
      { record: 11, name: 'b', parent: 10, size: 0, isDirectory: true },
      { record: 12, name: 'c', parent: 11, size: 0, isDirectory: true },
      { record: 13, name: 'deep.bin', parent: 12, size: 123456, isDirectory: false }
    ]);
    const { tree } = scanVolume({ readAt });
    expect(tree.size).toBe(123456);
    expect(tree.children[0].children[0].children[0].children[0].name).toBe('deep.bin');
  });

  it('reads a size that needs more than 32 bits', () => {
    // 5 GB in one file. A 32-bit read of the $DATA real size wraps and
    // reports something like 705 MB -- wrong, and entirely plausible.
    const { readAt } = buildFakeVolume([
      { record: 10, name: 'huge.iso', parent: 5, size: 5_000_000_000, isDirectory: false }
    ]);
    expect(scanVolume({ readAt }).tree.size).toBe(5_000_000_000);
  });

  // Measured on this machine before this was handled: 99,660 files kept
  // no $DATA in their base record and 290 GB of it sat in extension
  // records. Every one of those files was counted as zero bytes, which is
  // how a 76 GB folder reported 54 GB and still looked entirely credible.
  it('recovers the size of a file whose $DATA moved to an extension record', () => {
    const { readAt } = buildFakeVolume([
      { record: 10, name: 'fragmented.pak', parent: 5, size: 9_000_000_000, isDirectory: false, dataInExtension: true },
      { record: 11, baseRecord: 10, size: 9_000_000_000 }
    ]);
    const { tree, stats } = scanVolume({ readAt });
    expect(tree.size).toBe(9_000_000_000);
    expect(tree.children[0].name).toBe('fragmented.pak');
    expect(stats.recordsCompletedFromExtensions).toBe(1);
  });

  // The later fragments of a split stream report a size of zero, and only
  // the VCN-0 one states the real total. Summing them would multiply a
  // file's size by how badly it happened to be fragmented; taking the
  // last would zero it out entirely.
  it('takes the real size from the first fragment and ignores the rest', () => {
    const { readAt } = buildFakeVolume([
      { record: 10, name: 'split.bin', parent: 5, size: 4_000_000_000, isDirectory: false, dataInExtension: true },
      { record: 11, baseRecord: 10, size: 4_000_000_000, startingVcn: 0 },
      { record: 12, baseRecord: 10, size: 4_000_000_000, startingVcn: 500 },
      { record: 13, baseRecord: 10, size: 4_000_000_000, startingVcn: 900 }
    ]);
    expect(scanVolume({ readAt }).tree.size).toBe(4_000_000_000);
  });

  it('does not let an extension record overwrite a size the base already had', () => {
    const { readAt } = buildFakeVolume([
      { record: 10, name: 'normal.bin', parent: 5, size: 700, isDirectory: false },
      { record: 11, baseRecord: 10, size: 999_999 }
    ]);
    expect(scanVolume({ readAt }).tree.size).toBe(700);
  });

  it('never counts an extension record as a file of its own', () => {
    const { readAt } = buildFakeVolume([
      { record: 10, name: 'thing.bin', parent: 5, size: 1000, isDirectory: false, dataInExtension: true },
      { record: 11, baseRecord: 10, size: 1000 }
    ]);
    const { tree } = scanVolume({ readAt });
    // One file, counted once -- not a phantom sibling doubling the total.
    expect(tree.children).toHaveLength(1);
    expect(tree.size).toBe(1000);
  });

  // Sizes reported here are LOGICAL -- file lengths, the same measure
  // the recursive scanner and Explorer use. The volume size is reported
  // alongside rather than being treated as an upper bound on the total:
  // on a drive with hardlinks the sum of file lengths legitimately
  // exceeds the space in use, because Windows charges shared clusters
  // once while every name reports the full length.
  it('reports the total and the volume size as separate figures', () => {
    const { readAt } = buildFakeVolume(
      [{ record: 10, name: 'a.bin', parent: 5, size: 5000, isDirectory: false }],
      { totalClusters: 256 }
    );
    const { stats } = scanVolume({ readAt });
    expect(stats.totalBytes).toBe(5000);
    expect(stats.volumeBytes).toBe(256 * 4096);
  });

  it('reports the volume size from the boot sector', () => {
    const { readAt } = buildFakeVolume([], { totalClusters: 512 });
    expect(scanVolume({ readAt }).stats.volumeBytes).toBe(512 * 4096);
  });

  it('flags an incomplete MFT runlist instead of quietly reporting a partial total', () => {
    // The runlist covers fewer clusters than $DATA's real size claims --
    // the shape a heavily fragmented MFT takes when its extent map spills
    // into an $ATTRIBUTE_LIST. The scan still returns what it could read,
    // but must not present it as the whole drive.
    const { readAt } = buildFakeVolume(
      [{ record: 10, name: 'a.bin', parent: 5, size: 100, isDirectory: false }],
      { mftRunClusters: 1 }
    );
    expect(scanVolume({ readAt }).stats.mftComplete).toBe(false);
  });

  it('says so when the volume is not NTFS rather than returning an empty drive', () => {
    const { volume, readAt } = buildFakeVolume([]);
    volume.write('FAT32   ', 3, 'latin1');
    expect(() => scanVolume({ readAt })).toThrow(/NTFS/i);
  });

  it('reports progress as it streams through the table', () => {
    const { readAt } = buildFakeVolume([
      { record: 10, name: 'x.bin', parent: 5, size: 1, isDirectory: false }
    ]);
    const seen = [];
    scanVolume({ readAt, onProgress: (p) => seen.push(p.recordsRead) });
    expect(seen.length).toBeGreaterThan(0);
  });

  it('applies the depth cap to the tree while keeping deep files in the total', () => {
    const { readAt } = buildFakeVolume([
      { record: 10, name: 'a', parent: 5, size: 0, isDirectory: true },
      { record: 11, name: 'b', parent: 10, size: 0, isDirectory: true },
      { record: 12, name: 'c', parent: 11, size: 0, isDirectory: true },
      { record: 13, name: 'deep.bin', parent: 12, size: 999, isDirectory: false }
    ]);
    const { tree } = scanVolume({ readAt, maxDepth: 2 });
    expect(tree.size).toBe(999);
    expect(tree.children[0].children[0].children).toBeUndefined();
  });
});
