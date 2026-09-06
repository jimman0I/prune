/** Sets one entry's state, by id, without touching the array it was given.
 *
 * By id and never by name: the same name legitimately appears in both
 * hives -- Discord is in the machine Run key and the user Run key on this
 * machine -- and those are two different entries that must not move
 * together.
 *
 * A fresh array because the rows render from it and a failed toggle has to
 * roll back to what was there before. Mutating in place leaves nothing to
 * roll back to. */
export function applyEnabled(items, id, enabled) {
  return (items || []).map((item) => (item.id === id ? { ...item, enabled } : item));
}

/** One entry's recorded state, by id, or null if there isn't one.
 *
 * Null rather than false for a missing entry, and the distinction is the
 * point: a row that has left the list since the click has no prior state
 * to return to, and writing `false` would invent one the machine never
 * reported. A caller rolling back should leave such a row alone.
 *
 * Exists so a failed toggle can revert to what the row ACTUALLY was
 * rather than to the inverse of what was asked. Those differ the moment
 * two clicks on one row overlap -- see the test beside this. */
export function enabledStateOf(items, id) {
  const found = (items || []).find((item) => item.id === id);
  return typeof found?.enabled === 'boolean' ? found.enabled : null;
}

/** What to do with what came back from the backend.
 *
 * The row moves the moment it is clicked, because a switch that waits a
 * second and a half for PowerShell feels broken. This decides whether that
 * optimism was justified, and what the user should be told if it wasn't.
 *
 * A declined UAC prompt rolls back silently. It is a decision the user
 * just made, not a failure, and an error banner for it would read as
 * something having gone wrong -- the row snapping back is the whole
 * message. Everything else that did not end in the requested state gets a
 * sentence, including `ok: true` with the wrong state: that is exactly the
 * case the backend's read-back exists to catch, and the row has to follow
 * the machine rather than the click. */
export function toggleOutcome(result, requested) {
  if (result?.ok === true && result.enabled === requested) {
    return { revert: false, message: null };
  }

  if (result?.cancelled) return { revert: true, message: null };

  if (result?.error) {
    return { revert: true, message: result.error };
  }

  if (result?.ok === true) {
    return {
      revert: true,
      message: `Windows still has this ${result.enabled ? 'enabled' : 'disabled'}.`
    };
  }

  return { revert: true, message: "The change didn't go through." };
}
