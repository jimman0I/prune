/** How many programs Applications last found, this session only.
 *
 * Not persisted, not fetched -- a plain in-memory value ProgramList sets
 * whenever a real fetchPrograms() resolves, and the one consumer,
 * BugReportModal, reads once when it opens. A bug report must stay
 * instant, so it rides along on whatever Applications already found
 * rather than triggering a fresh (and possibly exactly what is broken)
 * registry read of its own.
 *
 * Found live (2026-09-29): a fresh Windows 10 install showed Applications
 * as completely empty, with no way to tell from the report alone that it
 * really was zero rather than the reporter just not mentioning it. */
let count = null;

export function setLastProgramsCount(n) {
  // null is an explicit, valid "nothing known yet" -- tests reset to it
  // between cases; anything else that isn't a real count is just ignored.
  if (n === null || (Number.isInteger(n) && n >= 0)) count = n;
}

export function getLastProgramsCount() {
  return count;
}
