/** Which folders changed between two saved scans.
 *
 * Compares FOLDERS by full path (case-insensitive, as Windows is), because
 * that is what a compact scan holds for certain. Four lists, each the top N:
 *
 *   grew / shrank -- folders in both, by change in size. A folder whose
 *     change is explained by one child (that child accounts for 90% of it) is
 *     left out in favour of the child: "Users grew 40 GB" followed by "Users\me
 *     grew 40 GB" and "Users\me\AppData grew 40 GB" is one fact said three
 *     times, and the deepest one is the one to act on.
 *   added / removed -- folders in only one scan, and only the TOP-most such
 *     folder: a new folder's whole subtree is new too, and listing every
 *     descendant would bury the thing that appeared.
 *
 * Iterative throughout, for the same reason scanArchive.js is. */
const EXPLAINED_BY_CHILD = 0.9;

function flatten(root) {
  const byPath = new Map();
  const stack = [{ node: root, path: root.n, parent: null }];
  while (stack.length > 0) {
    const { node, path, parent } = stack.pop();
    const entry = { path, size: node.s, parent, maxChildDelta: 0 };
    byPath.set(path.toLowerCase(), entry);
    for (const child of node.c ?? []) stack.push({ node: child, path: `${path}\\${child.n}`, parent: path.toLowerCase() });
  }
  return byPath;
}

export function compareScans(older, newer, { limit = 25 } = {}) {
  const before = flatten(older.root);
  const after = flatten(newer.root);

  const grew = [];
  const shrank = [];
  const added = [];
  const removed = [];

  // Deltas of the folders present in both, with each parent learning its
  // biggest child delta so a parent explained by one child can be dropped.
  const deltas = new Map();
  for (const [key, now] of after) {
    const was = before.get(key);
    if (!was) continue;
    const delta = now.size - was.size;
    deltas.set(key, { path: now.path, before: was.size, after: now.size, delta, parent: now.parent });
  }
  const biggestChild = new Map();
  for (const d of deltas.values()) {
    if (!d.parent) continue;
    const seen = biggestChild.get(d.parent);
    const magnitude = Math.abs(d.delta);
    if (seen === undefined || magnitude > seen) biggestChild.set(d.parent, magnitude);
  }
  for (const [key, d] of deltas) {
    if (d.delta === 0) continue;
    if ((biggestChild.get(key) ?? 0) >= Math.abs(d.delta) * EXPLAINED_BY_CHILD) continue;
    (d.delta > 0 ? grew : shrank).push({ path: d.path, before: d.before, after: d.after, delta: d.delta });
  }

  for (const [key, now] of after) {
    if (!before.has(key) && (now.parent === null || before.has(now.parent))) added.push({ path: now.path, size: now.size });
  }
  for (const [key, was] of before) {
    if (!after.has(key) && (was.parent === null || after.has(was.parent))) removed.push({ path: was.path, size: was.size });
  }

  const top = (list, by) => list.sort((a, b) => by(b) - by(a)).slice(0, limit);
  const totalBefore = older.root.s;
  const totalAfter = newer.root.s;
  return {
    totalBefore,
    totalAfter,
    delta: totalAfter - totalBefore,
    grew: top(grew, (r) => r.delta),
    shrank: top(shrank, (r) => -r.delta),
    added: top(added, (r) => r.size),
    removed: top(removed, (r) => r.size)
  };
}
