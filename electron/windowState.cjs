const { readFile, writeFile } = require('node:fs/promises');

/** Whether a saved window position falls within any currently-connected
 * display's work area. A laptop undocked from a second monitor since the
 * last save is the real case this exists for -- without it, a window
 * saved at x:2200 (once a real second monitor's coordinate space) opens
 * off-screen and invisible on a single-display machine, indistinguishable
 * from the app not launching at all. */
function isOnAnyDisplay(bounds, displays) {
  return displays.some((display) => {
    const area = display.workArea;
    return bounds.x >= area.x && bounds.x < area.x + area.width
      && bounds.y >= area.y && bounds.y < area.y + area.height;
  });
}

function isValidSavedState(saved) {
  return saved
    && typeof saved.width === 'number' && typeof saved.height === 'number'
    && typeof saved.x === 'number' && typeof saved.y === 'number';
}

/** Real bounds to open the window with: the saved ones if they're valid
 * and still on a real, currently-connected display, the app's own
 * default otherwise. Pure -- no Electron runtime dependency beyond the
 * plain shapes `screen.getAllDisplays()` and a saved-state object already
 * provide, so the one piece of real logic here (the display-validation
 * branch) is testable without ever opening a real window. */
function resolveWindowState({ saved, displays, defaultBounds }) {
  if (isValidSavedState(saved) && isOnAnyDisplay(saved, displays)) {
    return saved;
  }
  return { ...defaultBounds, x: undefined, y: undefined, isMaximized: false };
}

/** Best-effort, like every other piece of this feature -- a read failure
 * (missing file, corrupt JSON) means "nothing saved yet", never a crash
 * that blocks the window from opening at all. */
async function loadWindowState(filePath) {
  try {
    const text = await readFile(filePath, 'utf8');
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Best-effort on the write side too -- a failed save should never block
 * app shutdown or resizing. */
async function saveWindowState(filePath, state) {
  try {
    await writeFile(filePath, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

module.exports = { resolveWindowState, loadWindowState, saveWindowState };
