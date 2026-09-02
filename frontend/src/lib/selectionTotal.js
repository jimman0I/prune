/** What the selected rules add up to, and how much of that is actually
 * known.
 *
 * The tree now lists every rule before anything is measured, so the
 * footer has to distinguish two states that both used to render as
 * "0 B": nothing selected is worth cleaning, and nothing selected has
 * been measured yet. The first is a result. The second is a question we
 * have not asked the disk.
 *
 * Saying "0 B" for the second is the same class of mistake as showing a
 * placeholder version -- a confident number where there is no number. */
export function selectionTotal(categories, selected) {
  let bytes = 0;
  let measured = 0;
  let unmeasured = 0;

  for (const group of categories || []) {
    for (const item of group.items || []) {
      if (!selected.has(item.id)) continue;
      if (typeof item.sizeBytes === 'number') {
        bytes += item.sizeBytes;
        measured += 1;
      } else {
        unmeasured += 1;
      }
    }
  }

  return { bytes, measured, unmeasured, anyMeasured: measured > 0 };
}
