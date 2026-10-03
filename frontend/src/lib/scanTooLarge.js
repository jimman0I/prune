/** The code the backend puts on a fast scan that outgrew what one result can
 * hold (backend/src/lib/scanErrors.js). */
export const SCAN_TOO_LARGE = 'scan_too_large';

const TOO_LARGE_PATTERN = /invalid string length|invalid array length|out of memory|allocation failed|array buffer allocation/i;

/** Whether this failure means "the drive has more files than one scan can
 * hold", whether the backend said so (a code) or the browser did (V8 raises a
 * RangeError, "Invalid string length", when the reply is too big to read as
 * text). It is what the Disk Map turns into a sentence a person can act on. */
export function isScanTooLarge(errorOrCode) {
  if (errorOrCode === SCAN_TOO_LARGE) return true;
  if (!errorOrCode || typeof errorOrCode !== 'object') return typeof errorOrCode === 'string' && TOO_LARGE_PATTERN.test(errorOrCode);
  return errorOrCode.code === SCAN_TOO_LARGE
    || errorOrCode instanceof RangeError
    || TOO_LARGE_PATTERN.test(String(errorOrCode.message ?? ''));
}
