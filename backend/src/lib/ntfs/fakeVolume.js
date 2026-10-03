import { ATTR_DATA, ATTR_FILE_NAME, ATTR_INDEX_ALLOCATION } from './record.js';

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
/** Real data lives somewhere on a volume; nothing here reads it back, so any
 * cluster will do for a file's extent. */
const FILE_LCN = 20;

/** `entries` is [{ record, name, parent, size, isDirectory, ... }]. Record 0
 * is the MFT itself and record 5 the root; both are added automatically.
 *
 * Optional per entry:
 *   allocated   bytes really allocated (default: size rounded up to clusters)
 *   holes       sparse clusters appended to the file's runlist
 *   sparse      set the sparse flag on the data attribute
 *   resident    keep the data inside the record (no clusters)
 *   modified    last-write time, ms since the Unix epoch ($STANDARD_INFORMATION)
 *   links       [parentRecord, ...] extra hard-link names (header count follows)
 *   streams     [{ name, clusters }] alternate data streams
 *   indexClusters  a directory's index buffers
 *
 * `usedClusters` makes record 6 an honest $Bitmap with that many clusters
 * marked in use -- the volume's own ground truth for "space in use". */
export function buildFakeVolume(entries, { totalClusters = 256, mftRunClusters = null, usedClusters = null } = {}) {
  const allEntries = [
    { record: 5, name: '.', parent: 5, size: 0, isDirectory: true },
    ...entries
  ];
  const bitmapLcn = totalClusters - 2;
  if (usedClusters !== null && !allEntries.some((e) => e.record === 6)) {
    allEntries.push({
      record: 6, name: '$Bitmap', parent: 5, isDirectory: false, resident: false,
      size: Math.ceil(totalClusters / 8), bitmapLcn
    });
  }

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

  if (usedClusters !== null) {
    const bits = Buffer.alloc(Math.ceil(totalClusters / 8));
    for (let i = 0; i < usedClusters; i++) bits[i >> 3] |= 1 << (i & 7);
    bits.copy(volume, bitmapLcn * BYTES_PER_CLUSTER);
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

/** The same volume as buildFakeVolume, for a table far too big to hold: each
 * record's bytes are produced when the scan asks for them and never kept, so
 * a million-record drive costs time, not gigabytes.
 *
 * `entryFor(record)` returns the entry for that record number (the fields
 * buildFakeVolume takes) or null for an unused slot. Records 0 (the MFT) and
 * 5 (the root) are supplied here. This is what lets the worker's memory and
 * output size be measured against a drive of the size that broke it. */
export function buildLazyFakeVolume({ recordCount, entryFor }) {
  const mftBytes = recordCount * BYTES_PER_RECORD;
  const mftClusters = Math.ceil(mftBytes / BYTES_PER_CLUSTER);
  const totalClusters = MFT_CLUSTER + mftClusters + 16;
  const mftOffset = MFT_CLUSTER * BYTES_PER_CLUSTER;

  const boot = Buffer.alloc(mftOffset);
  writeBootSector(boot, totalClusters);
  const selfRecord = mftSelfRecord(mftClusters, mftBytes);
  const scratch = Buffer.alloc(BYTES_PER_RECORD);

  function recordInto(number, target, targetOffset) {
    if (number === 0) {
      writeRecord(target, targetOffset, selfRecord);
      return;
    }
    const entry = number === 5 ? { record: 5, name: '.', parent: 5, size: 0, isDirectory: true } : entryFor(number);
    if (!entry) { target.fill(0, targetOffset, targetOffset + BYTES_PER_RECORD); return; }
    writeRecord(target, targetOffset, fileRecordFor({ ...entry, record: number }));
  }

  return {
    volumeBytes: totalClusters * BYTES_PER_CLUSTER,
    readAt(buffer, offset) {
      buffer.fill(0);
      if (offset < mftOffset) {
        boot.copy(buffer, 0, offset, Math.min(boot.length, offset + buffer.length));
        return;
      }
      const end = offset + buffer.length;
      const mftEnd = mftOffset + mftBytes;
      if (offset >= mftEnd) return;
      const first = Math.floor((offset - mftOffset) / BYTES_PER_RECORD);
      const last = Math.min(recordCount - 1, Math.floor((Math.min(end, mftEnd) - 1 - mftOffset) / BYTES_PER_RECORD));
      for (let n = first; n <= last; n++) {
        const at = mftOffset + n * BYTES_PER_RECORD;
        if (at >= offset && at + BYTES_PER_RECORD <= end) {
          recordInto(n, buffer, at - offset);
        } else {
          recordInto(n, scratch, 0);
          const from = Math.max(at, offset);
          const to = Math.min(at + BYTES_PER_RECORD, end);
          scratch.copy(buffer, from - offset, from - at, to - at);
        }
      }
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
  // One run. Small tables: 0x21 = 1 length byte, 2 offset bytes. A table past
  // 255 clusters (the lazy volume below) needs a 4-byte length: 0x24.
  const runlist = mftClusters <= 0xff
    ? Buffer.from([0x21, mftClusters & 0xff, MFT_CLUSTER, 0x00, 0x00])
    : Buffer.from([0x24, mftClusters & 0xff, (mftClusters >> 8) & 0xff, (mftClusters >> 16) & 0xff, (mftClusters >>> 24) & 0xff, MFT_CLUSTER, 0x00, 0x00]);
  runlist.copy(b, o + 0x48);
  b.writeUInt32LE(0xffffffff, o + attrLength);
  return b;
}

/** Windows FILETIME (100 ns since 1601) for a Unix-epoch millisecond value. */
function toFiletime(ms) {
  return BigInt(Math.round(ms)) * 10000n + 116444736000000000n;
}

function fileRecordFor({ record, name, parent, size = 0, allocated, holes = 0, sparse = false, resident = false, isDirectory, dataInExtension, baseRecord, startingVcn = 0, modified, links = [], streams = [], indexClusters = 0, bitmapLcn }) {
  const b = emptyRecord();

  // An extension record: attributes belonging to `baseRecord`, no name of
  // its own. This is how NTFS stores a file whose attributes outgrew one
  // record, and it's where large fragmented files keep their $DATA.
  if (baseRecord !== undefined) {
    b.writeUInt16LE(0x0001, 0x16);
    b.writeBigUInt64LE(BigInt(baseRecord) | (3n << 48n), 0x20);
    const end = 0x38 + writeDataAttribute(b, 0x38, { size, startingVcn, allocated, holes, sparse });
    b.writeUInt32LE(0xffffffff, end);
    return b;
  }

  b.writeUInt16LE(isDirectory ? 0x0003 : 0x0001, 0x16);
  b.writeUInt16LE(1 + links.length, 0x12); // hard link count

  let o = 0x38;
  if (modified !== undefined) o += writeStandardInformation(b, o, modified);
  o += writeFileNameAttribute(b, o, { name, parent });
  for (const linkParent of links) o += writeFileNameAttribute(b, o, { name: `${name}.link${linkParent}`, parent: linkParent });
  // `dataInExtension` leaves the base record with a name and no size at
  // all, exactly as a real volume does once $DATA has moved out.
  if (!isDirectory && !dataInExtension) {
    o += resident
      ? writeResidentData(b, o, size)
      : writeDataAttribute(b, o, { size, startingVcn: 0, allocated, holes, sparse, lcn: bitmapLcn });
  }
  for (const stream of streams) o += writeStream(b, o, stream);
  if (indexClusters > 0) o += writeIndexAllocation(b, o, indexClusters);
  b.writeUInt32LE(0xffffffff, o);
  return b;
}

function writeStandardInformation(record, offset, modified) {
  const valueLength = 0x30;
  const headerLength = 0x18;
  const length = align8(headerLength + valueLength);
  record.writeUInt32LE(0x10, offset);
  record.writeUInt32LE(length, offset + 4);
  record.writeUInt8(0, offset + 8);
  record.writeUInt32LE(valueLength, offset + 0x10);
  record.writeUInt16LE(headerLength, offset + 0x14);
  const v = offset + headerLength;
  // creation, modification, MFT change, access -- 8 bytes each.
  record.writeBigUInt64LE(toFiletime(modified - 1000), v);
  record.writeBigUInt64LE(toFiletime(modified), v + 8);
  record.writeBigUInt64LE(toFiletime(modified + 1000), v + 0x10);
  record.writeBigUInt64LE(toFiletime(modified + 2000), v + 0x18);
  return length;
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

function writeResidentData(record, offset, size) {
  const headerLength = 0x18;
  const length = align8(headerLength + size);
  record.writeUInt32LE(ATTR_DATA, offset);
  record.writeUInt32LE(length, offset + 4);
  record.writeUInt8(0, offset + 8);
  record.writeUInt32LE(size, offset + 0x10);
  record.writeUInt16LE(headerLength, offset + 0x14);
  return length;
}

/** The runlist of a stream: real clusters, then optional holes. */
function runlistFor(allocatedBytes, holes, lcn = FILE_LCN) {
  const clusters = Math.ceil(allocatedBytes / BYTES_PER_CLUSTER);
  const bytes = [];
  const lengthField = (n) => {
    const width = n > 0xffffff ? 4 : n > 0xffff ? 3 : n > 0xff ? 2 : 1;
    return [width, Array.from({ length: width }, (_, i) => Math.floor(n / 256 ** i) % 256)];
  };
  if (clusters > 0) {
    const [width, field] = lengthField(clusters);
    // header: 2 offset bytes in the high nibble, `width` length bytes low.
    bytes.push(0x20 | width, ...field, lcn & 0xff, (lcn >> 8) & 0xff);
  }
  if (holes > 0) {
    const [width, field] = lengthField(holes);
    bytes.push(width, ...field); // no offset bytes: a sparse run
  }
  bytes.push(0);
  return Buffer.from(bytes);
}

function writeDataAttribute(record, offset, { size, startingVcn = 0, allocated, holes = 0, sparse = false, lcn, name = '' }) {
  // Real volumes round allocated size up to whole clusters; a caller that
  // doesn't care gets that default rather than a zero that would look
  // like a sparse file.
  const onDisk = allocated === undefined ? Math.ceil(size / BYTES_PER_CLUSTER) * BYTES_PER_CLUSTER : allocated;
  const runs = runlistFor(onDisk, holes, lcn);
  const length = align8(0x48 + runs.length);
  record.writeUInt32LE(ATTR_DATA, offset);
  record.writeUInt32LE(length, offset + 4);
  record.writeUInt8(1, offset + 8);                    // non-resident
  record.writeUInt8(0, offset + 9);                    // unnamed
  if (sparse) record.writeUInt16LE(0x8000, offset + 0x0c);
  // Only the fragment starting at VCN 0 states the file's real size; the
  // rest report zero, exactly as on disk.
  record.writeBigUInt64LE(BigInt(startingVcn), offset + 0x10);
  record.writeUInt16LE(0x48, offset + 0x20);
  // The header's allocated-size field counts holes too (the very trap that
  // once summed to 1270 GB), so the fake does the same.
  const headerAllocated = onDisk + holes * BYTES_PER_CLUSTER;
  record.writeBigUInt64LE(BigInt(startingVcn === 0 ? headerAllocated : 0), offset + 0x28);
  record.writeBigUInt64LE(BigInt(startingVcn === 0 ? size : 0), offset + 0x30);
  runs.copy(record, offset + 0x48);
  return length;
}

function writeStream(record, offset, { name, clusters }) {
  const runs = Buffer.from([0x31, clusters & 0xff, FILE_LCN & 0xff, (FILE_LCN >> 8) & 0xff, 0]);
  const nameBuffer = Buffer.from(name, 'utf16le');
  const nameOffset = 0x48;
  const runOffset = align8(nameOffset + nameBuffer.length);
  const length = align8(runOffset + runs.length);
  record.writeUInt32LE(ATTR_DATA, offset);
  record.writeUInt32LE(length, offset + 4);
  record.writeUInt8(1, offset + 8);
  record.writeUInt8(name.length, offset + 9);
  record.writeUInt16LE(nameOffset, offset + 10);
  record.writeUInt16LE(runOffset, offset + 0x20);
  record.writeBigUInt64LE(BigInt(clusters * BYTES_PER_CLUSTER), offset + 0x28);
  record.writeBigUInt64LE(BigInt(clusters * BYTES_PER_CLUSTER), offset + 0x30);
  nameBuffer.copy(record, offset + nameOffset);
  runs.copy(record, offset + runOffset);
  return length;
}

function writeIndexAllocation(record, offset, clusters) {
  const name = '$I30';
  const runs = Buffer.from([0x31, clusters & 0xff, FILE_LCN & 0xff, (FILE_LCN >> 8) & 0xff, 0]);
  const nameBuffer = Buffer.from(name, 'utf16le');
  const nameOffset = 0x48;
  const runOffset = align8(nameOffset + nameBuffer.length);
  const length = align8(runOffset + runs.length);
  record.writeUInt32LE(ATTR_INDEX_ALLOCATION, offset);
  record.writeUInt32LE(length, offset + 4);
  record.writeUInt8(1, offset + 8);
  record.writeUInt8(name.length, offset + 9);
  record.writeUInt16LE(nameOffset, offset + 10);
  record.writeUInt16LE(runOffset, offset + 0x20);
  record.writeBigUInt64LE(BigInt(clusters * BYTES_PER_CLUSTER), offset + 0x28);
  nameBuffer.copy(record, offset + nameOffset);
  runs.copy(record, offset + runOffset);
  return length;
}

function align8(value) {
  return value + ((8 - (value % 8)) % 8);
}
