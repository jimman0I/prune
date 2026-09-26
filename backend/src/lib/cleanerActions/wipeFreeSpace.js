import { mkdir, open, readdir, rm, rmdir, stat, statfs } from 'node:fs/promises';
import { dirname, join, parse } from 'node:path';
import { settingsPath } from '../../services/settings.js';

/** BleachBit's "Free disk space" (system.empty_space), for Windows.
 *
 * What it does, exactly: it writes zero-filled files onto the drive until
 * only a reserve is left, then deletes them. A file deleted earlier leaves
 * its data on the disk until something overwrites it; this overwrites all
 * of the space that is free, so those old files can no longer be recovered.
 *
 * What it does not do: free any space (it ends with exactly the space it
 * started with), touch any of the user's files, or help on an SSD -- where
 * TRIM and wear levelling mean writing to "free" space does not reliably
 * reach the old data, and where it costs real write wear. That is why it is
 * off by default and asks every time.
 *
 * Why it is careful. A drive filled to the last byte breaks the machine
 * while it runs: Windows cannot write its page file, the browser cannot
 * write a cookie, the user cannot save. So it keeps a RESERVE free
 * throughout (the larger of 2 GB and 2% of the drive), re-reads the real
 * free space as it goes because other programs keep writing, and cleans up
 * in a `finally` -- a crash, a Stop, a thrown error all end with the filler
 * deleted. If the process is killed outright, the next start removes what
 * was left (cleanupWipeLeftovers).
 */

export const FILLER_PREFIX = 'prune-wipe-';
const KiB = 1024;
const MiB = 1024 * KiB;
const GiB = 1024 * MiB;

/** One wipe at a time. Two would each see the other's filler as used space
 * and both would stop early; more importantly, a second one's cleanup
 * would delete the first's files from under it. */
let running = false;
export function wipeInProgress() { return running; }

/** Where the filler lives: a dedicated folder beside Prune's settings, on
 * the drive of the user's profile. A folder of its own means cleanup only
 * ever deletes files Prune named itself, in a place nothing else uses. */
export function wipeDir() {
  return join(dirname(settingsPath()), 'wipe');
}

/** The larger of 2 GB and 2% of the drive's size. */
export function defaultReserveBytes(totalBytes) {
  const two = Math.floor((Number(totalBytes) || 0) * 0.02);
  return Math.max(2 * GiB, two);
}

/** Free and total bytes of the drive holding `path`. */
async function driveStats(path) {
  const info = await statfs(path);
  return { freeBytes: info.bavail * info.bsize, totalBytes: info.blocks * info.bsize };
}

async function defaultFreeBytes(path) {
  return (await driveStats(path)).freeBytes;
}

/** Deletes filler files, and only files carrying the filler prefix.
 * Returns how many and how many bytes. A missing folder is not an error,
 * and the folder itself goes once it is empty. */
export async function cleanupWipeLeftovers({ dir = wipeDir() } = {}) {
  let names;
  try {
    names = await readdir(dir);
  } catch {
    return { files: 0, bytes: 0 };
  }
  let files = 0;
  let bytes = 0;
  for (const name of names) {
    if (!name.startsWith(FILLER_PREFIX)) continue;
    const path = join(dir, name);
    try {
      const info = await stat(path);
      await rm(path, { force: true });
      files += 1;
      bytes += info.size;
    } catch { /* locked or already gone: the next start tries again */ }
  }
  await rmdir(dir).catch(() => {}); // only succeeds when empty
  return { files, bytes };
}

async function defaultWriteChunk(handle, buffer, length) {
  return handle.write(buffer, 0, length);
}

/** Writes zeros until `reserveBytes` of the drive remain free.
 *
 * Resolves { bytesWritten, totalBytes, elapsedMs, aborted, reason } where
 * `reason` is null for a completed run, 'aborted' for Stop, or 'full' when
 * the drive ran out of room before the reserve check noticed. Rejects only
 * for an unexpected failure -- and the filler is deleted either way.
 *
 * Everything that would make a test write gigabytes is a parameter. */
export async function wipeFreeSpace({
  dir = wipeDir(),
  reserveBytes,
  chunkBytes = 8 * MiB,
  fileMaxBytes = 1 * GiB,
  recheckEveryBytes = 256 * MiB,
  progressEveryMs = 250,
  signal,
  onProgress,
  getFreeBytes = () => defaultFreeBytes(dir),
  writeChunk = defaultWriteChunk
} = {}) {
  if (running) throw new Error('A free-space wipe is already running.');
  running = true;
  const started = Date.now();
  let bytesWritten = 0;
  let totalBytes = 0;
  let reason = null;
  let handle = null;
  let lastProgress = 0;

  const report = async (force = false) => {
    if (!onProgress) return;
    const now = Date.now();
    if (!force && now - lastProgress < progressEveryMs) return;
    lastProgress = now;
    await onProgress({ bytesWritten, totalBytes, elapsedMs: now - started });
  };

  try {
    if (signal?.aborted) return { bytesWritten: 0, totalBytes: 0, elapsedMs: 0, aborted: true, reason: 'aborted' };

    await mkdir(dir, { recursive: true });
    // A crashed run's filler would count as used space and make this one
    // stop short of what it should.
    await cleanupWipeLeftovers({ dir });
    await mkdir(dir, { recursive: true });

    const startFree = await getFreeBytes();
    totalBytes = Math.max(0, startFree - reserveBytes);
    if (totalBytes === 0) { await report(true); return done(); }

    const zeros = Buffer.alloc(Math.min(chunkBytes, Math.max(totalBytes, 1)));
    let freeEstimate = startFree;
    let sinceCheck = 0;
    let fileIndex = 0;
    let fileBytes = 0;

    while (freeEstimate - reserveBytes > 0) {
      if (signal?.aborted) { reason = 'aborted'; break; }

      if (!handle || fileBytes >= fileMaxBytes) {
        await handle?.close();
        fileIndex += 1;
        fileBytes = 0;
        handle = await open(join(dir, `${FILLER_PREFIX}${String(fileIndex).padStart(4, '0')}.bin`), 'w');
      }

      // Never past the reserve: the last chunk is shortened to fit.
      const length = Math.min(zeros.length, freeEstimate - reserveBytes, fileMaxBytes - fileBytes);
      try {
        await writeChunk(handle, zeros, length);
      } catch (err) {
        if (err?.code === 'ENOSPC') { reason = 'full'; break; }
        throw err;
      }
      bytesWritten += length;
      fileBytes += length;
      freeEstimate -= length;
      sinceCheck += length;

      // Other programs are writing too, so trust the drive over arithmetic.
      if (sinceCheck >= recheckEveryBytes) {
        freeEstimate = await getFreeBytes();
        sinceCheck = 0;
        // What is left to do now, so progress does not run past 100%.
        totalBytes = Math.max(bytesWritten, bytesWritten + freeEstimate - reserveBytes);
      }
      await report();
    }
    await report(true);
  } finally {
    // Always, whatever happened above.
    await handle?.close().catch(() => {});
    await cleanupWipeLeftovers({ dir });
    running = false;
  }
  return done();

  function done() {
    return { bytesWritten, totalBytes, elapsedMs: Date.now() - started, aborted: reason === 'aborted', reason };
  }
}

/** What a wipe would do here, for the confirm dialog: the drive, how much it
 * would write, and a rough time from a real ~1 second write test.
 *
 * The speed is a floor-ish guess, not a promise: the drive slows down as
 * it fills, the machine gets busy, an SSD's cache runs out. The dialog says
 * "about". The sample is flushed to disk before it is timed so the figure
 * is the drive's, not the file cache's. */
export async function estimateWipe({
  dir = wipeDir(),
  reserveBytes,
  sampleMs = 1000,
  chunkBytes = 8 * MiB,
  getStats = () => driveStats(dir)
} = {}) {
  await mkdir(dir, { recursive: true });
  const { freeBytes, totalBytes } = await getStats();
  const reserve = reserveBytes ?? defaultReserveBytes(totalBytes);
  const bytesToWrite = Math.max(0, freeBytes - reserve);

  const sample = join(dir, `${FILLER_PREFIX}sample.bin`);
  const zeros = Buffer.alloc(chunkBytes);
  let written = 0;
  let elapsed = 1;
  const handle = await open(sample, 'w');
  try {
    const t0 = process.hrtime.bigint();
    const until = Date.now() + sampleMs;
    do {
      await handle.write(zeros, 0, zeros.length);
      written += zeros.length;
    } while (Date.now() < until);
    await handle.sync();
    elapsed = Math.max(1, Number(process.hrtime.bigint() - t0) / 1e6);
  } finally {
    await handle.close().catch(() => {});
    await rm(sample, { force: true });
    await rmdir(dir).catch(() => {});
  }

  const bytesPerSecond = Math.round(written / (elapsed / 1000));
  return {
    drive: parse(dir).root.replace(/[\\/]+$/, ''),
    freeBytes,
    totalBytes,
    reserveBytes: reserve,
    bytesToWrite,
    bytesPerSecond,
    seconds: bytesToWrite > 0 ? Math.ceil(bytesToWrite / bytesPerSecond) : 0
  };
}

/** The rule action's own entry points, so cleanerRules.js dispatches to it
 * like any other action. Nothing to measure in Preview: a wipe frees no
 * space, so there is no number to promise. */
export function scan() {
  return { present: true };
}

export async function execute(action, ruleName, guards = {}) {
  const result = await wipeFreeSpace({
    signal: guards.signal,
    reserveBytes: guards.wipeReserveBytes ?? defaultReserveBytes((await driveStats(wipeDir()).catch(() => ({ totalBytes: 0 }))).totalBytes),
    onProgress: guards.onProgress
      ? (progress) => guards.onProgress({ wipe: true, ...progress })
      : undefined
  });
  return { freedBytes: 0, skipped: [], wiped: result };
}
