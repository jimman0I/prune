/** A file path split for a two-line row: the file's own name on top, and
 * the folder it sits in beneath, cut in the MIDDLE when it does not fit.
 *
 * CSS can only ellipsise the end of a line, and the end of a folder path is
 * the part that says which folder it is ("...\Pictures\2019"), while the
 * start is the part every path shares ("C:\Users\jim"). So the folder is
 * handed back in two pieces: a `head` that may shrink to an ellipsis and a
 * `tail` (the last folder) that never does. Rendered side by side, the
 * ellipsis lands in the middle.
 *
 * Separator-agnostic (Windows paths, but also forward slashes), and it
 * changes nothing about the text: name + dir + separator is the input, so
 * what is copied is exactly what was reported. */
export function splitPath(path) {
  const text = String(path ?? '');
  const cut = Math.max(text.lastIndexOf('\\'), text.lastIndexOf('/'));
  if (cut < 0) return { name: text, dir: '', head: '', tail: '' };

  const name = text.slice(cut + 1);
  const dir = text.slice(0, cut);
  const inner = Math.max(dir.lastIndexOf('\\'), dir.lastIndexOf('/'));
  // "C:" or a single folder: nothing to protect at the end, nothing to cut.
  if (inner <= 0) return { name, dir, head: dir, tail: '' };
  return { name, dir, head: dir.slice(0, inner), tail: dir.slice(inner) };
}
