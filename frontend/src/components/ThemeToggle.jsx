import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../hooks/useTheme.jsx';

/** The sun/moon switch.
 *
 * Two glyphs crossfading through a rotation rather than one glyph morphing
 * into the other. A true morph between a filled disc with rays and a
 * crescent needs interpolating path data with different node counts,
 * which is a lot of machinery for something seen for 300ms -- and it
 * tends to pass through shapes that are neither.
 *
 * The button says which theme it will SWITCH TO, not which is active. A
 * control labelled with its current state reads as a status light and
 * gets clicked expecting nothing to happen.
 */

const SUN = (
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </>
);

const MOON = <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />;

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const goingTo = theme === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${goingTo} theme`}
      className="relative w-10 h-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] bg-[color:var(--surface-hover)] hover:bg-[color:var(--surface-strong)] border border-[color:var(--border-subtle)] transition-colors"
    >
      {/* The ripple. A single expanding disc of the accent at low alpha,
          keyed on the theme so it replays on every switch. It is behind
          the glyph and clipped by the button, so it reads as the press
          landing rather than as a second thing to look at. */}
      <AnimatePresence initial={false}>
        <motion.span
          key={theme}
          aria-hidden="true"
          className="absolute inset-0 rounded-xl bg-[color:var(--accent-primary)]"
          initial={{ scale: 0, opacity: 0.35 }}
          animate={{ scale: 2.4, opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        />
      </AnimatePresence>

      <AnimatePresence mode="wait" initial={false}>
        <motion.svg
          key={theme}
          width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          className="relative"
          // Rotating in one direction on the way out and continuing in the
          // same direction on the way in reads as one movement. Mirroring
          // it reads as the icon bouncing back.
          initial={{ rotate: -70, scale: 0.5, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          exit={{ rotate: 70, scale: 0.5, opacity: 0 }}
          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
        >
          {theme === 'dark' ? MOON : SUN}
        </motion.svg>
      </AnimatePresence>
    </button>
  );
}
