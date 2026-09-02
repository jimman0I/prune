/** Name of the block standing in for the part of the drive the scan
 * never reached. Exported so the renderer can style it without matching
 * on a string literal in two places. */
export const UNSCANNED_LABEL = 'Not scanned (ran out of time)';

/** How much of the drive has to be missing before it's worth drawing.
 * Below this the remainder is measurement noise -- logical vs allocated
 * sizes, files created during the scan -- not a hole in the picture. */
const MEANINGFUL_FRACTION = 0.02;

/** Reconciles a truncated drive-root scan against the space Windows says
 * is actually in use, and adds the difference as a visible block.
 *
 * This exists because of what a truncated scan looks like without it.
 * Unelevated, a scan of C:\ on this machine hit its 30-second budget
 * alphabetically at "Games" and returned 35.7 GB for a drive holding
 * 845 GB. The banner said "possibly incomplete", but the treemap itself
 * drew Games as 82% of the disk -- confidently, at full size, with Users
 * (528 GB), Program Files (x86) (225 GB) and ProgramData (155 GB) not
 * shown as unknown but simply absent. Someone reading it would go delete
 * the wrong thing.
 *
 * With the remainder drawn, every scanned slice becomes a fraction of the
 * real drive instead of a fraction of the fragment, and the biggest block
 * on screen is an honest "I haven't looked here yet" -- which is also the
 * clearest possible argument for the fast scan.
 *
 * Not a fabricated number: it's real used space minus what was really
 * measured. Where that subtraction can't be trusted -- no used-space
 * figure, a completed scan, or a total that already exceeds used space
 * (which hardlinks make legitimate) -- it returns the tree untouched
 * rather than inventing a block. */
export function withUnscannedRemainder(tree, usedBytes) {
  if (!tree || !tree.truncated) return tree;
  if (typeof usedBytes !== 'number' || !Number.isFinite(usedBytes) || usedBytes <= 0) return tree;

  const remainder = usedBytes - tree.size;
  if (remainder <= usedBytes * MEANINGFUL_FRACTION) return tree;

  return {
    ...tree,
    size: usedBytes,
    children: [
      ...(tree.children || []),
      { name: UNSCANNED_LABEL, size: remainder, type: 'directory', scanned: false }
    ]
  };
}

/** How much of the drive a reconciled scan actually measured, as
 * { used, measured, percent } -- or null when the tree carries no
 * remainder block and there is therefore nothing to compare against.
 *
 * The percentage is the point. "Possibly incomplete" reads as a rounding
 * caveat; "measured 34.5 GB of 850 GB in use" tells someone instantly
 * that what's on screen is nearly all hole. It rounds UP to 1% rather
 * than down to 0, because a real measurement reported as 0% claims
 * nothing was scanned, which is a different and wrong statement. */
export function scanCoverage(tree) {
  const remainder = tree?.children?.find((c) => c.scanned === false && c.name === UNSCANNED_LABEL);
  if (!remainder) return null;
  const measured = tree.size - remainder.size;
  return {
    used: tree.size,
    measured,
    percent: measured > 0 ? Math.max(1, Math.round((measured / tree.size) * 100)) : 0
  };
}
