/** How sure a leftover is, as the scan reports it.
 *
 * certain   the program's own folder or registry key vouches for it
 * likely    the product's name matches
 * possible  only the publisher's name, or one word of the product's
 *
 * A scan from before tiers existed carries none; such an item is treated as
 * likely, which is what a name match always was. */
export const TIERS = ['certain', 'likely', 'possible'];

export function tierOf(item) {
  return TIERS.includes(item?.confidence) ? item.confidence : 'likely';
}

const GROUPS = ['files', 'registryKeys', 'scheduledTasks'];

/** The groups the removal can act on, and so the only ones worth ticking. */
export const REMOVABLE_GROUPS = ['files', 'registryKeys'];

/** Whether any item in the scan says how sure it is. */
export function hasTiers(scanResult) {
  return GROUPS.some((group) => (scanResult?.[group]?.items || []).some((item) => TIERS.includes(item?.confidence)));
}

/** The "group:index" keys to tick when the review opens: certain and likely,
 * never possible. A possible item is a guess shared with other programs; it
 * is shown, and left for the person to choose. */
export function preselectKeys(scanResult, groups = REMOVABLE_GROUPS) {
  const keys = new Set();
  for (const group of groups) {
    const source = scanResult?.[group];
    if (!source?.ok) continue;
    (source.items || []).forEach((item, i) => {
      if (tierOf(item) !== 'possible') keys.add(`${group}:${i}`);
    });
  }
  return keys;
}

/** How many results the scan withheld because they belong to Windows, to a
 * Microsoft component, or to another installed program. */
export function protectedCount(scanResult) {
  return GROUPS.reduce((sum, group) => sum + (Number(scanResult?.[group]?.protected) || 0), 0);
}
