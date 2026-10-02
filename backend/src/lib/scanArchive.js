/** The compact form a Disk Map scan is saved in, and the check that what
 * arrives from the window really is that form.
 *
 * A scan of a busy drive is millions of files; saving every one would make a
 * 1 GB file per save and a multi-second load for a comparison that only
 * wants to know which FOLDERS grew. So the saved form is the folder tree
 * with counts, plus the biggest files:
 *
 *   { v: 1,
 *     root: { n: name, s: size, a?: allocated, m?: modified,
 *             f?: files below, d?: folders below, fc?: files directly in it,
 *             fb?: bytes of those files, c?: [child folders] },
 *     top: [{ p: path, s: size, a?: allocated, m?: modified }, ...] }
 *
 * The window builds it (frontend/src/lib/compactTree.js) because the tree
 * lives there; this module is the backend's gatekeeper. It rebuilds the tree
 * from only the fields it knows, so a request cannot smuggle arbitrary data
 * into a file, and it bounds depth and node count so a hostile or broken
 * body cannot exhaust memory. Iterative on purpose: a deep tree must not be
 * able to overflow the stack. */
export const ARCHIVE_VERSION = 1;
export const MAX_NODES = 3_000_000;
export const MAX_DEPTH = 64;
export const MAX_TOP_FILES = 1000;
const MAX_NAME = 1024;

const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined);

function cleanNode(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.n !== 'string' || raw.n === '' || raw.n.length > MAX_NAME) return null;
  const size = num(raw.s);
  if (size === undefined) return null;
  const node = { n: raw.n, s: size };
  for (const key of ['a', 'm', 'f', 'd', 'fc', 'fb']) {
    const value = num(raw[key]);
    if (value !== undefined) node[key] = value;
  }
  return node;
}

/** Returns { ok: true, archive, nodeCount } with a rebuilt copy, or
 * { ok: false, error }. */
export function normalizeArchive(input) {
  if (!input || typeof input !== 'object' || input.v !== ARCHIVE_VERSION) {
    return { ok: false, error: 'That is not a saved-scan file this version of Prune understands.' };
  }
  const root = cleanNode(input.root);
  if (!root) return { ok: false, error: 'The scan has no valid root folder.' };

  let nodeCount = 1;
  const stack = [{ raw: input.root, clean: root, depth: 0 }];
  while (stack.length > 0) {
    const { raw, clean, depth } = stack.pop();
    if (!Array.isArray(raw.c) || raw.c.length === 0) continue;
    if (depth + 1 > MAX_DEPTH) return { ok: false, error: 'The scan nests deeper than Prune saves.' };
    clean.c = [];
    for (const rawChild of raw.c) {
      const child = cleanNode(rawChild);
      if (!child) return { ok: false, error: 'The scan contains a folder that is not valid.' };
      if (++nodeCount > MAX_NODES) return { ok: false, error: 'The scan has more folders than Prune saves.' };
      clean.c.push(child);
      stack.push({ raw: rawChild, clean: child, depth: depth + 1 });
    }
  }

  const top = [];
  for (const file of Array.isArray(input.top) ? input.top.slice(0, MAX_TOP_FILES) : []) {
    if (!file || typeof file.p !== 'string' || file.p.length > 4096 || num(file.s) === undefined) continue;
    const entry = { p: file.p, s: file.s };
    for (const key of ['a', 'm']) {
      const value = num(file[key]);
      if (value !== undefined) entry[key] = value;
    }
    top.push(entry);
  }

  return { ok: true, archive: { v: ARCHIVE_VERSION, root, top }, nodeCount };
}
