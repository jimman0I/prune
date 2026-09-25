import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';

/** The menu a right-click opens on a treemap block.
 *
 * A portal into <body>, for the reason everything floating in this app
 * is: `backdrop-filter` on .glass-panel establishes a containing block,
 * so a position:fixed child of a panel is positioned against the PANEL
 * rather than the viewport. The treemap sits inside exactly such a panel.
 *
 * Positioned at the cursor and then pulled back inside the window if it
 * would hang off an edge -- right-clicking near the bottom is the common
 * case, not the exotic one, and a menu whose items are off-screen is a
 * menu with no items.
 */
const EASE = [0.2, 0.9, 0.3, 1];
const WIDTH = 210;
const ITEM_HEIGHT = 34;

/** The menu items that can be chosen, in order. */
const enabledItems = (menu) => [...menu.querySelectorAll('[role="menuitem"]:not(:disabled)')];

export default function ContextMenu({ open, x, y, items, onClose }) {
  const ref = useRef(null);
  // What had focus when the menu opened: the "..." button, a treemap cell, or
  // nothing in particular after a right-click. Focus goes back there on close.
  const openerRef = useRef(null);

  /* Reachable and usable without a mouse.
   *
   * The menu is portaled to the end of <body>, so without this a keyboard
   * user who pressed Enter on a row's "..." button stayed on that button
   * with the menu somewhere they could only reach by tabbing through the
   * rest of the page. Opening moves focus onto the first choice, Up/Down/
   * Home/End move between choices, Tab leaves (closing it), and closing
   * hands focus back to what opened it -- unless something else (the
   * confirmation dialog a choice raises) has already taken it. */
  useEffect(() => {
    if (!open) return undefined;
    openerRef.current = document.activeElement;
    enabledItems(ref.current ?? document.body)[0]?.focus();
    return () => {
      const opener = openerRef.current;
      const active = document.activeElement;
      // Focus still on the menu (or nowhere): it is ours to give back.
      const stillOurs = !active || active === document.body || ref.current?.contains(active) || !document.body.contains(active);
      if (stillOurs && opener && opener !== document.body && document.body.contains(opener)) opener.focus();
    };
  }, [open]);

  const onMenuKeyDown = (event) => {
    if (event.key === 'Tab') { onClose(); return; }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const list = enabledItems(event.currentTarget);
    if (list.length === 0) return;
    const at = list.indexOf(document.activeElement);
    let next;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = list.length - 1;
    else if (event.key === 'ArrowDown') next = at < 0 ? 0 : (at + 1) % list.length;
    else next = at < 0 ? list.length - 1 : (at - 1 + list.length) % list.length;
    list[next].focus();
  };

  useEffect(() => {
    if (!open) return;

    // Any click anywhere closes it, including one that lands on another
    // part of the app -- a menu that survives the next click is a menu
    // people close by clicking twice.
    const onPointerDown = (event) => {
      if (!ref.current?.contains(event.target)) onClose();
    };
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };

    // `true` so it runs before the treemap's own handlers, and scroll
    // closes it because the menu is anchored to a point in the viewport
    // that the content underneath has just moved away from.
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', onClose, true);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('scroll', onClose, true);
      window.removeEventListener('resize', onClose);
    };
  }, [open, onClose]);

  const height = (items?.length ?? 0) * ITEM_HEIGHT + 12;
  const left = Math.min(x, window.innerWidth - WIDTH - 8);
  const top = Math.min(y, window.innerHeight - height - 8);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          // AnimatePresence tracks its children BY KEY, and without one it
          // cannot tell that this child has left. The symptom is not a
          // missing animation: the element stays in the DOM at opacity 0
          // with pointer-events auto, so a dismissed menu leaves an
          // invisible 210px rectangle swallowing clicks over the treemap.
          // Caught live -- Escape cleared the state and the node stayed.
          key="context-menu"
          ref={ref}
          role="menu"
          onKeyDown={onMenuKeyDown}
          initial={{ opacity: 0, scale: 0.96, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -4 }}
          transition={{ duration: 0.16, ease: EASE }}
          // Grows from the cursor rather than from its own centre, so it
          // reads as coming out of the thing that was clicked.
          style={{ left: Math.max(8, left), top: Math.max(8, top), width: WIDTH, transformOrigin: 'top left' }}
          className="glass-panel fixed z-tooltip py-1.5"
        >
          {items.map((item) => (
            <button
              key={item.label}
              role="menuitem"
              disabled={item.disabled}
              onClick={() => { onClose(); item.onSelect(); }}
              className={`w-full text-left px-3.5 py-1.5 text-[12.5px] flex items-center justify-between gap-3 transition-colors ${
                item.disabled
                  ? 'text-[color:var(--text-muted)] opacity-50 cursor-not-allowed'
                  : item.danger
                    ? 'text-[color:var(--danger)] hover:bg-[color:var(--danger-soft)]'
                    : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text-primary)]'
              }`}
            >
              <span>{item.label}</span>
              {item.hint && (
                <span className="text-[10.5px] font-mono text-[color:var(--text-muted)] shrink-0">
                  {item.hint}
                </span>
              )}
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
