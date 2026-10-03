/** The renderer's side of Hunter's crosshair.
 *
 * The desktop app exposes `window.pruneWindow.hunter` (electron/preload.cjs):
 * start (carrying two short, already-translated labels for the crosshair),
 * cancel, and a listener for the one result event. In a browser, in a test, or
 * in a development build served without Electron there is no such bridge, and
 * Hunter says it needs the desktop app -- never an error.
 *
 * Nothing here finds a window. The crosshair is dragged in a window of its
 * own; when it is dropped, the main process asks the backend what is at that
 * point and sends the answer back here as a result. */
const bridge = () => (typeof window === 'undefined' ? undefined : window.pruneWindow?.hunter);

/** Opens the crosshair and minimises Prune. Resolves to:
 *   { ok: true }               -- it is open (or was already: { ok, reused })
 *   { ok: false, unsupported } -- no bridge, or not Windows
 *   { ok: false, error }       -- anything else
 * Never rejects. */
export async function startHunter({ hint, cancel } = {}) {
  const hunter = bridge();
  if (!hunter?.start) return { ok: false, unsupported: true };
  try {
    return await hunter.start({ hint, cancel });
  } catch (err) {
    return { ok: false, error: err?.message || 'The crosshair could not open.' };
  }
}

/** Closes the crosshair and brings Prune back. Never rejects. */
export async function cancelHunter() {
  const hunter = bridge();
  if (!hunter?.cancel) return { ok: false, unsupported: true };
  try {
    return await hunter.cancel();
  } catch (err) {
    return { ok: false, error: err?.message || 'The crosshair could not be closed.' };
  }
}

/** Calls back with each result the crosshair produces: a picked window (with
 * its program and startup entries), 'nothing', 'unreadable', 'cancelled' or
 * 'failed'. Returns the function that stops listening. */
export function onHunterResult(callback) {
  const hunter = bridge();
  if (!hunter?.onResult) return () => {};
  return hunter.onResult(callback);
}
