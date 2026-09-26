// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** The Settings screen's structure, as opposed to what each setting does
 * (SettingsPage.render.test.jsx): the tab list as a real tablist, where the
 * restore-point switch lives, how the Cleanup tab is grouped, and the
 * consistency rules -- description width, switch position, heading style.
 *
 * jsdom applies no CSS, so the visual rules are pinned as the classes that
 * carry them; what is asserted about structure (which panel a switch is in,
 * which side of its row) is real. */

const updateSettings = vi.fn(async (partial) => partial);
const fetchSettings = vi.fn();

vi.mock('../lib/api.js', () => ({
  fetchSettings: (...a) => fetchSettings(...a),
  updateSettings: (...a) => updateSettings(...a),
  fetchUpdateCheck: vi.fn(async () => ({ enabled: false, current: '2.3.4' })),
  openUpdatePage: vi.fn(),
  fetchAutomation: vi.fn(async () => ({ enabled: false, nextRun: null, missed: 0 })),
  runSandboxTest: vi.fn(),
  fetchStartupItems: vi.fn(), fetchStartupIcons: vi.fn(), setStartupItemEnabled: vi.fn(),
  fetchQuarantineBatches: vi.fn(), restoreQuarantineBatch: vi.fn(),
  deleteQuarantineBatch: vi.fn(), emptyQuarantine: vi.fn(),
  fetchDiskSpace: vi.fn(), fetchDiskHealth: vi.fn(),
  fetchCookieDomains: vi.fn(async () => ({
    domains: [{ domain: 'example.com', count: 3 }], errors: []
  }))
}));

const SettingsPage = (await import('./SettingsPage.jsx')).default;

const DEFAULTS = {
  excludeFolders: ['D:\\Games'],
  excludeExtensions: [],
  autoQuarantine: true,
  minimizeToTray: true,
  skipRecentHours: 24,
  createRestorePoint: true,
  hideUnavailableRules: false,
  quarantineRetentionDays: null,
  quarantineMaxSizeGb: null,
  cookieKeepList: ['old-site.com'],
  updateCheck: false,
  automation: { enabled: false, frequency: 'weekly', weekday: 0, hour: 2, minute: 0, task: 'scan' }
};

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
  fetchSettings.mockResolvedValue({ ...DEFAULTS });
});

const lastSaved = () => updateSettings.mock.calls.at(-1)?.[0];
const panelOf = (el) => el.closest('.glass-panel');

async function open(tab) {
  const user = userEvent.setup();
  renderScreen(<SettingsPage />);
  if (tab) await user.click(await screen.findByRole('tab', { name: tab }));
  await screen.findByRole('tab', { name: 'General' });
  return user;
}

describe('the sub-tabs are a tablist', () => {
  it('exposes tablist, tab and tabpanel, with the current tab selected', async () => {
    await open();

    const list = screen.getByRole('tablist');
    const tabs = within(list).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['General', 'Uninstall', 'Cleanup', 'About']);
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false', 'false']);

    const panel = screen.getByRole('tabpanel');
    expect(panel.getAttribute('aria-labelledby')).toBe(tabs[0].id);
    expect(tabs[0].getAttribute('aria-controls')).toBe(panel.id);
  });

  it('makes the panel itself focusable, so a keyboard user can reach a panel with no focusable content', async () => {
    await open('About');
    expect(screen.getByRole('tabpanel').getAttribute('tabindex')).toBe('0');
  });

  it('puts only the selected tab in the tab order (roving tabindex)', async () => {
    await open();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.getAttribute('tabindex'))).toEqual(['0', '-1', '-1', '-1']);
  });

  it('moves and selects with the arrow keys, wrapping at both ends', async () => {
    const user = await open();
    screen.getByRole('tab', { name: 'General' }).focus();

    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Uninstall' }));
    expect(screen.getByRole('tab', { name: 'Uninstall' }).getAttribute('aria-selected')).toBe('true');

    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'About' }));
    expect(screen.getByRole('tab', { name: 'About' }).getAttribute('aria-selected')).toBe('true');

    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'General' }));
  });

  it('jumps to the first and last tab with Home and End', async () => {
    const user = await open();
    screen.getByRole('tab', { name: 'General' }).focus();

    await user.keyboard('{End}');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'About' }));
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'General' }));
  });

  it('still remembers the tab it lands on', async () => {
    const user = await open();
    screen.getByRole('tab', { name: 'General' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(window.localStorage.getItem('prune.settingsTab')).toBe('uninstall');
  });
});

describe('the theme control lives in General', () => {
  it('offers System, Light and Dark, and says one thing about it', async () => {
    await open();
    const group = screen.getByRole('group', { name: 'Appearance' });
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['System', 'Light', 'Dark']);
    expect(screen.getByText('Pick Light or Dark, or let System follow Windows.')).toBeTruthy();
  });
});

describe('the restore-point switch moved to Uninstall, its behaviour did not', () => {
  const NAME = 'Restore point before removing leftovers';

  it('is on the Uninstall tab, in the same panel as "before uninstalling"', async () => {
    await open('Uninstall');
    const forced = await screen.findByRole('switch', { name: NAME });
    const before = screen.getByRole('switch', { name: 'Restore point before running an uninstaller' });
    expect(panelOf(forced)).toBe(panelOf(before));
  });

  it('is no longer on the Cleanup tab', async () => {
    await open('Cleanup');
    await screen.findByText('Exclude folders');
    expect(screen.queryByRole('switch', { name: NAME })).toBeNull();
  });

  it('still reads and writes the same setting key, createRestorePoint', async () => {
    const user = await open('Uninstall');
    const sw = await screen.findByRole('switch', { name: NAME });
    expect(sw.getAttribute('aria-checked')).toBe('true');

    await user.click(sw);
    await waitFor(() => expect(lastSaved()).toEqual({ createRestorePoint: false }));
  });

  it('reads off as off, and writes true back', async () => {
    fetchSettings.mockResolvedValue({ ...DEFAULTS, createRestorePoint: false });
    const user = await open('Uninstall');
    const sw = await screen.findByRole('switch', { name: NAME });
    expect(sw.getAttribute('aria-checked')).toBe('false');

    await user.click(sw);
    await waitFor(() => expect(lastSaved()).toEqual({ createRestorePoint: true }));
  });
});

describe('the Cleanup tab is grouped into panels like Uninstall', () => {
  it('puts the Deep Clean guards in one headed panel and the Quarantine settings in another', async () => {
    await open('Cleanup');
    const deepHeading = await screen.findByRole('heading', { name: 'Deep Clean' });
    const quarantineHeading = screen.getByRole('heading', { name: 'Quarantine' });

    const deep = panelOf(deepHeading);
    const quarantine = panelOf(quarantineHeading);
    expect(deep).not.toBe(quarantine);

    expect(within(deep).getByLabelText('Hours to leave recent files alone')).toBeTruthy();
    expect(within(deep).getByRole('switch', { name: "Hide cleaners that don't apply" })).toBeTruthy();

    expect(within(quarantine).getByRole('switch', { name: 'Auto-Quarantine' })).toBeTruthy();
    expect(within(quarantine).getByLabelText('Days to keep quarantine backups')).toBeTruthy();
    expect(within(quarantine).getByLabelText('Maximum quarantine size in gigabytes')).toBeTruthy();
  });

  it('separates the rows of a panel with a divider, the way Uninstall does', async () => {
    await open('Cleanup');
    const quarantine = panelOf(await screen.findByRole('heading', { name: 'Quarantine' }));
    expect(quarantine.querySelector('.divide-y')).toBeTruthy();
  });
});

describe('heading and description consistency', () => {
  const LABEL_STYLE = ['font-mono', 'uppercase', 'tracking-[0.14em]', 'text-[11px]'];

  it('draws group headings in the SCAN OUTPUT label style, on Uninstall', async () => {
    await open('Uninstall');
    for (const name of ['Before uninstalling', 'After uninstalling', 'Leftover files go to']) {
      const heading = await screen.findByRole('heading', { name });
      for (const cls of LABEL_STYLE) expect(heading.className).toContain(cls);
    }
  });

  it('draws the Cleanup group headings the same way', async () => {
    await open('Cleanup');
    for (const name of ['Deep Clean', 'Quarantine']) {
      const heading = await screen.findByRole('heading', { name });
      for (const cls of LABEL_STYLE) expect(heading.className).toContain(cls);
    }
  });

  it('caps every setting description at 62ch', async () => {
    await open();
    // General tab: rows that used to have no cap at all.
    const descriptions = [
      "Closing the window sends Prune to the system tray instead of quitting.",
      /Draws the drive's free space as one more block/
    ];
    for (const text of descriptions) {
      const p = (await screen.findByText(text)).closest('p');
      expect(p.className).toContain('max-w-[62ch]');
    }
  });

  it('caps the Cleanup descriptions too', async () => {
    await open('Cleanup');
    for (const text of [/Skip anything modified in the last few hours/, /A cap on the whole Quarantine folder/, /Everything Prune removes goes to Quarantine first/, /Folders and file types Prune will leave alone/]) {
      const p = (await screen.findByText(text)).closest('p');
      expect(p.className).toContain('max-w-[62ch]');
    }
  });
});

describe('the Automation switch sits in the right-hand slot', () => {
  it('shares a row with the title and description, on the right, like every other row', async () => {
    await open('Cleanup');
    const sw = await screen.findByRole('switch', { name: 'Automation' });

    const row = sw.closest('[data-setting-row]');
    expect(row).toBeTruthy();
    const [left, right] = Array.from(row.children);
    expect(within(left).getByText('Automation')).toBeTruthy();
    expect(within(left).getByText(/Runs while Prune is open/)).toBeTruthy();
    expect(within(right).getByRole('switch', { name: 'Automation' })).toBeTruthy();
    expect(left.contains(sw)).toBe(false);
  });

  it('still says whether it is scheduled', async () => {
    await open('Cleanup');
    expect(await screen.findByText('Off')).toBeTruthy();
  });
});

describe('small targets and badges', () => {
  it('gives the exclusion remove button a 24px target', async () => {
    await open('Cleanup');
    const remove = await screen.findByRole('button', { name: 'Stop excluding D:\\Games' });
    expect(remove.className).toMatch(/(?:^|\s)w-6(?:\s|$)/);
    expect(remove.className).toMatch(/(?:^|\s)h-6(?:\s|$)/);
  });

  it('draws the exclusion kind badge at 11px, not 9px', async () => {
    await open('Cleanup');
    const badge = await screen.findByText('Folder');
    expect(badge.className).toContain('text-[11px]');
    expect(badge.className).not.toContain('text-[9px]');
  });

  it('draws the cookie "not seen this scan" badge at 11px', async () => {
    const user = await open('Cleanup');
    await user.click(await screen.findByRole('button', { name: 'Scan for cookies' }));
    const badge = await screen.findByText('not seen this scan');
    expect(badge.className).toContain('text-[11px]');
    expect(badge.className).not.toContain('text-[9px]');
  });
});
