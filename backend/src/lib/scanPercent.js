/** Real percent of a whole-drive walk, or null when there is no honest one.
 *
 * `bytes` is what the walk has processed so far (logical file sizes);
 * `inUseBytes` is what the volume reports as allocated. They measure
 * different things (sparse and compressed files, NTFS metadata, hard links
 * and unreadable folders), so the ratio approaches but does not reliably
 * reach 100. It is capped at 99 so the bar can never claim "done" before the
 * scan itself says so. Below the cap the number is the raw ratio, floored:
 * this caps a value, it does not smooth one.
 *
 * Null unless `inUseBytes` is a positive finite number: an unknown total
 * yields no number at all, never a guess.
 */
export function scanPercent(bytes, inUseBytes) {
  if (typeof inUseBytes !== 'number' || !Number.isFinite(inUseBytes) || inUseBytes <= 0) return null;
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return null;
  return Math.min(99, Math.floor((bytes / inUseBytes) * 100));
}
