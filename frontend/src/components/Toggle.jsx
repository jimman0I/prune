import { motion } from 'framer-motion';

/** The app's pill switch. The thumb rides a spring rather than a CSS
 * transition, so it settles with a touch of give; under a reduced-motion
 * preference (MotionConfig or the OS setting) framer snaps it instead.
 *
 * `size` exists because AutomationSettings draws a slightly smaller pill.
 * `label` is optional on purpose: with none, no aria-label is emitted and
 * the caller supplies the name some other way (or, as today, not at all). */
const SIZES = {
  md: { track: 'w-10 h-6', thumb: 'top-0.5 left-0.5 w-5 h-5', travel: 16 },
  sm: { track: 'w-[38px] h-[21px]', thumb: 'top-[3px] left-[3px] w-[15px] h-[15px]', travel: 17 }
};

export default function Toggle({ checked, onChange, label, disabled = false, size = 'md' }) {
  const s = SIZES[size] ?? SIZES.md;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      disabled={disabled}
      className={`relative ${s.track} rounded-full transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
        checked ? 'bg-[color:var(--accent-primary)]' : 'bg-[color:var(--surface-strong)]'
      }`}
    >
      <motion.span
        aria-hidden="true"
        className={`absolute ${s.thumb} rounded-full bg-white`}
        initial={false}
        animate={{ x: checked ? s.travel : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </button>
  );
}
