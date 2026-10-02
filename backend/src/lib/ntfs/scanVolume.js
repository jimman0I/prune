import { parseBootSector } from './bootSector.js';
import { decodeRunlist } from './runlist.js';
import { parseFileRecord, applyFixups, ATTR_DATA } from './record.js';
import { buildTree } from './buildTree.js';

/** How much of the MFT to pull off the volume per read. Large sequential
 * reads are the entire reason this approach is fast: the MFT is one
 * mostly-contiguous region, so reading it in megabyte chunks turns what a
 * directory walk does as hundreds of thousands of scattered metadata
 * lookups into a handful of streaming reads. */
const CHUNK_BYTES = 4 * 1024 * 1024;

/** The record that holds $Bitmap, NTFS's one-bit-per-cluster map of what is
 * in use. */
const BITMAP_RECORD = 6;

/** Reads an NTFS volume's Master File Table and returns a directory tree.
 *
 * This is the WizTree approach, and the reason it's in a different speed
 * class from walking directories: NTFS already maintains one flat table
 * describing every file on the volume, with its name, size and parent. A
 * recursive walk asks the filesystem about each directory in turn and
 * pays a round trip per entry; this reads the table itself, sequentially,
 * and reconstructs the hierarchy in memory afterward.
 *
 * `readAt(buffer, offset)` is injected rather than taking a file
 * descriptor so the whole pipeline can be tested against a synthetic
 * volume built in memory. Reading a real volume requires Administrator
 * (Windows won't hand out a raw volume handle otherwise), which is why
 * this can't just open the drive itself and why WizTree asks for
 * elevation too.
 *
 * Returns { tree, stats } -- stats carries the honest caveats: how many
 * records were read, how many were unreadable, whether the MFT's own
 * runlist covered the whole table, and the totals a caller needs to check
 * the result against the volume itself (see the comment on `stats`). */
export function scanVolume({ readAt, driveLabel = 'C:', maxDepth = 12, onProgress } = {}) {
  const bootBuffer = Buffer.alloc(512);
  readAt(bootBuffer, 0);
  const geometry = parseBootSector(bootBuffer);

  const mftRuns = readMftRunlist(readAt, geometry);
  const records = new Map();
  // What EXTENSION records add to the base record they belong to, keyed by
  // that base. Collected separately because an extension can appear either
  // before or after its base in the table, so they can only be merged once
  // the whole pass is done.
  const extensions = new Map();

  let recordsRead = 0;
  let recordsSkipped = 0;
  let recordNumber = 0;

  const recordBuffer = Buffer.alloc(CHUNK_BYTES);
  for (const run of mftRuns.runs) {
    if (run.sparse || run.startCluster === null) {
      // Sparse clusters hold no records, but they still consume record
      // numbers -- skipping the counter forward keeps every subsequent
      // record's number (and therefore every parent link) correct.
      recordNumber += Math.floor((run.clusterCount * geometry.bytesPerCluster) / geometry.bytesPerFileRecord);
      continue;
    }

    const runBytes = run.clusterCount * geometry.bytesPerCluster;
    let consumed = 0;
    while (consumed < runBytes) {
      const chunkBytes = Math.min(CHUNK_BYTES, runBytes - consumed);
      const chunk = recordBuffer.subarray(0, chunkBytes);
      readAt(chunk, run.startCluster * geometry.bytesPerCluster + consumed);

      for (let offset = 0; offset + geometry.bytesPerFileRecord <= chunkBytes; offset += geometry.bytesPerFileRecord) {
        // Copied, not sub-arrayed: parseFileRecord applies fixups in
        // place, and the chunk buffer is reused by the next read.
        const slot = Buffer.from(chunk.subarray(offset, offset + geometry.bytesPerFileRecord));
        const parsed = parseFileRecord(slot, geometry.bytesPerSector, geometry.bytesPerCluster);
        if (!parsed) {
          recordsSkipped++;
        } else if (parsed.kind === 'extension') {
          const seen = extensions.get(parsed.baseRecord) ?? { size: 0, allocated: 0, streams: 0, index: 0, sparse: false };
          // Only one fragment of a stream reports the real size, so the
          // largest is the whole file rather than a sum of parts --
          // adding them would multiply a big file's size by how badly it
          // happened to be fragmented. Allocation is the opposite: each
          // fragment maps its own disjoint clusters, so those ARE summed.
          if (parsed.sizeBytes > seen.size) seen.size = parsed.sizeBytes;
          seen.allocated += parsed.allocatedBytes ?? 0;
          seen.streams += parsed.streamAllocatedBytes ?? 0;
          seen.index += parsed.indexAllocatedBytes ?? 0;
          if (parsed.sparse) seen.sparse = true;
          extensions.set(parsed.baseRecord, seen);
        } else {
          records.set(recordNumber, parsed);
          recordsRead++;
        }
        recordNumber++;
      }

      consumed += chunkBytes;
      onProgress?.({ recordsRead, recordsSkipped });
    }
  }

  // A base record whose $DATA moved out to an extension has no size of
  // its own; this is where it gets one back. Only applied when the base
  // genuinely reported nothing, so a file that kept its $DATA in place is
  // never overwritten by a stale fragment. Allocation is added regardless:
  // the extension's clusters are in use whatever the base says.
  let recordsCompletedFromExtensions = 0;
  for (const [baseRecord, ext] of extensions) {
    const entry = records.get(baseRecord);
    if (!entry) continue;
    if (entry.allocatedBytes !== undefined) {
      entry.allocatedBytes += ext.allocated;
      entry.streamAllocatedBytes += ext.streams;
      entry.indexAllocatedBytes += ext.index;
    }
    if (ext.sparse) entry.sparse = true;
    if (!entry.isDirectory && entry.sizeBytes <= 0 && ext.size > 0) {
      entry.sizeBytes = ext.size;
      recordsCompletedFromExtensions++;
    }
  }

  const tally = tallyEntries(records);
  const tree = buildTree(records, { name: driveLabel, maxDepth });

  return {
    tree,
    stats: {
      recordsRead,
      recordsCompletedFromExtensions,
      // Overwhelmingly these are unused MFT slots, which is normal -- the
      // table is preallocated. Reported anyway because a sudden spike is
      // the signature of a parse going wrong.
      recordsSkipped,
      // LOGICAL total: the sum of file lengths, the same measure Explorer's
      // Size column uses. A file with several hard links is ONE record here
      // and is counted once (Explorer, which walks names, counts it per
      // name), so this does not over-count on a WinSxS-heavy volume.
      totalBytes: tree.size,
      // ALLOCATED total: what the items occupy on disk, from each stream's
      // runlist (holes of sparse and compressed files left out). It is
      // split so that a disagreement with the volume can be traced:
      //   fileAllocatedBytes   -- ordinary file data
      //   streamAllocatedBytes -- alternate data streams
      //   indexAllocatedBytes  -- folders' own index buffers
      // The remainder of the volume's used space is NTFS bookkeeping this
      // scan has no record for ($Bitmap's own bitmap, non-resident
      // attribute lists, the boot area).
      allocatedBytes: tree.allocated ?? null,
      fileAllocatedBytes: tally.allocated - tally.streams - tally.index,
      streamAllocatedBytes: tally.streams,
      indexAllocatedBytes: tally.index,
      // Why logical and allocated differ, in counts.
      sparseOrCompressedFiles: tally.sparse,
      hardLinkedFiles: tally.hardLinked,
      hardLinkExtraNames: tally.extraNames,
      volumeBytes: geometry.volumeBytes,
      // The volume's own record of space in use ($Bitmap), the ground truth
      // allocatedBytes should land just under. null when it could not be read.
      ...readBitmapUsage({ readAt, geometry, mftRuns }),
      mftComplete: mftRuns.complete
    }
  };
}

function tallyEntries(records) {
  const tally = { allocated: 0, streams: 0, index: 0, sparse: 0, hardLinked: 0, extraNames: 0 };
  for (const entry of records.values()) {
    tally.allocated += entry.allocatedBytes ?? 0;
    tally.streams += entry.streamAllocatedBytes ?? 0;
    tally.index += entry.indexAllocatedBytes ?? 0;
    if (entry.sparse) tally.sparse += 1;
    if (entry.hardLinks) {
      tally.hardLinked += 1;
      tally.extraNames += entry.hardLinks - 1;
    }
  }
  return tally;
}

/** Counts the clusters $Bitmap marks in use, which is exactly the number
 * Windows subtracts from the volume size to report free space.
 *
 * It is read from the volume rather than assumed because it is the one
 * independent figure to hold the scan's allocated total against: if the two
 * disagree, the difference says where to look. Any failure -- a record that
 * will not parse, a runlist that does not cover the bitmap -- yields null
 * for both fields, never a partial count presented as a total. */
function readBitmapUsage({ readAt, geometry, mftRuns }) {
  const none = { bitmapUsedBytes: null, bitmapFreeBytes: null };
  try {
    const offset = locateMftRecord(mftRuns.runs, geometry, BITMAP_RECORD);
    if (offset === null) return none;
    const record = Buffer.alloc(geometry.bytesPerFileRecord);
    readAt(record, offset);
    if (record.toString('latin1', 0, 4) !== 'FILE' || !applyFixups(record, geometry.bytesPerSector)) return none;

    const data = findUnnamedNonResidentData(record);
    if (!data) return none;

    const totalClusters = Math.floor(geometry.volumeBytes / geometry.bytesPerCluster);
    const bitmapBytes = Math.ceil(totalClusters / 8);
    let remainingBytes = Math.min(bitmapBytes, data.realSize);
    if (remainingBytes < bitmapBytes) return none;

    let usedClusters = 0;
    let bitsLeft = totalClusters;
    const buffer = Buffer.alloc(CHUNK_BYTES);
    for (const run of data.runs) {
      if (remainingBytes <= 0) break;
      if (run.sparse || run.startCluster === null) return none; // a bitmap with holes is not one we can trust
      const runBytes = Math.min(run.clusterCount * geometry.bytesPerCluster, remainingBytes);
      let done = 0;
      while (done < runBytes) {
        const n = Math.min(CHUNK_BYTES, runBytes - done);
        const part = buffer.subarray(0, n);
        readAt(part, run.startCluster * geometry.bytesPerCluster + done);
        for (let i = 0; i < n && bitsLeft > 0; i++) {
          const take = Math.min(8, bitsLeft);
          usedClusters += POPCOUNT[part[i] & (take === 8 ? 0xff : (1 << take) - 1)];
          bitsLeft -= take;
        }
        done += n;
      }
      remainingBytes -= runBytes;
    }
    if (remainingBytes > 0 || bitsLeft > 0) return none;

    const usedBytes = usedClusters * geometry.bytesPerCluster;
    return { bitmapUsedBytes: usedBytes, bitmapFreeBytes: totalClusters * geometry.bytesPerCluster - usedBytes };
  } catch {
    return none;
  }
}

const POPCOUNT = Array.from({ length: 256 }, (_, n) => {
  let bits = 0;
  for (let v = n; v; v >>= 1) bits += v & 1;
  return bits;
});

/** Where MFT record `number` sits on the volume, found through the MFT's own
 * runlist (the table is rarely one contiguous extent). Null if it falls in a
 * hole or past the end. */
function locateMftRecord(runs, geometry, number) {
  let wanted = number * geometry.bytesPerFileRecord;
  for (const run of runs) {
    const runBytes = run.clusterCount * geometry.bytesPerCluster;
    if (wanted < runBytes) {
      if (run.sparse || run.startCluster === null) return null;
      return run.startCluster * geometry.bytesPerCluster + wanted;
    }
    wanted -= runBytes;
  }
  return null;
}

/** The runlist and real size of a record's unnamed non-resident $DATA. */
function findUnnamedNonResidentData(record) {
  let position = record.readUInt16LE(0x14);
  while (position + 8 <= record.length) {
    const type = record.readUInt32LE(position);
    if (type === 0xffffffff) break;
    const length = record.readUInt32LE(position + 4);
    if (length < 8 || position + length > record.length) break;
    if (type === ATTR_DATA && record.readUInt8(position + 8) === 1 && record.readUInt8(position + 9) === 0) {
      const runlistOffset = position + record.readUInt16LE(position + 0x20);
      return {
        runs: decodeRunlist(record.subarray(runlistOffset, position + length)),
        realSize: Number(record.readBigUInt64LE(position + 0x30))
      };
    }
    position += length;
  }
  return null;
}

/** Reads MFT record 0 -- the MFT's description of itself -- and returns
 * the runlist saying where the rest of it lives.
 *
 * `complete` is false when the runs don't cover the size $DATA claims.
 * That happens when the MFT is fragmented enough for its own extent map
 * to overflow into an $ATTRIBUTE_LIST, and it matters because the result
 * isn't an error -- it's a scan that silently sees only part of the
 * volume and reports a total that looks perfectly plausible. */
function readMftRunlist(readAt, geometry) {
  const record = Buffer.alloc(geometry.bytesPerFileRecord);
  readAt(record, geometry.mftOffset);

  if (record.toString('latin1', 0, 4) !== 'FILE') {
    throw new Error('The MFT does not start with a FILE record — this volume may not be NTFS.');
  }

  let position = record.readUInt16LE(0x14);
  while (position + 8 <= record.length) {
    const type = record.readUInt32LE(position);
    if (type === 0xffffffff) break;
    const length = record.readUInt32LE(position + 4);
    if (length < 8 || position + length > record.length) break;

    // Unnamed, non-resident $DATA is the MFT itself.
    if (type === ATTR_DATA && record.readUInt8(position + 8) === 1 && record.readUInt8(position + 9) === 0) {
      const runlistOffset = position + record.readUInt16LE(position + 0x20);
      const runs = decodeRunlist(record.subarray(runlistOffset, position + length));
      const realSize = Number(record.readBigUInt64LE(position + 0x30));
      const covered = runs.reduce((sum, r) => sum + r.clusterCount * geometry.bytesPerCluster, 0);
      if (runs.length === 0) throw new Error('The MFT reports no data runs — nothing to read.');
      return { runs, complete: covered >= realSize };
    }
    position += length;
  }

  throw new Error('Could not find the MFT\'s own $DATA attribute.');
}
