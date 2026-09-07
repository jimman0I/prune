import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FOCUSABLE_SELECTOR, visibleFocusable, nextFocusIndex, initialFocusTarget } from '../lib/focusTrap.js';

/** The shell every dialog in this app sits in.
 *
 * Both modals used to be a bare inline-styled `position: fixed` div with a
 * translucent black background and nothing else. No `role="dialog"`, no
 * Escape, no focus trap, no initial focus, no focus restore. That is a
 * problem anywhere and a real one here: Tab from an open uninstall dialog
 * moved focus to the program list BEHIND it, so the user was driving the
 * table they were about to delete from while the dialog was still up, with
 * no visible focus ring to tell them (there was none of those either).
 *
 * Deliberately NOT dismissible by clicking the backdrop. Every dialog this
 * wraps is destructive or reports the result of something destructive, and
 * a stray click landing outside a 680px panel should not throw away a
 * leftover review the user has been reading. Escape and the close button
 * are the ways out, and both are explicit.
 */
export default function ModalOverlay({ label, onClose, dismissible = true, children }) {
  const dialogRef = useRef(null);
  // Whatever had focus before the dialog opened, so it can be given back.
  // Without this, closing a dialog drops focus to <body> and the next Tab
  // starts from the top of the app rather than from the row you were on.
  const returnFocusRef = useRef(null);

  const focusableIn = useCallback(
    () => visibleFocusable(dialogRef.current?.querySelectorAll(FOCUSABLE_SELECTOR)),
    []
  );

  useEffect(() => {
    returnFocusRef.current = document.activeElement;

    // Focus moves INTO the dialog on open. Queued a frame out so it runs
    // after the children have actually rendered their controls -- on the
    // first paint the panel is often still empty.
    const raf = requestAnimationFrame(() => {
      const target = initialFocusTarget(
        dialogRef.current?.querySelectorAll(FOCUSABLE_SELECTOR),
        dialogRef.current
      );
      target?.focus?.();
    });

    return () => {
      cancelAnimationFrame(raf);
      // Only take focus back if it is still inside the dialog being torn
      // down. If something else has claimed it since, stealing it back
      // would be the more surprising behaviour.
      const active = document.activeElement;
      if (!dialogRef.current || dialogRef.current.contains(active) || active === document.body) {
        returnFocusRef.current?.focus?.();
      }
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        // `dismissible` is false while a removal is actually running.
        // Escape closing a dialog mid-uninstall would hide a process that
        // is still going, which is worse than making the user wait.
        if (dismissible) {
          event.stopPropagation();
          onClose?.();
        }
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = focusableIn();
      if (focusable.length === 0) {
        // Nothing to move to; keep focus on the dialog rather than letting
        // it walk out to the page behind.
        event.preventDefault();
        dialogRef.current?.focus?.();
        return;
      }

      const current = focusable.indexOf(document.activeElement);
      const next = nextFocusIndex(current, focusable.length, event.shiftKey);
      // Always prevented, even mid-list: the browser's own next stop and
      // ours agree in the middle, but letting the native behaviour run
      // means the wrap at the ends is the only thing this handles, and a
      // control appearing between renders would desynchronise the two.
      event.preventDefault();
      focusable[next]?.focus?.();
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [dismissible, onClose, focusableIn]);

  // A portal, so the dialog is never inside a parent whose transform,
  // filter or backdrop-filter would become its containing block -- the
  // trap this codebase has now hit twice, in the treemap tooltip and the
  // nav rail's labels.
  return createPortal(
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-6 bg-[color:var(--scrim)] backdrop-blur-[2px]"
      // The backdrop is inert on purpose; see the note above.
      aria-hidden="false"
    >
      {/* Deliberately NOT `display: contents`, which would be the tidy way
          to let the child own its own width: an element with
          `display: contents` can be dropped from the accessibility tree,
          and dropping the element carrying role="dialog" defeats the point
          of adding it. It is a real flex box that the panel fills. */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="flex w-full justify-center outline-none"
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
