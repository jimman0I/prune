import { describe, it, expect } from 'vitest';
import { parseBootSector } from './bootSector.js';

/** Builds an NTFS boot sector with the fields the scanner reads. Offsets
 * are from the NTFS BPB; anything not set here stays zero. */
function bootSector({
  bytesPerSector = 512,
  sectorsPerCluster = 8,
  totalSectors = 2000000000n,
  mftCluster = 786432n,
  clustersPerFileRecord = -10
} = {}) {
  const b = Buffer.alloc(512);
  b.write('NTFS    ', 3, 'latin1');
  b.writeUInt16LE(bytesPerSector, 11);
  b.writeUInt8(sectorsPerCluster, 13);
  b.writeBigUInt64LE(totalSectors, 40);
  b.writeBigUInt64LE(mftCluster, 48);
  b.writeInt8(clustersPerFileRecord, 64);
  return b;
}

describe('parseBootSector', () => {
  it('reads the geometry an MFT scan needs', () => {
    const result = parseBootSector(bootSector());
    expect(result.bytesPerSector).toBe(512);
    expect(result.sectorsPerCluster).toBe(8);
    expect(result.bytesPerCluster).toBe(4096);
    expect(result.mftOffset).toBe(786432 * 4096);
  });

  // The classic NTFS encoding trap: this field is SIGNED, and a negative
  // value isn't a count of clusters at all -- it's a base-2 log of a byte
  // size. -10 means 2^10 = 1024 bytes, which is the value nearly every
  // real volume uses. Reading it as unsigned gives 246 clusters per
  // record, and every record boundary after the first is wrong.
  it('decodes a negative clustersPerFileRecord as a power of two, not a count', () => {
    expect(parseBootSector(bootSector({ clustersPerFileRecord: -10 })).bytesPerFileRecord).toBe(1024);
    expect(parseBootSector(bootSector({ clustersPerFileRecord: -12 })).bytesPerFileRecord).toBe(4096);
  });

  it('treats a positive clustersPerFileRecord as a real cluster count', () => {
    const result = parseBootSector(bootSector({ clustersPerFileRecord: 2, sectorsPerCluster: 1 }));
    expect(result.bytesPerFileRecord).toBe(2 * 512);
  });

  it('computes the volume size in bytes', () => {
    const result = parseBootSector(bootSector({ totalSectors: 1000n, bytesPerSector: 512 }));
    expect(result.volumeBytes).toBe(512000);
  });

  it('rejects a non-NTFS volume rather than returning nonsense geometry', () => {
    const b = bootSector();
    b.write('FAT32   ', 3, 'latin1');
    expect(() => parseBootSector(b)).toThrow(/NTFS/i);
  });

  it('rejects an implausible sector size instead of computing a bad MFT offset', () => {
    // A zero here would make bytesPerCluster 0 and every subsequent offset
    // collapse to 0 -- far better to fail loudly at the boot sector.
    expect(() => parseBootSector(bootSector({ bytesPerSector: 0 }))).toThrow();
    expect(() => parseBootSector(bootSector({ bytesPerSector: 999 }))).toThrow();
  });

  it('accepts a 4096-byte-sector (advanced format) volume', () => {
    const result = parseBootSector(bootSector({ bytesPerSector: 4096, sectorsPerCluster: 1 }));
    expect(result.bytesPerCluster).toBe(4096);
  });

  it('rejects a buffer too short to be a boot sector', () => {
    expect(() => parseBootSector(Buffer.alloc(64))).toThrow();
  });
});
