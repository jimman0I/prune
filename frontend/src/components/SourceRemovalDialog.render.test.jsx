// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** Removing a Chocolatey package, turning off a Windows feature, removing a
 * Windows update. The rule worth testing is the restore point: when none
 * could be made the backend changes nothing, and only a second, explicit
 * yes sends the removal again without one. */

const appendHistoryEntry = vi.fn(async () => {});
vi.mock('../lib/api.js', () => ({
  appendHistoryEntry: (...a) => appendHistoryEntry(...a),
  fetchSettings: vi.fn(async () => ({})),
  updateSettings: vi.fn()
}));
const removeSourceItem = vi.fn();
vi.mock('../lib/programSourcesApi.js', () => ({ removeSourceItem: (...a) => removeSourceItem(...a) }));

const SourceRemovalDialog = (await import('./SourceRemovalDialog.jsx')).default;

const feature = { id: 'feature:Microsoft-Windows-Subsystem-Linux', name: 'Windows Subsystem for Linux', featureName: 'Microsoft-Windows-Subsystem-Linux', publisher: 'Microsoft', source: 'feature' };
const update = { id: 'update:KB5127694', name: 'KB5127694', publisher: 'Microsoft', source: 'update', kb: '5127694' };
const pkg = { id: 'chocolatey:shim', name: 'Shim', chocolateyId: 'shim', publisher: 'A', source: 'chocolatey', sizeBytes: 10 };

beforeEach(() => vi.clearAllMocks());

const open = (item) => {
  const onRemoved = vi.fn();
  renderScreen(<SourceRemovalDialog item={item} onClose={vi.fn()} onRemoved={onRemoved} />);
  return { onRemoved };
};

describe('SourceRemovalDialog', () => {
  it('says a feature change is a change to Windows itself, with a restore point first', async () => {
    open(feature);
    expect(await screen.findByRole('heading', { name: 'Turn off Windows Subsystem for Linux?' })).toBeTruthy();
    expect(screen.getByText(/changes Windows itself/).textContent).toMatch(/restore point first/);
    expect(screen.getByRole('button', { name: 'Turn off' })).toBeTruthy();
  });

  it('asks again, explicitly, when no restore point could be made, and only then goes ahead without one', async () => {
    const user = userEvent.setup();
    removeSourceItem
      .mockResolvedValueOnce({ ok: false, needsConsent: true, reason: 'System Protection is off.' })
      .mockResolvedValueOnce({ ok: true, restartNeeded: true, restorePoint: { created: false } });
    const { onRemoved } = open(feature);
    await user.click(await screen.findByRole('button', { name: 'Turn off' }));

    expect(await screen.findByText("Prune couldn't make a restore point: System Protection is off.")).toBeTruthy();
    expect(removeSourceItem).toHaveBeenLastCalledWith(feature, { allowWithoutRestorePoint: false });
    expect(onRemoved).not.toHaveBeenCalled();
    // A second Enter must not skip the restore point unread.
    await waitFor(() => expect(document.activeElement.textContent).toBe('Cancel'));

    await user.click(screen.getByRole('button', { name: 'Continue without a restore point' }));
    expect(await screen.findByText('Done. Restart Windows to finish.')).toBeTruthy();
    expect(removeSourceItem).toHaveBeenLastCalledWith(feature, { allowWithoutRestorePoint: true });
    expect(onRemoved).toHaveBeenCalledWith(feature);
    expect(appendHistoryEntry).toHaveBeenCalledWith(expect.objectContaining({ kind: 'feature', programName: 'Windows Subsystem for Linux' }));
  });

  it('a declined UAC prompt changes nothing and says so, with the dialog still open', async () => {
    const user = userEvent.setup();
    removeSourceItem.mockResolvedValue({ ok: false, cancelled: true });
    const { onRemoved } = open(update);
    await user.click(await screen.findByRole('button', { name: 'Uninstall update' }));
    expect(await screen.findByText('Nothing changed: administrator permission was not given.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Uninstall update' })).toBeTruthy();
    expect(onRemoved).not.toHaveBeenCalled();
  });

  it("shows the backend's refusal in its own words", async () => {
    const user = userEvent.setup();
    removeSourceItem.mockRejectedValue(new Error('That package is no longer installed.'));
    open(pkg);
    expect(await screen.findByRole('heading', { name: 'Uninstall Shim with Chocolatey?' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Uninstall' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('That package is no longer installed.'));
  });
});
