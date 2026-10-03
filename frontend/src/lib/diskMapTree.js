/** Joins `parentPath` + `name` with exactly one backslash, whether or not
 * `parentPath` already ends in one -- a bare drive root ("C:\\") is the
 * one shape in this whole tree that already carries a trailing separator. */
function joinPath(parentPath, name) {
  return parentPath.endsWith('\\') ? `${parentPath}${name}` : `${parentPath}\\${name}`;
}

/** Walks a disk-scan tree (from GET /api/disk-scan) and attaches a
 * `fullPath` to every node -- the backend only returns each node's own
 * `name`, not its path, since the scan is already rooted at the request's
 * own `path` query param. The frontend needs the real path per node for
 * both the hover tooltip and drill-down (clicking a directory re-scans
 * its `fullPath`). `rootPath` is the path the tree was scanned FROM (i.e.
 * exactly what was passed to fetchDiskScan), attached to the root node
 * itself rather than re-derived from its `name` (which is just the last
 * path segment, and empty for a bare drive root). Pure and non-mutating --
 * returns a new tree, the original is untouched. `null` (a failed scan)
 * passes through unchanged. */
export function attachFullPaths(node, rootPath) {
  if (!node) return null;
  return attachPathsFrom(node, rootPath);
}

function attachPathsFrom(node, fullPath) {
  const { folded, ...rest } = node;
  const withPath = { ...rest, fullPath };
  if (!node.children) return withPath;
  withPath.children = node.children.map(child => attachPathsFrom(child, joinPath(fullPath, child.name)));
  if (folded) withPath.children = withFoldedRow(withPath.children, folded);
  return withPath;
}

/** The scan folds a big folder's smaller files into one block on the folder
 * ({ count, size, allocated, exts }, see backend/src/lib/foldFiles.js). Here it
 * becomes the row everything else already knows: an `aggregated` file node,
 * placed by size among its siblings, with no path (it is not a file anyone can
 * open or delete). Its name is English; the screen shows the translation made
 * from `count` (localizeUnscanned). */
function withFoldedRow(children, folded) {
  const row = {
    name: `(${folded.count.toLocaleString('en-US')} smaller files)`,
    size: folded.size,
    type: 'file',
    aggregated: true,
    count: folded.count
  };
  if (typeof folded.allocated === 'number') row.allocated = folded.allocated;
  if (folded.exts) row.exts = folded.exts;
  const at = children.findIndex((c) => (c.size || 0) < row.size);
  return at === -1 ? [...children, row] : [...children.slice(0, at), row, ...children.slice(at)];
}

/** A treemap given the WHOLE recursive tree renders every descendant as
 * its own nested rect -- a directory's rect ends up fully covered by its
 * children's rects (same region, painted on top of it), so it can never
 * be clicked (found live). This returns just `node`'s DIRECT children,
 * each with its own `children` stripped (if any) so recharts renders it
 * as one solid, fully clickable rect sized by its own total -- one
 * treemap level at a time, matching how drill-down is supposed to work.
 * `node` is expected to already carry `fullPath` (see attachFullPaths). */
export function topLevelCells(node) {
  if (!node?.children) return [];
  return node.children.map(({ children, ...cell }) => cell);
}
