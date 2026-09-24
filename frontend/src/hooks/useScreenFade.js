import { useEffect } from 'react';

/** How long the screen-change fade takes. Short on purpose: switching tabs
 * is one of the most frequent things anyone does in the app, and Apple's own
 * guidance is to avoid adding motion to interactions that occur frequently
 * (HIG, Motion: "In apps, generally avoid adding motion to UI interactions
 * that occur frequently"). It used to be 300 ms with a 12px slide; now it
 * is an opacity-only cross-fade, just enough that the content change does
 * not read as a hard cut. */
export const SCREEN_FADE_MS = 160;

/** The screen-change transition: the CONTAINER fades in, its children are
 * left alone.
 *
 * Not AnimatePresence, and the reason is this app's architecture rather than
 * preference. Screens STAY MOUNTED once visited (see Screen.jsx) so the Disk
 * Map's scan and Deep Clean's results survive a tab switch. AnimatePresence
 * animates things in and out of the tree, and keying a wrapper on `screen`
 * would remount every screen on every switch -- throwing away exactly the
 * state that design protects.
 *
 * Web Animations rather than framer-motion, for one concrete reason:
 * framer-motion writes its keyframe values as INLINE STYLES, so a cancelled
 * or stalled run leaves `opacity: 0` sitting on the element permanently.
 * WAAPI at the default `fill: none` writes nothing -- once the animation
 * ends or is cancelled, the element is back to its stylesheet value.
 *
 * An animation that is running but not progressing still holds its first
 * keyframe, so the cleanup matters: leaving the screen cancels it and the
 * element is visible again immediately. It also stops every tab switch
 * stacking another animation on the same element (measured three live at
 * once after three switches).
 *
 * Reduced motion is checked directly. MotionConfig covers framer-motion and
 * index.css covers CSS transitions; neither reaches a WAAPI call. */
export function useScreenFade(stageRef, screen) {
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage?.animate) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;

    const animation = stage.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: SCREEN_FADE_MS, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
    );
    return () => animation.cancel();
  }, [stageRef, screen]);
}
