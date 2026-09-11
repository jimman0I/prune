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
const fetchUpdateCheck = vi.fn();
const openUpdatePage = vi.fn(async () => ({ ok: true }));

vi.mock('../lib/api.js', () => ({
  fetchSettings: (...a) => fetchSettings(...a),
  updateSettings: (...a) => updateSettings(...a),
  fetchUpdateCheck: (...a) => fetchUpdateCheck(...a),
  openUpdatePage: (...a) => openUpdatePage(...a),
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
  updateCheck: false,
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
  fetchUpdateCheck.mockResolvedValue({ enabled: false, current: '2.3.4' });
});

describe('the update check', () => {
  /* Prune's one outbound request, so the switch has to be off until the
   * user turns it on, and has to say what turning it on does -- who is
   * asked, how often, and that nothing is installed -- before they do. */
  const newer = {
    enabled: true, current: '2.3.4', latest: '2.3.5', newer: true,
    url: 'https://github.com/jimman0I/prune/releases/tag/v2.3.5'
  };
  const theSwitch = () => screen.findByRole('switch', { name: 'Check for updates' });

  it('is off by default, and says what turning it on would do', async () => {
    renderScreen(<SettingsPage />);
    expect((await theSwitch()).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText(/api\.github\.com/)).toBeTruthy();
    expect(screen.getByText(/nothing is downloaded or installed/i)).toBeTruthy();
  });

  it('saves the choice when it is turned on', async () => {
    const user = userEvent.setup();
    renderScreen(<SettingsPage />);
    await user.click(await theSwitch());
    expect(lastSaved()).toEqual({ updateCheck: true });
  });

  it('offers the download page when a newer release exists', async () => {
    fetchSettings.mockResolvedValue({ ...DEFAULTS, updateCheck: true });
    fetchUpdateCheck.mockResolvedValue(newer);
    const user = userEvent.setup();
    renderScreen(<SettingsPage />);

    expect(await screen.findByText(/Prune 2\.3\.5 is available/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Open the download page' }));
    expect(openUpdatePage).toHaveBeenCalledTimes(1);
  });

  it('says it is up to date when it is, with no download button', async () => {
    fetchSettings.mockResolvedValue({ ...DEFAULTS, updateCheck: true });
    fetchUpdateCheck.mockResolvedValue({ enabled: true, current: '2.3.4', latest: '2.3.4', newer: false, url: newer.url });
    renderScreen(<SettingsPage />);

    expect(await screen.findByText(/latest version/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Open the download page' })).toBeNull();
  });

  it('says so when the check fails, rather than going quiet', async () => {
    fetchSettings.mockResolvedValue({ ...DEFAULTS, updateCheck: true });
    fetchUpdateCheck.mockResolvedValue({ enabled: true, current: '2.3.4', error: 'GitHub answered 403.' });
    renderScreen(<SettingsPage />);

    expect(await screen.findByText(/Couldn.t check.*GitHub answered 403/)).toBeTruthy();
  });

  it('shows no update status at all while the switch is off', async () => {
    renderScreen(<SettingsPage />);
    await theSwitch();
    expect(screen.queryByText(/is available|latest version|Couldn.t check/i)).toBeNull();
  });

  it('reads a settings file with no update-check entry as off', async () => {
    // A settings file written before this feature existed has no such
    // key, and a missing key is not consent to reach the network.
    const { updateCheck, ...older } = DEFAULTS;
    fetchSettings.mockResolvedValue(older);
    renderScreen(<SettingsPage />);
    expect((await theSwitch()).getAttribute('aria-checked')).toBe('false');
  });

  it('shows nothing from a check while the switch is off, whatever the answer', async () => {
    /* The status belongs to the switch. An answer that arrives while it
     * is off -- a check still in flight when it was turned off, say -- is
     * not shown as if the user had asked for it. */
    fetchUpdateCheck.mockResolvedValue(newer);
    renderScreen(<SettingsPage />);
    await theSwitch();
    await waitFor(() => expect(fetchUpdateCheck).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText(/is available/i)).toBeNull();
  });

  it('checks straight away when the switch is turned on', async () => {
    // Not an hour later, when a cached "off" answer finally goes stale.
    fetchUpdateCheck
      .mockResolvedValueOnce({ enabled: false, current: '2.3.4' })
      .mockResolvedValue(newer);
    const user = userEvent.setup();
    renderScreen(<SettingsPage />);
    await user.click(await theSwitch());
    expect(await screen.findByText(/Prune 2\.3\.5 is available/)).toBeTruthy();
  });
});

describe('the About panel', () => {
  it('shows the version the backend is running, not a constant in this file', async () => {
    /* It said v2.2.0 through five releases: the version was a hand-copied
     * constant and nothing failed when it went stale. */
    fetchUpdateCheck.mockResolvedValue({ enabled: false, current: '9.8.7' });
    const user = userEvent.setup();
    renderScreen(<SettingsPage />);
    await user.click(await screen.findByRole('button', { name: 'About' }));

    expect(await screen.findByText('v9.8.7')).toBeTruthy();
  });
});

describe('the Uninstall tab', () => {
  /* Revo's Uninstaller -> Backup and General pages, reduced to what Prune
   * can honestly do. Everything here defaults to how Prune already
   * behaved, except the two slow, admin-hungry steps, which are off. */
  const openUninstallTab = async () => {
    const user = userEvent.setup();
    renderScreen(<SettingsPage />);
    await user.click(await screen.findByRole('button', { name: 'Uninstall' }));
    return user;
  };

  it.each([
    ['Create a restore point before uninstalling', { restorePointBeforeUninstall: true }],
    ['Back up the registry before uninstalling', { registryBackupBeforeUninstall: true }],
    ['Scan for leftovers after uninstalling', { scanLeftoversAfterUninstall: false }],
    ['Tick every leftover by default', { preselectLeftovers: false }],
    ['Keep an uninstall history', { keepUninstallHistory: false }]
  ])('saves "%s" when it is switched', async (label, expected) => {
    const user = await openUninstallTab();
    await user.click(await screen.findByRole('switch', { name: label }));
    expect(lastSaved()).toEqual(expected);
  });

  it('says what the registry backup costs, and what happens if it fails', async () => {
    await openUninstallTab();
    expect(await screen.findByText(/140 MB/)).toBeTruthy();
    expect(screen.getByText(/newest 3/)).toBeTruthy();
    expect(screen.getByText(/doesn.t run/i)).toBeTruthy();
  });

  it('starts on Quarantine for leftover files', async () => {
    await openUninstallTab();
    expect((await screen.findByRole('radio', { name: /Quarantine/ })).checked).toBe(true);
  });

  it('saves the Recycle Bin', async () => {
    const user = await openUninstallTab();
    await user.click(await screen.findByRole('radio', { name: /Recycle Bin/ }));
    expect(lastSaved()).toEqual({ leftoverDestination: 'recycle' });
  });

  it('saves permanent deletion, and says plainly it cannot be undone', async () => {
    const user = await openUninstallTab();
    expect(screen.queryByText(/can.t be restored/i)).toBeNull();
    await user.click(await screen.findByRole('radio', { name: /Delete permanently/ }));
    expect(lastSaved()).toEqual({ leftoverDestination: 'permanent' });
    expect(await screen.findByText(/can.t be restored/i)).toBeTruthy();
  });
});

describe('resetting warning confirmations', () => {
  // BleachBit's "Reset warning confirmations". Prune remembered "don't ask
  // again" per risky cleaner and gave no way to take it back.
  it('clears every remembered choice', async () => {
    fetchSettings.mockResolvedValue({ ...DEFAULTS, acknowledgedCleanWarnings: ['chrome-cookies', 'recycle-bin'] });
    const user = await openCleanupTab();
    expect(await screen.findByText(/2 cleaner warnings/i)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Reset warning confirmations' }));
    expect(lastSaved()).toEqual({ acknowledgedCleanWarnings: [] });
  });

  it('is disabled when there is nothing to reset', async () => {
    fetchSettings.mockResolvedValue({ ...DEFAULTS, acknowledgedCleanWarnings: [] });
    await openCleanupTab();
    expect((await screen.findByRole('button', { name: 'Reset warning confirmations' })).disabled).toBe(true);
  });
});

describe('free space on the Disk Map', () => {
  it('is off by default and saves when switched on', async () => {
    const user = userEvent.setup();
    renderScreen(<SettingsPage />);
    const toggle = await screen.findByRole('switch', { name: 'Show free space on the Disk Map' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    await user.click(toggle);
    expect(lastSaved()).toEqual({ showFreeSpaceOnMap: true });
  });
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
