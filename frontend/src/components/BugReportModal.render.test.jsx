// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import { isCopyable } from '../testSupport/copyable.js';

/** The "Report a bug" dialog: what it shows before anything leaves, and
 * what it does when the user opens the report. */

const fetchBugReportInfo = vi.fn();
const openBugReport = vi.fn();
vi.mock('../lib/api.js', () => ({
  fetchSettings: vi.fn(async () => ({})),
  updateSettings: vi.fn(),
  fetchBugReportInfo: (...a) => fetchBugReportInfo(...a),
  openBugReport: (...a) => openBugReport(...a)
}));

const BugReportModal = (await import('./BugReportModal.jsx')).default;

beforeEach(() => {
  vi.clearAllMocks();
  fetchBugReportInfo.mockResolvedValue({ version: '2.8.0', windows: 'Windows_NT 10.0.26200', arch: 'x64' });
  openBugReport.mockResolvedValue({ ok: true, opened: 'https://github.com/jimman0I/prune/issues/new?x=1' });
});

/** ModalOverlay moves focus to its first control a frame after mounting.
 * Typing before that frame lands in a field that then loses focus, which a
 * person (slower than a frame) never sees, so tests wait it out. */
const settled = () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

const openButton = () => screen.getByRole('button', { name: 'Open on GitHub' });

describe('BugReportModal', () => {
  it('says what will be included, and that nothing else is collected', async () => {
    renderScreen(<BugReportModal onClose={() => {}} />);

    expect(screen.getByRole('dialog', { name: 'Report a bug' })).toBeTruthy();
    expect(screen.getByLabelText('Summary')).toBeTruthy();
    expect(screen.getByLabelText('What went wrong?')).toBeTruthy();
    expect(screen.getByText('What will be included')).toBeTruthy();
    expect(await screen.findByText('Prune version: 2.8.0')).toBeTruthy();
    expect(screen.getByText('Windows version: Windows_NT 10.0.26200')).toBeTruthy();
    expect(screen.getByText('Architecture: x64')).toBeTruthy();
    expect(screen.getByText(/no file paths, no scan results, no user name/i)).toBeTruthy();
    expect(screen.getByText(/public/i)).toBeTruthy();
    expect(screen.getByText(/free GitHub account/i)).toBeTruthy();
  });

  it('keeps Open on GitHub disabled until something is written', async () => {
    const user = userEvent.setup();
    renderScreen(<BugReportModal onClose={() => {}} />);
    await settled();
    expect(openButton().disabled).toBe(true);

    await user.type(screen.getByLabelText('What went wrong?'), '   ');
    expect(openButton().disabled).toBe(true);

    await user.type(screen.getByLabelText('What went wrong?'), 'It crashed');
    expect(openButton().disabled).toBe(false);
  });

  it('sends the trimmed title and description, then confirms', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderScreen(<BugReportModal onClose={onClose} />);
    await settled();

    await user.type(screen.getByLabelText('Summary'), '  Scan crashes ');
    await user.type(screen.getByLabelText('What went wrong?'), ' I ran a scan & it closed. ');
    await user.click(openButton());

    await waitFor(() => expect(openBugReport).toHaveBeenCalledTimes(1));
    expect(openBugReport).toHaveBeenCalledWith({ title: 'Scan crashes', description: 'I ran a scan & it closed.' });
    expect(await screen.findByText('Opened in your browser — post the issue there to send it.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows a selectable error and a Copy report fallback when it cannot open', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    openBugReport.mockRejectedValue(new Error('explorer.exe not found'));
    renderScreen(<BugReportModal onClose={() => {}} />);
    await settled();

    await user.type(screen.getByLabelText('Summary'), 'Title');
    await user.type(screen.getByLabelText('What went wrong?'), 'Body text');
    await user.click(openButton());

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('explorer.exe not found');
    expect(isCopyable(alert)).toBe(true);
    // The user's text is still there to retry with.
    expect(screen.getByLabelText('What went wrong?').value).toBe('Body text');

    await user.click(screen.getByRole('button', { name: 'Copy report' }));
    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = writeText.mock.calls[0][0];
    expect(copied).toContain('Title');
    expect(copied).toContain('Body text');
    expect(copied).toContain('Prune 2.8.0');
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeTruthy();
  });

  it('closes on Escape and on Cancel', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderScreen(<BugReportModal onClose={onClose} />);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('carries no native hover text', () => {
    const { container } = renderScreen(<BugReportModal onClose={() => {}} />);
    expect(container.ownerDocument.body.querySelectorAll('[title]')).toHaveLength(0);
  });
});
