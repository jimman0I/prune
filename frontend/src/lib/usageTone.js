/** Colour for a "how full" readout: quiet until it matters.
 *
 * The primary accent is reserved for actions (index.css says so beside the
 * token), so a storage bar or the disk gauge coloured with it read as
 * something to press. These stay neutral, and turn amber only when the
 * number is a reason to act -- under 10% free, or a gauge at 85% or more.
 * Amber and not red: red keeps meaning broken or destructive.
 *
 * Returns CSS colour values, so a caller drops the result straight into a
 * style or an SVG stroke. Kept out of the components so the thresholds are
 * one testable place rather than three inline comparisons. */

export const NEUTRAL = 'var(--text-secondary)';
export const WARN = 'var(--warning)';

/** Free space under 10% of the drive. Unknown sizes stay neutral: a bar
 * that cannot be measured has nothing to warn about. */
export function storageBarColor(freeBytes, totalBytes) {
  if (typeof freeBytes !== 'number' || typeof totalBytes !== 'number' || totalBytes <= 0) return NEUTRAL;
  return freeBytes / totalBytes < 0.1 ? WARN : NEUTRAL;
}

/** A live gauge at 85% or more of its range. `base` is the gauge's own hue
 * (CPU and memory keep theirs); the warning replaces it only when full. */
export function gaugeColor(percent, base = NEUTRAL) {
  return Number.isFinite(percent) && percent >= 85 ? WARN : base;
}
