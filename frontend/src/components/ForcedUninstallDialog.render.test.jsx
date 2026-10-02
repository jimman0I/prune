// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

const pickPath = vi.fn();
const scanForcedUninstall = vi.fn();
const removeQuarantined = vi.fn();
const fetchSettings = vi.fn();
vi.mock('../lib/api.js', () => ({
  pickPath: (...a) => pickPath(...a),
  scanForcedUninstall: (...a) => scanForcedUninstall(...a),
  scanForLeftovers: vi.fn(),
  streamUninstall: vi.fn(),
  removeQuarantined: (...a) => removeQuarantined(...a),
  fetchSettings: (...a) => fetchSettings(...a),
  updateSettings: vi.fn(async (p) => p),
  appendHistoryEntry: vi.fn(async () => {})
}));

const ForcedUninstallDialog = (await import('./ForcedUninstallDialog.jsx')).default;

const found = {
  files: { ok: true, items: [{ path: 'D:\\Old\\Thing', sizeBytes: 100, confidence: 'certain' }] },
  registryKeys: { ok: true, items: [] },
  scheduledTasks: { ok: true, items: [] }
};

beforeEach(() => {
  vi.clearAllMocks();
  fetchSettings.mockResolvedValue({ preselectLeftovers: true });
  scanForcedUninstall.mockResolvedValue(found);
  removeQuarantined.mockResolvedValue({ destination: 'quarantine', files: [{ originalPath: 'D:\\Old\\Thing', sizeBytes: 100 }], registryKeys: [], totalSizeBytes: 100 });
});

describe('the forced uninstall form', () => {
  it('cannot continue until it has a name or a folder, and says so', () => {
    renderScreen(<ForcedUninstallDialog onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Continue' }).disabled).toBe(true);
    expect(screen.getByText(/Enter a name or choose a folder/)).toBeTruthy();
  });

  it('puts the folder from the Browse dialog in the field', async () => {
    pickPath.mockResolvedValue({ path: 'D:\\Old\\Thing' });
    const user = userEvent.setup();
    renderScreen(<ForcedUninstallDialog onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Browse…' }));
    expect(pickPath).toHaveBeenCalledWith('folder');
    await waitFor(() => expect(screen.getByLabelText('Install folder').value).toBe('D:\\Old\\Thing'));
    expect(screen.getByRole('button', { name: 'Continue' }).disabled).toBe(false);
  });

  it('leaves the field alone when the dialog is cancelled', async () => {
    pickPath.mockResolvedValue({ path: null });
    const user = userEvent.setup();
    renderScreen(<ForcedUninstallDialog onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Browse…' }));
    await waitFor(() => expect(pickPath).toHaveBeenCalled());
    expect(screen.getByLabelText('Install folder').value).toBe('');
  });

  it('says when the folder dialog could not be shown', async () => {
    pickPath.mockRejectedValue(new Error('no desktop'));
    const user = userEvent.setup();
    renderScreen(<ForcedUninstallDialog onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Browse…' }));
    expect(await screen.findByText(/Couldn.t open the folder dialog: no desktop/)).toBeTruthy();
  });
});

describe('the forced uninstall itself', () => {
  it('runs an Advanced scan for a name and folder with no registry entry, then reviews and removes', async () => {
    const user = userEvent.setup();
    renderScreen(<ForcedUninstallDialog onClose={vi.fn()} />);
    await user.type(screen.getByLabelText('Program name'), 'Old Thing');
    await user.type(screen.getByLabelText('Install folder'), 'D:\\Old\\Thing');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('Forced uninstall of Old Thing')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Advanced' }).getAttribute('aria-checked')).toBe('true');
    await user.click(screen.getByRole('button', { name: 'Search for leftovers' }));

    await waitFor(() => expect(scanForcedUninstall).toHaveBeenCalledTimes(1));
    const request = scanForcedUninstall.mock.calls[0][0];
    expect(request).toMatchObject({ name: 'Old Thing', mode: 'advanced', anchors: { installLocation: 'D:\\Old\\Thing' } });
    expect(request.registryKey).toBeUndefined();

    await user.click(await screen.findByRole('button', { name: 'Remove selected' }));
    await waitFor(() => expect(removeQuarantined).toHaveBeenCalledTimes(1));
    expect(removeQuarantined.mock.calls[0][0]).toMatchObject({ programName: 'Old Thing', files: ['D:\\Old\\Thing'], destination: 'quarantine' });
  });

  it('searches on the folder\'s own name when only a folder is given', async () => {
    const user = userEvent.setup();
    renderScreen(<ForcedUninstallDialog onClose={vi.fn()} />);
    await user.type(screen.getByLabelText('Install folder'), 'D:\\Games\\Lost Game\\');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('button', { name: 'Search for leftovers' }));
    await waitFor(() => expect(scanForcedUninstall).toHaveBeenCalled());
    expect(scanForcedUninstall.mock.calls[0][0].name).toBe('Lost Game');
  });

  it('does not remember the depth chosen here as the default for ordinary uninstalls', async () => {
    const { updateSettings } = await import('../lib/api.js');
    const user = userEvent.setup();
    renderScreen(<ForcedUninstallDialog onClose={vi.fn()} />);
    await user.type(screen.getByLabelText('Program name'), 'X');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('radio', { name: 'Safe' }));
    expect(updateSettings).not.toHaveBeenCalled();
  });
});
