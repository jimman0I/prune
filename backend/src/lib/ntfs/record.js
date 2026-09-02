export const ATTR_FILE_NAME = 0x30;
export const ATTR_DATA = 0x80;

const FLAG_IN_USE = 0x0001;
const FLAG_DIRECTORY = 0x0002;
const END_OF_ATTRIBUTES = 0xffffffff;

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
 *   { kind: 'entry', name, parentRecord, sizeBytes, isDirectory }
 *       a real file or directory
 *   { kind: 'extension', baseRecord, sizeBytes }
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
 * Mutates `record` (fixups are applied in place). */
export function parseFileRecord(record, bytesPerSector) {
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
  if (baseReference !== 0n) {
    return {
      kind: 'extension',
      baseRecord: Number(baseReference & 0x0000ffffffffffffn),
      sizeBytes: findUnnamedDataSize(record)
    };
  }

  const isDirectory = (flags & FLAG_DIRECTORY) !== 0;

  let best = null;      // best $FILE_NAME seen so far
  let sizeBytes = 0;
  let position = record.readUInt16LE(0x14);

  while (position + 8 <= record.length) {
    const type = record.readUInt32LE(position);
    if (type === END_OF_ATTRIBUTES) break;

    const length = record.readUInt32LE(position + 4);
    // Guard against a corrupt length: zero would spin forever, and an
    // absurd one would read past the buffer.
    if (length < 8 || position + length > record.length) break;

    if (type === ATTR_FILE_NAME) {
      const candidate = readFileName(record, position);
      if (candidate && isBetterName(candidate, best)) best = candidate;
    } else if (type === ATTR_DATA && !isDirectory) {
      const size = readUnnamedDataSize(record, position);
      if (size !== null) sizeBytes = size;
    }
    position += length;
  }

  if (!best) return null;
  return {
    kind: 'entry',
    name: best.name,
    parentRecord: best.parentRecord,
    // A directory's size is the sum of what's inside it, computed by the
    // caller once the whole tree is known -- never its own $DATA.
    sizeBytes: isDirectory ? 0 : sizeBytes,
    isDirectory
  };
}

/** Walks a record's attributes for the one unnamed $DATA that carries the
 * file's size. Used for extension records, where that attribute is the
 * only thing worth reading. */
function findUnnamedDataSize(record) {
  let position = record.readUInt16LE(0x14);
  while (position + 8 <= record.length) {
    const type = record.readUInt32LE(position);
    if (type === END_OF_ATTRIBUTES) break;
    const length = record.readUInt32LE(position + 4);
    if (length < 8 || position + length > record.length) break;
    if (type === ATTR_DATA) {
      const size = readUnnamedDataSize(record, position);
      if (size !== null) return size;
    }
    position += length;
  }
  return 0;
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
 * thing the recursive scanner already reports.
 *
 * It is deliberately NOT the allocated "size on disk" figure. That was
 * implemented and then removed (2026-09-02): reading allocated size from
 * offset 0x28 summed to 1270 GB on a 952.9 GB volume, and claimed that
 * not one file on the drive had allocated below logical while 772,000
 * were flagged sparse. Those two cannot both be true, so the number was
 * wrong in a way that wasn't understood -- and a confidently wrong "size
 * on disk" is worse than not offering one. */
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

