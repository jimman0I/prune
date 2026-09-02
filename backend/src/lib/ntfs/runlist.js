/** Decodes an NTFS data runlist -- the compact map of where a
 * non-resident attribute's clusters actually live on disk.
 *
 * Each run starts with a header byte packing two nibbles: the low nibble
 * is how many bytes encode the run's LENGTH, the high nibble how many
 * encode its OFFSET. A header of 0 ends the list.
 *
 * Two details are where this goes wrong if written from intuition:
 *
 *  - The offset is a SIGNED delta from the previous run's start cluster,
 *    not an absolute address. Fragmented files routinely have extents
 *    that sit earlier on disk than their predecessor, encoded as negative
 *    deltas; read unsigned, those become enormous positive clusters far
 *    past the end of the volume.
 *
 *  - A run with zero offset bytes is SPARSE. It covers virtual clusters
 *    that were never allocated, and it must not move the running LCN --
 *    treating it as a delta of zero would make the next run's address
 *    relative to the wrong place.
 *
 * Returns `[]` and stops early on a truncated or malformed list rather
 * than throwing: this parses real on-disk data that can be damaged, and a
 * partial runlist is more useful than a crashed scan. */
export function decodeRunlist(buffer) {
  const runs = [];
  let position = 0;
  let currentLcn = 0;

  while (position < buffer.length) {
    const header = buffer[position++];
    if (header === 0) break;

    const lengthBytes = header & 0x0f;
    const offsetBytes = (header >> 4) & 0x0f;
    if (lengthBytes === 0) break; // a run with no length is meaningless
    if (position + lengthBytes + offsetBytes > buffer.length) break; // truncated

    const clusterCount = readUnsigned(buffer, position, lengthBytes);
    position += lengthBytes;

    if (offsetBytes === 0) {
      runs.push({ startCluster: null, clusterCount, sparse: true });
      continue;
    }

    currentLcn += readSigned(buffer, position, offsetBytes);
    position += offsetBytes;
    runs.push({ startCluster: currentLcn, clusterCount });
  }

  return runs;
}

function readUnsigned(buffer, offset, byteCount) {
  let value = 0;
  for (let i = byteCount - 1; i >= 0; i--) value = value * 256 + buffer[offset + i];
  return value;
}

/** Little-endian two's complement of arbitrary width. The sign lives in
 * the top bit of the LAST byte, since these are stored little-endian. */
function readSigned(buffer, offset, byteCount) {
  let value = readUnsigned(buffer, offset, byteCount);
  const signBit = 2 ** (byteCount * 8 - 1);
  if (value >= signBit) value -= signBit * 2;
  return value;
}
