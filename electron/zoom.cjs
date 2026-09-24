/** Text zoom for the app window: the decision logic, kept free of Electron
 * so it can be tested without a window.
 *
 * `win.removeMenu()` (main.cjs) removed Electron's default menu, and the
 * View > Zoom accelerators went with it, so the app's 9-12 px text could not
 * be enlarged at all. main.cjs restores Ctrl+= / Ctrl++ / Ctrl+- / Ctrl+0
 * through `before-input-event` and Ctrl+wheel through `zoom-changed`, and
 * both routes come here to decide what the key or wheel means and what the
 * new level is.
 *
 * Levels are Chromium's own: 0 is 100% and every whole step multiplies by
 * 1.2 (so 0.5 is about 1.095x). The range stops at about 69% and 173%.
 * Below that text is unreadable, and above it the 900 px minimum window
 * lays out at under 520 css px, narrower than any screen here was designed
 * for. */

const ZOOM_STEP = 0.5;
const ZOOM_MIN = -2;
const ZOOM_MAX = 3;

const clamp = (level) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, level));

/** Snapped to a whole step so repeated float additions can never drift
 * off the grid (0.5 is exact in binary, but a saved value may not be). */
const snap = (level) => Math.round(level / ZOOM_STEP) * ZOOM_STEP;

/** What a keyboard event means for zoom: 'in', 'out', 'reset' or null.
 *
 * Only Ctrl with an optional Shift: Shift is how a US layout types `+`, so
 * it must be allowed, but Alt or Meta held means some other chord. Only the
 * press, not the release, and auto-repeat is deliberately kept so holding
 * the key keeps stepping. `key` is the character, so the numpad's + and -
 * arrive as the same '+' and '-'. */
function zoomActionForInput(input) {
  if (!input || input.type !== 'keyDown') return null;
  if (!input.control || input.alt || input.meta) return null;
  switch (input.key) {
    case '=':
    case '+':
      return 'in';
    case '-':
      return 'out';
    case '0':
      return 'reset';
    default:
      return null;
  }
}

/** The level after an action, always inside [ZOOM_MIN, ZOOM_MAX]. An
 * unknown action leaves the (clamped) level alone. */
function applyZoomAction(level, action) {
  const current = Number.isFinite(level) ? level : 0;
  if (action === 'in') return clamp(snap(current + ZOOM_STEP));
  if (action === 'out') return clamp(snap(current - ZOOM_STEP));
  if (action === 'reset') return 0;
  return clamp(snap(current));
}

/** The level to restore from saved window state. Anything that is not a
 * finite number means 100%: a corrupt file must never produce a NaN zoom. */
function resolveSavedZoom(saved) {
  const level = saved && typeof saved === 'object' ? saved.zoomLevel : undefined;
  if (typeof level !== 'number' || !Number.isFinite(level)) return 0;
  return clamp(snap(level));
}

module.exports = { zoomActionForInput, applyZoomAction, resolveSavedZoom, ZOOM_STEP, ZOOM_MIN, ZOOM_MAX };
