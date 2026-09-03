/** How recent an install has to be to lead the list.
 *
 * Revo splits its list into "New Programs" and "Other Programs". Its own
 * rule is not a window at all -- it remembers the list from last time and
 * calls whatever is new since then new -- which means the group empties
 * itself the moment you look at it twice. A fixed week is a different
 * promise and a more predictable one: this always answers "what landed on
 * this machine recently", whether or not Prune has ever run before.
 *
 * Seven days also reproduces the split Revo happens to show here: its new
 * group spans 27/08 to 02/09 against a clock reading 03/09, and Wuthering
 * Waves at 17/08 sits in Other. */
export const RECENT_DAYS = 7;

/** Splits the list into what was installed in the last week and
 * everything else, preserving the order it was given.
 *
 * Ordering is the caller's business -- the list arrives already sorted by
 * whichever column the user picked, and grouping must not quietly reorder
 * within a group.
 *
 * A program with no date is never "recent". Most of those dates are now
 * inferred from the uninstall key's write time rather than declared, but
 * an absent one means we could not establish any date at all, and guessing
 * that it is new would put arbitrary rows at the top of the list. */
export function splitRecentPrograms(programs, { now = Date.now(), days = RECENT_DAYS } = {}) {
  // Whole days, not a rolling 168 hours. An install date carries no time
  // of day, so comparing it against an instant makes "seven days ago"
  // mean "seven days ago, but only if it was installed after lunch".
  const today = new Date(now);
  const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
    - days * 24 * 60 * 60 * 1000;
  const recent = [];
  const rest = [];

  for (const program of programs || []) {
    const time = parseDate(program.installDate);
    if (time !== null && time >= cutoff) recent.push(program);
    else rest.push(program);
  }

  return { recent, rest };
}

/** Parses the YYYY-MM-DD the backend produces, as local midnight.
 *
 * `new Date('2026-09-02')` parses as UTC midnight, which in any timezone
 * ahead of UTC is the previous day locally -- enough to drop a program out
 * of the window a day early. */
function parseDate(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const time = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime();
  return Number.isFinite(time) ? time : null;
}
