/** The drive letter a path is on ("C" for "c:\Users\me"), or null for
 * anything that is not a drive path -- a UNC share has no letter. */
export function driveLetterOf(path) {
  const match = /^([a-z]):(?:[\\/]|$)/i.exec(String(path ?? '').trim());
  return match ? match[1].toUpperCase() : null;
}

/** "C:\" -- the path of a drive's root, which is also what the scanner and
 * the breadcrumb call the drive. */
export function rootOfDrive(letter) {
  return `${String(letter).toUpperCase()}:\\`;
}

/** Used bytes and the used share of a drive, from what Windows reports.
 * Null where free space is unknown -- a percentage guessed from a missing
 * number would be drawn as a fact. */
export function driveUsage(drive) {
  const total = drive?.totalBytes;
  const free = drive?.freeBytes;
  if (typeof total !== 'number' || !(total > 0) || typeof free !== 'number' || !Number.isFinite(free)) return null;
  const usedBytes = Math.max(0, total - free);
  return { usedBytes, percent: Math.min(100, Math.round((usedBytes / total) * 100)) };
}

/** Splits a fast-scan reply into the drives that were read and the ones that
 * were not.
 *
 * The reply carries one entry per drive, each either a tree or an error:
 * a FAT32 stick in the same job must not cost the user the C: scan they
 * just approved a prompt for. A requested drive the reply never mentions is
 * reported as a failure too -- silence is not success. The older
 * single-drive shape ({ tree, stats, driveLetter }) is still understood. */
export function drivesFromScan(result, requested = []) {
  const entries = Array.isArray(result?.drives)
    ? result.drives
    : result?.tree
      ? [{ driveLetter: result.driveLetter ?? requested[0], tree: result.tree, stats: result.stats }]
      : [];

  const scanned = [];
  const failures = [];
  for (const entry of entries) {
    const letter = String(entry?.driveLetter ?? '').toUpperCase();
    if (!letter) continue;
    if (entry.tree) scanned.push({ letter, tree: entry.tree, stats: entry.stats ?? {} });
    else failures.push({ letter, error: entry.error ?? 'The drive could not be read.' });
  }

  for (const asked of requested.map((l) => String(l).toUpperCase())) {
    if (![...scanned, ...failures].some((d) => d.letter === asked)) {
      failures.push({ letter: asked, error: 'The drive was not part of the scan.' });
    }
  }
  return { scanned, failures };
}
