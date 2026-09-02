/** Parses the NTFS boot sector (sector 0 of the volume) into the geometry
 * an MFT scan needs: where the MFT starts and how big each of its records
 * is. Everything else in the scan is computed from these numbers, so an
 * error here is silently wrong data everywhere -- hence the validation.
 *
 * Field offsets are from the NTFS BIOS Parameter Block. */
export function parseBootSector(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 512) {
    throw new Error('Boot sector must be at least 512 bytes.');
  }

  const oem = buffer.toString('latin1', 3, 11);
  if (oem !== 'NTFS    ') {
    throw new Error(`Not an NTFS volume (OEM id "${oem.trim()}"). Only NTFS has an MFT to read.`);
  }

  const bytesPerSector = buffer.readUInt16LE(11);
  // A bad value here doesn't fail later, it quietly makes every offset
  // wrong -- a zero collapses them all to 0. Sector sizes are always a
  // power of two in this range; anything else means we're not looking at
  // a boot sector.
  if (![512, 1024, 2048, 4096].includes(bytesPerSector)) {
    throw new Error(`Implausible sector size ${bytesPerSector} — this doesn't look like a boot sector.`);
  }

  const sectorsPerCluster = buffer.readUInt8(13);
  if (sectorsPerCluster === 0) throw new Error('Boot sector reports 0 sectors per cluster.');
  const bytesPerCluster = bytesPerSector * sectorsPerCluster;

  const totalSectors = buffer.readBigUInt64LE(40);
  const mftCluster = buffer.readBigUInt64LE(48);

  return {
    bytesPerSector,
    sectorsPerCluster,
    bytesPerCluster,
    volumeBytes: Number(totalSectors) * bytesPerSector,
    mftOffset: Number(mftCluster) * bytesPerCluster,
    bytesPerFileRecord: decodeClusterOrLog(buffer.readInt8(64), bytesPerCluster)
  };
}

/** NTFS overloads this byte: positive means "this many clusters", negative
 * means "2 to the power of its absolute value, in BYTES". Nearly every
 * real volume stores -10 (1024-byte records), so reading the field as
 * unsigned yields 246 clusters per record and misplaces every record
 * boundary but the first -- the kind of mistake that produces a scan full
 * of plausible-looking garbage rather than an error. */
function decodeClusterOrLog(rawValue, bytesPerCluster) {
  return rawValue >= 0 ? rawValue * bytesPerCluster : 2 ** -rawValue;
}
