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
      { record: 11, baseRecord: 10, size: 4_000_000_000, startingVcn: 0, allocated: 4096 },
      { record: 12, baseRecord: 10, size: 4_000_000_000, startingVcn: 500, allocated: 4096 },
      { record: 13, baseRecord: 10, size: 4_000_000_000, startingVcn: 900, allocated: 4096 }
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

describe('scanVolume sizes on disk', () => {
  const C = 4096;

  it('reports allocated size beside logical size, per file and per folder', () => {
    const { readAt } = buildFakeVolume([
      { record: 10, name: 'Games', parent: 5, isDirectory: true },
      { record: 11, name: 'a.bin', parent: 10, size: 5000, isDirectory: false },
      { record: 12, name: 'b.bin', parent: 10, size: 100, isDirectory: false }
    ]);
    const { tree } = scanVolume({ readAt });
    const games = tree.children.find((n) => n.name === 'Games');
    expect(games.size).toBe(5100);
    expect(games.allocated).toBe(2 * C + 1 * C);
    expect(games.children.find((n) => n.name === 'a.bin').allocated).toBe(2 * C);
    expect(tree.allocated).toBe(3 * C);
  });

  // The 1270 GB bug: holes in a sparse file are in the logical size and in the
  // header's allocated field, and on no disk.
  it('does not count the holes of a sparse file as space in use', () => {
    const { readAt } = buildFakeVolume([
      { record: 10, name: 'disk.vhdx', parent: 5, size: 800_000_000, allocated: 3 * C, holes: 195_000, sparse: true, isDirectory: false }
    ]);
    const { tree, stats } = scanVolume({ readAt });
    expect(tree.size).toBe(800_000_000);
    expect(tree.allocated).toBe(3 * C);
    expect(stats.sparseOrCompressedFiles).toBe(1);
  });

  it('counts a file with several hard links once, however many names it has', () => {
    const { readAt } = buildFakeVolume([
      { record: 10, name: 'System32', parent: 5, isDirectory: true },
      { record: 11, name: 'WinSxS', parent: 5, isDirectory: true },
      { record: 12, name: 'shared.dll', parent: 10, size: 6000, isDirectory: false, links: [11, 11] }
    ]);
    const { tree, stats } = scanVolume({ readAt });
    expect(tree.size).toBe(6000);
    expect(tree.allocated).toBe(2 * C);
    expect(stats.hardLinkedFiles).toBe(1);
    expect(stats.hardLinkExtraNames).toBe(2);
    expect(tree.children.flatMap((d) => d.children ?? []).filter((n) => n.name === 'shared.dll')).toHaveLength(1);
  });

  it('adds the clusters of every extension record to the file they belong to', () => {
    const { readAt } = buildFakeVolume([
      { record: 10, name: 'big.pak', parent: 5, size: 3 * C, isDirectory: false, dataInExtension: true },
      { record: 11, baseRecord: 10, size: 3 * C, startingVcn: 0, allocated: 2 * C },
      { record: 12, baseRecord: 10, size: 3 * C, startingVcn: 2, allocated: C }
    ]);
    const { tree } = scanVolume({ readAt });
    expect(tree.size).toBe(3 * C);
    expect(tree.allocated).toBe(3 * C);
  });

  it('counts alternate data streams and directory index buffers on disk but not in the size', () => {
    const { readAt } = buildFakeVolume([
      { record: 10, name: 'Big', parent: 5, isDirectory: true, indexClusters: 4 },
      { record: 11, name: 'doc.txt', parent: 10, size: 10, resident: true, streams: [{ name: 'Zone.Identifier', clusters: 1 }], isDirectory: false }
    ]);
    const { tree, stats } = scanVolume({ readAt });
    expect(tree.size).toBe(10);
    expect(tree.allocated).toBe(5 * C);
    expect(stats.streamAllocatedBytes).toBe(C);
    expect(stats.indexAllocatedBytes).toBe(4 * C);
    expect(stats.fileAllocatedBytes).toBe(0);
  });

  it('exposes the totals a caller needs to compare against the volume', () => {
    const { readAt } = buildFakeVolume([
      { record: 10, name: 'a.bin', parent: 5, size: 9000, isDirectory: false }
    ], { totalClusters: 256 });
    const { stats } = scanVolume({ readAt });
    expect(stats.totalBytes).toBe(9000);
    expect(stats.allocatedBytes).toBe(3 * C);
    expect(stats.volumeBytes).toBe(256 * C);
  });

  // $Bitmap is NTFS's own record of which clusters are in use -- the same
  // figure Windows subtracts to report free space.
  it('reads the volume\'s used clusters from $Bitmap as the ground truth', () => {
    const { readAt } = buildFakeVolume([], { totalClusters: 256, usedClusters: 77 });
    const { stats } = scanVolume({ readAt });
    expect(stats.bitmapUsedBytes).toBe(77 * C);
    expect(stats.bitmapFreeBytes).toBe((256 - 77) * C);
  });

  it('says the ground truth is unavailable rather than guessing when there is no readable $Bitmap', () => {
    const { readAt } = buildFakeVolume([]);
    const { stats } = scanVolume({ readAt });
    expect(stats.bitmapUsedBytes).toBeNull();
  });
});