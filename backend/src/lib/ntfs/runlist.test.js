import { describe, it, expect } from 'vitest';
import { decodeRunlist } from './runlist.js';

describe('decodeRunlist', () => {
  it('decodes a single run', () => {
    // 0x21: 1 byte of length, 2 bytes of offset. length=0x28, lcn=0x0334
    expect(decodeRunlist(Buffer.from([0x21, 0x28, 0x34, 0x03, 0x00])))
      .toEqual([{ startCluster: 0x0334, clusterCount: 0x28 }]);
  });

  // The rule that makes runlists unlike any other length/offset pair: each
  // run's offset is a SIGNED delta from the previous run's start, not an
  // absolute cluster. A fragmented file whose later extents sit earlier on
  // disk encodes them as negative deltas, and reading those as unsigned
  // sends the scan to an absurd cluster far past the end of the volume.
  it('applies each offset as a signed delta from the previous run', () => {
    // run1: len 0x28 at lcn 0x0334
    // run2: len 0x10, delta +0x08 -> lcn 0x033C
    // run3: len 0x08, delta -0x40 -> lcn 0x02FC
    const buffer = Buffer.from([
      0x21, 0x28, 0x34, 0x03,
      0x11, 0x10, 0x08,
      0x11, 0x08, 0xC0,
      0x00
    ]);
    expect(decodeRunlist(buffer)).toEqual([
      { startCluster: 0x0334, clusterCount: 0x28 },
      { startCluster: 0x033C, clusterCount: 0x10 },
      { startCluster: 0x02FC, clusterCount: 0x08 }
    ]);
  });

  it('handles a multi-byte length', () => {
    // 0x12: 2 bytes length, 1 byte offset. length=0x0100, lcn=0x05
    expect(decodeRunlist(Buffer.from([0x12, 0x00, 0x01, 0x05, 0x00])))
      .toEqual([{ startCluster: 5, clusterCount: 256 }]);
  });

  // A sparse run has a length but NO offset bytes at all. It occupies
  // virtual clusters that were never allocated, so it must not advance the
  // running LCN -- treating it as a delta of 0 would silently re-read the
  // previous run's clusters as if they were this run's data.
  it('treats a zero-length offset as a sparse run and leaves the previous LCN alone', () => {
    // run1: len 0x10 at lcn 0x20; run2: 0x01 = 1 byte length, 0 offset bytes
    // run3: len 0x10, delta +0x05 -> 0x25, measured from run1, not run2
    const buffer = Buffer.from([0x21, 0x10, 0x20, 0x00, 0x01, 0x08, 0x11, 0x10, 0x05, 0x00]);
    const runs = decodeRunlist(buffer);
    expect(runs[1]).toEqual({ startCluster: null, clusterCount: 8, sparse: true });
    expect(runs[2].startCluster).toBe(0x25);
  });

  it('stops at the terminating zero byte and ignores trailing padding', () => {
    const buffer = Buffer.from([0x11, 0x04, 0x02, 0x00, 0xFF, 0xFF, 0xFF]);
    expect(decodeRunlist(buffer)).toHaveLength(1);
  });

  it('returns an empty list for an immediately-terminated runlist', () => {
    expect(decodeRunlist(Buffer.from([0x00]))).toEqual([]);
    expect(decodeRunlist(Buffer.alloc(0))).toEqual([]);
  });

  it('stops rather than reading past the end of a truncated runlist', () => {
    // Claims 4 offset bytes but only 1 is present. Real MFT data can be
    // damaged, and running off the end of the buffer must not throw.
    expect(() => decodeRunlist(Buffer.from([0x41, 0x10, 0x20]))).not.toThrow();
    expect(decodeRunlist(Buffer.from([0x41, 0x10, 0x20]))).toEqual([]);
  });

  it('decodes a large 4-byte length and 4-byte signed negative offset', () => {
    const buffer = Buffer.from([
      0x44, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0x10, 0x00, // len 0x100000 lcn 0x100000
      0x44, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0xF0, 0xFF, // len 0x10000, delta -0x100000
      0x00
    ]);
    const runs = decodeRunlist(buffer);
    expect(runs[0]).toEqual({ startCluster: 0x100000, clusterCount: 0x100000 });
    expect(runs[1].startCluster).toBe(0x100000 - 0x100000);
  });
});
