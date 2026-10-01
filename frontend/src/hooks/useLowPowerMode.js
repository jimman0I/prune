import { useEffect } from 'react';

/** The attribute index.css keys low power mode's CSS on -- same pattern
 * as useWindowActivity.js's INACTIVE_ATTRIBUTE, a plain data attribute on
 * <html> that every relevant rule in index.css reads. */
export const LOW_POWER_ATTRIBUTE = 'data-low-power';

/** Stamps or clears the attribute from the persisted setting
 * (Settings -> General -> Low power mode, auto-detected once on first
 * install -- see backend/src/services/settings.js's
 * detectLowPowerDefault()). Purely visual plumbing, like
 * useWindowActivity: no state of its own, just keeps <html> in sync with
 * whatever `enabled` App.jsx hands it. */
export function useLowPowerMode(enabled) {
  useEffect(() => {
    const root = document.documentElement;
    if (enabled) root.setAttribute(LOW_POWER_ATTRIBUTE, '');
    else root.removeAttribute(LOW_POWER_ATTRIBUTE);
    // Leave nothing behind: an unmounted app must not keep it stamped.
    return () => root.removeAttribute(LOW_POWER_ATTRIBUTE);
  }, [enabled]);
}
