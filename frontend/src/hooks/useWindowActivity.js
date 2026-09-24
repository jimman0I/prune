import { useEffect } from 'react';

/** The attribute index.css keys the aurora's pause on. */
export const INACTIVE_ATTRIBUTE = 'data-window-inactive';

/** Marks <html> while the window is not in use: unfocused, or hidden
 * (minimised, another virtual desktop).
 *
 * Purely visual plumbing -- no setting, no state, no re-render. The one
 * consumer is index.css, which pauses the two full-viewport aurora layers
 * while the attribute is present. The saving is a judgment call, not a
 * measurement: it was not profiled, it is simply work that nobody can see.
 *
 * Events: `blur`/`focus` on the window cover clicking away and back;
 * `visibilitychange` covers minimising and desktop switches, where focus
 * events are not reliable. Each handler re-reads the real state instead of
 * trusting which event fired, so the two sources can never disagree. */
export function useWindowActivity() {
  useEffect(() => {
    const root = document.documentElement;
    const update = () => {
      const inactive = document.hidden || !document.hasFocus();
      if (inactive) root.setAttribute(INACTIVE_ATTRIBUTE, '');
      else root.removeAttribute(INACTIVE_ATTRIBUTE);
    };

    window.addEventListener('blur', update);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    update();

    return () => {
      window.removeEventListener('blur', update);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', update);
      // Leave nothing behind: an unmounted app must not keep the aurora paused.
      root.removeAttribute(INACTIVE_ATTRIBUTE);
    };
  }, []);
}
