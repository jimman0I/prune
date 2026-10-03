/** The one failure of the MFT scan that has a cause worth naming: the drive
 * has more files than one scan result can hold.
 *
 * V8 raises a RangeError ("Invalid string length", "Invalid array length",
 * "Array buffer allocation failed") when a string, array or buffer outgrows
 * its limit, and a process that outgrows its heap dies with a FATAL ERROR
 * instead of throwing at all. Neither tells a person anything. They are
 * recognised here once, so the worker, the elevated runner, the route and the
 * screen all speak of it the same way. */
export const SCAN_TOO_LARGE = 'scan_too_large';

export const SCAN_TOO_LARGE_MESSAGE =
  'The drive has more files than Prune could hold in one scan. Use "Walk folders" to scan it a folder at a time, or exclude large folders in Settings.';

const TOO_LARGE_PATTERN = /invalid string length|invalid array length|array buffer allocation failed|out of memory|allocation failed|Cannot create a (string|Buffer) longer|ERR_STRING_TOO_LONG|ERR_BUFFER_TOO_LARGE/i;

/** 'scan_too_large' for a failure that means the result outgrew a limit, else
 * null. Takes an Error or a message string (what stderr gives). */
export function classifyScanError(error) {
  const text = typeof error === 'string' ? error : `${error?.name ?? ''} ${error?.message ?? ''} ${error?.code ?? ''}`;
  if (typeof error !== 'string' && error instanceof RangeError) return SCAN_TOO_LARGE;
  return TOO_LARGE_PATTERN.test(text) ? SCAN_TOO_LARGE : null;
}
