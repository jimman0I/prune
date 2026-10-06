// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, within, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from './testSupport/renderScreen.jsx';
import { APP_VERSION } from './lib/appVersion.js';

/** The "What's new" notice through the real App: it opens once after an
 * update, and what closing it does. Screens are stubbed; what is measured is
 * the dialog, the version written back, and which rail item is current. */

const settingsState = vi.hoisted(() => ({}));

const stub = (name) => () => <div>{name} screen</div>;
vi.mock('./components/Dashboard.jsx', () => ({ default: stub('dashboard') }));
vi.mock('./components/DiskMap.jsx', () => ({ default: stub('diskmap') }));
vi.mock('./components/QuarantineManager.jsx', () => ({ default: stub('quarantine') }));
vi.mock('./components/StartupItems.jsx', () => ({ default: stub('startup') }));
vi.mock('./components/SettingsPage.jsx', () => ({ default: stub('settings') }));
vi.mock('./components/DeepClean.jsx', () => ({ default: stub('deepclean') }));
vi.mock('./components/Duplicates.jsx', () => ({ default: stub('duplicates') }));
vi.mock('./components/ProgramList.jsx', () => ({ default: stub('programlist') }));

vi.mock('./lib/api.js', () => ({
  fetchPrograms: vi.fn(async () => ({})),
  fetchProgramIcons: vi.fn(async () => ({})),
  fetchProgramSizes: vi.fn(async () => ({})),
  fetchProgramVersions: vi.fn(async () => ({})),
  fetchProgramInstallDates: vi.fn(async () => ({})),
  fetchStoreApps: vi.fn(async () => ({})),
  fetchBrowserExtensions: vi.fn(async () => ({})),
  fetchStartupItems: vi.fn(async () => []),
  fetchStartupIcons: vi.fn(async () => ({})),
  fetchAutomation: vi.fn(async () => ({})),
  checkAutomation: vi.fn(async () => ({})),
  fetchDuplicates: vi.fn(async () => ({})),
  fetchPackageIcons: vi.fn(async () => ({})),
  fetchRunningPrograms: vi.fn(async () => ({})),
  fetchQuarantineBatches: vi.fn(async () => ({ batches: [] })),
  fetchSettings: vi.fn(async () => ({ ...settingsState })),
  updateSettings: vi.fn(async (partial) => {
    Object.assign(settingsState, partial);
    return { ...settingsState };
  }),
  fetchUpdateCheck: vi.fn(async () => ({ enabled: false, current: '0.0.0' })),
  fetchDeepCleanRules: vi.fn(async () => []),
  fetchCleanerCategoryIcons: vi.fn(async () => ({})),
  fetchDiskSpace: vi.fn(async () => ({})),
  fetchFileTypeIcons: vi.fn(async () => ({})),
  fetchUninstallHistory: vi.fn(async () => [])
}));

vi.mock('./hooks/usePrograms.js', () => ({
  useProgramData: () => ({
    programs: [], icons: {}, totalSize: 0, extensions: [], running: {},
    loading: false, error: null, refresh: () => {}
  })
}));

const api = await import('./lib/api.js');
const App = (await import('./App.jsx')).default;

const rail = () => within(screen.getByRole('navigation', { name: 'Main' }));
const current = () => rail().getAllByRole('button').find((b) => b.getAttribute('aria-current') === 'page')?.getAttribute('aria-label');
const NOTICE = { name: /what's new in prune/i };
const noticeOpen = () => screen.queryByRole('dialog', NOTICE);
const settle = (ms = 1100) => new Promise((resolve) => setTimeout(resolve, ms));
const setVisibility = (state) => Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });

beforeEach(() => {
  for (const key of Object.keys(settingsState)) delete settingsState[key];
  vi.mocked(api.updateSettings).mockClear();
});
afterEach(() => { delete document.visibilityState; });

describe('after an update', () => {
  it('opens once, named for the version, with focus on Got it', async () => {
    settingsState.lastSeenVersion = '2.9.2';
    renderScreen(<App />);

    const dialog = await screen.findByRole('dialog', NOTICE);
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(within(dialog).getByText(/what's new in prune 3\.0/i)).toBeTruthy();
    expect(within(dialog).getAllByRole('listitem').length).toBeGreaterThanOrEqual(6);
    await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Got it' })));
  });

  it('counts an install that never recorded a version as an update', async () => {
    settingsState.lastSeenVersion = null;
    renderScreen(<App />);
    expect(await screen.findByRole('dialog', NOTICE)).toBeTruthy();
  });

  it('Got it records the running version and does not come back', async () => {
    settingsState.lastSeenVersion = null;
    renderScreen(<App />);
    await screen.findByRole('dialog', NOTICE);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Got it' }));

    expect(noticeOpen()).toBeNull();
    expect(api.updateSettings.mock.calls.map((c) => c[0])).toContainEqual({ lastSeenVersion: APP_VERSION });
    await settle();
    expect(noticeOpen()).toBeNull();
    expect(api.updateSettings).toHaveBeenCalledTimes(1);
  });

  it('Escape records it too', async () => {
    settingsState.lastSeenVersion = null;
    renderScreen(<App />);
    await screen.findByRole('dialog', NOTICE);

    fireEvent.keyDown(document.body, { key: 'Escape' });

    await waitFor(() => expect(noticeOpen()).toBeNull());
    expect(api.updateSettings.mock.calls.map((c) => c[0])).toContainEqual({ lastSeenVersion: APP_VERSION });
  });

  it('a click on the backdrop records it too', async () => {
    settingsState.lastSeenVersion = null;
    renderScreen(<App />);
    await screen.findByRole('dialog', NOTICE);

    await userEvent.setup().click(document.body.querySelector('.fixed.inset-0'));

    await waitFor(() => expect(noticeOpen()).toBeNull());
    expect(api.updateSettings.mock.calls.map((c) => c[0])).toContainEqual({ lastSeenVersion: APP_VERSION });
  });

  it('"Show me" records it, closes it and goes to that screen', async () => {
    settingsState.lastSeenVersion = null;
    renderScreen(<App />);
    const dialog = await screen.findByRole('dialog', NOTICE);
    expect(current()).toBe('Dashboard');

    const card = within(dialog).getByRole('heading', { name: 'Disk Map' }).closest('li');
    await userEvent.setup().click(within(card).getByRole('button', { name: 'Show me' }));

    expect(noticeOpen()).toBeNull();
    expect(current()).toBe('Disk Map');
    expect(api.updateSettings.mock.calls.map((c) => c[0])).toContainEqual({ lastSeenVersion: APP_VERSION });
  });

  it('the Settings card goes to Settings', async () => {
    settingsState.lastSeenVersion = null;
    renderScreen(<App />);
    const dialog = await screen.findByRole('dialog', NOTICE);

    const card = within(dialog).getByRole('heading', { name: 'More in Settings' }).closest('li');
    await userEvent.setup().click(within(card).getByRole('button', { name: 'Show me' }));

    expect(current()).toBe('Settings');
  });

  it('the sidebar card is information only, with no "Show me"', async () => {
    settingsState.lastSeenVersion = null;
    renderScreen(<App />);
    const dialog = await screen.findByRole('dialog', NOTICE);
    const card = within(dialog).getByRole('heading', { name: /sidebar/i }).closest('li');
    expect(within(card).queryByRole('button')).toBeNull();
  });

  it('says plainly that the background options are off until turned on', async () => {
    settingsState.lastSeenVersion = null;
    renderScreen(<App />);
    const dialog = await screen.findByRole('dialog', NOTICE);
    expect(within(dialog).getByText(/all off until you turn them on/i)).toBeTruthy();
  });
});

describe('when it does not open', () => {
  it.each([
    ['a fresh install (stamped with the running version)', () => { settingsState.lastSeenVersion = APP_VERSION; }],
    ['a patch update of the same release', () => { settingsState.lastSeenVersion = '3.0.0'; }],
    ['settings that say nothing about it', () => {}]
  ])('%s', async (_name, arrange) => {
    arrange();
    renderScreen(<App />);
    await screen.findByRole('navigation', { name: 'Main' });
    await settle();
    expect(noticeOpen()).toBeNull();
    expect(api.updateSettings).not.toHaveBeenCalled();
  });

  it('not over another dialog; it follows once that one closes', async () => {
    settingsState.lastSeenVersion = null;
    renderScreen(<App />);
    fireEvent.keyDown(document.body, { key: '/', ctrlKey: true });
    expect(screen.getByRole('dialog')).toBeTruthy();

    await settle();
    expect(noticeOpen()).toBeNull();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);

    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(await screen.findByRole('dialog', NOTICE)).toBeTruthy();
  });

  it('not while the window is hidden; it opens when the window is first shown', async () => {
    setVisibility('hidden');
    settingsState.lastSeenVersion = null;
    renderScreen(<App />);
    await screen.findByRole('navigation', { name: 'Main' });
    await settle();
    expect(noticeOpen()).toBeNull();

    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(await screen.findByRole('dialog', NOTICE)).toBeTruthy();
  });
});
