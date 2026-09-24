// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { isCopyable } from '../testSupport/copyable.js';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import { ScanFailure, FastScanNote, LoadingState } from './DiskMap.jsx';

/** What the Disk Map says when a scan could not be done.
 *
 * Text selection is off across the app. These stay selectable: they name
 * the folder and Windows' reason, which is what somebody pastes into
 * Explorer or a search to find out why. */

vi.mock('../lib/api.js', () => ({
  fetchSettings: vi.fn(async () => ({})),
  updateSettings: vi.fn()
}));

afterEach(cleanup);

describe('a scan that failed', () => {
  it('names the folder and the reason, and both can be copied', async () => {
    // Braces, not a quoted attribute: JSX does not process escapes inside
    // attribute quotes, so "D:\\Games" there would hand over two backslashes.
    renderScreen(<ScanFailure path={'D:\\Games'} error="EACCES: permission denied" />);

    const message = await screen.findByText(/Couldn't scan "D:\\Games": EACCES: permission denied/);
    expect(isCopyable(message)).toBe(true);
  });
});

describe('a fast scan that could not run', () => {
  it("leaves Windows' reason copyable", () => {
    render(<FastScanNote note="The MFT could not be read: Access is denied." />);

    expect(isCopyable(screen.getByText('The MFT could not be read: Access is denied.'))).toBe(true);
  });
});

describe('the full-drive-scan loading state', () => {
  // No percentage anywhere in here, on purpose -- a directory walk does
  // not know its own total until it has finished, so a real progress bar
  // would have to lie. The breathing rings are motion, not a number: they
  // say "this is still working" without claiming a total the scan does
  // not have. See the pulse-ring keyframe's own comment in index.css.
  it('breathes two rings behind the spinner while a scan this long has nothing more specific to report', async () => {
    renderScreen(<LoadingState path={'C:\\'} />);
    // The path now sits inside one "Scanning <path>" label element.
    await screen.findByText(/Scanning C:\\/);

    const rings = document.querySelectorAll('[style*="pulse-ring"]');
    expect(rings.length).toBe(2);
  });
});
