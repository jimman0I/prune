/** Sorts folder-table rows by a column.
 *
 * Its own module rather than an inline comparator because of what nulls
 * mean here. A row with no counts is one the scan never opened, and
 * sorting it as if it were zero would file "we didn't look" among "we
 * looked and found nothing" -- which is the distinction the whole table
 * is built to preserve.
 *
 * Unmeasured rows always sink, in both directions. They are not the
 * smallest and they are not the largest; they are unknown, and unknown
 * belongs at the bottom of a list someone is scanning for the biggest
 * thing. */
export function sortFolderRows(rows, column, direction = 'desc') {
  const list = [...(rows || [])];
  const sign = direction === 'asc' ? 1 : -1;

  list.sort((a, b) => {
    if (column === 'name') {
      // Names always read A-Z under "asc", whatever the other columns do.
      return a.name.localeCompare(b.name, undefined, { numeric: true }) * sign;
    }

    const left = a[column];
    const right = b[column];
    const leftMissing = left === null || left === undefined;
    const rightMissing = right === null || right === undefined;

    if (leftMissing && rightMissing) return a.name.localeCompare(b.name);
    if (leftMissing) return 1;   // sinks, regardless of direction
    if (rightMissing) return -1;

    if (left === right) return a.name.localeCompare(b.name);
    return (left < right ? -1 : 1) * sign;
  });

  return list;
}

/** Click behaviour for a column header.
 *
 * A new column starts descending, because every numeric column here is
 * one someone opens the table to find the top of. Clicking the active
 * column flips it. */
export function nextFolderSort(current, column) {
  if (current.column !== column) return { column, direction: column === 'name' ? 'asc' : 'desc' };
  return { column, direction: current.direction === 'asc' ? 'desc' : 'asc' };
}
