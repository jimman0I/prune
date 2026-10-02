import { open as fsOpen, lstat, chmod, rename, unlink, readdir, rmdir } from 'node:fs/promises';
import { randomBytes, randomFillSync } from 'node:crypto';
import { dirname, join } from 'node:path';

/** Overwrite-then-delete, for the files Prune removes for good.
 *
 * What it does: writes over every byte the file occupies (zeros for one
 * pass, random data for three), flushes each pass to the drive, cuts the
 * file to nothing, renames it to a random name so the old name is not left
 * in the directory entry's history, and only then unlinks it.
 *
 * What it cannot promise, and the UI says so: overwriting in place reaches
 * the old data only on a drive that writes in place. An SSD remaps a rewrite
 * to a fresh cell and leaves the old one for later; a copy-on-write or
 * journaling filesystem, a file-history/backup copy, a cloud-synced folder
 * and a volume shadow copy each keep a copy this never touches. So this is
 * best effort, off by default, and described as such. */

const MiB = 1024 * 1024;

/** 1 or 3. Anything else -- a typo, a value from a future version -- is 1,
 * the cheap one: a setting that silently turns into a multi-hour job is
 * worse than one that quietly does less. */
export function normalizePasses(value) {
  return Number(value) === 3 ? 3 : 1;
}

function abortError() {
  const err = new Error('Shredding was stopped.');
  err.name = 'AbortError';
  return err;
}

/** Shreds one regular file. Throws on failure, leaving the file where it
 * was (with its read-only flag put back); resolves { bytes } once it is
 * gone. A symbolic link is removed as a link -- never followed, so what it
 * points at is not overwritten.
 *
 * `onStage(stage, path, detail)` is for progress and for tests:
 * 'pass' (detail = pass number), 'chunk' (detail = bytes just written),
 * 'overwritten' (before truncation), 'renamed' (path = the random name).
 * `open` is injectable for the same reason. */
export async function shredFile(path, passes = 1, { chunkBytes = MiB, signal, onStage, open = fsOpen } = {}) {
  const count = normalizePasses(passes);
  const info = await lstat(path);
  if (info.isDirectory()) throw new Error(`${path} is a folder, not a file`);
  if (info.isSymbolicLink()) {
    await unlink(path);
    return { bytes: 0, link: true };
  }

  const size = info.size;
  // Windows' read-only attribute stops a write; chmod 0o666 clears it.
  const readOnly = (info.mode & 0o200) === 0;
  if (readOnly) await chmod(path, 0o666);

  let handle = null;
  try {
    if (size > 0) {
      handle = await open(path, 'r+');
      const buffer = Buffer.alloc(Math.min(chunkBytes, size));
      for (let pass = 1; pass <= count; pass += 1) {
        await onStage?.('pass', path, pass);
        // One pass is zeros; three are random data, so no pass is a pattern
        // the others could be mistaken for.
        const random = count === 3;
        if (!random) buffer.fill(0);
        let position = 0;
        while (position < size) {
          if (signal?.aborted) throw abortError();
          const length = Math.min(buffer.length, size - position);
          if (random) randomFillSync(buffer, 0, length);
          const { bytesWritten } = await handle.write(buffer, 0, length, position);
          if (!bytesWritten) throw new Error(`Could not write to ${path}`);
          position += bytesWritten;
          await onStage?.('chunk', path, bytesWritten);
        }
        await handle.sync();
      }
      await onStage?.('overwritten', path);
      await handle.truncate(0);
      await handle.close();
      handle = null;
    }
  } catch (err) {
    await handle?.close().catch(() => {});
    if (readOnly) await chmod(path, 0o444).catch(() => {});
    throw err;
  }

  // The name goes before the entry does. If the rename fails the file is
  // simply removed under the name it has.
  let finalPath = path;
  try {
    const randomName = join(dirname(path), randomBytes(8).toString('hex'));
    await rename(path, randomName);
    finalPath = randomName;
    await onStage?.('renamed', randomName);
  } catch { /* unlink under the original name */ }

  try {
    await unlink(finalPath);
  } catch (err) {
    // Contents are already gone, so only the entry is left. Put the name
    // back so the report points at the file the user chose.
    if (finalPath !== path) await rename(finalPath, path).catch(() => {});
    throw err;
  }
  return { bytes: size };
}

const reasonOf = (err) => (err && err.message) || String(err);

/** Shreds files and whole folders.
 *
 * Folders are walked without following links (a junction inside is removed
 * as a link, its target untouched), every file in them is shredded, and a
 * folder is removed once it is empty. One file that will not shred -- in
 * use, no permission -- is recorded in `failed` and the rest carry on; its
 * folder is kept because it is not empty.
 *
 * Resolves { shredded: [{path, bytes}], failed: [{path, reason}], bytes,
 * aborted }. `onProgress` is called after each file; `onBytes` (throttled)
 * while a large file is being overwritten. */
export async function shredPaths(paths, passes = 1, {
  signal, onProgress, onBytes, chunkBytes, open, bytesEveryMs = 200
} = {}) {
  const shredded = [];
  const failed = [];
  let bytes = 0;
  let aborted = false;
  let lastBytesReport = 0;

  const fileOptions = (path) => ({
    chunkBytes,
    open,
    signal,
    onStage: onBytes
      ? (stage, _p, detail) => {
        if (stage !== 'chunk') return;
        const now = Date.now();
        if (now - lastBytesReport < bytesEveryMs) return;
        lastBytesReport = now;
        onBytes({ currentPath: path, filesDone: shredded.length, bytesDone: bytes });
      }
      : undefined
  });

  async function shredOne(path) {
    if (signal?.aborted) { aborted = true; return false; }
    try {
      const result = await shredFile(path, passes, fileOptions(path));
      shredded.push({ path, bytes: result.bytes });
      bytes += result.bytes;
      await onProgress?.({ filesDone: shredded.length, bytesDone: bytes, failedCount: failed.length, currentPath: path });
      return true;
    } catch (err) {
      if (err?.name === 'AbortError') { aborted = true; return false; }
      failed.push({ path, reason: reasonOf(err) });
      return false;
    }
  }

  /** Returns true when everything below `path` is gone. */
  async function shredTree(path) {
    let info;
    try {
      info = await lstat(path);
    } catch (err) {
      failed.push({ path, reason: reasonOf(err) });
      return false;
    }
    if (info.isSymbolicLink() || !info.isDirectory()) return shredOne(path);

    let entries;
    try {
      entries = await readdir(path, { withFileTypes: true });
    } catch (err) {
      failed.push({ path, reason: reasonOf(err) });
      return false;
    }
    let clean = true;
    for (const entry of entries) {
      if (aborted) return false;
      if (!(await shredTree(join(path, entry.name)))) clean = false;
    }
    if (!clean || aborted) return false;
    try {
      await rmdir(path);
      return true;
    } catch (err) {
      failed.push({ path, reason: reasonOf(err) });
      return false;
    }
  }

  for (const path of paths) {
    if (signal?.aborted || aborted) { aborted = true; break; }
    await shredTree(path);
  }

  return { shredded, failed, bytes, aborted };
}
