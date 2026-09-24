import { useEffect, useRef } from 'react';
import { matchShortcut } from '../lib/shortcutMatch.js';
import { SCREEN_ORDER } from '../lib/screenOrder.js';

/** The app's global chords, in one listener.
 *
 * One listener rather than one per screen: screens here stay mounted and
 * hidden once visited, so a per-screen handler would still be listening
 * from behind whatever tab is in front, and Ctrl+K would focus a search
 * box nobody can see.
 *
 * Bound on `keydown` with capture, and only for chords this app actually
 * claims. Everything else is left alone -- the browser's own shortcuts
 * live in the same keyspace and quietly stealing one is worse than not
 * having the feature.
 */
export function useKeyboardShortcuts({ onSearch, onSettings, onHelp, onGoToScreen }) {
  /* The handlers live in a ref so the listener is bound once.
   *
   * They arrive as inline arrows from App, which means a new identity on
   * every render -- and with them in the dependency array, the effect
   * tore the document-level keydown listener down and added it again
   * after every single App render. Not a leak, since the cleanup ran, but
   * pointless churn on the hot path, and a dependency array that claimed
   * to describe when the binding changes while really meaning "always".
   *
   * Read through the ref at call time, so the handler that runs is always
   * the current one -- which is the thing a dependency array was
   * protecting against, achieved without rebinding. */
  const handlersRef = useRef(null);
  handlersRef.current = { search: onSearch, settings: onSettings, help: onHelp, goToScreen: onGoToScreen };

  useEffect(() => {

    const onKeyDown = (event) => {
      const action = matchShortcut(event);
      if (!action) return;

      // "screen:3" is the third entry in the rail, resolved here so the
      // caller hears a screen id rather than a digit.
      let handler = handlersRef.current[action];
      if (action.startsWith('screen:')) {
        const id = SCREEN_ORDER[Number(action.slice(7)) - 1];
        const goTo = handlersRef.current.goToScreen;
        handler = id && goTo ? () => goTo(id) : null;
      }
      if (!handler) return;

      // Only prevented once a handler has actually claimed it. Calling
      // preventDefault for a chord nothing handles takes the key away
      // from the browser for no reason -- Ctrl+F would stop opening find
      // on a screen that has no search box.
      event.preventDefault();
      handler();
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
    // Empty, and honestly so: nothing this effect closes over changes.
  }, []);
}

/** What the help modal lists. Data rather than markup so the list cannot
 * drift from what matchShortcut actually accepts. `id` keys into
 * shortcutsModal.actions.* in the catalog -- ShortcutsModal supplies the
 * translated label at render time, so this array carries no English text. */
export const SHORTCUTS = [
  { keys: ['Ctrl', 'K'], alternative: ['Ctrl', 'F'], id: 'focusSearch' },
  { keys: ['Ctrl', ','], id: 'openSettings' },
  { keys: ['Ctrl', '1–8'], id: 'goToScreen' },
  { keys: ['Ctrl', '/'], id: 'showThisList' },
  // Text zoom is not handled by this hook: the Electron shell restores it
  // (electron/zoom.cjs, wired in main.cjs) after removing the default menu
  // took the accelerators with it. Listed here because this array is what
  // the help modal shows, and they are keys people can press.
  { keys: ['Ctrl', '+'], alternative: ['Ctrl', '-'], id: 'zoomInOut' },
  { keys: ['Ctrl', '0'], id: 'zoomReset' },
  { keys: ['Esc'], id: 'closeDialog' },
  { keys: ['Tab'], id: 'moveBetweenControls' }
];
