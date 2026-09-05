/** Choosing which copy of a duplicate set survives.
 *
 * The frontend's half of duplicateGroups.js. The backend groups the files
 * -- that needs the disk -- and the screen decides what to keep, which
 * needs only the groups it was handed. Kept as a real module rather than
 * inline in the component because the invariant below is worth a test.
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
