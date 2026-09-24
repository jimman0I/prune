/** The screens in the order the nav rail lists them, top to bottom.
 *
 * One list for two readers: Ctrl+1 to Ctrl+8 jump to the Nth entry, and
 * each rail tooltip shows the number that goes with its own position. Kept
 * out of both components so neither can quietly reorder the other's idea
 * of "first" -- NavRail.render.test.jsx asserts the rail renders in exactly
 * this order, which is the cross-check.
 *
 * Settings is last because it lives in the rail's footer, but it is still
 * a screen in the list, and Ctrl+, keeps opening it directly as well. */
export const SCREEN_ORDER = [
  'dashboard',
  'diskmap',
  'applications',
  'quarantine',
  'startup',
  'duplicates',
  'deepclean',
  'settings'
];
