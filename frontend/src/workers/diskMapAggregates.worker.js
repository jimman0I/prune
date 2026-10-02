import { createAggregator } from '../lib/aggregator.js';

/** Computes Disk Map's three heaviest tree-derived views off the main
 * thread: the file-type breakdown, the largest-files list, and the
 * folder table's per-row counts.
 *
 * Each is an honest single O(n) pass over the scanned tree on its own --
 * see their own file-level comments, which each independently reasoned
 * that a full sort or a full walk is cheap "at the ~68,000-80,000 files a
 * real scan produces here." That reasoning holds on the machine it was
 * measured on. It does not hold on a heavily-used drive with millions of
 * files -- a large Steam library, a few years of node_modules, a dev
 * drive nobody has cleaned -- where the fast (MFT) scan hands back a tree
 * n times larger, and three of these passes run back to back,
 * synchronously, in the exact render that just received the scan.
 * Reported directly: Disk Map froze the WHOLE app, not just its own tab,
 * on some machines -- which is the signature of a main-thread block, not
 * of a slow feature.
 *
 * Moving the work here does not make any of the three passes
 * algorithmically faster. It makes them not block window drags, other
 * tabs, or anything else sharing the renderer's one JS thread while they
 * run. `useDiskMapAggregates.js` is what posts to this and what falls
 * back to the same handler (synchronously) wherever `Worker` does not
 * exist -- Node's test environment, most notably -- so both paths must
 * produce the exact same numbers.
 *
 * The tree is posted once and remembered (see lib/aggregator.js); a search
 * after that sends only its text. */
const handle = createAggregator();

self.onmessage = (event) => {
  self.postMessage(handle(event.data));
};
