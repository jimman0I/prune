import { classifyScanError, SCAN_TOO_LARGE_MESSAGE } from '../scanErrors.js';

/** Reads the worker's output (see mftWorkerRun.js) from the lines of its file.
 *
 * `lines` are Buffers, one per line. A header is parsed (it is small); the tree
 * line after it is kept as the raw bytes it arrived as. The route that answers
 * the request writes those bytes straight to the response, so the backend --
 * which in the packaged app is the Electron main process -- never parses a
 * drive's tree only to serialize it again. `parseTrees` turns them into objects
 * for a caller that wants to look inside.
 *
 * Returns { drives } with one entry per drive:
 *   { driveLetter, stats, treeJson: Buffer }   (or `tree` when parseTrees)
 *   { driveLetter, error, code? }
 * or { error, code? } when the job itself failed. */
export function readDriveLines(lines, { parseTrees = false } = {}) {
  const drives = [];
  if (!Array.isArray(lines)) return { drives };
  for (let i = 0; i < lines.length; i++) {
    let header;
    try {
      header = JSON.parse(lines[i].toString('utf8'));
    } catch (err) {
      return { error: `The helper's output could not be read: ${err.message}` };
    }
    if (header.__error) return { error: header.__error, ...(header.__code ? { code: header.__code } : {}) };
    // Not a line this reader knows: ignored rather than guessed at.
    if (!header.hasTree && !header.driveLetter) continue;
    if (!header.hasTree) {
      drives.push({ driveLetter: header.driveLetter, error: header.error ?? 'The drive could not be read.', ...(header.code ? { code: header.code } : {}) });
      continue;
    }
    const treeLine = lines[++i];
    if (!treeLine) {
      drives.push({ driveLetter: header.driveLetter, error: 'The scan ended before the drive was written.' });
      continue;
    }
    if (!parseTrees) {
      drives.push({ driveLetter: header.driveLetter, stats: header.stats ?? {}, treeJson: treeLine });
      continue;
    }
    try {
      drives.push({ driveLetter: header.driveLetter, stats: header.stats ?? {}, tree: JSON.parse(treeLine.toString('utf8')) });
    } catch (err) {
      const code = classifyScanError(err);
      drives.push({ driveLetter: header.driveLetter, error: code ? SCAN_TOO_LARGE_MESSAGE : err.message, ...(code ? { code } : {}) });
    }
  }
  return { drives };
}
