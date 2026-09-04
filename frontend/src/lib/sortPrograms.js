import { isRecentlyInstalled, parseInstallDate } from './recentPrograms.js';

/** Columns that read best largest/newest first when you click them. */
const DESCENDING_FIRST = new Set(['sizeBytes', 'installDate', 'recent']);

/** Orders two programs by install date, oldest first, with an undated one
 * sorting as older than any date.
 *
 * This is the tiebreak inside the New column only, and it deliberately
 * reads a missing date differently from the Installed column beside it.
 * There, a missing date is unknown and sinks in both directions. Here the
 * question is only how new something is, and a program we could not date
 * is as far from new as the column can express -- so it belongs at the
 * not-new end, which flips with the arrow like every other value.
 *
 * The explicit null branches also keep two undated programs from
 * subtracting two nulls into NaN, which would leave the sort undefined. */
function byInstallDate(a, b) {
  const at = parseInstallDate(a.installDate);
  const bt = parseInstallDate(b.installDate);
  if (at === null && bt === null) return 0;
  if (at === null) return -1;
  if (bt === null) return 1;
  return at - bt;
}

const COMPARATORS = {
  name: (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  publisher: (a, b) => (a.publisher || '').localeCompare(b.publisher || '', undefined, { sensitivity: 'base' }),
  version: (a, b) => (a.version || '').localeCompare(b.version || '', undefined, { numeric: true }),
  architecture: (a, b) => (a.architecture || '').localeCompare(b.architecture || ''),
  sizeBytes: (a, b) => a.sizeBytes - b.sizeBytes,
  installDate: (a, b) => new Date(a.installDate) - new Date(b.installDate),
  // The New column. Sorting a flag on its own would leave every program
  // inside a group in whatever order the registry happened to hand them
  // over, so this falls back to the date: within the new ones, newest
  // first; within the rest, most recent first. Both halves then read the
  // way the arrow says.
  recent: (a, b, options) =>
    (Number(isRecentlyInstalled(a, options)) - Number(isRecentlyInstalled(b, options)))
    || byInstallDate(a, b)
};

/** Columns whose value is derived rather than stored on the program.
 * These are never "unknown": a program with no install date is not new,
 * which is an answer, not a gap -- unlike an unmeasured size. */
const DERIVED = new Set(['recent']);

/** Whether a value counts as "we don't know" for sorting. */
function isUnknown(program, column) {
  if (DERIVED.has(column)) return false;
  const value = program[column];
  return value === null || value === undefined || value === '';
}

/** Sorts a copy of `programs`.
 *
 * Unknown values always sink to the bottom, in BOTH directions. An
 * unknown size is not a zero-byte program: sorting it as 0 buries it
 * among the genuinely tiny ones and quietly turns "we couldn't read
 * this" into a measurement. Same for a missing install date.
 *
 * `options` carries the clock the New column needs. It is threaded through
 * rather than read inside the comparator so a test can sort against a
 * fixed date; every caller in the app omits it and gets the real one. */
export function sortPrograms(programs, column, direction, options = {}) {
  const compare = COMPARATORS[column];
  if (!compare) return [...programs];

  const sign = direction === 'desc' ? -1 : 1;
  return [...programs].sort((a, b) => {
    const aUnknown = isUnknown(a, column);
    const bUnknown = isUnknown(b, column);
    if (aUnknown && bUnknown) return 0;
    if (aUnknown) return 1;
    if (bUnknown) return -1;
    return compare(a, b, options) * sign;
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
