import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { open, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { candidatesBySize, groupByDigest } from './duplicateGroups.js';
import { normalizePath, toExcludePattern } from '../lib/cleanGuards.js';
import { matchesExtension } from '../lib/exclusionInput.js';

/** Finding files that are byte-identical.
 *
 * The naive version hashes everything, and on a real drive that means
 * reading several hundred gigabytes to answer a question about a few. This
 * does it in three passes, each one cheap enough to make the next
 * affordable:
 *
 *   1. Walk and stat. Sizes only -- nothing is opened.
 *   2. Drop every size nothing else shares. Two files of different sizes
 *      cannot be identical, and most files on a machine are unique by
 *      size alone, so the great majority are ruled out here having never
 *      been read.
 *   3. Hash the survivors' FIRST 64 KB, and only fully hash what still
 *      collides. Files that share a size but differ usually differ near
 *      the start -- different videos, different installers, different
 *      save games -- so the full read is reserved for genuine candidates.
 *
 * Everything is bounded by an AbortSignal, checked between files rather
 * than only inside I/O, so cancelling stops the walk rather than stopping
 * the reporting of a walk that continues.
 */

/** Enough to separate files that merely share a size. Containers put
 * distinguishing headers well inside this. */
const PARTIAL_BYTES = 64 * 1024;

/** A ceiling on how much work one scan may do. A duplicate scan over a
 * whole drive is not a background task and must not become one. */
const DEFAULT_MAX_FILES = 200_000;

async function hashFile(path, { bytes = null, signal } = {}) {
  try {
    if (bytes !== null) {
      // A single positional read rather than a stream: for 64 KB the
      // stream machinery costs more than the read does.
      const handle = await open(path, 'r');
      try {
        const buffer = Buffer.alloc(bytes);
        const { bytesRead } = await handle.read(buffer, 0, bytes, 0);
        return createHash('sha256').update(buffer.subarray(0, bytesRead)).digest('hex');
      } finally {
        await handle.close();
      }
    }

    return await new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = createReadStream(path, { signal });
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  } catch {
    // A locked, vanished or unreadable file has no digest. Null, never a
    // placeholder -- see groupByDigest, which drops these rather than
    // grouping every unreadable file on the machine together.
    return null;
  }
}

/** Every file under `root`, with the sizes and times needed to group and
 * to choose a keeper. Directories are walked; nothing is opened. */
async function collectFiles(root, { signal, exclusions, maxFiles, onProgress }) {
  const files = [];
  const stack = [root];
  let scanned = 0;

  while (stack.length > 0) {
    if (signal?.aborted || files.length >= maxFiles) break;
    const dir = stack.pop();

    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      // Unreadable directory. Skipped rather than failing the scan, the
      // same way the disk map treats one.
      continue;
    }

    for (const entry of entries) {
      if (signal?.aborted || files.length >= maxFiles) break;
      const path = join(dir, entry.name);
      if (isExcluded(path, exclusions)) continue;

      if (entry.isDirectory()) {
        stack.push(path);
        continue;
      }
      if (!entry.isFile()) continue;

      try {
        const info = await stat(path);
        files.push({ path, size: info.size, mtimeMs: info.mtimeMs });
      } catch { /* gone between readdir and stat */ }

      if (++scanned % 500 === 0) onProgress?.({ phase: 'walking', scanned });
    }
  }

  return files;
}

function isExcluded(path, exclusions) {
  if (!exclusions) return false;
  const folders = exclusions.excludeFolders ?? [];
  const extensions = exclusions.excludeExtensions ?? [];
  if (matchesExtension(path, extensions)) return true;
  if (folders.length === 0) return false;

  const haystack = normalizePath(path);
  return folders.map(toExcludePattern).filter(Boolean).some((p) => haystack.includes(p));
}

/** Hashes a list, respecting the signal between files. */
async function hashAll(files, options, onProgress) {
  const out = [];
  for (let i = 0; i < files.length; i++) {
    if (options.signal?.aborted) break;
    const digest = await hashFile(files[i].path, options);
    out.push({ ...files[i], digest });
    if ((i + 1) % 50 === 0) onProgress?.({ phase: options.bytes ? 'sampling' : 'hashing', scanned: i + 1, total: files.length });
  }
  return out;
}

export async function findDuplicates(root, {
  signal,
  exclusions = null,
  maxFiles = DEFAULT_MAX_FILES,
  onProgress = null
} = {}) {
  const files = await collectFiles(root, { signal, exclusions, maxFiles, onProgress });
  onProgress?.({ phase: 'walked', scanned: files.length });

  // Pass 2: sizes. Nothing has been opened yet.
  const sizeGroups = candidatesBySize(files);
  const sizeCandidates = sizeGroups.flat();
  onProgress?.({ phase: 'sized', candidates: sizeCandidates.length, of: files.length });

  // Pass 3a: the first 64 KB, which separates most same-size files.
  const sampled = await hashAll(sizeCandidates, { bytes: PARTIAL_BYTES, signal }, onProgress);
  const stillColliding = groupByDigest(sampled).flatMap((group) => group.files);
  onProgress?.({ phase: 'sampled', candidates: stillColliding.length });

  // Pass 3b: full contents, only for what survived.
  const fullyHashed = await hashAll(stillColliding, { signal }, onProgress);

  const groups = groupByDigest(fullyHashed);
  return {
    groups,
    scannedFiles: files.length,
    // A partial answer is still an answer, and saying it is partial is
    // the difference between "no duplicates" and "we stopped looking".
    truncated: Boolean(signal?.aborted) || files.length >= maxFiles,
    wastedBytes: groups.reduce((sum, g) => sum + g.wastedBytes, 0)
  };
}
