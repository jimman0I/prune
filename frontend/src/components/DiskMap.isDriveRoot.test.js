import { describe, it, expect } from 'vitest';
import { isDriveRoot } from './DiskMap.jsx';

/** This gate decides whether a truncated scan gets reconciled against the
 * drive's real used space. It shipped once as `/^[a-z]:\?$/i` -- an
 * optional literal question mark instead of an optional separator -- so
 * it returned false for every path and the unscanned remainder silently
 * never rendered. Nothing threw; the feature just didn't happen. */
describe('isDriveRoot', () => {
  it('accepts a drive root with a trailing separator', () => {
    expect(isDriveRoot('C:\\')).toBe(true);
    expect(isDriveRoot('D:\\')).toBe(true);
    expect(isDriveRoot('c:\\')).toBe(true);
  });

  it('accepts a bare drive letter', () => {
    expect(isDriveRoot('C:')).toBe(true);
  });

  it('accepts a forward slash, which Windows also honours', () => {
    expect(isDriveRoot('C:/')).toBe(true);
  });

  it('rejects any path inside the drive', () => {
    expect(isDriveRoot('C:\\Users')).toBe(false);
    expect(isDriveRoot('C:\\Users\\jim')).toBe(false);
    expect(isDriveRoot('C:\\Games')).toBe(false);
  });

  it('rejects things that are not paths', () => {
    expect(isDriveRoot('')).toBe(false);
    expect(isDriveRoot('CC:')).toBe(false);
    expect(isDriveRoot('1:')).toBe(false);
    expect(isDriveRoot(null)).toBe(false);
    expect(isDriveRoot(undefined)).toBe(false);
  });
});
