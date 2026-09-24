import { useCountUp } from '../hooks/useCountUp.js';

const defaultFormat = (n) => n.toLocaleString();

/** A number that counts to its new value instead of snapping.
 *
 * `format` receives the rounded in-flight value, so a byte formatter or a
 * locale-aware one both work. A non-finite value (a size not known yet)
 * renders as an em dash rather than NaN. */
export default function AnimatedNumber({ value, format = defaultFormat, duration = 250 }) {
  const shown = useCountUp(value, { duration });
  if (!Number.isFinite(value)) return <span>{'—'}</span>;
  return <span>{format(Math.round(shown))}</span>;
}
