// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** The Dashboard's Windows tools dialog: what it lists, what a click sends,
 * and how each outcome is said. The backend is mocked; nothing opens. */

const fetchWindowsTools = vi.fn();
const launchWindowsTool = vi.fn(async () => ({ ok: true }));

vi.mock('../lib/api.js', () => ({
  fetchWindowsTools: (...a) => fetchWindowsTools(...a),
  launchWindowsTool: (...a) => launchWindowsTool(...a),
  fetchDiskSpace: vi.fn(async () => ({ freeBytes: 500 * 1024 ** 3, totalBytes: 1000 * 1024 ** 3 })),
  fetchDiskHealth: vi.fn(async () => ({ disks: [] })),
  unlockDiskWear: vi.fn(),
  fetchUninstallHistory: vi.fn(async () => []),
  fetchAutomation: vi.fn(async () => ({ enabled: false, nextRun: null, missed: 0 })),
  streamDeepCleanScan: vi.fn(() => new Promise(() => {})),
  fetchSettings: vi.fn(async () => ({})),
  updateSettings: vi.fn()
}));

const WindowsToolsDialog = (await import('./WindowsToolsDialog.jsx')).default;
const Dashboard = (await import('./Dashboard.jsx')).default;
const ToastHost = (await import('./ToastHost.jsx')).default;

const TOOLS = [
  { id: 'systemRestore', group: 'repair', elevated: false, kind: 'window' },
  { id: 'sfc', group: 'repair', elevated: true, kind: 'window', command: 'sfc /scannow' },
  { id: 'services', group: 'manage', elevated: false, kind: 'window' },
  { id: 'flushDns', group: 'network', elevated: true, kind: 'action', command: 'ipconfig /flushdns' },
  { id: 'onScreenKeyboard', group: 'access', elevated: false, kind: 'window' }
];

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
  fetchWindowsTools.mockResolvedValue(TOOLS);
  launchWindowsTool.mockResolvedValue({ ok: true });
});

const open = (name) => screen.findByRole('button', { name: `Open ${name}` });

describe('WindowsToolsDialog', () => {
  it('lists only what the backend found, under their groups, in group order', async () => {
    renderScreen(<WindowsToolsDialog onClose={() => {}} />);
    await open('Services');
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(['Repair', 'Manage', 'Network', 'Security and accessibility']);
    const repair = screen.getByRole('region', { name: 'Repair' });
    expect(within(repair).getByText('System Restore')).toBeTruthy();
    expect(within(repair).getByText('Finds and repairs damaged Windows files.')).toBeTruthy();
    expect(screen.queryByText('Group Policy')).toBeNull();
    expect(screen.queryByText('Diagnose')).toBeNull();
  });

  it('marks the ones that ask for administrator with a shield and words, and shows their command', async () => {
    renderScreen(<WindowsToolsDialog onClose={() => {}} />);
    await open('Services');
    const sfc = screen.getByTestId('elevated-sfc');
    expect(sfc.textContent).toBe('Asks for administrator');
    expect(sfc.querySelector('svg')).toBeTruthy();
    expect(screen.getByText('sfc /scannow')).toBeTruthy();
    expect(screen.getByText('Runs in a Command Prompt that stays open')).toBeTruthy();
    expect(screen.getByTestId('elevated-flushDns')).toBeTruthy();
    expect(screen.queryByTestId('elevated-services')).toBeNull();
    expect(document.querySelector('[title]')).toBeNull();
  });

  it('sends the id and nothing else', async () => {
    const user = userEvent.setup();
    renderScreen(<WindowsToolsDialog onClose={() => {}} />);
    await user.click(await open('Services'));
    expect(launchWindowsTool).toHaveBeenCalledWith('services');
  });

  it('says so when the UAC dialog was declined', async () => {
    launchWindowsTool.mockResolvedValueOnce({ ok: false, cancelled: true });
    const user = userEvent.setup();
    renderScreen(<WindowsToolsDialog onClose={() => {}} />);
    await user.click(await open('System File Checker'));
    expect((await screen.findByRole('status')).textContent).toBe('Windows was not given permission, so nothing was started.');
  });

  it('names the tool and the reason when it could not start', async () => {
    launchWindowsTool.mockResolvedValueOnce({ ok: false, error: 'The system cannot find the file specified.' });
    const user = userEvent.setup();
    renderScreen(<WindowsToolsDialog onClose={() => {}} />);
    await user.click(await open('On-screen keyboard'));
    expect((await screen.findByRole('alert')).textContent).toBe("On-screen keyboard: Couldn't start it: The system cannot find the file specified.");
  });

  it('runs Flush DNS and reports it with a toast', async () => {
    const user = userEvent.setup();
    renderScreen(<><WindowsToolsDialog onClose={() => {}} /><ToastHost /></>);
    await user.click(await screen.findByRole('button', { name: 'Run Flush DNS' }));
    expect(launchWindowsTool).toHaveBeenCalledWith('flushDns');
    expect(await screen.findByText('DNS cache flushed.')).toBeTruthy();
  });

  it('holds the other buttons while one is starting, so a UAC dialog is never stacked on another', async () => {
    let finish;
    launchWindowsTool.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const user = userEvent.setup();
    renderScreen(<WindowsToolsDialog onClose={() => {}} />);
    await user.click(await open('System File Checker'));
    expect(screen.getByRole('button', { name: 'Open System File Checker' }).textContent).toBe('Opening…');
    expect(screen.getByRole('button', { name: 'Open Services' }).disabled).toBe(true);
    finish({ ok: true });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open Services' }).disabled).toBe(false));
  });

  it('says why when the list cannot be read', async () => {
    fetchWindowsTools.mockRejectedValueOnce(new Error('Backend offline'));
    renderScreen(<WindowsToolsDialog onClose={() => {}} />);
    expect((await screen.findByRole('alert')).textContent).toBe("Couldn't list the tools: Backend offline");
  });
});

describe('on the Dashboard', () => {
  it('opens from a quiet button beside the heading, and closes again', async () => {
    const user = userEvent.setup();
    renderScreen(<Dashboard programs={[]} programsMeasured onNavigate={() => {}} />);
    const button = await screen.findByRole('button', { name: 'Windows tools' });
    expect(button.className).toContain('btn-ghost');
    await user.click(button);
    const dialog = await screen.findByRole('dialog', { name: 'Windows tools' });
    expect(await within(dialog).findByText('Services')).toBeTruthy();
    // Focus starts on Close, never on a button that starts a tool.
    await waitFor(() => expect(document.activeElement?.textContent).toBe('Close'));
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
