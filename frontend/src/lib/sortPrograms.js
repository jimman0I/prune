/** Columns that read best largest/newest first when you click them. */
const DESCENDING_FIRST = new Set(['sizeBytes', 'installDate']);

const COMPARATORS = {
  name: (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  publisher: (a, b) => (a.publisher || '').localeCompare(b.publisher || '', undefined, { sensitivity: 'base' }),
  version: (a, b) => (a.version || '').localeCompare(b.version || '', undefined, { numeric: true }),
  architecture: (a, b) => (a.architecture || '').localeCompare(b.architecture || ''),
  sizeBytes: (a, b) => a.sizeBytes - b.sizeBytes,
  installDate: (a, b) => new Date(a.installDate) - new Date(b.installDate)
};

/** Whether a value counts as "we don't know" for sorting. */
function isUnknown(program, column) {
  const value = program[column];
  return value === null || value === undefined || value === '';
}

/** Sorts a copy of `programs`.
 *
 * Unknown values always sink to the bottom, in BOTH directions. An
 * unknown size is not a zero-byte program: sorting it as 0 buries it
 * among the genuinely tiny ones and quietly turns "we couldn't read
 * this" into a measurement. Same for a missing install date. */
export function sortPrograms(programs, column, direction) {
  const compare = COMPARATORS[column];
  if (!compare) return [...programs];

  const sign = direction === 'desc' ? -1 : 1;
  return [...programs].sort((a, b) => {
    const aUnknown = isUnknown(a, column);
    const bUnknown = isUnknown(b, column);
    if (aUnknown && bUnknown) return 0;
    if (aUnknown) return 1;
    if (bUnknown) return -1;
    return compare(a, b) * sign;
  });
}

/** What clicking a column header should do: reverse if it's already the
 * sorted column, otherwise switch to it in the direction someone clicking
 * that particular column almost always wants. */
export function nextSortState(current, column) {
  if (current.column === column) {
    return { column, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { column, direction: DESCENDING_FIRST.has(column) ? 'desc' : 'asc' };
}
