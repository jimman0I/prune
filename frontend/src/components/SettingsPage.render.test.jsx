// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** The Settings screen, rendered, with the two quarantine limits under
 * the most scrutiny.
 *
 * lib/limitInput.js already tests positiveOrOff as a function. What was
 * untested is the thing that actually matters: that the field on screen
 * is wired to it. A number input hands back an empty string on every
 * keystroke that clears it, and if that reached the backend as 0 -- read
 * as "keep nothing" -- the app's only undo would be emptied while
 * somebody was mid-edit. The function being correct proves nothing if the
 * input calls Number() itself.
 */

const updateSettings = vi.fn(async (partial) => partial);
const fetchSettings = vi.fn();

vi.mock('../lib/api.js', () => ({
  fetchSettings: (...a) => fetchSettings(...a),
  updateSettings: (...a) => updateSettings(...a),
  fetchAutomation: vi.fn(async () => ({ enabled: false, nextRun: null, missed: 0 })),
  runSandboxTest: vi.fn(),
  fetchStartupItems: vi.fn(), fetchStartupIcons: vi.fn(), setStartupItemEnabled: vi.fn(),
  fetchQuarantineBatches: vi.fn(), restoreQuarantineBatch: vi.fn(),
  deleteQuarantineBatch: vi.fn(), emptyQuarantine: vi.fn(),
  fetchDiskSpace: vi.fn(), fetchDiskHealth: vi.fn()
}));

const SettingsPage = (await import('./SettingsPage.jsx')).default;

const DEFAULTS = {
  excludeFolders: [],
  excludeExtensions: [],
  autoQuarantine: true,
  theme: 'dark',
  minimizeToTray: true,
  skipRecentHours: 24,
  createRestorePoint: true,
  hideUnavailableRules: false,
  quarantineRetentionDays: null,
  quarantineMaxSizeGb: null,
  automation: { enabled: false, frequency: 'weekly', weekday: 0, hour: 2, minute: 0, task: 'scan' }
};

const days = () => screen.getByLabelText('Days to keep quarantine backups');
const gigabytes = () => screen.getByLabelText('Maximum quarantine size in gigabytes');

/** Renders and navigates to the Cleanup tab.
 *
 * Every control under test lives there; the screen opens on General. That
 * the guards are one click away rather than on the first screen is a
 * deliberate arrangement, so the tests reach them the way a person would
 * rather than by rendering the tab's contents directly. */
async function openCleanupTab() {
  const user = userEvent.setup();
  renderScreen(<SettingsPage />);
  await user.click(await screen.findByRole('button', { name: 'Cleanup' }));
  return user;
}

/** The partial written by the most recent save. */
const lastSaved = () => updateSettings.mock.calls.at(-1)?.[0];

beforeEach(() => {
  vi.clearAllMocks();
  fetchSettings.mockResolvedValue({ ...DEFAULTS });
});

describe('the quarantine limit fields', () => {
  it('are blank, and say what blank means, when no limit is set', async () => {
    // Off is the default, and a 0 sitting in the box would read as a
    // limit of zero rather than as the absence of one.
    await openCleanupTab();
    expect(days().value).toBe('');
    expect(days().placeholder).toBe('Never');
    expect(gigabytes().value).toBe('');
    expect(gigabytes().placeholder).toBe('No limit');
  });

  it('show a limit that is set', async () => {
    fetchSettings.mockResolvedValue({ ...DEFAULTS, quarantineRetentionDays: 30, quarantineMaxSizeGb: 5 });
    await openCleanupTab();
    await waitFor(() => expect(days().value).toBe('30'));
    expect(gigabytes().value).toBe('5');
  });

  it('save a real number as a number', async () => {
    const user = await openCleanupTab();
    await user.type(days(), '30');
    await waitFor(() => expect(lastSaved()).toEqual({ quarantineRetentionDays: 30 }));
  });

  it('save a fraction of a gigabyte', async () => {
    // The step is 0.5, so half a gigabyte has to survive the round trip
    // as 0.5 rather than being floored to 0 -- which is the value that
    // means "no limit" and would silently switch the cap off.
    const user = await openCleanupTab();
    await user.type(gigabytes(), '0.5');
    await waitFor(() => expect(lastSaved()).toEqual({ quarantineMaxSizeGb: 0.5 }));
  });

  it('save a typed 0 as OFF, never as a limit of zero', async () => {
    // The failure this guards. A retention of 0 read literally deletes
    // every backup on the next pass; a size cap of 0 does it faster.
    const user = await openCleanupTab();
    await user.type(days(), '0');
    await waitFor(() => expect(lastSaved()).toEqual({ quarantineRetentionDays: null }));

    await user.type(gigabytes(), '0');
    await waitFor(() => expect(lastSaved()).toEqual({ quarantineMaxSizeGb: null }));
  });

  it('save a cleared field as OFF, not as zero', async () => {
    // The state a number input is in for a moment every time someone
    // selects the contents and starts retyping.
    fetchSettings.mockResolvedValue({ ...DEFAULTS, quarantineRetentionDays: 30 });
    const user = await openCleanupTab();
    await waitFor(() => expect(days().value).toBe('30'));

    await user.clear(days());
    await waitFor(() => expect(lastSaved()).toEqual({ quarantineRetentionDays: null }));
  });

  it('do not save one limit while the other is being edited', async () => {
    // Each write is a partial. Sending the whole settings object would
    // make every keystroke in one field overwrite whatever another screen
    // had changed since this one loaded.
    const user = await openCleanupTab();
    await user.type(days(), '7');
    await waitFor(() => expect(lastSaved()).toEqual({ quarantineRetentionDays: 7 }));
    expect(Object.keys(lastSaved())).toEqual(['quarantineRetentionDays']);
  });
});

describe('the guards beside them', () => {
  it('toggles the restore point off by sending only that key', async () => {
    const user = await openCleanupTab();
    await user.click(screen.getByRole('switch', { name: 'Create a restore point first' }));
    await waitFor(() => expect(lastSaved()).toEqual({ createRestorePoint: false }));
  });

  it('keeps 0 meaning "off" for the recent-files guard, which really is a number', async () => {
    // Deliberately different from the two limits above, and worth pinning
    // so nobody unifies them. Here 0 is a real value -- "do not skip
    // anything recent" -- because the failure is a file being swept up,
    // not a backup being destroyed.
    const user = await openCleanupTab();
    await user.clear(screen.getByLabelText('Hours to leave recent files alone'));
    await waitFor(() => expect(lastSaved()).toEqual({ skipRecentHours: 0 }));
  });
});
