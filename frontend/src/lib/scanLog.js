function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** Folds one streamed rule into the grouped tree the UI renders, so sizes
 * appear while the scan is still running rather than all at once at the
 * end.
 *
 * An UPDATE where it used to be an append. The tree is now on screen
 * before any scan runs -- built from the rule list, every size a dash --
 * so a scanned rule has a placeholder waiting for it. Appending would
 * have listed all forty rules twice. Matching on id and leaving the row
 * where it is also keeps the tree still while it fills in, instead of
 * reordering itself under the reader.
 *
 * Returns a new array every time. The tree is rendered from React state
 * mid-scan, and mutating the previous one in place would leave counts and
 * sizes stale until something unrelated happened to trigger a render. */
export function mergeScannedRule(categories, item) {
  const index = categories.findIndex((group) => group.category === item.category);
  if (index === -1) return [...categories, { category: item.category, items: [item] }];

  return categories.map((group, i) => {
    if (i !== index) return group;
    const at = group.items.findIndex((existing) => existing.id === item.id);
    if (at === -1) return { ...group, items: [...group.items, item] };
    return {
      ...group,
      items: group.items.map((existing, j) => (j === at ? { ...existing, ...item } : existing))
    };
  });
}

/** One line of the live scan log: what was just looked at, and what was
 * found.
 *
 * The detail is the whole point of showing a log rather than a spinner.
 * "0 B" is four genuinely different answers -- the software isn't here,
 * the folder exists but Windows wouldn't let us read it, there is nothing
 * to measure because the rule runs a command, or it really is empty --
 * and running past them at one line each is the clearest place to tell
 * them apart. */
export function scanLogLine(item) {
  if (item.sizeBytes === null || item.sizeBytes === undefined) {
    return { label: item.name, detail: 'nothing to measure', tone: 'muted' };
  }
  if (item.accessible === false) {
    return { label: item.name, detail: 'needs admin', tone: 'warning' };
  }
  if (item.present === false) {
    return { label: item.name, detail: 'not installed', tone: 'muted' };
  }
  if (item.sizeBytes === 0) {
    return { label: item.name, detail: 'empty', tone: 'muted' };
  }
  return { label: item.name, detail: formatBytes(item.sizeBytes), tone: 'size' };
}
