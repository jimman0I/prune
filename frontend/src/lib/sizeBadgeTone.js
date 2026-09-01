const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;

/** Which color band a program's size badge should use, per the Aurora Deck
 * brief's own size bands. Unknown/zero size (many system components report
 * no size at all) reads as the lowest tier rather than an error state. */
export function sizeBadgeTone(bytes) {
  if (!bytes) return 'cyan';
  if (bytes < 100 * MB) return 'cyan';
  if (bytes < 1 * GB) return 'blue';
  if (bytes < 5 * GB) return 'amber';
  return 'coral';
}