/** A scan, boiled down to what is worth keeping, and back.
 *
 * The saved form (documented in backend/src/lib/scanArchive.js) is the FOLDER
 * tree with counts plus the biggest files. A scan of a busy drive holds
 * millions of files, and a saved copy of every one would be a gigabyte that
 * answers questions nobody asks later; "which folders grew" and "what are my
 * biggest files" are answered by this. The folder's own file count and file
 * bytes are kept (fc / fb), which is what lets a reopened scan account for
 * the files it did NOT keep as one labelled block, so every folder still adds
 * up. */
const ARCHIVE_VERSION = 1;
const DEFAULT_TOP_FILES = 200;

const isMeasured = (node) => node.scanned !== false;

/** Folder tree -> compact archive. `tree` is a Disk Map tree with `fullPath`
 * on its nodes (attachFullPaths). The synthetic "not scanned" and "free
 * space" blocks are not saved: they describe the moment of the scan, not the
 * drive. */
export function compactTree(tree, { topFiles = DEFAULT_TOP_FILES, rootName } = {}) {
  const top = [];
  // Trimmed whenever it doubles, so a tree of millions of files never holds
  // millions of candidates.
  const trim = () => { top.sort((a, b) => b.s - a.s); top.length = Math.min(top.length, topFiles); };

  function walk(node) {
    const out = { n: node.name, s: node.size || 0 };
    if (typeof node.allocated === 'number') out.a = node.allocated;
    if (typeof node.modified === 'number') out.m = node.modified;
    if (!Array.isArray(node.children)) return out; // past the depth cap: size only

    let files = 0;
    let folders = 0;
    let directFiles = 0;
    let directBytes = 0;
    const children = [];
    for (const child of node.children) {
      if (!isMeasured(child) || child.aggregated || child.free) continue;
      if (child.type === 'directory') {
        const compact = walk(child);
        children.push(compact);
        folders += 1 + (compact.d ?? 0);
        files += compact.f ?? 0;
      } else {
        files += 1;
        directFiles += 1;
        directBytes += child.size || 0;
        if ((child.size || 0) > 0) {
          const entry = { p: child.fullPath || child.name, s: child.size };
          if (typeof child.allocated === 'number') entry.a = child.allocated;
          if (typeof child.modified === 'number') entry.m = child.modified;
          top.push(entry);
          if (top.length > topFiles * 2) trim();
        }
      }
    }
    out.f = files;
    out.d = folders;
    out.fc = directFiles;
    out.fb = directBytes;
    if (children.length > 0) out.c = children;
    return out;
  }

  const root = walk(tree);
  // The folder walk names a drive root by its path ("C:\"), the MFT scan by its
  // label ("C:"); a saved scan always uses the label so two scans line up.
  if (rootName) root.n = rootName;
  trim();
  return { v: ARCHIVE_VERSION, root, top };
}

const lower = (path) => path.toLowerCase();

/** Compact archive -> a tree the Disk Map renders, with full paths. The saved
 * big files go back under the folders they came from, and the files that were
 * not kept become one `aggregated` block per folder (named by
 * `aggregateLabel(count)`), so a folder's children still add up to its size. */
export function expandArchive(archive, { rootPath, aggregateLabel = (n) => `${n} smaller items` }) {
  const keptByParent = new Map();
  for (const file of archive.top ?? []) {
    const parent = lower(file.p.slice(0, Math.max(file.p.lastIndexOf('\\'), 0)));
    if (!keptByParent.has(parent)) keptByParent.set(parent, []);
    keptByParent.get(parent).push(file);
  }

  const joinPath = (parent, name) => (parent.endsWith('\\') ? `${parent}${name}` : `${parent}\\${name}`);

  function build(compact, fullPath) {
    const node = { name: compact.n, size: compact.s, type: 'directory', fullPath };
    if (typeof compact.a === 'number') node.allocated = compact.a;
    if (typeof compact.m === 'number') node.modified = compact.m;
    if (typeof compact.f === 'number') node.counts = { files: compact.f, folders: compact.d ?? 0 };
    const hasListing = Array.isArray(compact.c) || typeof compact.f === 'number';
    if (!hasListing) return node; // past the depth cap

    const children = (compact.c ?? []).map((child) => build(child, joinPath(fullPath, child.n)));
    let keptCount = 0;
    let keptBytes = 0;
    const key = lower(fullPath.replace(/\\+$/, ''));
    for (const file of keptByParent.get(key) ?? []) {
      keptCount += 1;
      keptBytes += file.s;
      const name = file.p.slice(file.p.lastIndexOf('\\') + 1);
      const fileNode = { name, size: file.s, type: 'file', fullPath: file.p };
      if (typeof file.a === 'number') fileNode.allocated = file.a;
      if (typeof file.m === 'number') fileNode.modified = file.m;
      children.push(fileNode);
    }
    const leftCount = (compact.fc ?? 0) - keptCount;
    const leftBytes = (compact.fb ?? 0) - keptBytes;
    if (leftCount > 0 || leftBytes > 0) {
      children.push({ name: aggregateLabel(Math.max(leftCount, 1)), size: Math.max(leftBytes, 0), type: 'file', aggregated: true });
    }
    children.sort((a, b) => b.size - a.size);
    node.children = children;
    return node;
  }

  return build(archive.root, rootPath);
}
