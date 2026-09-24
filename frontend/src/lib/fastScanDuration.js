/** How long the user's last SUCCESSFUL fast (admin) scan took, remembered so
 * the next one can say roughly how long is left.
 *
 * The fast scan runs in an elevated process that hands back one result at the
 * end, so there is no progress to report. The only honest estimate is what
 * this machine actually did last time -- pure UI memory, kept in localStorage
 * like theme.js and settingsTab.js for the same reasons. The first scan ever
 * has nothing stored and therefore no estimate: nothing is invented. */
export const FAST_SCAN_DURATION_KEY = 'prune.fastScanMs';

// A fast scan of a whole drive takes seconds. Below a second is a glitch;
// above ten minutes is not a scan this estimate should promise anything about.
const MIN_MS = 1_000;
const MAX_MS = 10 * 60_000;

/** A stored or measured duration made safe: null unless it is a positive
 * finite number, clamped into a sane range. */
export function sanitizeFastScanMs(value) {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return null;
  return Math.min(MAX_MS, Math.max(MIN_MS, Math.round(n)));
}

export function readFastScanMs(storage) {
  try {
    return sanitizeFastScanMs(storage?.getItem(FAST_SCAN_DURATION_KEY));
  } catch {
    return null;
  }
}

/** Only ever called with a scan that finished successfully. Returns whether
 * anything was stored. */
export function writeFastScanMs(storage, ms) {
  const clean = sanitizeFastScanMs(ms);
  if (clean === null) return false;
  try {
    storage?.setItem(FAST_SCAN_DURATION_KEY, String(clean));
    return true;
  } catch {
    return false;
  }
}

/** What to say while a fast scan runs.
 *
 *   none    -- nothing remembered: no number at all.
 *   left    -- `seconds` left, based on the last scan.
 *   overrun -- already past the remembered duration: it is taking longer,
 *              and a countdown stuck at zero would be a lie. */
export function fastScanEstimate({ expectedMs, elapsedMs }) {
  const expected = sanitizeFastScanMs(expectedMs);
  if (expected === null || !Number.isFinite(elapsedMs)) return { state: 'none' };
  if (elapsedMs >= expected) return { state: 'overrun' };
  return { state: 'left', seconds: Math.ceil((expected - elapsedMs) / 1000) };
}
