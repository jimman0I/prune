/** Matching a file against the user's excluded file types.
 *
 * The other half of this -- turning what someone TYPED into a stored
 * value -- lives in the frontend, because it is a question about input
 * rather than about files. Splitting them that way means neither side
 * duplicates the other's logic: the UI decides once, at the point the
 * user's intent is clearest, and the backend only ever sees a normalised
 * '.iso'.
 */

/** Whether a file's own extension is in the list.
 *
 * The LAST extension only. "backup.iso.tmp" is a .tmp file, and matching
 * ".iso" anywhere in the name would protect the one file the user least
 * meant to keep.
 *
 * A leading dot is a name, not an extension: ".gitignore" is a file
 * called that, which is the same rule fileTypeColors.js applies on the
 * front end. */
export function matchesExtension(filePath, extensions) {
  if (typeof filePath !== 'string' || !Array.isArray(extensions) || extensions.length === 0) {
    return false;
  }

  const name = filePath.split(/[\\/]/).pop() ?? '';
  const match = /[^.](\.[A-Za-z0-9_-]+)$/.exec(name);
  if (!match) return false;

  const found = match[1].toLowerCase();
  return extensions.some((ext) => String(ext).toLowerCase() === found);
}
