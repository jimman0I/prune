import { extensionBreakdown } from './extensionBreakdown.js';
import { largestFiles } from './largestFiles.js';
import { folderTableRows } from './folderTable.js';

/** The Disk Map's tree-derived views, as one stateful handler shared by the
 * Web Worker and by the synchronous fallback.
 *
 * Stateful for one reason: the search box. A search changes only the
 * largest-files list, and the tree it runs over can be millions of nodes. If
 * every keystroke re-sent the tree to the worker, structured-cloning it would
 * cost more than the search. So the tree is sent once, remembered here, and
 * later requests carry only the search text; the file-type breakdown and the
 * folder rows, which do not depend on the search, are computed once per
 * tree and reused.
 *
 * `handle` takes { requestId, tree?, fileLimit, filterText } -- `tree` only
 * when it changed -- and returns the three views. */
export function createAggregator() {
  let tree = null;
  let cached = null;

  return function handle({ requestId, tree: incoming, fileLimit, filterText }) {
    if (incoming) {
      tree = incoming;
      cached = null;
    }
    if (!tree) throw new Error('No tree has been sent to aggregate.');
    cached ??= { extensionBreakdown: extensionBreakdown(tree), folderRows: folderTableRows(tree) };
    return {
      requestId,
      extensionBreakdown: cached.extensionBreakdown,
      folderRows: cached.folderRows,
      largestFiles: largestFiles(tree, { limit: fileLimit, filterText })
    };
  };
}
