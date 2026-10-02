// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** The scan depth the dialog offers, remembers and sends. The api module is
 * mocked; nothing is scanned or removed. */

const streamUninstall = vi.fn();
const scanForLeftovers = vi.fn();
const scanForcedUninstall = vi.fn();
const fetchSettings = vi.fn();
const updateSettings = vi.fn();
vi.mock('../lib/api.js', () => ({
  streamUninstall: (...a) => streamUninstall(...a),
  scanForLeftovers: (...a) => scanForLeftovers(...a),
  scanForcedUninstall: (...a) => scanForcedUninstall(...a),
  removeQuarantined: vi.fn(),
  fetchSettings: (...a) => fetchSettings(...a),
  updateSettings: (...a) => updateSettings(...a),
  appendHistoryEntry: vi.fn(async () => {})
}));

const UninstallModal = (await import('./UninstallModal.jsx')).default;

const program = {
  id: 'thing', name: 'Thing', publisher: 'Acme', uninstallString: '"C:\\Program Files\\Thing\\uninst.exe"',
  installLocation: 'C:\\Program Files\\Thing', registryKey: 'HKLM:\\SOFTWARE\\Thing'
};
const nothing = {
  files: { ok: true, items: [] }, registryKeys: { ok: true, items: [] }, scheduledTasks: { ok: true, items: [] }
};

beforeEach(() => {
  vi.clearAllMocks();
  streamUninstall.mockResolvedValue();
  scanForLeftovers.mockResolvedValue(nothing);
  scanForcedUninstall.mockResolvedValue(nothing);
  fetchSettings.mockResolvedValue({});
  updateSettings.mockImplementation(async (partial) => ({ ...partial }));
});

const radio = (name) => screen.getByRole('radio', { name });

describe('the scan depth picker', () => {
  it('offers Safe, Moderate and Advanced, with Moderate chosen by default', async () => {
    renderScreen(<UninstallModal program={program} onClose={vi.fn()} />);
    expect(screen.getByRole('radiogroup', { name: 'Leftover scan' })).toBeTruthy();
    expect(radio('Moderate').getAttribute('aria-checked')).toBe('true');
    expect(radio('Safe').getAttribute('aria-checked')).toBe('false');
    expect(radio('Advanced').getAttribute('aria-checked')).toBe('false');
  });

  it('describes the chosen mode', async () => {
    const user = userEvent.setup();
    renderScreen(<UninstallModal program={program} onClose={vi.fn()} />);
    expect(screen.getByText(/matched by name/i)).toBeTruthy();
    await user.click(radio('Advanced'));
    expect(screen.getByText(/several folders deep/i)).toBeTruthy();
  });

  it('starts on the remembered mode', async () => {
    fetchSettings.mockResolvedValue({ leftoverScanMode: 'advanced' });
    renderScreen(<UninstallModal program={program} onClose={vi.fn()} />);
    await waitFor(() => expect(radio('Advanced').getAttribute('aria-checked')).toBe('true'));
  });

  it('remembers a new choice as a setting', async () => {
    const user = userEvent.setup();
    renderScreen(<UninstallModal program={program} onClose={vi.fn()} />);
    await user.click(radio('Safe'));
    await waitFor(() => expect(updateSettings).toHaveBeenCalled());
    expect(updateSettings.mock.calls[0][0]).toEqual({ leftoverScanMode: 'safe' });
  });

  it('moves with the arrow keys and chooses as it goes', async () => {
    const user = userEvent.setup();
    renderScreen(<UninstallModal program={program} onClose={vi.fn()} />);
    radio('Moderate').focus();
    await user.keyboard('{ArrowRight}');
    expect(radio('Advanced').getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(radio('Advanced'));
    await user.keyboard('{ArrowRight}');
    expect(radio('Safe').getAttribute('aria-checked')).toBe('true');
  });

  it('keeps only the chosen option in the tab order', () => {
    renderScreen(<UninstallModal program={program} onClose={vi.fn()} />);
    expect(radio('Moderate').tabIndex).toBe(0);
    expect(radio('Safe').tabIndex).toBe(-1);
    expect(radio('Advanced').tabIndex).toBe(-1);
  });
});

describe('what the scan is sent', () => {
  it('sends the chosen mode and the program\'s own anchors', async () => {
    const user = userEvent.setup();
    renderScreen(<UninstallModal program={program} onClose={vi.fn()} />);
    await user.click(radio('Advanced'));
    await user.click(screen.getByRole('button', { name: 'Start uninstalling' }));
    await user.click(await screen.findByRole('button', { name: 'Scan for leftovers' }));

    await waitFor(() => expect(scanForLeftovers).toHaveBeenCalledTimes(1));
    expect(scanForLeftovers).toHaveBeenCalledWith('Thing', 'Acme', {
      mode: 'advanced',
      anchors: {
        installLocation: 'C:\\Program Files\\Thing', registryKey: 'HKLM:\\SOFTWARE\\Thing',
        uninstallString: '"C:\\Program Files\\Thing\\uninst.exe"'
      },
      programId: 'thing'
    });
  });

  it('does the same for a program whose own uninstaller is gone', async () => {
    const user = userEvent.setup();
    renderScreen(<UninstallModal program={{ ...program, health: { orphaned: true, reason: 'gone' } }} onClose={vi.fn()} />);
    await user.click(radio('Safe'));
    await user.click(screen.getByRole('button', { name: 'Search for leftovers' }));

    await waitFor(() => expect(scanForcedUninstall).toHaveBeenCalledTimes(1));
    expect(scanForcedUninstall.mock.calls[0][0]).toMatchObject({
      name: 'Thing', mode: 'safe', registryKey: 'HKLM:\\SOFTWARE\\Thing',
      anchors: expect.objectContaining({ installLocation: 'C:\\Program Files\\Thing' })
    });
  });

  it('is not offered when the leftover scan after uninstall is turned off', async () => {
    fetchSettings.mockResolvedValue({ scanLeftoversAfterUninstall: false });
    renderScreen(<UninstallModal program={program} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.queryByRole('radiogroup')).toBeNull());
  });
});
