/** Seconds left in a folder walk, counted down from a figure the SERVER sent.
 *
 * The walk has no honest "time to finish" -- it does not know how many
 * folders are below it -- but it does have a hard stop, and the backend says
 * how far away that is (`remainingMs` on each progress event). That makes
 * this an UPPER BOUND, not a prediction: a small folder finishes in a second
 * and simply ends. The wording that goes with it ("up to N s left") is what
 * keeps that honest; this function only does the arithmetic.
 *
 * `remainingMs` was true at `receivedAt`; `now` is when the answer is wanted.
 * Rounded UP, so the display reaches 0 only when the time really has run
 * out, and clamped at 0 so a late tick can never show a negative. Returns
 * null when there is no real figure, in which case nothing is shown.
 *
 * Deliberately no animation lives here or in whatever displays it: the
 * number is plain text that changes once a second, so there is nothing for
 * reduced motion to switch off. */
export function remainingSeconds({ remainingMs, receivedAt, now }) {
  if (!Number.isFinite(remainingMs) || !Number.isFinite(receivedAt) || !Number.isFinite(now)) return null;
  const left = remainingMs - Math.max(0, now - receivedAt);
  return Math.max(0, Math.ceil(left / 1000));
}
