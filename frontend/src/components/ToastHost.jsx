import { createPortal } from 'react-dom';
import { useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useToasts } from '../hooks/useToasts.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';

/** Where toasts are drawn.
 *
 * A portal into <body>, for the reason the disk map's tooltip and the
 * modal overlay both are: `backdrop-filter` on .glass-panel establishes a
 * containing block, so a `position: fixed` child of a panel is positioned
 * against the PANEL rather than the viewport. This codebase has been
 * caught by that twice.
 *
 * Bottom-right rather than top-centre. The top of every screen here is a
 * heading and the controls that act on it, and a toast landing over those
 * covers the thing the user is about to do next.
 */

const TONE = {
  success: { accent: 'var(--success)', soft: 'var(--success-soft)' },
  danger: { accent: 'var(--danger)', soft: 'var(--danger-soft)' },
  warning: { accent: 'var(--warning)', soft: 'var(--warning-soft)' },
  // Neutral: an info toast is a report, not an action, and the accent is
  // only ever the colour of the thing you press.
  info: { accent: 'var(--text-secondary)', soft: 'var(--surface-hover)' }
};

/** The brief's easing and timing: snappy, 0.2-0.3s, no overshoot. */
const EASE = [0.2, 0.9, 0.3, 1];

/** Whether focus arrived by keyboard. An engine without :focus-visible
 * support throws on the selector; treat that as keyboard, the safe side
 * (the toast is held rather than lost). */
function isFocusVisible(element) {
  try {
    return element.matches(':focus-visible');
  } catch {
    return true;
  }
}

function ToastCard({ toast, onDismiss, onPause, onResume }) {
  const { t } = useLanguage();
  const tone = TONE[toast.tone] ?? TONE.info;

  /* Held on screen while the pointer is over it OR focus is inside it.
   * Two independent reasons, so leaving with the mouse must not release a
   * toast whose dismiss button still has focus, and vice versa. */
  const hovered = useRef(false);
  const focused = useRef(false);
  const sync = () => (hovered.current || focused.current ? onPause(toast.id) : onResume(toast.id));

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 24, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.96 }}
      transition={{ duration: 0.24, ease: EASE }}
      className="glass-panel w-[330px] px-4 py-3 flex items-start gap-3 pointer-events-auto"
      style={{ borderColor: tone.soft }}
      onMouseEnter={() => { hovered.current = true; sync(); }}
      onMouseLeave={() => { hovered.current = false; sync(); }}
      onFocus={(event) => {
        // Keyboard focus only. Clicking a control inside the card focuses it
        // too, and a toast held open by a stale mouse focus would never
        // leave: the pointer is gone but the focus is not.
        if (!isFocusVisible(event.target)) return;
        focused.current = true;
        sync();
      }}
      onBlur={(event) => {
        // Focus moving between controls inside the card is not leaving it.
        if (event.currentTarget.contains(event.relatedTarget)) return;
        focused.current = false;
        sync();
      }}
      // Failures are alerts; routine confirmations and warnings are polite
      // status messages. A screen reader interrupting to say "freed 2.4 GB"
      // is worse than silence.
      role={toast.tone === 'danger' ? 'alert' : 'status'}
      aria-live={toast.tone === 'danger' ? 'assertive' : 'polite'}
    >
      <span className="w-[3px] self-stretch rounded-full shrink-0" style={{ background: tone.accent }} />

      <div className="flex-1 min-w-0 select-text">
        <div className="text-[12.5px] text-[color:var(--text-primary)] leading-snug">
          {toast.message}
          {/* The repeat count, when the same thing happened again. Shown
              rather than stacking four identical cards. */}
          {toast.count > 1 && (
            <span className="ml-1.5 text-[11px] font-mono text-[color:var(--text-muted)]">
              ×{toast.count}
            </span>
          )}
        </div>

        {toast.detail && (
          <div className="text-[11.5px] text-[color:var(--text-secondary)] mt-1 leading-snug">
            {toast.detail}
          </div>
        )}

        {/* The paths behind a count. "Skipped 3 locked files" invites
            "which ones", and this is the answer without a second click. */}
        {toast.paths?.length > 0 && (
          <ul className="mt-1.5 space-y-0.5">
            {toast.paths.map((path) => (
              <li key={path} className="text-[11px] font-mono text-[color:var(--text-muted)] truncate">
                {path}
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label={t('toastHost.dismiss')}
        className="btn-ghost shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-[color:var(--text-muted)]"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </motion.div>
  );
}

export default function ToastHost() {
  const { toasts, dismiss, pause, resume } = useToasts();

  return createPortal(
    <div
      className="fixed bottom-6 right-6 z-tooltip flex flex-col-reverse gap-2.5 pointer-events-none"
      // The container never eats clicks -- only the cards do. A toast in
      // the corner must not block the button underneath it.
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} onPause={pause} onResume={resume} />
        ))}
      </AnimatePresence>
    </div>,
    document.body
  );
}
