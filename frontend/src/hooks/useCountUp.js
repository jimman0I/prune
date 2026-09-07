import { useEffect, useRef, useState } from 'react';
import { countUpValue, EASE_OUT_DURATION } from '../lib/countUp.js';

/** Animates a number from whatever it was showing to whatever it becomes.
 *
 * Used for the dashboard's figures -- storage in use, application count --
 * which arrive well after the panel does and otherwise snap into place
 * with no indication anything happened.
 *
 * It counts FROM THE CURRENT DISPLAYED VALUE, not from zero. A poll that
 * nudges 210 to 211 should tick by one, not restart from nothing; only
 * the first arrival counts up from 0, and that is because 0 is genuinely
 * what was on screen.
 *
 * Honours reduced motion by returning the value directly. The MotionConfig
 * in main.jsx covers framer-motion, and index.css covers CSS transitions,
 * but this is a JS loop writing numbers and neither reaches it -- the same
 * gap that once let three components animate at full strength for someone
 * who had asked the OS for less.
 */
export function useCountUp(target, { duration = EASE_OUT_DURATION } = {}) {
  const [shown, setShown] = useState(() => (Number.isFinite(target) ? target : 0));
  const frameRef = useRef(0);
  // Read inside the loop rather than captured, so the animation always
  // interpolates from where the number actually is.
  const shownRef = useRef(shown);
  shownRef.current = shown;

  useEffect(() => {
    if (!Number.isFinite(target)) return undefined;

    const reduced = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced || duration <= 0) { setShown(target); return undefined; }

    const from = shownRef.current;
    if (from === target) return undefined;

    const started = performance.now();
    const step = (now) => {
      const progress = (now - started) / duration;
      setShown(countUpValue(from, target, progress));
      if (progress < 1) frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);

    // Cancelling matters more than it looks: without it, a value that
    // changes twice in quick succession leaves two loops running and the
    // number visibly fights itself.
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return shown;
}
