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

/** Life of a toast that carries an action (Undo). Five seconds is long enough
 * to read a sentence twice, not to read it, decide, and move to a button: this
 * is the time somebody has to change their mind. Hovering or focusing it holds
 * it for as long as they need. */
export const UNDO_TTL = 15000;

/** Life of a warning. A warning is something to act on ("protected by
 * Windows", "3 files locked"), so it stays longer than a confirmation -- but
 * it does leave. Notices that never left piled up in the corner and read as
 * a bug; the same facts are on the screen that raised them. Hovering or
 * focusing a toast holds it for as long as someone needs. */
export const WARNING_TTL = 12000;

/** Life of a failure: the only account of what went wrong, so the longest. A
 * caller that really needs one to stay passes `ttl: 0`. */
export const ERROR_TTL = 20000;

const TONE_TTL = { warning: WARNING_TTL, danger: ERROR_TTL };

/** Repeats inside this window are counted rather than stacked. */
const DEDUPE_WINDOW = 8000;

let sequence = 0;

function sameToast(a, b) {
  // An action belongs to one event: two moves into Quarantine with the same
  // words are two Undo buttons for two different batches, and merging them
  // would leave one batch with nothing to bring it back.
  if (a.action || b.action) return false;
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

  const tone = toast.tone ?? 'info';
  const entry = {
    tone: 'info',
    // Stated by the caller wins; otherwise it depends on what kind of
    // notice this is.
    ttl: Math.max(TONE_TTL[tone] ?? DEFAULT_TTL, toast.action ? UNDO_TTL : 0),
    ...toast,
    id: `t${++sequence}`,
    createdAt: now,
    count: 1
  };

  const existing = list.findIndex((t) => sameToast(t, entry) && now - t.createdAt < DEDUPE_WINDOW);
  if (existing >= 0) {
    const held = list[existing];
    // A repeat lands on a toast somebody may be reading right now: keep it
    // held (pausedAt moves to now so the fresh life starts at resume).
    const bumped = { ...held, count: held.count + 1, createdAt: now, ...(held.pausedAt != null && { pausedAt: now }) };
    return [bumped, ...list.slice(0, existing), ...list.slice(existing + 1)];
  }

  return [entry, ...list].slice(0, max);
}

/** Drops whatever has run out of time.
 *
 * `ttl: 0` never expires; only a caller that asks for it explicitly gets
 * that.
 *
 * Returns the SAME array when nothing changed. This runs on an interval,
 * and a fresh array every tick would re-render the host and restart every
 * exit animation underneath it. */
export function expireToasts(toasts, now = Date.now()) {
  const list = toasts || [];
  const kept = list.filter((t) => t.pausedAt != null || !t.ttl || now - t.createdAt < t.ttl);
  return kept.length === list.length ? list : kept;
}

/** Stops one toast's clock, for as long as it is hovered or focused.
 *
 * Somebody reading a toast, or moving to its dismiss button, must not have
 * it taken away mid-sentence. The moment is remembered so resumeToast can
 * give back exactly the time spent held. Pausing an already-paused toast
 * keeps the FIRST moment: hover and then focus are one continuous hold. */
export function pauseToast(toasts, id, now = Date.now()) {
  const list = toasts || [];
  const at = list.findIndex((t) => t.id === id);
  if (at < 0 || list[at].pausedAt != null) return list;
  return list.map((t, i) => (i === at ? { ...t, pausedAt: now } : t));
}

/** Restarts it, with the time spent held not counted against its life. */
export function resumeToast(toasts, id, now = Date.now()) {
  const list = toasts || [];
  const at = list.findIndex((t) => t.id === id);
  if (at < 0 || list[at].pausedAt == null) return list;
  return list.map((t, i) => {
    if (i !== at) return t;
    const { pausedAt, ...rest } = t;
    return { ...rest, createdAt: t.createdAt + (now - pausedAt) };
  });
}

/** Removes one by id, and returns the same array if it was not there. */
export function dismissToast(toasts, id) {
  const list = toasts || [];
  const next = list.filter((t) => t.id !== id);
  return next.length === list.length ? list : next;
}
