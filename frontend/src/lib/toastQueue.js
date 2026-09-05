/** The toast stack, as pure data.
 *
 * Separate from the component and from the hook because the interesting
 * behaviour is not the rendering: it is what happens when the same thing
 * is announced twice, what happens when six announcements arrive at once,
 * and what is allowed to disappear on a timer. Those are decisions, and
 * decisions in a component are decisions nothing tests.
 */

/** How many can be on screen. Past four the stack is taller than most of
 * what it covers, and the oldest is already gone from memory. */
export const MAX_TOASTS = 4;

/** Default life. Long enough to read a sentence twice, which is the
 * actual bar -- people look up mid-way. */
export const DEFAULT_TTL = 5000;

/** Repeats inside this window are counted rather than stacked. */
const DEDUPE_WINDOW = 8000;

let sequence = 0;

function sameToast(a, b) {
  // Tone is part of identity: "Cleanup complete" as a success and as a
  // failure are different events even if a caller words them alike.
  return a.message === b.message && (a.tone ?? 'info') === (b.tone ?? 'info');
}

/** Adds a toast, or counts it against an identical recent one.
 *
 * Counting rather than stacking matters for the messages this app raises:
 * cleaning twice in a row produces the same sentence twice, and four
 * copies of it hide the one line that WAS different. The timer resets
 * when a repeat lands, so the second occurrence gets a full life rather
 * than inheriting whatever was left of the first. */
export function addToast(toasts, toast, { now = Date.now(), max = MAX_TOASTS } = {}) {
  const list = toasts || [];
  if (!toast?.message) return list;

  const entry = {
    tone: 'info',
    ttl: DEFAULT_TTL,
    ...toast,
    id: `t${++sequence}`,
    createdAt: now,
    count: 1
  };

  const existing = list.findIndex((t) => sameToast(t, entry) && now - t.createdAt < DEDUPE_WINDOW);
  if (existing >= 0) {
    const bumped = { ...list[existing], count: list[existing].count + 1, createdAt: now };
    return [bumped, ...list.slice(0, existing), ...list.slice(existing + 1)];
  }

  return [entry, ...list].slice(0, max);
}

/** Drops whatever has run out of time.
 *
 * `ttl: 0` never expires. A failure nobody has acknowledged should not
 * vanish on a timer -- that is how someone misses the only notice that
 * three files were not cleaned.
 *
 * Returns the SAME array when nothing changed. This runs on an interval,
 * and a fresh array every tick would re-render the host and restart every
 * exit animation underneath it. */
export function expireToasts(toasts, now = Date.now()) {
  const list = toasts || [];
  const kept = list.filter((t) => !t.ttl || now - t.createdAt < t.ttl);
  return kept.length === list.length ? list : kept;
}

/** Removes one by id, and returns the same array if it was not there. */
export function dismissToast(toasts, id) {
  const list = toasts || [];
  const next = list.filter((t) => t.id !== id);
  return next.length === list.length ? list : next;
}
