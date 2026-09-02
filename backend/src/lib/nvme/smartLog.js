/** Parses the NVMe SMART / Health Information log page (log page 0x02).
 *
 * This is the same data CrystalDiskInfo shows, and the reason it exists
 * alongside the Windows reliability counters: Get-StorageReliabilityCounter
 * is a thin wrapper that many drives barely populate. On this machine it
 * returns null for power-on hours and every error counter, and -- worse --
 * reports Wear as 0 while the drive's own SMART log says 12% used. The
 * log page is the drive speaking for itself.
 *
 * Field offsets are from the NVMe base specification, "SMART / Health
 * Information Log Page". Counters are 128-bit little-endian; the low 64
 * bits are read, which is far more range than any of these will ever
 * reach (2^64 data units is ~9 billion TB).
 *
 * Every value is returned as null rather than 0 when the drive doesn't
 * populate it -- 0 power-on hours is a claim, and a wrong one. */
const DATA_UNIT_BYTES = 512_000; // one "data unit" is 1000 * 512 bytes

/** Reads a little-endian unsigned integer of `length` bytes, capped at
 * the low 8 bytes. Returns a Number: these counters stay far below
 * Number.MAX_SAFE_INTEGER in any real drive's lifetime. */
function readCounter(buffer, offset, length = 16) {
  let value = 0n;
  for (let i = Math.min(length, 8) - 1; i >= 0; i--) {
    value = (value << 8n) | BigInt(buffer[offset + i]);
  }
  return Number(value);
}

export function parseNvmeSmartLog(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 512) {
    throw new Error(`NVMe SMART log must be 512 bytes, got ${buffer?.length ?? 'nothing'}.`);
  }

  const criticalWarning = buffer[0];
  // Composite temperature is in KELVIN. A drive that reports 0 isn't at
  // absolute zero, it just isn't reporting.
  const kelvin = buffer.readUInt16LE(1);
  const dataUnitsRead = readCounter(buffer, 32);
  const dataUnitsWritten = readCounter(buffer, 48);

  return {
    // Bit flags: 0 spare below threshold, 1 temperature, 2 reliability
    // degraded, 3 read-only, 4 volatile memory backup failed.
    criticalWarning,
    criticalWarningFlags: {
      spareBelowThreshold: (criticalWarning & 0x01) !== 0,
      temperatureThreshold: (criticalWarning & 0x02) !== 0,
      reliabilityDegraded: (criticalWarning & 0x04) !== 0,
      readOnlyMode: (criticalWarning & 0x08) !== 0,
      volatileMemoryBackupFailed: (criticalWarning & 0x10) !== 0
    },
    temperatureC: kelvin > 0 ? kelvin - 273 : null,
    availableSparePercent: buffer[3],
    availableSpareThresholdPercent: buffer[4],
    // The drive's own estimate of how much of its rated endurance is
    // spent. The spec allows it to exceed 100, so callers must clamp
    // rather than assume 0..100.
    percentageUsed: buffer[5],
    dataUnitsRead,
    dataUnitsWritten,
    bytesRead: dataUnitsRead * DATA_UNIT_BYTES,
    bytesWritten: dataUnitsWritten * DATA_UNIT_BYTES,
    hostReadCommands: readCounter(buffer, 64),
    hostWriteCommands: readCounter(buffer, 80),
    controllerBusyMinutes: readCounter(buffer, 96),
    powerCycles: readCounter(buffer, 112),
    powerOnHours: readCounter(buffer, 128),
    unsafeShutdowns: readCounter(buffer, 144),
    mediaErrors: readCounter(buffer, 160),
    errorLogEntries: readCounter(buffer, 176)
  };
}

/** Life remaining, from the drive's own wear estimate.
 *
 * Clamped to 0..100 because the NVMe spec explicitly permits
 * "Percentage Used" to exceed 100 once a drive passes its rated
 * endurance -- an unclamped subtraction would render a negative bar. */
export function lifeRemainingFromWear(percentageUsed) {
  if (typeof percentageUsed !== 'number' || Number.isNaN(percentageUsed)) return null;
  return Math.max(0, Math.min(100, 100 - percentageUsed));
}
