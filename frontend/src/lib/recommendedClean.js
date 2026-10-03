/** What "Clean recommended" on the Dashboard would clean.
 *
 * The same idea as Deep Clean's default ticks (rules marked `recommended` in
 * cleaners.json: caches that rebuild themselves, nothing that costs a large
 * re-download or loses state a person can see), narrowed further for a
 * one-click action:
 *
 * - Nothing that loses data. A rule marked `risky` is never taken, even one the
 *   person once ticked in Deep Clean and chose to stop being asked about: that
 *   choice was made there, for that screen.
 * - Nothing that must be confirmed every time (the free-space wipe).
 * - Only what a scan measured and found something in. A rule with no size is
 *   either empty (nothing to do) or unknown, and a one-click clean is the wrong
 *   place to act on a number nobody has seen.
 *
 * Pure: takes a Deep Clean tree (listed, or measured, or restored from the
 * remembered scan) and says which rule ids, and how many bytes they add up to. */
export function recommendedPlan(tree) {
  const ids = [];
  let bytes = 0;
  let fromCache = false;
  for (const group of Array.isArray(tree) ? tree : []) {
    for (const item of group?.items ?? []) {
      if (item.recommended !== true) continue;
      if (item.risky || item.confirmEveryTime) continue;
      if (item.present === false || item.accessible === false) continue;
      if (item.rescanNeeded) continue;
      if (typeof item.sizeBytes !== 'number' || !(item.sizeBytes > 0)) continue;
      ids.push(item.id);
      bytes += item.sizeBytes;
      if (item.fromCache === true) fromCache = true;
    }
  }
  return { ids, bytes, count: ids.length, fromCache };
}
