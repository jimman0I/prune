import { openSync, readSync, closeSync, writeFileSync } from 'node:fs';
import { scanVolume } from './scanVolume.js';

/** The elevated half of the MFT scan, and the ONLY part that touches a
 * raw volume handle.
 *
 * It runs as a separate elevated process (see runElevatedNodeJson) rather
 * than inside the backend for the obvious reason: Windows will not open
 * `\\.\C:` for a process that isn't Administrator, and running all of
 * Prune elevated to read a disk map would be a far worse trade than one
 * UAC prompt when the user asks for a fast scan.
 *
 * Invoked as: mftWorker.js <driveLetter> <maxDepth> <outputPath>
 * Always writes JSON to <outputPath>, including on failure -- the
 * unelevated parent cannot see this process's stderr (it runs at a higher
 * integrity level), so an error that isn't written to the file is an
 * error nobody ever sees. */
const [driveArg, depthArg, outPath] = process.argv.slice(2);

try {
  writeFileSync(outPath, JSON.stringify(run(driveArg, Number(depthArg) || 12)), 'utf8');
} catch (err) {
  try {
    writeFileSync(outPath, JSON.stringify({ __error: err.message }), 'utf8');
  } catch { /* nothing left to try */ }
  process.exitCode = 1;
}

function run(driveLetter, maxDepth) {
  const letter = String(driveLetter || 'C').replace(/[^a-z]/gi, '').slice(0, 1).toUpperCase();
  if (!letter) throw new Error('No drive letter was given.');

  // \\.\C: is the raw volume, as opposed to C:\ the mounted filesystem.
  const fd = openSync(`\\\\.\\${letter}:`, 'r');
  try {
    return {
      driveLetter: letter,
      ...scanVolume({
        readAt: makeVolumeReader(fd),
        driveLabel: `${letter}:`,
        maxDepth
      })
    };
  } finally {
    closeSync(fd);
  }
}

/** Reads from a raw volume handle into `buffer` at an absolute byte
 * offset.
 *
 * Volume handles are stricter than files: reads have to be whole sectors
 * at sector-aligned offsets, and a short read is normal rather than an
 * error. This absorbs both -- it reads an aligned window big enough to
 * contain the requested range, loops until it's full, and copies out the
 * slice the caller actually asked for. Callers get plain
 * "give me these bytes" semantics and the alignment rules stay in one
 * place. */
function makeVolumeReader(fd, sectorSize = 512) {
  return function readAt(buffer, offset) {
    const alignedStart = Math.floor(offset / sectorSize) * sectorSize;
    const padding = offset - alignedStart;
    const alignedLength = Math.ceil((padding + buffer.length) / sectorSize) * sectorSize;

    const window = padding === 0 && alignedLength === buffer.length ? buffer : Buffer.alloc(alignedLength);

    let filled = 0;
    while (filled < alignedLength) {
      const bytes = readSync(fd, window, filled, alignedLength - filled, alignedStart + filled);
      // Zero means end of volume. Throwing beats returning a half-filled
      // buffer that would parse as a region full of empty records.
      if (bytes === 0) throw new Error(`Unexpected end of volume reading ${alignedLength} bytes at ${alignedStart}.`);
      filled += bytes;
    }

    if (window !== buffer) window.copy(buffer, 0, padding, padding + buffer.length);
  };
}
