/** The key used for a directory, and for a file with no extension. These
 * match the backend's own FOLDER_KEY / GENERIC_FILE_KEY. */
export const FOLDER_KEY = 'folder';
export const GENERIC_FILE_KEY = 'file';

/** Lowercased ".ext", or null when the name has no real extension.
 *
 * The extension has to contain a letter. Without that, a versioned folder
 * like "app-1.0.9255" reads as a ".9255 file" -- Squirrel apps put those
 * everywhere -- and the treemap would ask the shell about hundreds of
 * file types that don't exist. */
export function extensionOf(name) {
  if (typeof name !== 'string') return null;
  const match = name.match(/(\.[a-z0-9_-]{1,12})$/i);
  if (!match) return null;
  const ext = match[1].toLowerCase();
  return /[a-z]/.test(ext) ? ext : null;
}

/** Which icon a treemap cell should use, or null for a cell that should
 * have none. */
export function iconKeyForNode(node) {
  if (!node) return null;
  // The unscanned-remainder block isn't a real folder; a folder icon
  // would imply it's something you could open.
  if (node.scanned === false) return null;
  if (node.type === 'directory') return FOLDER_KEY;
  return extensionOf(node.name) ?? GENERIC_FILE_KEY;
}

/** The distinct real extensions among these cells -- what to ask the
 * backend to resolve. Folders and extensionless files need no lookup:
 * their icons come back with every response anyway. */
export function extensionsInCells(cells) {
  const found = new Set();
  for (const cell of cells || []) {
    if (cell.type !== 'file') continue;
    const ext = extensionOf(cell.name);
    if (ext) found.add(ext);
  }
  return [...found];
}
