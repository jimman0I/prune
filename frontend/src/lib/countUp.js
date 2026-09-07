/** How long a number takes to settle on its new value. */
export const EASE_OUT_DURATION = 600;

const num = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

/** The value to show partway through a count.
 *
 * Cubic ease-out: most of the distance is covered early and the last few
 * percent crawl, which is what makes a number read as settling rather
 * than as a progress bar filling.
 *
 * Progress is clamped because a backgrounded tab hands back a delta far
 * past the duration on its first frame after returning, and an unclamped
 * ease would briefly show a figure LARGER than the real one. On a
 * dashboard reporting disk usage that is not a cosmetic problem.
 *
 * At progress 1 the target is returned exactly rather than computed --
 * floating-point easing lands on 499.99999 often enough to matter, and a
 * number that stops one unit short of the truth is worse than one that
 * never moved. */
export function countUpValue(from, to, progress) {
  const start = num(from);
  const end = num(to);
  if (progress >= 1) return end;
  if (progress <= 0) return start;

  const eased = 1 - (1 - progress) ** 3;
  return start + (end - start) * eased;
}
