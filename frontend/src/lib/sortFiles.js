/** Sorts the File view's list by size, modified date or name.
 *
 * The same rule sortFolderRows.js keeps for the Tree view: a missing value
 * is UNKNOWN, not smallest or oldest, so it sinks in both directions rather
 * than being filed beside the files that really are the oldest. Ties fall
 * back to the name so the order never shuffles between renders. */
export function sortFiles(files, column = 'size', direction = 'desc') {
  const list = [...(files || [])];
  const sign = direction === 'asc' ? 1 : -1;
  const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });

  list.sort((a, b) => {
    if (column === 'name') return byName(a, b) * sign;

    const left = a[column];
    const right = b[column];
    const leftMissing = left === null || left === undefined;
    const rightMissing = right === null || right === undefined;
    if (leftMissing && rightMissing) return byName(a, b);
    if (leftMissing) return 1;
    if (rightMissing) return -1;
    if (left === right) return byName(a, b);
    return (left < right ? -1 : 1) * sign;
  });
  return list;
}
