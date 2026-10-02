/** The largest few files a rule would take, kept while walking.
 *
 * Preview shows a per-file list now, and a rule can match millions of files
 * (a shader cache, a profile-wide search), so the list is built as the walk
 * goes and never holds more than `limit` entries: a min-heap by size, where
 * a file smaller than the smallest kept is rejected with one comparison.
 * The rule's true count and total come from the walk itself, not from this. */

export const FILE_LIST_LIMIT = 200;

export function createTopFiles(limit = FILE_LIST_LIMIT) {
  const heap = []; // min-heap by sizeBytes: heap[0] is the smallest kept

  const swap = (i, j) => { const t = heap[i]; heap[i] = heap[j]; heap[j] = t; };
  const up = (i) => {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heap[parent].sizeBytes <= heap[i].sizeBytes) break;
      swap(parent, i);
      i = parent;
    }
  };
  const down = (i) => {
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let smallest = i;
      if (l < heap.length && heap[l].sizeBytes < heap[smallest].sizeBytes) smallest = l;
      if (r < heap.length && heap[r].sizeBytes < heap[smallest].sizeBytes) smallest = r;
      if (smallest === i) break;
      swap(i, smallest);
      i = smallest;
    }
  };

  return {
    add(path, sizeBytes) {
      if (limit <= 0 || !Number.isFinite(sizeBytes)) return;
      if (heap.length < limit) {
        heap.push({ path, sizeBytes });
        up(heap.length - 1);
      } else if (sizeBytes > heap[0].sizeBytes) {
        heap[0] = { path, sizeBytes };
        down(0);
      }
    },
    /** Biggest first. */
    toArray() {
      return [...heap].sort((a, b) => b.sizeBytes - a.sizeBytes);
    }
  };
}

/** The union of several actions' lists, capped and biggest first. */
export function mergeTopFiles(lists, limit = FILE_LIST_LIMIT) {
  const top = createTopFiles(limit);
  for (const list of lists) for (const file of list || []) top.add(file.path, file.sizeBytes);
  return top.toArray();
}
