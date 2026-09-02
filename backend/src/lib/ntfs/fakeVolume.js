import { ATTR_DATA, ATTR_FILE_NAME } from './record.js';

/** Builds a real, byte-accurate NTFS volume image in memory: boot sector,
 * an MFT whose record 0 describes itself with a proper runlist, and one
 * FILE record per entry with update sequence arrays applied.
 *
 * This exists so scanVolume's whole pipeline can be tested without
 * Administrator. Reading a real volume needs a raw handle Windows only
 * grants to an elevated process, so without a synthetic volume the only
 * way to exercise the parser end to end would be a manual elevated run --
 * which is exactly the kind of "verified once, never again" coverage that
 * lets a regression through later.
 *
 * Test-only, but deliberately NOT a mock: it produces the same bytes a
 * real volume would, so a parser bug shows up here the same way it would
 * on disk. */
const BYTES_PER_SECTOR = 512;
const SECTORS_PER_CLUSTER = 8;
const BYTES_PER_CLUSTER = BYTES_PER_SECTOR * SECTORS_PER_CLUSTER;
const BYTES_PER_RECORD = 1024;
const MFT_CLUSTER = 4;

/** `entries` is [{ record, name, parent, size, isDirectory }]. Record 0 is
 * the MFT itself and record 5 the root; both are added automatically. */
export function buildFakeVolume(entries, { totalClusters = 256, mftRunClusters = null } = {}) {
  const allEntries = [
    { record: 5, name: '.', parent: 5, size: 0, isDirectory: true },
    ...entries
  ];
  const highestRecord = allEntries.reduce((max, e) => Math.max(max, e.record), 0);
  const recordCount = highestRecord + 1;
  const mftBytes = recordCount * BYTES_PER_RECORD;
  const mftClusters = mftRunClusters ?? Math.ceil(mftBytes / BYTES_PER_CLUSTER);

  const volume = Buffer.alloc(totalClusters * BYTES_PER_CLUSTER);
  writeBootSector(volume, totalClusters);

  const mftOffset = MFT_CLUSTER * BYTES_PER_CLUSTER;
  // Record 0: the MFT describing where it lives.
  writeRecord(volume, mftOffset, mftSelfRecord(mftClusters, mftBytes));

  for (const entry of allEntries) {
    writeRecord(volume, mftOffset + entry.record * BYTES_PER_RECORD, fileRecordFor(entry));
  }

  return {
    volume,
    readAt(buffer, offset) {
      if (offset < 0 || offset + buffer.length > volume.length) {
        throw new Error(`Read past end of fake volume: ${offset} + ${buffer.length}`);
      }
      volume.copy(buffer, 0, offset, offset + buffer.length);
    }
  };
}

function writeBootSector(volume, totalClusters) {
  volume.write('NTFS    ', 3, 'latin1');
  volume.writeUInt16LE(BYTES_PER_SECTOR, 11);
  volume.writeUInt8(SECTORS_PER_CLUSTER, 13);
  volume.writeBigUInt64LE(BigInt(totalClusters * SECTORS_PER_CLUSTER), 40);
  volume.writeBigUInt64LE(BigInt(MFT_CLUSTER), 48);
  volume.writeInt8(-10, 64); // 2^10 = 1024-byte records, what real volumes use
}

/** Stamps the update sequence array the way NTFS does on disk: the real
 * last two bytes of each sector move into the array, and the sectors get
 * the check value. */
function writeRecord(volume, offset, record) {
  const usaOffset = record.readUInt16LE(4);
  const sectors = record.readUInt16LE(6) - 1;
  const sequence = 0x0007;
  record.writeUInt16LE(sequence, usaOffset);
  for (let i = 0; i < sectors; i++) {
    const tail = (i + 1) * BYTES_PER_SECTOR - 2;
    record[usaOffset + 2 + i * 2] = record[tail];
    record[usaOffset + 3 + i * 2] = record[tail + 1];
    record.writeUInt16LE(sequence, tail);
  }
  record.copy(volume, offset);
}

function emptyRecord() {
  const b = Buffer.alloc(BYTES_PER_RECORD);
  b.write('FILE', 0, 'latin1');
  b.writeUInt16LE(0x30, 4);                              // USA offset
  b.writeUInt16LE(1 + BYTES_PER_RECORD / BYTES_PER_SECTOR, 6);
  b.writeUInt16LE(0x38, 0x14);                           // first attribute
  b.writeUInt16LE(0x0001, 0x16);                         // in use
  b.writeUInt32LE(BYTES_PER_RECORD, 0x18);
  return b;
}

function mftSelfRecord(mftClusters, mftBytes) {
  const b = emptyRecord();
  const attrLength = 0x50;
  let o = 0x38;
  b.writeUInt32LE(ATTR_DATA, o);
  b.writeUInt32LE(attrLength, o + 4);
  b.writeUInt8(1, o + 8);                 // non-resident
  b.writeUInt8(0, o + 9);                 // unnamed
  b.writeUInt16LE(0x48, o + 0x20);        // runlist offset within the attribute
  b.writeBigUInt64LE(BigInt(mftBytes), o + 0x30);  // real size
  // One run: 0x21 = 1 length byte, 2 offset bytes.
  const runlist = Buffer.from([0x21, mftClusters & 0xff, MFT_CLUSTER, 0x00, 0x00]);
  runlist.copy(b, o + 0x48);
  b.writeUInt32LE(0xffffffff, o + attrLength);
  return b;
}

function fileRecordFor({ record, name, parent, size, allocated, isDirectory, dataInExtension, baseRecord, startingVcn = 0 }) {
  const b = emptyRecord();

  // An extension record: attributes belonging to `baseRecord`, no name of
  // its own. This is how NTFS stores a file whose attributes outgrew one
  // record, and it's where large fragmented files keep their $DATA.
  if (baseRecord !== undefined) {
    b.writeUInt16LE(0x0001, 0x16);
    b.writeBigUInt64LE(BigInt(baseRecord) | (3n << 48n), 0x20);
    const end = 0x38 + writeDataAttribute(b, 0x38, size, startingVcn, allocated);
    b.writeUInt32LE(0xffffffff, end);
    return b;
  }

  b.writeUInt16LE(isDirectory ? 0x0003 : 0x0001, 0x16);

  let o = 0x38;
  o += writeFileNameAttribute(b, o, { name, parent });
  // `dataInExtension` leaves the base record with a name and no size at
  // all, exactly as a real volume does once $DATA has moved out.
  if (!isDirectory && !dataInExtension) o += writeDataAttribute(b, o, size, 0, allocated);
  b.writeUInt32LE(0xffffffff, o);
  return b;
}

function writeFileNameAttribute(record, offset, { name, parent }) {
  const nameBuffer = Buffer.from(name, 'utf16le');
  // 0x42 is where the name starts in a $FILE_NAME value -- see record.js
  // for the field-by-field count. Getting this wrong here is worse than
  // useless: it makes the parser's matching mistake invisible.
  const valueLength = 0x42 + nameBuffer.length;
  const headerLength = 0x18;
  const length = align8(headerLength + valueLength);

  record.writeUInt32LE(ATTR_FILE_NAME, offset);
  record.writeUInt32LE(length, offset + 4);
  record.writeUInt8(0, offset + 8);                    // resident
  record.writeUInt32LE(valueLength, offset + 0x10);
  record.writeUInt16LE(headerLength, offset + 0x14);

  const v = offset + headerLength;
  // High 16 bits are a sequence number, as on a real volume -- a parser
  // that doesn't mask them off puts every file under a nonexistent parent.
  record.writeBigUInt64LE(BigInt(parent) | (3n << 48n), v);
  record.writeUInt8(name.length, v + 0x40);
  record.writeUInt8(1, v + 0x41);                      // Win32 namespace
  nameBuffer.copy(record, v + 0x42);
  return length;
}

function writeDataAttribute(record, offset, size, startingVcn = 0, allocated) {
  // Real volumes round allocated size up to whole clusters; a caller that
  // doesn't care gets that default rather than a zero that would look
  // like a sparse file.
  const onDisk = allocated === undefined ? Math.ceil(size / BYTES_PER_CLUSTER) * BYTES_PER_CLUSTER : allocated;
  const length = 0x50;
  record.writeUInt32LE(ATTR_DATA, offset);
  record.writeUInt32LE(length, offset + 4);
  record.writeUInt8(1, offset + 8);                    // non-resident
  record.writeUInt8(0, offset + 9);                    // unnamed
  // Only the fragment starting at VCN 0 states the file's real size; the
  // rest report zero, exactly as on disk.
  record.writeBigUInt64LE(BigInt(startingVcn), offset + 0x10);
  record.writeUInt16LE(0x48, offset + 0x20);
  record.writeBigUInt64LE(BigInt(startingVcn === 0 ? onDisk : 0), offset + 0x28);
  record.writeBigUInt64LE(BigInt(startingVcn === 0 ? size : 0), offset + 0x30);
  return length;
}

function align8(value) {
  return value + ((8 - (value % 8)) % 8);
}
