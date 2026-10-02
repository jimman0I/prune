import { attachFullPaths } from './diskMapTree.js';
import { withUnscannedRemainder } from './unscannedRemainder.js';

/** The backend's picture of a folder walk that is still running (see
 * backend/src/lib/liveTree.js), made ready to draw like any other scan.
 *
 * It needs three things done. Folders get their full paths, so the table and
 * the map can open them. The block standing for the small items it folded
 * together (it carries a count, not a name, because the backend knows no
 * language) is named in the user's language. And for a whole drive the
 * "not scanned yet" remainder is added -- real used space minus what has been
 * read -- so every folder on screen is a share of the drive, with the
 * unread part drawn as unread rather than left out.
 *
 * It is flagged `partial` and `truncated`, so nothing downstream mistakes it
 * for a finished scan. */
export function prepareSnapshot(snapshot, { rootPath, usedBytes = null, atDriveRoot = false, aggregateLabel }) {
  if (!snapshot) return null;

  const named = (node) => {
    if (node.aggregated) return { ...node, name: aggregateLabel(node.count ?? 1) };
    if (!node.children) return node;
    return { ...node, children: node.children.map(named) };
  };

  // A folded-together block is not a place: it must not get a path, or the
  // table would offer to open or remove somewhere that does not exist.
  const unpathed = (node) => {
    if (node.aggregated) { const { fullPath, ...rest } = node; return rest; }
    return node.children ? { ...node, children: node.children.map(unpathed) } : node;
  };
  const withPaths = unpathed(attachFullPaths(named(snapshot), rootPath));
  return atDriveRoot ? withUnscannedRemainder(withPaths, usedBytes) : withPaths;
}
