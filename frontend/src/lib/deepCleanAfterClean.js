/** What Deep Clean's rows say after a clean, without walking the disk again.
 *
 * A rescan used to follow every clean, to make the sizes on screen true. The
 * clean already reports, rule by rule, what it removed -- and that is enough
 * to say a good deal truthfully, so the rows are updated from it:
 *
 * - A rule that only deletes files (a `delete` or `deepscan` action) and had
 *   nothing skipped is empty now: 0 B.
 * - The same rule with locked or held files keeps what is left: its old size
 *   minus what came off. Not a measurement, but arithmetic on two numbers the
 *   disk itself gave, and the rule's own result says the rest was skipped.
 * - Anything else -- a database edited in place, registry entries, a search
 *   that stopped short so its size was only a floor -- has no honest "what is
 *   left" from the numbers a clean reports. Those rows are marked
 *   `rescanNeeded` and show no size, rather than a guess.
 *
 * Pure: takes the tree and the clean's per-rule results, returns a new tree. */

const DELETES_FILES = new Set(['delete', 'deepscan']);

/** The rule's actions, read the way the backend reads them: an explicit
 * list, else a legacy `command` (one shell action) or `paths` (one delete). */
function actionTypes(item) {
  if (Array.isArray(item.actions)) return item.actions.map((a) => a?.type);
  if (item.command) return ['shell'];
  if (item.paths) return ['delete'];
  return [];
}

function onlyDeletesFiles(item) {
  const types = actionTypes(item);
  return types.length > 0 && types.every((type) => DELETES_FILES.has(type));
}

/** The row with everything a fresh scan would have filled in removed, so a
 * settled row never carries a file list, a partial-result flag or a
 * "from the last scan" mark that no longer describes it. */
function withoutScanDetail(item) {
  const { files: _files, filesListed: _filesListed, fromCache: _fromCache, incomplete: _incomplete, rescanNeeded: _rescanNeeded, ...rest } = item;
  return rest;
}

function settleRow(item, result) {
  const unreadable = item.accessible === false;
  const measured = typeof item.sizeBytes === 'number';
  // A rule that was never measured (a command, the free-space wipe) has no
  // number to bring up to date.
  if (!measured && !unreadable) return item;

  const removed = (Number(result.freedBytes) || 0) + (Number(result.movedBytes) || 0);
  const skipped = Array.isArray(result.skipped) ? result.skipped.length : 0;
  const scheduled = Number(result.scheduledForRestart) || 0;
  const leftBehind = skipped > 0 || scheduled > 0;

  if (unreadable) {
    // Only an administrator clean reaches these. If it took nothing and
    // skipped everything, the folder is still protected: say nothing new.
    if (removed === 0 && leftBehind) return item;
    return { ...withoutScanDetail(item), sizeBytes: null, fileCount: null, accessible: true, rescanNeeded: true };
  }

  if (onlyDeletesFiles(item) && !item.incomplete) {
    const left = leftBehind ? Math.max(0, item.sizeBytes - removed) : 0;
    return { ...withoutScanDetail(item), sizeBytes: left, fileCount: left === 0 ? 0 : null };
  }

  // Cannot be subtracted. If it did nothing at all, the row is still true.
  const changedSomething = removed > 0 || leftBehind || (Number(result.registryKeysRemoved) || 0) > 0;
  if (!changedSomething) return item;
  return { ...withoutScanDetail(item), sizeBytes: null, fileCount: null, rescanNeeded: true };
}

/** `tree` after a clean reported `results` (one object per rule, as the
 * execute stream sends them). Rows the clean did not report on, and rules
 * that failed outright, are returned untouched. */
export function settleScanAfterClean(tree, results) {
  if (!Array.isArray(tree) || !Array.isArray(results) || results.length === 0) return tree;
  const byId = new Map();
  for (const result of results) if (result && typeof result.id === 'string' && !result.error) byId.set(result.id, result);
  if (byId.size === 0) return tree;
  return tree.map((group) => ({
    ...group,
    items: group.items.map((item) => {
      const result = byId.get(item.id);
      return result ? settleRow(item, result) : item;
    })
  }));
}
