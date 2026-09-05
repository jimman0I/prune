import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { addToast, dismissToast, expireToasts } from '../lib/toastQueue.js';

/** Raising a toast from anywhere, without threading a prop through six
 * components that do not care.
 *
 * The queue itself is pure and lives in lib/toastQueue.js; this is only
 * the plumbing plus the expiry tick. Kept apart deliberately: the
 * interesting behaviour -- what counts as a duplicate, what is allowed to
 * disappear on a timer, how many fit -- is testable data manipulation,
 * and none of it should need a rendered component to exercise. */
const ToastContext = createContext(null);

/** How often expiry is checked. Not per-frame: a toast leaving 250ms
 * later than its nominal life is imperceptible, and a requestAnimationFrame
 * loop running for the whole session to achieve that is not a trade worth
 * making in an app that is idle most of the time. */
const TICK_MS = 250;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((toast) => {
    setToasts((current) => addToast(current, toast));
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((current) => dismissToast(current, id));
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      // expireToasts returns the SAME array when nothing expired, so this
      // is a no-op re-render only when something actually left.
      setToasts((current) => expireToasts(current));
    }, TICK_MS);
    return () => clearInterval(timer);
  }, []);

  // Named helpers rather than a bare `push({tone})` everywhere: the call
  // site should read as what happened, not as how it is coloured.
  const value = useMemo(() => ({
    toasts,
    dismiss,
    push,
    success: (message, extra) => push({ tone: 'success', message, ...extra }),
    info: (message, extra) => push({ tone: 'info', message, ...extra }),
    warn: (message, extra) => push({ tone: 'warning', message, ...extra }),
    // Failures never expire on their own. Someone who looked away must
    // still find out that three files were not cleaned.
    error: (message, extra) => push({ tone: 'danger', message, ttl: 0, ...extra })
  }), [toasts, dismiss, push]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

/** Returns a no-op set outside a provider rather than throwing.
 *
 * A missing provider should not be able to crash a screen over a piece of
 * feedback. It is a real risk here: several components render inside test
 * harnesses and inside the modal portal, neither of which has a reason to
 * know about toasts. */
const NOOP = {
  toasts: [],
  push: () => {}, dismiss: () => {},
  success: () => {}, info: () => {}, warn: () => {}, error: () => {}
};

export function useToasts() {
  return useContext(ToastContext) ?? NOOP;
}
