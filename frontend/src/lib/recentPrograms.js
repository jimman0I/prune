/** How recent an install has to be to be flagged New.
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
 * Waves at 17/08 sits in Other.
 *
 * This used to drive a two-group split of the table, with recent installs
 * under their own collapsible heading. It is a column now: the same fact,
 * carried by the row it belongs to instead of by a band above it. A
 * grouping decides the order for you and costs a full-width heading and a
 * collapse state; a sortable column puts the same rows on top when you ask
 * for them and stays out of the way when you have sorted by size. */
export const RECENT_DAYS = 7;

/** Whether this program landed on the machine within the window.
 *
 * A program with no date is never recent. Most of these dates are now
 * inferred from the uninstall key's write time rather than declared, but
 * an absent one means we could not establish any date at all, and guessing
 * that it is new would flag arbitrary rows. */
export function isRecentlyInstalled(program, { now = Date.now(), days = RECENT_DAYS } = {}) {
  const time = parseInstallDate(program?.installDate);
  if (time === null) return false;

  // Whole days, not a rolling 168 hours. An install date carries no time
  // of day, so comparing it against an instant makes "seven days ago"
  // mean "seven days ago, but only if it was installed after lunch".
  const today = new Date(now);
  const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
    - days * 24 * 60 * 60 * 1000;
  return time >= cutoff;
}

/** Parses the YYYY-MM-DD the backend produces, as local midnight.
 *
 * `new Date('2026-09-02')` parses as UTC midnight, which in any timezone
 * ahead of UTC is the previous day locally -- enough to drop a program out
 * of the window a day early.
 *
 * Exported because sorting by the New column needs the same reading of the
 * same field: a column that disagrees with the flag beside it about what
 * "2026-09-02" means would be worse than no column. */
export function parseInstallDate(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const time = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime();
  return Number.isFinite(time) ? time : null;
}
