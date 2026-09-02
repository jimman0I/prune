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
