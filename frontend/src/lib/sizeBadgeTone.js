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
 * the quietest band rather than as an error state. */
export function sizeBadgeTone(bytes) {
  if (!bytes) return 'low';
  if (bytes < 100 * MB) return 'low';
  if (bytes < 1 * GB) return 'moderate';
  if (bytes < 5 * GB) return 'high';
  return 'peak';
}
