/** The native file/folder chooser for "Shred files...".
 *
 * The page cannot reach the file system by itself: a plain <input type=file>
 * hides the real path in a sandboxed window, and a dropped folder arrives as
 * a File with no usable path. So the page asks the main process, naming only
 * a KIND ('files' or 'folders'), and gets back an array of path strings. It
 * cannot set the dialog's title, filters or starting folder -- the one piece
 * of main-process UI the page can open is a plain chooser.
 *
 * Kept free of `require('electron')` so it is testable under node:test: the
 * dialog and window are handed in. */

const KINDS = {
  files: ['openFile', 'multiSelections'],
  folders: ['openDirectory', 'multiSelections']
};

/** The options for one kind, or null for anything else. */
function dialogOptionsFor(kind) {
  if (typeof kind !== 'string' || !Object.hasOwn(KINDS, kind)) return null;
  return { properties: [...KINDS[kind]] };
}

/** Opens the chooser and resolves the chosen paths -- an empty list when
 * cancelled, when the kind is unknown, or when nothing usable came back. */
async function pickPaths({ dialog, win, kind }) {
  const options = dialogOptionsFor(kind);
  if (!options) return [];
  const result = await dialog.showOpenDialog(win, options);
  if (!result || result.canceled || !Array.isArray(result.filePaths)) return [];
  return result.filePaths.filter((p) => typeof p === 'string' && p.length > 0);
}

module.exports = { pickPaths, dialogOptionsFor };
