// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** Reading the other accounts' programs: one question first, then what each
 * account gave up, and the one outcome that affects someone else said
 * plainly. */

vi.mock('../lib/api.js', () => ({
  fetchSettings: vi.fn(async () => ({})),
  updateSettings: vi.fn(),
  fetchInstallTraces: vi.fn(async () => []),
  fetchPrograms: vi.fn(async () => []),
  revealInExplorer: vi.fn(),
  openInstalledAppsSettings: vi.fn(),
  deleteInstallTrace: vi.fn()
}));
const scanOtherAccounts = vi.fn();
vi.mock('../lib/programSourcesApi.js', () => ({ scanOtherAccounts: (...a) => scanOtherAccounts(...a) }));

const OtherAccountsDialog = (await import('./OtherAccountsDialog.jsx')).default;
const ProgramList = (await import('./ProgramList.jsx')).default;
const { batchIneligibleReason } = await import('../lib/batchSelection.js');

const profiles = [{ sid: 'S-1-5-21-1-2-3-1005', name: 'nikos' }, { sid: 'S-1-5-21-1-2-3-1004', name: 'WsiAccount' }];

beforeEach(() => vi.clearAllMocks());

describe('OtherAccountsDialog', () => {
  it('names the accounts and says it needs administrator permission and changes nothing', async () => {
    renderScreen(<OtherAccountsDialog profiles={profiles} onClose={() => {}} />);
    expect(await screen.findByText(/needs administrator permission\. Nothing is changed\./)).toBeTruthy();
    expect(screen.getByText('Accounts on this PC: nikos, WsiAccount')).toBeTruthy();
    expect(scanOtherAccounts).not.toHaveBeenCalled();
  });

  it('shows what each account gave up, and an account it could not read', async () => {
    const user = userEvent.setup();
    scanOtherAccounts.mockResolvedValue({ ok: true, scan: { accounts: [{ sid: profiles[0].sid, name: 'nikos', count: 4 }, { sid: profiles[1].sid, name: 'WsiAccount', count: 0, error: 'x' }], programs: [{}], stuck: [] } });
    renderScreen(<OtherAccountsDialog profiles={profiles} onClose={() => {}} />);
    await user.click(await screen.findByRole('button', { name: 'Read their programs' }));
    const list = await screen.findByRole('status');
    expect(within(list).getByText('Programs: 4')).toBeTruthy();
    expect(within(list).getByText("Couldn't be read")).toBeTruthy();
    expect(within(list).getByText(/under Other accounts/)).toBeTruthy();
  });

  it('says nothing changed when UAC is declined', async () => {
    const user = userEvent.setup();
    scanOtherAccounts.mockResolvedValueOnce({ ok: false, cancelled: true });
    renderScreen(<OtherAccountsDialog profiles={profiles} onClose={() => {}} />);
    await user.click(await screen.findByRole('button', { name: 'Read their programs' }));
    expect(await screen.findByText(/administrator permission wasn't given/)).toBeTruthy();
  });
});

describe('other accounts in the list', () => {
  it('offers to read them beside the sources until they have been read, as a button rather than a segment', async () => {
    const user = userEvent.setup();
    const onOpenOtherAccounts = vi.fn();
    renderScreen(<ProgramList programs={[{ id: 'p', name: 'Mine', uninstallString: 'u.exe', sizeBytes: 1 }]} otherProfiles={profiles} onOpenOtherAccounts={onOpenOtherAccounts} />);
    const button = await screen.findByRole('button', { name: 'Other accounts…' });
    expect(button.hasAttribute('aria-pressed')).toBe(false);
    expect(within(screen.getByRole('group', { name: 'Where programs come from' })).queryByRole('button', { name: 'Other accounts…' })).toBeNull();
    await user.click(button);
    expect(onOpenOtherAccounts).toHaveBeenCalled();
  });

  const row = { id: 'user:S:Discord', name: 'Discord', publisher: 'Discord Inc.', sizeBytes: 9, installLocation: 'C:\\Users\\nikos\\AppData\\Local\\Discord', owner: 'nikos', source: 'otherUser' };

  it('is a list of its own, with the owner on each row and Forced uninstall as the way to remove', async () => {
    const user = userEvent.setup();
    const onRemoveUnregistered = vi.fn();
    renderScreen(<ProgramList programs={[{ id: 'p', name: 'Mine', uninstallString: 'u.exe', sizeBytes: 1 }]} otherUsers={[row]} onRemoveUnregistered={onRemoveUnregistered} />);
    expect(screen.queryByRole('row', { name: /Discord/ })).toBeNull();
    await user.click(await screen.findByRole('button', { name: 'Other accounts (1)' }));
    expect(screen.getByText(/can't run another account's uninstaller/)).toBeTruthy();
    const discord = screen.getByRole('row', { name: /Discord/ });
    expect(within(discord).getByText('nikos')).toBeTruthy();
    await user.click(within(discord).getByRole('button', { name: /Remove/ }));
    expect(onRemoveUnregistered).toHaveBeenCalledWith(row);
    expect(batchIneligibleReason(row)).toMatch(/another account/);
  });
});
