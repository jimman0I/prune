import { decodeRunlist } from './runlist.js';

export const ATTR_FILE_NAME = 0x30;
export const ATTR_DATA = 0x80;
export const ATTR_INDEX_ALLOCATION = 0xa0;

const FLAG_IN_USE = 0x0001;
const FLAG_DIRECTORY = 0x0002;
const END_OF_ATTRIBUTES = 0xffffffff;

// Attribute flag bits (offset 0x0C of an attribute header).
const ATTR_FLAG_COMPRESSED = 0x0001;
const ATTR_FLAG_SPARSE = 0x8000;

// $FILE_NAME namespaces. A file usually has two of these attributes: the
// real name and an 8.3 alias. Preferring the alias fills a scan with
// PROGRA~1 instead of "Program Files".
const NAMESPACE_DOS = 2;

/** Reverses NTFS's update sequence array, IN PLACE.
 *
 * NTFS overwrites the last two bytes of every sector in a record with a
 * check value, stashing the real bytes in an array in the header. This
 * exists so a torn write is detectable: if a sector's tail doesn't hold
 * the expected value, that sector was never written and the record's
 * contents are not trustworthy.
 *
 * Returns false for such a record (and for a header claiming an array
 * larger than the buffer). Parsing on regardless is the failure mode that
 * matters here -- it doesn't crash, it yields realistic-looking names and
 * sizes that are simply wrong. */
export function applyFixups(record, bytesPerSector) {
  const usaOffset = record.readUInt16LE(4);
  const usaCount = record.readUInt16LE(6);
  if (usaCount < 1) return false;

  const sectors = usaCount - 1; // first word is the check value itself
  if (sectors * bytesPerSector > record.length) return false;
  if (usaOffset + usaCount * 2 > record.length) return false;

  const expected = record.readUInt16LE(usaOffset);
  for (let i = 0; i < sectors; i++) {
    const tail = (i + 1) * bytesPerSector - 2;
    if (record.readUInt16LE(tail) !== expected) return false;
    record[tail] = record[usaOffset + 2 + i * 2];
    record[tail + 1] = record[usaOffset + 3 + i * 2];
  }
  return true;
}

/** Parses one MFT slot into one of three outcomes:
 *
 *   { kind: 'entry', name, parentRecord, sizeBytes, allocatedBytes, isDirectory, ... }
 *       a real file or directory
 *   { kind: 'extension', baseRecord, sizeBytes, allocatedBytes, ... }
 *       a continuation of another record -- not a file of its own, but it
 *       may carry the $DATA that names the base record's size
 *   null
 *       nothing a scan should count
 *
 * Null covers three genuinely different "not a file" cases, each of which
 * would otherwise become a bogus tree entry: the slot was never a record
 * (or is a deleted one still on disk), the record failed its fixup check
 * (torn write), or it has no $FILE_NAME so there is nothing to call it.
 *
 * `bytesPerCluster` turns runlist cluster counts into bytes. Without it no
 * allocation is reported (`allocatedBytes` is undefined), because a size on
 * disk guessed from a default cluster size would be wrong on any volume
 * formatted differently.
 *
 * Mutates `record` (fixups are applied in place). */
export function parseFileRecord(record, bytesPerSector, bytesPerCluster = 0) {
  if (record.length < 0x30) return null;
  if (record.toString('latin1', 0, 4) !== 'FILE') return null;
  if (!applyFixups(record, bytesPerSector)) return null;

  const flags = record.readUInt16LE(0x16);
  if ((flags & FLAG_IN_USE) === 0) return null;

  // A non-zero base reference means this record is a continuation of
  // another one, not a file in its own right. It is NOT nothing, though:
  // when a file's attributes outgrow one 1024-byte record, NTFS moves
  // $DATA out here, and the base record is left describing a file with no
  // size at all.
  //
  // Measured on this machine before this was handled: 99,660 files had no
  // $DATA in their base record, and the extension records held 290 GB of
  // it. Every one of those files was being counted as zero bytes.
  const baseReference = record.readBigUInt64LE(0x20);
  const isExtension = baseReference !== 0n;
  const isDirectory = (flags & FLAG_DIRECTORY) !== 0;

  let best = null;      // best $FILE_NAME seen so far
  let sizeBytes = 0;
  const allocation = { data: 0, streams: 0, index: 0, sparse: false };
  let position = record.readUInt16LE(0x14);

  while (position + 8 <= record.length) {
    const type = record.readUInt32LE(position);
    if (type === END_OF_ATTRIBUTES) break;

    const length = record.readUInt32LE(position + 4);
    // Guard against a corrupt length: zero would spin forever, and an
    // absurd one would read past the buffer.
    if (length < 8 || position + length > record.length) break;

    if (type === ATTR_FILE_NAME) {
      if (!isExtension) {
        const candidate = readFileName(record, position);
        if (candidate && isBetterName(candidate, best)) best = candidate;
      }
    } else if (type === ATTR_DATA) {
      const named = record.readUInt8(position + 9) !== 0;
      if (!named && !isDirectory) {
        const size = readUnnamedDataSize(record, position);
        if (size !== null) sizeBytes = size;
      }
      addAllocation(allocation, readStreamAllocation(record, position, length, bytesPerCluster), named ? 'streams' : 'data');
    } else if (type === ATTR_INDEX_ALLOCATION) {
      addAllocation(allocation, readStreamAllocation(record, position, length, bytesPerCluster), 'index');
    }
    position += length;
  }

  const allocatedBytes = bytesPerCluster > 0 ? allocation.data + allocation.streams + allocation.index : undefined;

  if (isExtension) {
    return {
      kind: 'extension',
      baseRecord: Number(baseReference & 0x0000ffffffffffffn),
      sizeBytes,
      allocatedBytes,
      streamAllocatedBytes: bytesPerCluster > 0 ? allocation.streams : undefined,
      indexAllocatedBytes: bytesPerCluster > 0 ? allocation.index : undefined,
      sparse: allocation.sparse
    };
  }

  if (!best) return null;

  // The header's own count of names pointing at this file. A record with
  // several $FILE_NAMEs is ONE file with several names: it is one entry here
  // and its bytes are counted once, under one name -- never once per name.
  const links = record.readUInt16LE(0x12);

  return {
    kind: 'entry',
    name: best.name,
    parentRecord: best.parentRecord,
    // A directory's size is the sum of what's inside it, computed by the
    // caller once the whole tree is known -- never its own $DATA.
    sizeBytes: isDirectory ? 0 : sizeBytes,
    allocatedBytes,
    streamAllocatedBytes: bytesPerCluster > 0 ? allocation.streams : undefined,
    indexAllocatedBytes: bytesPerCluster > 0 ? allocation.index : undefined,
    sparse: allocation.sparse,
    hardLinks: links > 1 ? links : undefined,
    isDirectory
  };
}

function addAllocation(allocation, found, bucket) {
  if (!found) return;
  allocation[bucket] += found.bytes;
  if (found.sparse) allocation.sparse = true;
}

/** The bytes one non-resident attribute fragment really occupies on disk,
 * read from its RUNLIST: the clusters mapped to a real location, with holes
 * left out.
 *
 * Not the header's own "allocated size" field (offset 0x28). That one is the
 * cluster-rounded size of the whole stream, and for a sparse or compressed
 * stream it still counts the holes. It was read from there once
 * (2026-09-02) and the total came to 1270 GB on a 952.9 GB volume. The
 * runlist is what NTFS itself consults to know which clusters are in use.
 *
 * Every fragment of a stream is summed (a stream split across attribute
 * records has one runlist per record, over disjoint cluster ranges), where
 * the logical size is taken from the first fragment only.
 *
 * Returns null for data that lives inside the MFT record (resident): it
 * occupies no clusters of its own, the MFT's own allocation holds it. */
function readStreamAllocation(record, attributeOffset, attributeLength, bytesPerCluster) {
  if (record.readUInt8(attributeOffset + 8) === 0) return null; // resident
  if (!(bytesPerCluster > 0)) return null;
  if (attributeOffset + 0x28 > record.length) return null;

  const runlistOffset = record.readUInt16LE(attributeOffset + 0x20);
  if (runlistOffset < 0x40 || runlistOffset >= attributeLength) return { bytes: 0, sparse: false };
  const runs = decodeRunlist(record.subarray(attributeOffset + runlistOffset, attributeOffset + attributeLength));

  let clusters = 0;
  for (const run of runs) if (!run.sparse) clusters += run.clusterCount;

  const attributeFlags = record.readUInt16LE(attributeOffset + 0x0c);
  return {
    bytes: clusters * bytesPerCluster,
    sparse: (attributeFlags & (ATTR_FLAG_SPARSE | ATTR_FLAG_COMPRESSED)) !== 0
  };
}

/** The size an unnamed $DATA attribute contributes, or null when it
 * contributes none.
 *
 * Two filters, both load-bearing:
 *
 *  - NAMED $DATA is an alternate data stream. Explorer doesn't count
 *    those toward a file's size and neither should this.
 *
 *  - A non-resident $DATA is one FRAGMENT of the stream, and only the
 *    fragment starting at VCN 0 carries the real size of the whole file;
 *    the others report zero. Taking whichever fragment happened to come
 *    last would zero out exactly the large fragmented files that matter
 *    most in a disk usage view.
 *
 * This is the LOGICAL size -- the file's length, the same thing
 * Explorer's Size column and fs.stat() report, and therefore the same
 * thing the recursive scanner already reports. The size on disk is read
 * separately, from the runlist (see readStreamAllocation). */
function readUnnamedDataSize(record, attributeOffset) {
  if (record.readUInt8(attributeOffset + 9) !== 0) return null; // named stream
  const nonResident = record.readUInt8(attributeOffset + 8) !== 0;
  if (!nonResident) return record.readUInt32LE(attributeOffset + 0x10);

  if (attributeOffset + 0x38 > record.length) return null;
  if (record.readBigUInt64LE(attributeOffset + 0x10) !== 0n) return null; // not the first fragment
  return Number(record.readBigUInt64LE(attributeOffset + 0x30));
}

/** $FILE_NAME value layout, counted out field by field because being off
 * by even one field produces names made of raw record bytes:
 *
 *   0x00 parent file reference   (8)
 *   0x08 creation time           (8)
 *   0x10 modification time       (8)
 *   0x18 MFT record change time  (8)
 *   0x20 access time             (8)
 *   0x28 allocated size          (8)
 *   0x30 real size               (8)
 *   0x38 flags                   (4)
 *   0x3C reparse value           (4)
 *   0x40 name length in CHARS    (1)
 *   0x41 namespace               (1)
 *   0x42 name, UTF-16LE
 *
 * Found the hard way (2026-09-02): these were originally read at 0x50 /
 * 0x51 / 0x52 -- sixteen bytes past the end of the structure. Every test
 * passed, because the synthetic volume the tests build encoded the same
 * wrong offsets; two halves written from one misconception agree with
 * each other perfectly. Only running it against a real NTFS volume showed
 * it: sizes came back exactly right while names came back as binary
 * rubbish with fragments of the real name visible inside them. */
const NAME_LENGTH_OFFSET = 0x40;
const NAMESPACE_OFFSET = 0x41;
const NAME_OFFSET = 0x42;

function readFileName(record, attributeOffset) {
  if (record.readUInt8(attributeOffset + 8) !== 0) return null; // never non-resident
  const valueOffset = attributeOffset + record.readUInt16LE(attributeOffset + 0x14);
  if (valueOffset + NAME_OFFSET > record.length) return null;

  const nameLength = record.readUInt8(valueOffset + NAME_LENGTH_OFFSET);
  const nameEnd = valueOffset + NAME_OFFSET + nameLength * 2;
  if (nameLength === 0 || nameEnd > record.length) return null;

  return {
    // The parent is a 64-bit file reference whose low 48 bits are the MFT
    // record number and whose high 16 are a sequence number. Using the
    // whole value as a record number puts every file under a parent that
    // doesn't exist.
    parentRecord: Number(record.readBigUInt64LE(valueOffset) & 0x0000ffffffffffffn),
    namespace: record.readUInt8(valueOffset + NAMESPACE_OFFSET),
    name: record.toString('utf16le', valueOffset + NAME_OFFSET, nameEnd)
  };
}

/** Prefers any non-DOS name over an 8.3 alias, and otherwise keeps the
 * first seen -- so a file with only a DOS name still gets one rather than
 * being dropped for having no "real" name. */
function isBetterName(candidate, current) {
  if (!current) return true;
  return current.namespace === NAMESPACE_DOS && candidate.namespace !== NAMESPACE_DOS;
}
