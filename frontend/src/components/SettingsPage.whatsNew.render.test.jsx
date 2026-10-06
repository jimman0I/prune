// @vitest-environment jsdom
import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import { useWhatsNew } from '../hooks/useWhatsNew.js';

/** Settings > About re-opens the "What's new" dialog on request, without
 * touching the recorded version, and Settings follows a "Show me" to a tab. */

const settingsState = vi.hoisted(() => ({}));

vi.mock('../lib/api.js', () => ({
  fetchCustomCleaners: vi.fn(async () => ({ locations: [], imported: [] })),
  fetchSettings: vi.fn(async () => ({ ...settingsState })),
  updateSettings: vi.fn(async (p) => ({ ...settingsState, ...p })),
  fetchUpdateCheck: vi.fn(async () => ({ enabled: false, current: '3.0.0' })),
  openUpdatePage: vi.fn(),
  fetchAutomation: vi.fn(async () => ({ enabled: false, nextRun: null, missed: 0 })),
  runSandboxTest: vi.fn(),
  fetchStartupItems: vi.fn(), fetchStartupIcons: vi.fn(), setStartupItemEnabled: vi.fn(),
  fetchQuarantineBatches: vi.fn(), restoreQuarantineBatch: vi.fn(),
  deleteQuarantineBatch: vi.fn(), emptyQuarantine: vi.fn(),
  fetchDiskSpace: vi.fn(), fetchDiskHealth: vi.fn(),
  fetchCookieDomains: vi.fn(async () => ({ domains: [], errors: [] }))
}));

const api = await import('../lib/api.js');
const SettingsPage = (await import('./SettingsPage.jsx')).default;
const WhatsNewDialog = (await import('./WhatsNewDialog.jsx')).default;

/** The pieces App wires together, without the rest of App. */
function Harness({ tabRequest = null }) {
  const whatsNew = useWhatsNew();
  return (
    <>
      <SettingsPage onShowWhatsNew={whatsNew.openManual} tabRequest={tabRequest} />
      {whatsNew.mode && <WhatsNewDialog version={whatsNew.version} onClose={whatsNew.dismiss} onShowMe={() => {}} />}
    </>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  for (const key of Object.keys(settingsState)) delete settingsState[key];
  vi.mocked(api.updateSettings).mockClear();
});

describe('Settings > About', () => {
  it('has a button that opens the dialog and leaves the recorded version alone', async () => {
    // Already seen: nothing opens by itself, so any dialog here was asked for.
    settingsState.lastSeenVersion = '3.0.0';
    const user = userEvent.setup();
    renderScreen(<Harness />);

    await user.click(await screen.findByRole('tab', { name: 'About' }));
    await user.click(screen.getByRole('button', { name: "What's new in this version" }));

    const dialog = await screen.findByRole('dialog', { name: /what's new in prune/i });
    await user.click(within(dialog).getByRole('button', { name: 'Got it' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(api.updateSettings).not.toHaveBeenCalled();
  });

  it('does not record even when the update notice is still due', async () => {
    settingsState.lastSeenVersion = '2.9.2';
    const user = userEvent.setup();
    renderScreen(<Harness />);

    await user.click(await screen.findByRole('tab', { name: 'About' }));
    await user.click(screen.getByRole('button', { name: "What's new in this version" }));
    await user.click(await screen.findByRole('button', { name: 'Got it' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(api.updateSettings).not.toHaveBeenCalled();
  });

  it('has no button when it is not given a handler', async () => {
    const user = userEvent.setup();
    renderScreen(<SettingsPage />);
    await user.click(await screen.findByRole('tab', { name: 'About' }));
    expect(screen.queryByRole('button', { name: "What's new in this version" })).toBeNull();
  });
});

/** Holds the request the way App does: a value that changes when asked. */
function TabHarness() {
  const [request, setRequest] = useState({ tab: null, nonce: 0 });
  return (
    <>
      <button type="button" onClick={() => setRequest((r) => ({ tab: 'about', nonce: r.nonce + 1 }))}>ask about</button>
      <button type="button" onClick={() => setRequest((r) => ({ tab: 'nonsense', nonce: r.nonce + 1 }))}>ask nonsense</button>
      <SettingsPage tabRequest={request} />
    </>
  );
}

describe('opening on a tab by request', () => {
  const selected = () => screen.getAllByRole('tab').find((t) => t.getAttribute('aria-selected') === 'true').textContent;

  it('switches to the requested tab, and again for a new request', async () => {
    const user = userEvent.setup();
    renderScreen(<TabHarness />);
    await screen.findByRole('tab', { name: 'General' });
    expect(selected()).toBe('General');

    await user.click(screen.getByText('ask about'));
    expect(selected()).toBe('About');

    await user.click(screen.getByRole('tab', { name: 'Cleanup' }));
    expect(selected()).toBe('Cleanup');
    await user.click(screen.getByText('ask about'));
    expect(selected()).toBe('About');
  });

  it('ignores a tab that does not exist', async () => {
    const user = userEvent.setup();
    renderScreen(<TabHarness />);
    await screen.findByRole('tab', { name: 'General' });
    await user.click(screen.getByText('ask nonsense'));
    expect(selected()).toBe('General');
  });
});
