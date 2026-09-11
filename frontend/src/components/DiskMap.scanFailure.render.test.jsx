// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { isCopyable } from '../testSupport/copyable.js';
import { ScanFailure, FastScanNote } from './DiskMap.jsx';

/** What the Disk Map says when a scan could not be done.
 *
 * Text selection is off across the app. These stay selectable: they name
 * the folder and Windows' reason, which is what somebody pastes into
 * Explorer or a search to find out why. */

afterEach(cleanup);

describe('a scan that failed', () => {
  it('names the folder and the reason, and both can be copied', () => {
    // Braces, not a quoted attribute: JSX does not process escapes inside
    // attribute quotes, so "D:\\Games" there would hand over two backslashes.
    render(<ScanFailure path={'D:\\Games'} error="EACCES: permission denied" />);

    const message = screen.getByText(/Couldn't scan "D:\\Games": EACCES: permission denied/);
    expect(isCopyable(message)).toBe(true);
  });
});

describe('a fast scan that could not run', () => {
  it("leaves Windows' reason copyable", () => {
    render(<FastScanNote note="The MFT could not be read: Access is denied." />);

    expect(isCopyable(screen.getByText('The MFT could not be read: Access is denied.'))).toBe(true);
  });
});
