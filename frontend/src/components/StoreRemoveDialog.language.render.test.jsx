// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** The single-app Store removal dialog's own copy follows the chosen
 * language, the same property DiskMap's and ProgramList's own language
 * files exist to prove. Reached straight from ProgramList's Store-app
 * Uninstall button, so it is part of the same unit of work as the
 * Applications screen rather than a screen of its own.
 *
 * Windows' own refusal message and the raw package name are never
 * translated -- same rule as every other screen that echoes text Windows
 * itself produced. */

const removeStoreApp = vi.fn();
const appendHistoryEntry = vi.fn(async () => {});
vi.mock('../lib/api.js', () => ({
  removeStoreApp: (...a) => removeStoreApp(...a),
  appendHistoryEntry: (...a) => appendHistoryEntry(...a),
  fetchSettings: vi.fn(async () => ({ language: 'el' })),
  updateSettings: vi.fn()
}));

const StoreRemoveDialog = (await import('./StoreRemoveDialog.jsx')).default;

const app = {
  id: 'store:Microsoft.WindowsCalculator_11.2210.0.0_x64__8wekyb3d8bbwe',
  name: 'Calculator', publisher: 'Microsoft Corporation', sizeBytes: 4096,
  packageFullName: 'Microsoft.WindowsCalculator_11.2210.0.0_x64__8wekyb3d8bbwe'
};

beforeEach(() => { vi.clearAllMocks(); });

const open = (props = {}) => {
  const onClose = props.onClose || vi.fn();
  const onRemoved = props.onRemoved || vi.fn();
  renderScreen(<StoreRemoveDialog app={app} onClose={onClose} onRemoved={onRemoved} />);
  return { onClose, onRemoved };
};

describe('the store remove dialog, in Greek', () => {
  it('translates the heading with the app name interpolated, and the warning body', async () => {
    open();
    expect(await screen.findByRole('heading', { name: 'Αφαίρεση Calculator;' })).toBeTruthy();
    expect(screen.getByText(/δεν μπορεί να επαναφερθεί από εδώ/)).toBeTruthy();
  });

  it('translates Cancel before any action, and Remove app as the confirm button', async () => {
    open();
    expect(await screen.findByRole('button', { name: 'Ακύρωση' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Αφαίρεση εφαρμογής' })).toBeTruthy();
  });

  it('translates Removing… while the removal is in flight, then Close once done', async () => {
    let resolveRemoval;
    removeStoreApp.mockReturnValue(new Promise((resolve) => { resolveRemoval = resolve; }));
    const user = userEvent.setup();
    open();

    await user.click(await screen.findByRole('button', { name: 'Αφαίρεση εφαρμογής' }));
    expect(screen.getByRole('button', { name: 'Αφαίρεση…' })).toBeTruthy();

    resolveRemoval({ ok: true });
    expect(await screen.findByRole('button', { name: 'Κλείσιμο' })).toBeTruthy();
  });

  it("keeps Windows' own refusal text and the raw package name untranslated", async () => {
    removeStoreApp.mockRejectedValue(new Error('The package is currently in use.'));
    const user = userEvent.setup();
    open();

    await user.click(await screen.findByRole('button', { name: 'Αφαίρεση εφαρμογής' }));

    expect(await screen.findByText('The package is currently in use.')).toBeTruthy();
    expect(screen.getByText(app.packageFullName)).toBeTruthy();
    // Cancel is back, not Close -- the removal failed, so this is still asking.
    expect(screen.getByRole('button', { name: 'Ακύρωση' })).toBeTruthy();
  });

  it('still removes by package name and logs history under the Greek button', async () => {
    removeStoreApp.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    const { onRemoved } = open();

    await user.click(await screen.findByRole('button', { name: 'Αφαίρεση εφαρμογής' }));

    await waitFor(() => expect(onRemoved).toHaveBeenCalledTimes(1));
    expect(removeStoreApp).toHaveBeenCalledWith(app.packageFullName);
    expect(appendHistoryEntry).toHaveBeenCalledWith({
      programName: 'Calculator', publisher: 'Microsoft Corporation', sizeBytes: 4096
    });
  });
});
