/** Two parts of the app can hold Deep Clean's scan at once: the Deep Clean
 * screen (kept mounted once visited) and the Dashboard's "Clean recommended".
 * Each reads the remembered scan from localStorage when it starts and keeps its
 * own copy after that, so a clean or a scan finished in one would leave the
 * other showing sizes that are no longer true.
 *
 * This is the whole fix: whoever changes the remembered scan says so, and the
 * others read it again. The announcer is named so it never hears itself. */

const EVENT = 'prune:deep-clean-scan-changed';

export function announceScanChange(source) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { source } }));
  } catch { /* an announcement that cannot be made changes nothing else */ }
}

/** Calls `handler` whenever someone other than `source` changes the scan.
 * Returns the function that stops listening. */
export function onScanChange(source, handler) {
  if (typeof window === 'undefined') return () => {};
  const listener = (event) => {
    if (event?.detail?.source === source) return;
    handler();
  };
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
