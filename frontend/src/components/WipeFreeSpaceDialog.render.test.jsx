// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** The free-space wipe's dialog: which drive, how many passes, and what
 * that will cost -- with the choice saved only when it is confirmed. */

const GB = 1024 ** 3;
const fetchWipeEstimate = vi.fn();
const fetchWipeDrives = vi.fn();
let settingsRecord;
const fetchSettings = vi.fn(async () => settingsRecord);
const updateSettings = vi.fn(async (partial) => {
  settingsRecord = { ...settingsRecord, ...partial };
  return settingsRecord;
});

vi.mock('../lib/api.js', () => ({
  fetchWipeEstimate: (...a) => fetchWipeEstimate(...a),
  fetchWipeDrives: (...a) => fetchWipeDrives(...a),
  fetchSettings: (...a) => fetchSettings(...a),
  updateSettings: (...a) => updateSettings(...a)
}));

const WipeFreeSpaceDialog = (await import('./WipeFreeSpaceDialog.jsx')).default;

const drives = {
  profileDrive: 'C:',
  drives: [
    { drive: 'C:', label: 'Windows', totalBytes: 500 * GB, freeBytes: 40 * GB },
    { drive: 'D:', label: 'Games', totalBytes: 1000 * GB, freeBytes: 400 * GB }
  ]
};
const estimateFor = (drive, passes = 1) => ({
  drive, freeBytes: 40 * GB, totalBytes: 500 * GB, reserveBytes: 10 * GB, passes,
  bytesToWrite: 30 * GB, totalBytesToWrite: 30 * GB * passes, bytesPerSecond: 100 * 1024 * 1024, seconds: 5400 * passes
});

const onCancel = vi.fn();
const onConfirm = vi.fn();
const open = () => renderScreen(<WipeFreeSpaceDialog onCancel={onCancel} onConfirm={onConfirm} />);

beforeEach(() => {
  vi.clearAllMocks();
  settingsRecord = { wipeDrive: null, wipePasses: 1 };
  fetchWipeDrives.mockResolvedValue(drives);
  fetchWipeEstimate.mockImplementation(async ({ drive, passes } = {}) => estimateFor(drive ?? 'C:', passes ?? 1));
});

describe('the drive picker', () => {
  it('lists the local drives with their free space, and starts on the profile drive', async () => {
    open();
    const group = await screen.findByRole('radiogroup', { name: 'Drive to wipe' });
    const c = within(group).getByRole('radio', { name: /C: \(Windows\)/ });
    const d = within(group).getByRole('radio', { name: /D: \(Games\)/ });
    expect(c.checked).toBe(true);
    expect(d.checked).toBe(false);
    expect(within(group).getByText('D: (Games) · 400 GB free of 1000 GB')).toBeTruthy();
  });

  it('starts on the drive the setting remembers', async () => {
    settingsRecord = { wipeDrive: 'D:', wipePasses: 1 };
    open();
    const group = await screen.findByRole('radiogroup', { name: 'Drive to wipe' });
    await waitFor(() => expect(within(group).getByRole('radio', { name: /D: \(Games\)/ }).checked).toBe(true));
  });

  it('measures the drive that is picked', async () => {
    const user = userEvent.setup();
    open();
    await screen.findByRole('radiogroup', { name: 'Drive to wipe' });
    await waitFor(() => expect(fetchWipeEstimate).toHaveBeenCalledWith({ drive: 'C:', passes: 1 }));
    await user.click(screen.getByRole('radio', { name: /D: \(Games\)/ }));
    await waitFor(() => expect(fetchWipeEstimate).toHaveBeenCalledWith({ drive: 'D:', passes: 1 }));
    expect(await screen.findByText('Drive: D:')).toBeTruthy();
  });

  it('is not shown when there is only one drive', async () => {
    fetchWipeDrives.mockResolvedValue({ profileDrive: 'C:', drives: [drives.drives[0]] });
    open();
    expect(await screen.findByText('Drive: C:')).toBeTruthy();
    expect(screen.queryByRole('radiogroup', { name: 'Drive to wipe' })).toBeNull();
  });

  it('still works, on the profile drive, when the drives cannot be listed', async () => {
    fetchWipeDrives.mockRejectedValue(new Error('powershell failed'));
    open();
    expect(await screen.findByText('Drive: C:')).toBeTruthy();
    expect(screen.queryByRole('radiogroup', { name: 'Drive to wipe' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Add to this clean' })).toBeTruthy();
  });
});

describe('the passes', () => {
  it('offers 1 pass (zeros) and 3 passes (random data)', async () => {
    open();
    const group = await screen.findByRole('radiogroup', { name: 'Overwrite passes' });
    expect(within(group).getByRole('radio', { name: '1 pass (zeros)' }).checked).toBe(true);
    expect(within(group).getByRole('radio', { name: '3 passes (random data)' }).checked).toBe(false);
  });

  it('scales the amount and the time by the passes without measuring the drive again', async () => {
    const user = userEvent.setup();
    open();
    expect(await screen.findByText('About 30 GB will be written.')).toBeTruthy();
    expect(screen.getByText(/Roughly 1 h 30 min/)).toBeTruthy();
    const calls = fetchWipeEstimate.mock.calls.length;

    await user.click(await screen.findByRole('radio', { name: '3 passes (random data)' }));

    expect(await screen.findByText('About 90 GB will be written.')).toBeTruthy();
    expect(screen.getByText(/Roughly 4 h 30 min/)).toBeTruthy();
    expect(fetchWipeEstimate.mock.calls.length).toBe(calls);
  });

  it('starts on the passes the setting remembers', async () => {
    settingsRecord = { wipeDrive: null, wipePasses: 3 };
    open();
    await waitFor(() => expect(screen.getByRole('radio', { name: '3 passes (random data)' }).checked).toBe(true));
  });
});

describe('confirming', () => {
  it('saves the drive and passes, then adds the wipe to the clean', async () => {
    const user = userEvent.setup();
    open();
    await screen.findByRole('radiogroup', { name: 'Drive to wipe' });
    await user.click(screen.getByRole('radio', { name: /D: \(Games\)/ }));
    await user.click(screen.getByRole('radio', { name: '3 passes (random data)' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add to this clean' }).disabled).toBe(false));
    await user.click(screen.getByRole('button', { name: 'Add to this clean' }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(false));
    expect(updateSettings.mock.calls[0][0]).toEqual({ wipeDrive: 'D:', wipePasses: 3 });
  });

  it('saves the profile drive as no choice at all', async () => {
    const user = userEvent.setup();
    open();
    await screen.findByRole('radiogroup', { name: 'Drive to wipe' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add to this clean' }).disabled).toBe(false));
    await user.click(screen.getByRole('button', { name: 'Add to this clean' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(updateSettings.mock.calls[0][0]).toEqual({ wipeDrive: null, wipePasses: 1 });
  });

  it('saves nothing on Cancel', async () => {
    const user = userEvent.setup();
    open();
    await screen.findByRole('radiogroup', { name: 'Drive to wipe' });
    await user.click(screen.getByRole('radio', { name: /D: \(Games\)/ }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
    expect(updateSettings).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('cannot be confirmed while the chosen drive is still being measured, or if it could not be', async () => {
    fetchWipeEstimate.mockRejectedValue(new Error('access denied'));
    open();
    expect(await screen.findByText("Couldn't measure the drive: access denied")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add to this clean' }).disabled).toBe(true);
  });

  it('says the wipe loses nothing, costs time and wear, and that Stop ends it', async () => {
    open();
    await screen.findByText('Drive: C:');
    expect(screen.getByText(/SSD with TRIM this does nothing useful/)).toBeTruthy();
    expect(screen.getByText(/Stop ends it at once and deletes the filler/)).toBeTruthy();
    expect(screen.getByText(/overwrites the free space on the drive you choose/)).toBeTruthy();
  });
});
