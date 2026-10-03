// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** Settings, General: "Remember the last Disk Map scan of each drive" -- on by
 * default, honest about the disk it uses, and on turning off, an offer to
 * delete what is already saved. */

const fetchSettings = vi.fn();
const updateSettings = vi.fn();
const fetchAutoScans = vi.fn();
const deleteAutoScans = vi.fn();
vi.mock('../lib/api.js', () => ({
  fetchSettings: (...a) => fetchSettings(...a),
  updateSettings: (...a) => updateSettings(...a),
  fetchAutoScans: (...a) => fetchAutoScans(...a),
  deleteAutoScans: (...a) => deleteAutoScans(...a),
  fetchRunAsAdmin: vi.fn(async () => ({ supported: true, enabled: false, elevatedNow: false, startsWithWindows: false })),
  setRunAsAdmin: vi.fn(),
  fetchMftStatus: vi.fn(async () => ({ elevated: false })),
  fetchUpdateCheck: vi.fn(async () => ({ enabled: false, current: '3.0.0' })),
  openUpdatePage: vi.fn(),
  fetchAutomation: vi.fn(async () => ({ enabled: false, nextRun: null, missed: 0 })),
  fetchCustomCleaners: vi.fn(async () => ({ locations: [], imported: [] })),
  fetchCookieDomains: vi.fn(async () => ({ domains: [], errors: [] })),
  runSandboxTest: vi.fn()
}));

const SettingsPage = (await import('./SettingsPage.jsx')).default;
/** The partial written by the most recent save. */
const lastSaved = () => updateSettings.mock.calls.at(-1)?.[0];
const TITLE = 'Remember the last Disk Map scan of each drive';
const BASE_SETTINGS = { theme: 'dark', updateCheck: false, language: 'en', excludeFolders: [], excludeExtensions: [] };

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
  fetchSettings.mockResolvedValue({ ...BASE_SETTINGS });
  updateSettings.mockImplementation(async (partial) => ({ ...BASE_SETTINGS, ...partial }));
  fetchAutoScans.mockResolvedValue({ scans: [], count: 0, bytes: 0 });
  deleteAutoScans.mockResolvedValue(0);
});

describe('Settings: remembering Disk Map scans', () => {
  it('is on when the settings never said, and explains the disk it uses', async () => {
    renderScreen(<SettingsPage />);
    const sw = await screen.findByRole('switch', { name: TITLE });
    expect(sw.getAttribute('aria-checked')).toBe('true');
    const panel = sw.closest('.glass-panel');
    expect(within(panel).getByText(/a few MB, up to about 25 MB on a drive with a million folders/)).toBeTruthy();
    expect(within(panel).getByText(/stays on this PC/)).toBeTruthy();
  });

  it('is off only when the setting is exactly false', async () => {
    fetchSettings.mockResolvedValue({ ...BASE_SETTINGS, rememberDiskMapScans: false });
    renderScreen(<SettingsPage />);
    expect((await screen.findByRole('switch', { name: TITLE })).getAttribute('aria-checked')).toBe('false');
  });

  it('saves the choice when switched', async () => {
    const user = userEvent.setup();
    renderScreen(<SettingsPage />);
    await user.click(await screen.findByRole('switch', { name: TITLE }));
    await waitFor(() => expect(lastSaved()).toEqual({ rememberDiskMapScans: false }));
    await user.click(screen.getByRole('switch', { name: TITLE }));
    await waitFor(() => expect(lastSaved()).toEqual({ rememberDiskMapScans: true }));
  });

  it('shows how many automatic scans are saved and what they use', async () => {
    fetchAutoScans.mockResolvedValue({ scans: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], count: 3, bytes: 18 * 1024 * 1024 });
    renderScreen(<SettingsPage />);
    expect(await screen.findByText('Automatic scans saved: 3 (18 MB)')).toBeTruthy();
  });

  it('says nothing about saved scans when there are none', async () => {
    renderScreen(<SettingsPage />);
    await screen.findByRole('switch', { name: TITLE });
    expect(screen.queryByText(/Automatic scans saved/)).toBeNull();
    expect(screen.queryByText('Delete the automatic scans that are already saved?')).toBeNull();
  });

  it('while on, offers no deletion', async () => {
    fetchAutoScans.mockResolvedValue({ scans: [{ id: 'a' }], count: 1, bytes: 1024 });
    renderScreen(<SettingsPage />);
    await screen.findByText('Automatic scans saved: 1 (1 KB)');
    expect(screen.queryByRole('button', { name: 'Delete them' })).toBeNull();
  });

  it('when switched off with scans saved, offers to delete them, and deletes only when asked', async () => {
    fetchAutoScans.mockResolvedValue({ scans: [{ id: 'a' }, { id: 'b' }], count: 2, bytes: 2048 });
    deleteAutoScans.mockResolvedValue(2);
    const user = userEvent.setup();
    renderScreen(<SettingsPage />);
    await screen.findByText('Automatic scans saved: 2 (2 KB)');
    await user.click(screen.getByRole('switch', { name: TITLE }));

    expect(await screen.findByText('Delete the automatic scans that are already saved?')).toBeTruthy();
    expect(deleteAutoScans).not.toHaveBeenCalled();
    fetchAutoScans.mockResolvedValue({ scans: [], count: 0, bytes: 0 });
    await user.click(screen.getByRole('button', { name: 'Delete them' }));
    await waitFor(() => expect(deleteAutoScans).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Automatic scans deleted.')).toBeTruthy();
    expect(screen.queryByText('Delete the automatic scans that are already saved?')).toBeNull();
  });

  it('keeps them when told to', async () => {
    fetchAutoScans.mockResolvedValue({ scans: [{ id: 'a' }], count: 1, bytes: 2048 });
    const user = userEvent.setup();
    renderScreen(<SettingsPage />);
    await screen.findByText('Automatic scans saved: 1 (2 KB)');
    await user.click(screen.getByRole('switch', { name: TITLE }));
    await user.click(await screen.findByRole('button', { name: 'Keep them' }));
    expect(deleteAutoScans).not.toHaveBeenCalled();
    expect(screen.queryByText('Delete the automatic scans that are already saved?')).toBeNull();
    expect(screen.getByText('Automatic scans saved: 1 (2 KB)')).toBeTruthy();
  });

  it('says why when the deletion fails, and offers it again', async () => {
    fetchSettings.mockResolvedValue({ ...BASE_SETTINGS, rememberDiskMapScans: false });
    fetchAutoScans.mockResolvedValue({ scans: [{ id: 'a' }], count: 1, bytes: 2048 });
    deleteAutoScans.mockRejectedValue(new Error('EBUSY'));
    const user = userEvent.setup();
    renderScreen(<SettingsPage />);
    await user.click(await screen.findByRole('button', { name: 'Delete them' }));
    expect(await screen.findByText('Couldn\'t delete them: EBUSY')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete them' })).toBeTruthy();
  });
});
