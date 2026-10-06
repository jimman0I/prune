import { useCallback, useEffect, useRef, useState } from 'react';
import { useSettings } from './useSystemQueries.js';
import { APP_VERSION } from '../lib/appVersion.js';
import { shouldShowWhatsNew } from '../lib/whatsNew.js';

/** How long after launch the notice waits, so the Dashboard is on screen
 * first and the dialog does not arrive in the middle of the window opening. */
const SETTLE_MS = 700;

/** The "What's new" notice: when it opens by itself, and what closing it does.
 *
 * `mode` is null (closed), 'auto' (the update notice) or 'manual' (opened from
 * Settings > About). Only the update notice ever writes `lastSeenVersion`:
 * the About button is a way to re-read it, not a way to be done with it.
 *
 * The update notice opens once per launch, when the version is newer than the
 * recorded one (lib/whatsNew.js) AND the window can actually be seen
 * (`document.visibilityState`, which is "hidden" while Prune sits in the tray
 * or minimised after --start-minimized, and turns visible when it is first
 * shown) AND nothing else is modal. `blocked` is App's own dialogs; any other
 * open dialog (a screen's own, such as Deep Clean's warning) is found in the
 * DOM, the same test the Ctrl+N chords use.
 *
 * Dismissing records the running version. If the write fails the notice stays
 * closed for this launch and comes back on the next, which beats nagging. */
export function useWhatsNew({ blocked = false } = {}) {
  const { settings, save } = useSettings();
  const { mutate } = save;
  const [mode, setMode] = useState(null);
  const settled = useRef(false); // opened (either way) during this launch

  const due = Boolean(settings) && shouldShowWhatsNew({ current: APP_VERSION, lastSeen: settings.lastSeenVersion });

  useEffect(() => {
    if (!due || blocked || settled.current) return undefined;
    const tryOpen = () => {
      if (settled.current) return;
      if (document.visibilityState !== 'visible') return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      settled.current = true;
      setMode('auto');
    };
    const timer = setTimeout(tryOpen, SETTLE_MS);
    document.addEventListener('visibilitychange', tryOpen);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', tryOpen);
    };
  }, [due, blocked]);

  const record = useCallback(() => mutate({ lastSeenVersion: APP_VERSION }), [mutate]);

  /** Closes it; the update notice also records that it was seen. */
  const dismiss = useCallback(() => {
    if (mode === 'auto') record();
    setMode(null);
  }, [mode, record]);

  /** A card's "Show me": the same as dismissing, then `go(target)`. */
  const showMe = useCallback((target, go) => {
    if (mode === 'auto') record();
    setMode(null);
    go?.(target);
  }, [mode, record]);

  const openManual = useCallback(() => {
    settled.current = true; // reading it by hand settles the automatic one for this launch
    setMode('manual');
  }, []);

  return { mode, version: APP_VERSION, dismiss, showMe, openManual };
}
