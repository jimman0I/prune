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

/** One line of the live CLEAN log -- BleachBit's own "Delete ..." /
 * "Vacuum ..." output, for the step that actually removes something
 * rather than the scan that only measures it.
 *
 * `item` is a streamed executeRulesProgressively result: { id, name,
 * freedBytes, skipped, recycled, error }. The label leads with a verb the
 * same way BleachBit's does (Delete / Recycle), because "Chrome Cache"
 * on its own doesn't say what just happened to it -- only what was
 * chosen a screen ago. */
export function executeLogLine(item) {
  if (item.error) {
    return { label: item.name ?? item.id, detail: item.error, tone: 'warning' };
  }

  // The verb says what actually happened, not just what was chosen --
  // a rule that only vacuums a database or only removes a registry key
  // never "Deletes" anything, and saying so would be inaccurate, not
  // just imprecise.
  //
  // `registryKeysRemoved` is set iff executeRule's merge logic ran a
  // winreg action for this rule, so its presence (not its value) is the
  // discriminator -- 0 means the action ran and found nothing to remove,
  // not that the field is absent.
  if (item.registryKeysRemoved !== undefined) {
    const label = `Clear ${item.name ?? item.id}`;
    return item.registryKeysRemoved > 0
      ? { label, detail: `${item.registryKeysRemoved} registry key${item.registryKeysRemoved === 1 ? '' : 's'}`, tone: 'size' }
      : { label, detail: 'already absent', tone: 'muted' };
  }

  // `vacuumed` is set iff executeRule ran a sqlite.vacuum action for this
  // rule -- freedBytes here came from compacting a database file, not
  // from removing any. `vacuumed: true` only means the action RAN, not
  // that it succeeded: sqliteVacuumAction.execute can still come back
  // with freedBytes: 0 and real entries in skipped[] (missing file,
  // excluded/too-recent guard, or the VACUUM subprocess itself failing
  // against a locked/corrupt database) -- collapsing that into a flat
  // "Compact X: 0 B" would hide a real failure behind a genuine no-op,
  // so this follows the same freedBytes -> skipped -> empty shape the
  // Delete/Recycle fallthrough below already uses.
  if (item.vacuumed) {
    const label = `Compact ${item.name ?? item.id}`;
    if (item.freedBytes > 0) {
      return { label, detail: formatBytes(item.freedBytes), tone: 'size' };
    }
    if (item.skipped?.length > 0) {
      return { label, detail: `${item.skipped.length} skipped`, tone: 'warning' };
    }
    return { label, detail: 'already empty', tone: 'muted' };
  }

  // `edited` is set iff executeRule ran a json action for this rule --
  // freedBytes here came from removing one key from a JSON file, not
  // from deleting the file itself. Same "ran, but might not have
  // succeeded" caveat vacuumed carries: a held/failed edit still sets
  // edited, so this follows the identical freedBytes -> skipped -> empty
  // fallthrough rather than an unconditional "success" label.
  if (item.edited) {
    const label = `Trim ${item.name ?? item.id}`;
    if (item.freedBytes > 0) {
      return { label, detail: formatBytes(item.freedBytes), tone: 'size' };
    }
    if (item.skipped?.length > 0) {
      return { label, detail: `${item.skipped.length} skipped`, tone: 'warning' };
    }
    return { label, detail: 'already empty', tone: 'muted' };
  }

  const verb = item.recycled ? 'Recycle' : 'Delete';
  const label = `${verb} ${item.name ?? item.id}`;

  if (item.freedBytes > 0) {
    // A rule with locked files still freed something -- Chrome's cache
    // is a thousand small files and a handful being open in another
    // process should read as "mostly done", not silently vanish behind
    // the size of everything else that came off.
    const lockedSuffix = item.skipped?.length > 0 ? `, ${item.skipped.length} locked` : '';
    return { label, detail: `${formatBytes(item.freedBytes)}${lockedSuffix}`, tone: 'size' };
  }

  if (item.skipped?.length > 0) {
    return { label, detail: `${item.skipped.length} locked`, tone: 'warning' };
  }

  return { label, detail: 'already empty', tone: 'muted' };
}
