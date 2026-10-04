import { mkdir, open, readdir, rm, rmdir, stat, statfs } from 'node:fs/promises';
import { randomFillSync } from 'node:crypto';
import { dirname, join, parse } from 'node:path';
import { settingsPath } from '../../services/settings.js';
import { normalizePasses } from '../shredFile.js';

/** BleachBit's "Free disk space" (system.empty_space), for Windows.
 *
 * What it does, exactly: it writes filler files onto the chosen drive until
 * only a reserve is left, then deletes them -- once for one pass (zeros), or
 * three times over for three passes (a fresh stream of random data each
 * time). A file deleted earlier leaves its data on the disk until something
 * overwrites it; this overwrites all of the space that is free, so those old
 * files can no longer be recovered.
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
 * was left (cleanupWipeLeftovers / cleanupAllWipeLeftovers).
 */

export const FILLER_PREFIX = 'prune-wipe-';
/** The folder the filler lives in at the root of a drive that is not the
 * profile's. A folder of its own, so cleanup only ever deletes files Prune
 * named itself, in a place nothing else uses. */
export const DRIVE_WIPE_FOLDER = 'Prune-wipe';
const KiB = 1024;
const MiB = 1024 * KiB;
const GiB = 1024 * MiB;

/** One wipe at a time. Two would each see the other's filler as used space
 * and both would stop early; more importantly, a second one's cleanup
 * would delete the first's files from under it. */
let running = false;
/** A wipe started in a worker thread (see cleanWorkerHost.js) holds `running`
 * in that thread's copy of this module, so the thread that serves the Wipe
 * estimate is told about it and answers from both. */
let runningElsewhere = false;
export function wipeInProgress() { return running || runningElsewhere; }
/** For the thread that hosts a clean worker: a wipe is, or is no longer,
 * running in it. */
export function setWipeRunningElsewhere(value) { runningElsewhere = value === true; }

let wipeStateListener = null;
/** For a clean worker: be told when a wipe starts and stops in this thread. */
export function onWipeStateChange(listener) { wipeStateListener = listener; }
function setRunning(value) {
  running = value;
  try { wipeStateListener?.(value); } catch { /* telling someone must never break the wipe */ }
}

/** Where the filler lives for the profile's own drive: a dedicated folder
 * beside Prune's settings, so nothing is ever created at the root of C:. */
export function wipeDir() {
  return join(dirname(settingsPath()), 'wipe');
}

const driveOf = (path) => parse(path).root.replace(/[\\/]+$/, '').toUpperCase();

/** "D:" for "d:" / "D:" -- or null for nothing. Anything else is an error:
 * this value ends up in a path that is created and filled, so it is only
 * ever a bare drive letter, never a path someone typed. */
export function normalizeDrive(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || !/^[A-Za-z]:$/.test(value.trim())) {
    throw new Error('Choose a drive like D: -- not a folder or a network path.');
  }
  return value.trim().toUpperCase();
}

/** The filler folder for a drive: the profile drive keeps using the folder
 * beside settings, any other gets `<drive>\Prune-wipe`. */
export function wipeDirFor(drive) {
  const letter = normalizeDrive(drive);
  if (letter === null || letter === driveOf(wipeDir())) return wipeDir();
  return `${letter}\\${DRIVE_WIPE_FOLDER}`;
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

/** The start-up sweep: the profile's folder and the `Prune-wipe` folder on
 * each of `drives` (bare letters, e.g. ['C:', 'D:']). One failing drive
 * never stops the rest. */
export async function cleanupAllWipeLeftovers({ drives = [] } = {}) {
  const total = await cleanupWipeLeftovers();
  for (const drive of drives) {
    let dir;
    try { dir = wipeDirFor(drive); } catch { continue; }
    if (dir === wipeDir()) continue;
    const removed = await cleanupWipeLeftovers({ dir }).catch(() => ({ files: 0, bytes: 0 }));
    total.files += removed.files;
    total.bytes += removed.bytes;
  }
  return total;
}

async function defaultWriteChunk(handle, buffer, length) {
  return handle.write(buffer, 0, length);
}

/** Writes filler until `reserveBytes` of the drive remain free, `passes`
 * times (1 = zeros, 3 = random data, anything else = 1).
 *
 * Resolves { bytesWritten, totalBytes, elapsedMs, aborted, reason, passes,
 * pattern } where `bytesWritten` and `totalBytes` count ALL passes and
 * `reason` is null for a completed run, 'aborted' for Stop, or 'full' when
 * the drive ran out of room before the reserve check noticed. Rejects only
 * for an unexpected failure -- and the filler is deleted either way.
 *
 * Everything that would make a test write gigabytes is a parameter. */
export async function wipeFreeSpace({
  dir = wipeDir(),
  reserveBytes,
  passes = 1,
  chunkBytes = 8 * MiB,
  fileMaxBytes = 1 * GiB,
  recheckEveryBytes = 256 * MiB,
  progressEveryMs = 250,
  signal,
  onProgress,
  getFreeBytes = () => defaultFreeBytes(dir),
  writeChunk = defaultWriteChunk
} = {}) {
  if (wipeInProgress()) throw new Error('A free-space wipe is already running.');
  setRunning(true);
  const passCount = normalizePasses(passes);
  const random = passCount === 3;
  const pattern = random ? 'random' : 'zeros';
  const started = Date.now();
  let bytesWritten = 0;
  let totalBytes = 0;
  let reason = null;
  let handle = null;
  let lastProgress = 0;
  let pass = 1;

  const report = async (force = false) => {
    if (!onProgress) return;
    const now = Date.now();
    if (!force && now - lastProgress < progressEveryMs) return;
    lastProgress = now;
    await onProgress({ bytesWritten, totalBytes, elapsedMs: now - started, pass, passes: passCount, pattern });
  };

  try {
    if (signal?.aborted) return { bytesWritten: 0, totalBytes: 0, elapsedMs: 0, aborted: true, reason: 'aborted', passes: passCount, pattern };

    for (pass = 1; pass <= passCount && reason !== 'aborted'; pass += 1) {
      await mkdir(dir, { recursive: true });
      // A crashed run's filler -- or the previous pass's -- would count as
      // used space and make this pass stop short of what it should.
      await cleanupWipeLeftovers({ dir });
      await mkdir(dir, { recursive: true });

      const startFree = await getFreeBytes();
      const passTotal = Math.max(0, startFree - reserveBytes);
      const before = bytesWritten;
      // Later passes are assumed to be the size of this one until the
      // drive says otherwise.
      totalBytes = before + passTotal * (passCount - pass + 1);
      if (passTotal === 0) { await report(true); break; }

      const filler = Buffer.alloc(Math.min(chunkBytes, Math.max(passTotal, 1)));
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
        const length = Math.min(filler.length, freeEstimate - reserveBytes, fileMaxBytes - fileBytes);
        // A fresh stream every chunk, so no two passes (or chunks) share a pattern.
        if (random) randomFillSync(filler, 0, length);
        try {
          await writeChunk(handle, filler, length);
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
          const thisPass = bytesWritten - before + Math.max(0, freeEstimate - reserveBytes);
          totalBytes = Math.max(bytesWritten, before + thisPass * (passCount - pass + 1));
        }
        await report();
      }

      // The pass is over: the filler goes before the next pass (or the end)
      // so the drive has its space back.
      await handle?.close().catch(() => {});
      handle = null;
      if (pass === passCount || reason === 'aborted') break;
      await report(true);
    }
    pass = Math.min(pass, passCount);
    if (reason !== 'aborted') {
      // Settled at what was actually written when it came in short.
      if (totalBytes < bytesWritten) totalBytes = bytesWritten;
      await report(true);
    }
  } finally {
    // Always, whatever happened above.
    await handle?.close().catch(() => {});
    await cleanupWipeLeftovers({ dir });
    setRunning(false);
  }
  return { bytesWritten, totalBytes, elapsedMs: Date.now() - started, aborted: reason === 'aborted', reason, passes: passCount, pattern };
}

/** What a wipe would do here, for the confirm dialog: the drive, how much it
 * would write, and a rough time from a real ~1 second write test.
 *
 * The speed is a floor-ish guess, not a promise: the drive slows down as
 * it fills, the machine gets busy, an SSD's cache runs out. The dialog says
 * "about". The sample is flushed to disk before it is timed so the figure
 * is the drive's, not the file cache's. For three passes the sample is
 * random data too, so generating it is part of the speed. */
export async function estimateWipe({
  drive,
  dir = wipeDirFor(drive),
  passes = 1,
  reserveBytes,
  sampleMs = 1000,
  chunkBytes = 8 * MiB,
  getStats = () => driveStats(dir)
} = {}) {
  const passCount = normalizePasses(passes);
  const random = passCount === 3;
  await mkdir(dir, { recursive: true });
  const { freeBytes, totalBytes } = await getStats();
  const reserve = reserveBytes ?? defaultReserveBytes(totalBytes);
  const bytesToWrite = Math.max(0, freeBytes - reserve);

  const sample = join(dir, `${FILLER_PREFIX}sample.bin`);
  const data = Buffer.alloc(chunkBytes);
  let written = 0;
  let elapsed = 1;
  const handle = await open(sample, 'w');
  try {
    const t0 = process.hrtime.bigint();
    const until = Date.now() + sampleMs;
    do {
      if (random) randomFillSync(data);
      await handle.write(data, 0, data.length);
      written += data.length;
    } while (Date.now() < until);
    await handle.sync();
    elapsed = Math.max(1, Number(process.hrtime.bigint() - t0) / 1e6);
  } finally {
    await handle.close().catch(() => {});
    await rm(sample, { force: true });
    await rmdir(dir).catch(() => {});
  }

  const bytesPerSecond = Math.round(written / (elapsed / 1000));
  const totalBytesToWrite = bytesToWrite * passCount;
  return {
    drive: normalizeDrive(drive) ?? driveOf(dir),
    freeBytes,
    totalBytes,
    reserveBytes: reserve,
    passes: passCount,
    pattern: random ? 'random' : 'zeros',
    bytesToWrite,
    totalBytesToWrite,
    bytesPerSecond,
    seconds: totalBytesToWrite > 0 ? Math.ceil(totalBytesToWrite / bytesPerSecond) : 0
  };
}

/** The rule action's own entry points, so cleanerRules.js dispatches to it
 * like any other action. Nothing to measure in Preview: a wipe frees no
 * space, so there is no number to promise. */
export function scan() {
  return { present: true };
}

/** Runs the wipe the Settings choose: `guards.wipeDrive` (a bare drive
 * letter, or none for the profile's own drive) and `guards.wipePasses`.
 * The 4th argument is for tests. */
export async function execute(action, ruleName, guards = {}, { run = wipeFreeSpace, stats = driveStats } = {}) {
  const drive = normalizeDrive(guards.wipeDrive);
  const dir = wipeDirFor(drive);
  const passes = normalizePasses(guards.wipePasses);
  const root = `${parse(dir).root}`;
  const total = (await stats(root).catch(() => ({ totalBytes: 0 }))).totalBytes;
  const result = await run({
    dir,
    passes,
    signal: guards.signal,
    reserveBytes: guards.wipeReserveBytes ?? defaultReserveBytes(total),
    onProgress: guards.onProgress
      ? (progress) => guards.onProgress({ wipe: true, ...progress })
      : undefined
  });
  return { freedBytes: 0, skipped: [], wiped: { ...result, drive: drive ?? driveOf(dir) } };
}
