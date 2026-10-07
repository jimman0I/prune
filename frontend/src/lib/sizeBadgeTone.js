const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;

/** Which severity band a program's size badge falls in.
 *
 * Returns a severity, never a colour. It used to return 'cyan' | 'blue' |
 * 'amber' | 'coral', which tied this file to the palette and then broke
 * twice over when the palette changed: cyan became the primary action
 * colour, so the smallest band would have matched every button on screen,
 * and coral stopped existing at all. What a band means is a fact about
 * size; what colour it is drawn in belongs to the component drawing it.
 *
 * Unknown or zero size -- which many system components report -- reads as
 * the quietest band rather than as an error state.
 *
 * Thresholds raised from the original 1GB/5GB split: on a real machine
 * that put the amber bands on most of the list -- Office, a browser, a
 * handful of ordinary desktop apps all clear 1GB on their own -- which
 * left amber meaning "this program exists" rather than "this one is
 * actually worth a second look." 2GB and 15GB instead put amber on the
 * programs a disk-space screen exists to flag: games and large suites,
 * not everyday software. */
export function sizeBadgeTone(bytes) {
  if (!bytes) return 'low';
  if (bytes < 250 * MB) return 'low';
  if (bytes < 2 * GB) return 'moderate';
  if (bytes < 15 * GB) return 'high';
  return 'peak';
}
