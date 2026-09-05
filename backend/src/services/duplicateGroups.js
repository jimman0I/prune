/** Grouping identical files, and choosing which copy survives.
 *
 * Pure, and separate from the walking and hashing, because this is where
 * the decisions are: what counts as a candidate worth opening, what a
 * group actually WASTES as opposed to what it occupies, and which copy is
 * kept. All three are easy to get subtly wrong in ways no crash reveals.
 */

/** Which copy of a duplicate set survives.
 *
 * Named for what is KEPT rather than for what is selected. The brief said
 * "auto-select oldest", and that phrasing is ambiguous about which end
 * survives -- which is the consequential half of the choice, on a screen
 * whose whole job is deleting the other copies. */
export const KEEP = {
  OLDEST: 'oldest',
  NEWEST: 'newest'
};

/** Files worth hashing, grouped by the size they share.
 *
 * This is what makes a duplicate scan affordable at all. Hashing is the
 * expensive part, two files of different sizes cannot be identical, and
 * most files on a machine have a size nothing else shares -- so the great
 * majority are ruled out without ever being opened.
 *
 * Zero-byte files are dropped outright. Every empty file is byte-identical
 * to every other one, which is true and useless: it would be the largest
 * group on screen, and deleting from it frees nothing. */
export function candidatesBySize(files) {
  const bySize = new Map();
  for (const file of files || []) {
    const size = Number(file?.size);
    if (!Number.isFinite(size) || size <= 0) continue;
    if (!bySize.has(size)) bySize.set(size, []);
    bySize.get(size).push(file);
  }

  return [...bySize.values()].filter((group) => group.length > 1);
}

/** Hashed files, gathered into the sets that are genuinely identical.
 *
 * A file with no digest is dropped rather than grouped. Null is what an
 * unreadable or locked file comes back with, and treating it as a value
 * would collect every unreadable file on the machine into one group and
 * offer them for deletion as copies of each other. */
export function groupByDigest(hashed) {
  const byDigest = new Map();
  for (const file of hashed || []) {
    if (!file?.digest) continue;
    if (!byDigest.has(file.digest)) byDigest.set(file.digest, []);
    byDigest.get(file.digest).push(file);
  }

  const groups = [];
  for (const [digest, files] of byDigest) {
    if (files.length < 2) continue;
    const size = Number(files[0].size) || 0;
    groups.push({
      digest,
      size,
      count: files.length,
      // What deleting the extras would actually return. Three copies of a
      // 10 MB file waste 20 MB, not 30 -- one of them is the file. The
      // other figure would promise space that cannot be freed.
      wastedBytes: size * (files.length - 1),
      files
    });
  }

  return groups.sort((a, b) => b.wastedBytes - a.wastedBytes);
}

/** The paths to remove, keeping exactly one copy per group.
 *
 * The invariant worth stating: this NEVER returns every file in a group.
 * A bug that did would not delete a duplicate, it would delete the file.
 *
 * Ties are broken by path so the answer is stable. Two copies written in
 * the same millisecond are common -- a copy operation preserves mtime --
 * and a selection that reshuffled between scans would be untrustworthy in
 * exactly the situation it is most needed. */
export function selectForRemoval(groups, strategy = KEEP.OLDEST) {
  const selected = [];

  for (const group of groups || []) {
    const files = [...(group?.files || [])];
    if (files.length < 2) continue;

    files.sort((a, b) => {
      const at = Number(a.mtimeMs) || 0;
      const bt = Number(b.mtimeMs) || 0;
      if (at !== bt) return at - bt;
      return String(a.path).localeCompare(String(b.path));
    });

    // Sorted oldest-first, so the keeper is one end or the other.
    const keeper = strategy === KEEP.NEWEST ? files[files.length - 1] : files[0];
    for (const file of files) {
      if (file !== keeper) selected.push(file.path);
    }
  }

  return selected.sort();
}
