import { parseBootSector } from './bootSector.js';
import { decodeRunlist } from './runlist.js';
import { parseFileRecord, ATTR_DATA } from './record.js';
import { buildTree } from './buildTree.js';

/** How much of the MFT to pull off the volume per read. Large sequential
 * reads are the entire reason this approach is fast: the MFT is one
 * mostly-contiguous region, so reading it in megabyte chunks turns what a
 * directory walk does as hundreds of thousands of scattered metadata
 * lookups into a handful of streaming reads. */
const CHUNK_BYTES = 4 * 1024 * 1024;

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
 * records were read, how many were unreadable, and whether the MFT's own
 * runlist covered the whole table. */
export function scanVolume({ readAt, driveLabel = 'C:', maxDepth = 12, onProgress } = {}) {
  const bootBuffer = Buffer.alloc(512);
  readAt(bootBuffer, 0);
  const geometry = parseBootSector(bootBuffer);

  const mftRuns = readMftRunlist(readAt, geometry);
  const records = new Map();
  // Sizes found in EXTENSION records, keyed by the base record they
  // belong to. Collected separately because an extension can appear
  // either before or after its base in the table, so they can only be
  // merged once the whole pass is done.
  const extensionSizes = new Map();

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
        const parsed = parseFileRecord(slot, geometry.bytesPerSector);
        if (!parsed) {
          recordsSkipped++;
        } else if (parsed.kind === 'extension') {
          // Only one fragment of a stream reports the real size, so the
          // largest is the whole file rather than a sum of parts --
          // adding them would multiply a big file's size by how badly it
          // happened to be fragmented.
          if (parsed.sizeBytes > (extensionSizes.get(parsed.baseRecord) || 0)) {
            extensionSizes.set(parsed.baseRecord, parsed.sizeBytes);
          }
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
  // never overwritten by a stale fragment.
  let recordsCompletedFromExtensions = 0;
  for (const [baseRecord, sizeBytes] of extensionSizes) {
    const entry = records.get(baseRecord);
    if (!entry || entry.isDirectory || entry.sizeBytes > 0 || sizeBytes <= 0) continue;
    entry.sizeBytes = sizeBytes;
    recordsCompletedFromExtensions++;
  }

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
      // LOGICAL total: the sum of file lengths, the same measure the
      // recursive scanner and Explorer use. On a volume with hardlinks it
      // legitimately exceeds the space actually in use, because Windows
      // charges shared clusters once while every name reports the full
      // length. volumeBytes rides along so a caller can show both rather
      // than implying the two ought to match.
      totalBytes: tree.size,
      volumeBytes: geometry.volumeBytes,
      mftComplete: mftRuns.complete
    }
  };
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
