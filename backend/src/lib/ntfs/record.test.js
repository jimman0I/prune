import { describe, it, expect } from 'vitest';
import { applyFixups, parseFileRecord, ATTR_DATA, ATTR_FILE_NAME } from './record.js';

const SECTOR = 512;
const RECORD = 1024;

/** Builds a FILE record with its update sequence array already in place,
 * i.e. the on-disk form: the last two bytes of every sector hold the USN
 * and their real values live in the array. */
function fileRecord({ sequence = 0x0005, sectorTails = [[0xaa, 0xbb], [0xcc, 0xdd]], attributes = [] } = {}) {
  const b = Buffer.alloc(RECORD);
  b.write('FILE', 0, 'latin1');
  const usaOffset = 0x30;
  b.writeUInt16LE(usaOffset, 4);
  b.writeUInt16LE(1 + sectorTails.length, 6); // USN word + one word per sector
  b.writeUInt16LE(0x38, 0x14);                // first attribute offset
  b.writeUInt16LE(0x0001, 0x16);              // flags: in use
  b.writeUInt32LE(RECORD, 0x18);

  b.writeUInt16LE(sequence, usaOffset);
  sectorTails.forEach((tail, i) => {
    b[usaOffset + 2 + i * 2] = tail[0];
    b[usaOffset + 3 + i * 2] = tail[1];
    // On disk the sector tail is overwritten with the USN.
    b.writeUInt16LE(sequence, (i + 1) * SECTOR - 2);
  });

  let offset = 0x38;
  for (const attr of attributes) {
    attr.copy(b, offset);
    offset += attr.length;
  }
  b.writeUInt32LE(0xffffffff, offset); // end-of-attributes marker
  return b;
}

function residentAttribute(type, value) {
  const headerLength = 0x18;
  const length = headerLength + value.length + ((8 - ((headerLength + value.length) % 8)) % 8);
  const b = Buffer.alloc(length);
  b.writeUInt32LE(type, 0);
  b.writeUInt32LE(length, 4);
  b.writeUInt8(0, 8);                    // resident
  b.writeUInt32LE(value.length, 0x10);
  b.writeUInt16LE(headerLength, 0x14);
  value.copy(b, headerLength);
  return b;
}

function nonResidentDataAttribute(realSize) {
  const length = 0x50;
  const b = Buffer.alloc(length);
  b.writeUInt32LE(ATTR_DATA, 0);
  b.writeUInt32LE(length, 4);
  b.writeUInt8(1, 8);                    // non-resident
  b.writeUInt16LE(0x48, 0x20);           // runlist offset
  b.writeBigUInt64LE(BigInt(realSize), 0x30);
  return b;
}

function fileNameAttribute({ parentRecord = 5, name = 'thing.txt', namespace = 1, allocatedSize = 0 }) {
  const nameBuffer = Buffer.from(name, 'utf16le');
  const value = Buffer.alloc(0x42 + nameBuffer.length);
  // Parent reference: low 48 bits are the record number, high 16 the
  // sequence number.
  value.writeBigUInt64LE(BigInt(parentRecord) | (7n << 48n), 0);
  value.writeBigUInt64LE(BigInt(allocatedSize), 0x28);
  value.writeUInt8(name.length, 0x40);
  value.writeUInt8(namespace, 0x41);
  nameBuffer.copy(value, 0x42);
  return residentAttribute(ATTR_FILE_NAME, value);
}

describe('applyFixups', () => {
  it('restores the real last two bytes of every sector', () => {
    const record = fileRecord();
    expect(applyFixups(record, SECTOR)).toBe(true);
    expect(record[SECTOR - 2]).toBe(0xaa);
    expect(record[SECTOR - 1]).toBe(0xbb);
    expect(record[2 * SECTOR - 2]).toBe(0xcc);
    expect(record[2 * SECTOR - 1]).toBe(0xdd);
  });

  // The whole point of the update sequence array: if a sector tail doesn't
  // hold the expected USN, the record was torn by an interrupted write and
  // its contents are not trustworthy. Parsing it anyway yields garbage
  // sizes and names that look real.
  it('rejects a record whose sector tail does not carry the expected USN', () => {
    const record = fileRecord();
    record.writeUInt16LE(0x9999, 2 * SECTOR - 2);
    expect(applyFixups(record, SECTOR)).toBe(false);
  });

  it('rejects a record whose USA would run past the end of the buffer', () => {
    const record = fileRecord();
    record.writeUInt16LE(99, 6); // claims 98 sectors in a 2-sector record
    expect(applyFixups(record, SECTOR)).toBe(false);
  });
});

describe('parseFileRecord', () => {
  it('returns null for a slot that is not a FILE record', () => {
    expect(parseFileRecord(Buffer.alloc(RECORD), SECTOR)).toBeNull();
  });

  it('returns null for a record marked not in use', () => {
    const record = fileRecord({ attributes: [fileNameAttribute({ name: 'gone.txt' })] });
    applyFixupsInPlaceForTest(record);
    record.writeUInt16LE(0x0000, 0x16);
    expect(parseFileRecord(record, SECTOR)).toBeNull();
  });

  it('reads the name, parent and size of a resident file', () => {
    const record = fileRecord({
      attributes: [
        fileNameAttribute({ name: 'notes.txt', parentRecord: 42 }),
        residentAttribute(ATTR_DATA, Buffer.alloc(37))
      ]
    });
    const result = parseFileRecord(record, SECTOR);
    expect(result.name).toBe('notes.txt');
    expect(result.parentRecord).toBe(42);
    expect(result.sizeBytes).toBe(37);
    expect(result.isDirectory).toBe(false);
  });

  it('reads the real size of a non-resident file from its $DATA header', () => {
    const record = fileRecord({
      attributes: [fileNameAttribute({ name: 'big.bin' }), nonResidentDataAttribute(5_000_000_000)]
    });
    expect(parseFileRecord(record, SECTOR).sizeBytes).toBe(5_000_000_000);
  });

  it('marks a directory and gives it no size of its own', () => {
    const record = fileRecord({ attributes: [fileNameAttribute({ name: 'Windows', parentRecord: 5 })] });
    record.writeUInt16LE(0x0003, 0x16); // in use + directory
    const result = parseFileRecord(record, SECTOR);
    expect(result.isDirectory).toBe(true);
    expect(result.sizeBytes).toBe(0);
  });

  // Most files carry two $FILE_NAME attributes: the real long name and an
  // 8.3 DOS alias. Preferring the alias would fill the scan with names
  // like PROGRA~1.
  it('prefers the Win32 long name over the DOS 8.3 alias', () => {
    const record = fileRecord({
      attributes: [
        fileNameAttribute({ name: 'PROGRA~1', namespace: 2 }),
        fileNameAttribute({ name: 'Program Files', namespace: 1 })
      ]
    });
    expect(parseFileRecord(record, SECTOR).name).toBe('Program Files');
  });

  it('falls back to a DOS-only name rather than reporting no name', () => {
    const record = fileRecord({ attributes: [fileNameAttribute({ name: 'ODDNAME', namespace: 2 })] });
    expect(parseFileRecord(record, SECTOR).name).toBe('ODDNAME');
  });

  // An extension record's attributes belong to its base record, so it is
  // never a file of its own -- counting one as a file invents an entry
  // with a duplicate name and double-counts its size. But it isn't
  // nothing either: when a file's attributes outgrow one record, its
  // $DATA lives out here, and discarding the record loses the file's
  // entire size.
  it('reports an extension record as an extension, naming the base it belongs to', () => {
    const record = fileRecord({
      attributes: [fileNameAttribute({ name: 'part.bin' }), nonResidentDataAttribute(8_000_000_000)]
    });
    // Non-zero base reference, with a sequence number in the high bits
    // that has to be masked off the same way a parent reference does.
    record.writeBigUInt64LE(123n | (5n << 48n), 0x20);

    const result = parseFileRecord(record, SECTOR);
    expect(result.kind).toBe('extension');
    expect(result.baseRecord).toBe(123);
    expect(result.sizeBytes).toBe(8_000_000_000);
    expect(result.name).toBeUndefined();
  });

  it('reports a later stream fragment as an extension carrying no size', () => {
    // Only the VCN-0 fragment states the real size; the rest report zero.
    const data = nonResidentDataAttribute(8_000_000_000);
    data.writeBigUInt64LE(4096n, 0x10); // starting VCN
    const record = fileRecord({ attributes: [data] });
    record.writeBigUInt64LE(123n, 0x20);
    expect(parseFileRecord(record, SECTOR).sizeBytes).toBe(0);
  });

  it('ignores a named $DATA stream when sizing a file', () => {
    // A named stream is an alternate data stream; Explorer doesn't count
    // those toward a file's size either.
    const ads = nonResidentDataAttribute(999_999_999);
    ads.writeUInt8(4, 9); // non-zero name length -> named stream
    const record = fileRecord({
      attributes: [fileNameAttribute({ name: 'doc.txt' }), ads, nonResidentDataAttribute(1234)]
    });
    expect(parseFileRecord(record, SECTOR).sizeBytes).toBe(1234);
  });

  it('returns null rather than throwing on an attribute claiming an absurd length', () => {
    const bad = residentAttribute(ATTR_FILE_NAME, Buffer.alloc(16));
    bad.writeUInt32LE(0xfffffff0, 4);
    const record = fileRecord({ attributes: [bad] });
    expect(() => parseFileRecord(record, SECTOR)).not.toThrow();
  });

  it('returns null for a record with no $FILE_NAME at all', () => {
    const record = fileRecord({ attributes: [residentAttribute(ATTR_DATA, Buffer.alloc(8))] });
    expect(parseFileRecord(record, SECTOR)).toBeNull();
  });
});

/* ---- allocated ("size on disk") size, hard links ----------------------
 *
 * An earlier attempt read the allocated size from offset 0x28 of the
 * non-resident header and summed to 1270 GB on a 952.9 GB volume. That
 * field is the cluster-rounded size of the WHOLE stream -- for a sparse or
 * compressed stream it still counts the holes. What the file really holds
 * on disk is the clusters its runlist maps to real locations, so that is
 * what these tests pin down. */

const CLUSTER = 4096;

/** Encodes runs as an NTFS runlist. A run is { count, delta } where delta is
 * the signed cluster offset from the previous run's start, or null for a
 * sparse run (a hole). */
function encodeRunlist(runs) {
  const bytes = [];
  const minimal = (value, signed) => {
    let n = 1;
    for (;;) {
      const max = signed ? 2 ** (8 * n - 1) : 2 ** (8 * n);
      if (signed ? value >= -max && value < max : value < max) return n;
      n += 1;
    }
  };
  for (const { count, delta } of runs) {
    const lengthBytes = minimal(count, false);
    const offsetBytes = delta === null ? 0 : minimal(delta, true);
    bytes.push((offsetBytes << 4) | lengthBytes);
    for (let i = 0; i < lengthBytes; i++) bytes.push(Math.floor(count / 256 ** i) % 256);
    if (delta !== null) {
      const unsigned = delta < 0 ? delta + 256 ** offsetBytes : delta;
      for (let i = 0; i < offsetBytes; i++) bytes.push(Math.floor(unsigned / 256 ** i) % 256);
    }
  }
  bytes.push(0);
  return Buffer.from(bytes);
}

/** A non-resident attribute with a real runlist. `name` makes it a named
 * stream; `flags` is the attribute's flag word (0x0001 compressed, 0x8000
 * sparse); `allocatedField` is what the header's 0x28 field claims. */
function streamAttribute({ type = ATTR_DATA, runs, realSize = 0, startingVcn = 0, name = '', flags = 0, allocatedField = 0 }) {
  const list = encodeRunlist(runs);
  const nameBuffer = Buffer.from(name, 'utf16le');
  const nameOffset = 0x48;
  const runOffset = nameOffset + nameBuffer.length + ((8 - ((nameOffset + nameBuffer.length) % 8)) % 8);
  const length = runOffset + list.length + ((8 - (list.length % 8)) % 8);
  const b = Buffer.alloc(length);
  b.writeUInt32LE(type, 0);
  b.writeUInt32LE(length, 4);
  b.writeUInt8(1, 8);
  b.writeUInt8(name.length, 9);
  b.writeUInt16LE(nameOffset, 10);
  b.writeUInt16LE(flags, 12);
  b.writeBigUInt64LE(BigInt(startingVcn), 0x10);
  b.writeUInt16LE(runOffset, 0x20);
  b.writeBigUInt64LE(BigInt(allocatedField), 0x28);
  b.writeBigUInt64LE(BigInt(startingVcn === 0 ? realSize : 0), 0x30);
  nameBuffer.copy(b, nameOffset);
  list.copy(b, runOffset);
  return b;
}

const parse = (attributes, { flags } = {}) => {
  const record = fileRecord({ attributes: [fileNameAttribute({ name: 'f.bin' }), ...attributes] });
  if (flags !== undefined) record.writeUInt16LE(flags, 0x16);
  return parseFileRecord(record, SECTOR, CLUSTER);
};

describe('allocated size', () => {
  it('is the clusters the runlist maps, times the cluster size', () => {
    const r = parse([streamAttribute({ realSize: 10_000, runs: [{ count: 3, delta: 100 }] })]);
    expect(r.sizeBytes).toBe(10_000);
    expect(r.allocatedBytes).toBe(3 * CLUSTER);
  });

  it('adds up every run of a fragmented file, including one that jumps backwards', () => {
    const r = parse([streamAttribute({ realSize: 20_000, runs: [{ count: 2, delta: 500 }, { count: 1, delta: -300 }, { count: 2, delta: 40 }] })]);
    expect(r.allocatedBytes).toBe(5 * CLUSTER);
  });

  // The 1270 GB bug: header field 0x28 counts the holes, the runlist does not.
  it('does not count the holes of a sparse file, whatever the header field says', () => {
    const r = parse([streamAttribute({
      realSize: 1_000_000_000, flags: 0x8000, allocatedField: 1_000_000_000,
      runs: [{ count: 2, delta: 900 }, { count: 200_000, delta: null }, { count: 1, delta: 10 }]
    })]);
    expect(r.sizeBytes).toBe(1_000_000_000);
    expect(r.allocatedBytes).toBe(3 * CLUSTER);
  });

  it('counts only the stored clusters of a compressed file', () => {
    const r = parse([streamAttribute({
      realSize: 64 * CLUSTER, flags: 0x0001, allocatedField: 64 * CLUSTER,
      runs: [{ count: 5, delta: 70 }, { count: 11, delta: null }]
    })]);
    expect(r.allocatedBytes).toBe(5 * CLUSTER);
  });

  it('is zero for data that lives inside the MFT record itself', () => {
    const r = parse([residentAttribute(ATTR_DATA, Buffer.alloc(300))]);
    expect(r.sizeBytes).toBe(300);
    expect(r.allocatedBytes).toBe(0);
  });

  it('is zero for a file with no data at all', () => {
    expect(parse([]).allocatedBytes).toBe(0);
  });

  it('counts an alternate data stream on disk, but not in the logical size', () => {
    const r = parse([
      streamAttribute({ realSize: 5000, runs: [{ count: 2, delta: 10 }] }),
      streamAttribute({ name: 'Zone', realSize: 90_000, runs: [{ count: 22, delta: 50 }] })
    ]);
    expect(r.sizeBytes).toBe(5000);
    expect(r.streamAllocatedBytes).toBe(22 * CLUSTER);
    expect(r.allocatedBytes).toBe(24 * CLUSTER);
  });

  it('counts a directory\'s index buffers', () => {
    const record = fileRecord({ attributes: [
      fileNameAttribute({ name: 'Windows' }),
      streamAttribute({ type: 0xa0, name: '$I30', runs: [{ count: 4, delta: 30 }] })
    ] });
    record.writeUInt16LE(0x0003, 0x16);
    const r = parseFileRecord(record, SECTOR, CLUSTER);
    expect(r.isDirectory).toBe(true);
    expect(r.indexAllocatedBytes).toBe(4 * CLUSTER);
    expect(r.allocatedBytes).toBe(4 * CLUSTER);
    expect(r.sizeBytes).toBe(0);
  });

  it('sums the fragments of one stream split across attribute instances', () => {
    const r = parse([
      streamAttribute({ realSize: 9 * CLUSTER, runs: [{ count: 4, delta: 10 }] }),
      streamAttribute({ startingVcn: 4, runs: [{ count: 5, delta: 100 }] })
    ]);
    expect(r.sizeBytes).toBe(9 * CLUSTER);
    expect(r.allocatedBytes).toBe(9 * CLUSTER);
  });

  it('reports the allocation of an extension record, to be added to its base', () => {
    const record = fileRecord({ attributes: [streamAttribute({ startingVcn: 4, runs: [{ count: 6, delta: 100 }] })] });
    record.writeBigUInt64LE(123n, 0x20);
    const r = parseFileRecord(record, SECTOR, CLUSTER);
    expect(r.kind).toBe('extension');
    expect(r.allocatedBytes).toBe(6 * CLUSTER);
  });

  it('survives a runlist that is cut off', () => {
    const attr = streamAttribute({ realSize: 100, runs: [{ count: 3, delta: 100 }] });
    attr[0x48] = 0x44; // header promising 4+4 bytes that are not there
    expect(() => parse([attr])).not.toThrow();
  });

  it('is left out when the caller does not say how big a cluster is', () => {
    const record = fileRecord({ attributes: [fileNameAttribute({ name: 'f.bin' }), streamAttribute({ realSize: 1, runs: [{ count: 1, delta: 1 }] })] });
    expect(parseFileRecord(record, SECTOR).allocatedBytes).toBeUndefined();
  });
});

describe('flags that explain a gap between size and allocation', () => {
  it('marks a sparse stream and a compressed stream', () => {
    expect(parse([streamAttribute({ realSize: 9, flags: 0x8000, runs: [{ count: 1, delta: 1 }] })]).sparse).toBe(true);
    expect(parse([streamAttribute({ realSize: 9, flags: 0x0001, runs: [{ count: 1, delta: 1 }] })]).sparse).toBe(true);
    expect(parse([streamAttribute({ realSize: 9, runs: [{ count: 1, delta: 1 }] })]).sparse).toBe(false);
  });
});

describe('hard links', () => {
  // One record is one file. Its several $FILE_NAME attributes are names for
  // that file, so it is one entry: the bytes are counted once, under one name.
  it('is one entry however many names the record carries', () => {
    const record = fileRecord({ attributes: [
      fileNameAttribute({ name: 'real.dll', parentRecord: 40 }),
      fileNameAttribute({ name: 'link-in-winsxs.dll', parentRecord: 77 }),
      fileNameAttribute({ name: 'LINK-I~1.DLL', parentRecord: 77, namespace: 2 }),
      streamAttribute({ realSize: 8000, runs: [{ count: 2, delta: 10 }] })
    ] });
    record.writeUInt16LE(3, 0x12); // hard link count
    const r = parseFileRecord(record, SECTOR, CLUSTER);
    expect(r.kind).toBe('entry');
    expect(r.sizeBytes).toBe(8000);
    expect(r.allocatedBytes).toBe(2 * CLUSTER);
    expect(r.hardLinks).toBe(3);
  });

  it('reports no link count for an ordinary file', () => {
    const record = fileRecord({ attributes: [fileNameAttribute({ name: 'a.txt' })] });
    record.writeUInt16LE(1, 0x12);
    expect(parseFileRecord(record, SECTOR, CLUSTER).hardLinks).toBeUndefined();
  });
});
/** The helpers above build on-disk form; parseFileRecord applies fixups
 * itself, so a test that mutates flags after construction needs the
 * record already un-fixed-up to stay consistent. */
function applyFixupsInPlaceForTest(record) {
  applyFixups(record, SECTOR);
  // Re-stamp so parseFileRecord's own applyFixups still validates.
  const usaOffset = record.readUInt16LE(4);
  const sequence = record.readUInt16LE(usaOffset);
  const count = record.readUInt16LE(6) - 1;
  for (let i = 0; i < count; i++) {
    record[usaOffset + 2 + i * 2] = record[(i + 1) * SECTOR - 2];
    record[usaOffset + 3 + i * 2] = record[(i + 1) * SECTOR - 1];
    record.writeUInt16LE(sequence, (i + 1) * SECTOR - 2);
  }
}

/* ---- $STANDARD_INFORMATION: when the file was last written ------------- */

/** Windows FILETIME: 100 ns ticks since 1601-01-01. */
const filetime = (ms) => BigInt(Math.round(ms)) * 10000n + 116444736000000000n;

function standardInformation({ created = 0, modified = 0, changed = 0, accessed = 0, short = false }) {
  const value = Buffer.alloc(short ? 0x10 : 0x30);
  value.writeBigUInt64LE(filetime(created), 0);
  value.writeBigUInt64LE(filetime(modified), 8);
  if (!short) {
    value.writeBigUInt64LE(filetime(changed), 0x10);
    value.writeBigUInt64LE(filetime(accessed), 0x18);
  }
  return residentAttribute(0x10, value);
}

describe('modified time', () => {
  const WHEN = Date.UTC(2026, 6, 4, 12, 30, 15, 250);

  it('reads the last-write time from $STANDARD_INFORMATION as Unix milliseconds', () => {
    const r = parse([standardInformation({ created: WHEN - 5000, modified: WHEN, changed: WHEN + 1000, accessed: WHEN + 2000 })]);
    // 100 ns ticks lose a sub-millisecond digit at most; to the millisecond is exact here.
    expect(r.modified).toBe(WHEN);
  });

  it('takes the write time, not the creation, MFT-change or access time', () => {
    const r = parse([standardInformation({ created: 1000, modified: WHEN, changed: 3000, accessed: 4000 })]);
    expect(r.modified).toBe(WHEN);
  });

  it('is null when the record has no $STANDARD_INFORMATION', () => {
    expect(parse([]).modified).toBeNull();
  });

  it('is null for a zero time rather than 1601', () => {
    const value = Buffer.alloc(0x30);
    expect(parse([residentAttribute(0x10, value)]).modified).toBeNull();
  });

  it('is null for a value too short to hold the time', () => {
    expect(parse([residentAttribute(0x10, Buffer.alloc(8))]).modified).toBeNull();
  });

  it('is null for a time that is not plausible (a corrupt record), not a date in the year 30000', () => {
    const value = Buffer.alloc(0x30);
    value.writeBigUInt64LE(0x7fffffffffffffffn, 8);
    expect(parse([residentAttribute(0x10, value)]).modified).toBeNull();
  });

  it('works for a directory too', () => {
    const record = fileRecord({ attributes: [standardInformation({ modified: WHEN }), fileNameAttribute({ name: 'Windows' })] });
    record.writeUInt16LE(0x0003, 0x16);
    expect(parseFileRecord(record, SECTOR, CLUSTER).modified).toBe(WHEN);
  });
});