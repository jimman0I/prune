// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** Settings -> Cleanup -> "Also run when Prune is closed".
 *
 * An opt-in that registers a Windows scheduled task, so what is held still is
 * that it is off until switched on, that the switch shows the task as Windows
 * has it, that it is offered only where it can work (and says why not), and
 * that the last unattended clean is one quiet line with moved and freed apart. */

const fetchScheduledClean = vi.fn();
const setScheduledClean = vi.fn();
const fetchLastAutoClean = vi.fn();
vi.mock('../lib/api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchScheduledClean: (...a) => fetchScheduledClean(...a),
  setScheduledClean: (...a) => setScheduledClean(...a),
  fetchLastAutoClean: (...a) => fetchLastAutoClean(...a)
}));

const BackgroundCleanSetting = (await import('./BackgroundCleanSetting.jsx')).default;

const CLEAN = { enabled: true, task: 'clean', frequency: 'daily', hour: 2, minute: 0 };
const state = (over = {}) => ({ supported: true, reason: null, exists: false, inSync: null, nextRun: null, lastRun: null, lastTaskResult: null, canEnable: true, lastClean: null, ...over });
const render = (automation = CLEAN) => renderScreen(<BackgroundCleanSetting automation={automation} />);
const NAME = 'Also run when Prune is closed';

beforeEach(() => {
  vi.clearAllMocks();
  fetchScheduledClean.mockResolvedValue(state());
  fetchLastAutoClean.mockResolvedValue(null);
});

describe('the switch', () => {
  it('is off by default, named, and says what the task is before anyone turns it on', async () => {
    render();
    const sw = await screen.findByRole('switch', { name: NAME });
    await waitFor(() => expect(sw.disabled).toBe(false));
    expect(sw.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText(/for your account only/)).toBeTruthy();
    expect(screen.getByText(/needs no administrator rights and stores no password/)).toBeTruthy();
    expect(await screen.findByText(/prune-cli clean --preset recommended/)).toBeTruthy();
    expect(setScheduledClean).not.toHaveBeenCalled();
  });

  it('turns the task on only when pressed, then shows what Windows says', async () => {
    setScheduledClean.mockResolvedValue(state({ exists: true, inSync: true, nextRun: new Date(2030, 0, 2, 2, 0).getTime() }));
    render();
    const sw = await screen.findByRole('switch', { name: NAME });
    await waitFor(() => expect(sw.disabled).toBe(false));
    fireEvent.click(sw);
    await waitFor(() => expect(setScheduledClean).toHaveBeenCalledWith(true));
    await waitFor(() => expect(screen.getByRole('switch', { name: NAME }).getAttribute('aria-checked')).toBe('true'));
    expect(screen.getByText(/Next automatic run:/)).toBeTruthy();
  });

  it('shows an existing task as on, and turning it off sends false', async () => {
    fetchScheduledClean.mockResolvedValue(state({ exists: true, inSync: true, nextRun: Date.now() + 3600_000 }));
    setScheduledClean.mockResolvedValue(state());
    render();
    const sw = await screen.findByRole('switch', { name: NAME });
    await waitFor(() => expect(sw.getAttribute('aria-checked')).toBe('true'));
    fireEvent.click(sw);
    await waitFor(() => expect(setScheduledClean).toHaveBeenCalledWith(false));
    await waitFor(() => expect(screen.getByRole('switch', { name: NAME }).getAttribute('aria-checked')).toBe('false'));
  });

  it('can still be switched off when the schedule no longer cleans', async () => {
    fetchScheduledClean.mockResolvedValue(state({ exists: true, inSync: false }));
    render({ ...CLEAN, task: 'scan' });
    const sw = await screen.findByRole('switch', { name: NAME });
    await waitFor(() => expect(sw.getAttribute('aria-checked')).toBe('true'));
    expect(sw.disabled).toBe(false);
  });

  it('warns when the task in Windows is not the schedule above', async () => {
    fetchScheduledClean.mockResolvedValue(state({ exists: true, inSync: false }));
    render();
    expect(await screen.findByText(/doesn't match the schedule above/)).toBeTruthy();
  });

  it('says what went wrong when the change is refused', async () => {
    setScheduledClean.mockRejectedValue(new Error('ERROR: Access is denied.'));
    render();
    const sw = await screen.findByRole('switch', { name: NAME });
    await waitFor(() => expect(sw.disabled).toBe(false));
    fireEvent.click(sw);
    expect(await screen.findByText(/Couldn't change this setting: ERROR: Access is denied\./)).toBeTruthy();
    expect(screen.getByRole('switch', { name: NAME }).getAttribute('aria-checked')).toBe('false');
  });

  it('says so when Windows cannot be read, and leaves the switch off', async () => {
    fetchScheduledClean.mockRejectedValue(new Error('powershell timed out'));
    render();
    expect(await screen.findByText(/Couldn't read the task's state: powershell timed out/)).toBeTruthy();
    expect(screen.getByRole('switch', { name: NAME }).disabled).toBe(true);
  });

  it('reports a failure code only when Windows did not start the task cleanly', async () => {
    fetchScheduledClean.mockResolvedValue(state({ exists: true, inSync: true, lastRun: Date.now() - 1000, lastTaskResult: 2147942402 }));
    render();
    expect(await screen.findByText(/Windows reported error 2147942402/)).toBeTruthy();
  });

  it('stays quiet about a task that has not run yet, or that ran with a rule error', async () => {
    fetchScheduledClean.mockResolvedValue(state({ exists: true, inSync: true, lastRun: null, lastTaskResult: 267011 }));
    const first = render();
    await screen.findByRole('switch', { name: NAME });
    await waitFor(() => expect(screen.getByRole('switch', { name: NAME }).getAttribute('aria-checked')).toBe('true'));
    expect(screen.queryByText(/Windows reported error/)).toBeNull();
    first.unmount();
    fetchScheduledClean.mockResolvedValue(state({ exists: true, inSync: true, lastRun: Date.now() - 1000, lastTaskResult: 1 }));
    render();
    await waitFor(() => expect(screen.getByRole('switch', { name: NAME }).getAttribute('aria-checked')).toBe('true'));
    expect(screen.queryByText(/Windows reported error/)).toBeNull();
  });
});

describe('where it is offered', () => {
  it('is off and disabled, with the reason, in a development build or off Windows', async () => {
    fetchScheduledClean.mockResolvedValue(state({ supported: false, reason: 'unpackaged' }));
    render();
    expect(await screen.findByText('Available in the installed Prune app on Windows. This copy can\'t set it.')).toBeTruthy();
    const sw = screen.getByRole('switch', { name: NAME });
    expect(sw.disabled).toBe(true);
    expect(sw.getAttribute('aria-checked')).toBe('false');
    expect(screen.queryByText(/prune-cli clean --preset recommended/)).toBeNull();
  });

  it('says when the launcher is missing', async () => {
    fetchScheduledClean.mockResolvedValue(state({ supported: false, reason: 'cli-missing' }));
    render();
    expect(await screen.findByText(/prune-cli\.cmd is missing from Prune's folder/)).toBeTruthy();
  });

  it('is disabled with the reason while the schedule only measures', async () => {
    render({ ...CLEAN, task: 'scan' });
    expect(await screen.findByText(/The task only cleans/)).toBeTruthy();
    expect(screen.getByRole('switch', { name: NAME }).disabled).toBe(true);
  });

  it('has no native hover text', async () => {
    const { container } = render();
    await screen.findByRole('switch', { name: NAME });
    expect(container.querySelectorAll('[title]')).toHaveLength(0);
  });
});

describe('the last automatic clean', () => {
  it('is one line: when, what was moved and what was freed', async () => {
    fetchLastAutoClean.mockResolvedValue({ at: Date.now() - 3 * 3600_000, ok: true, mode: 'quarantine', movedBytes: 1288490189, freedBytes: 0, rulesCleaned: 4, rulesFailed: 0 });
    render();
    const line = await screen.findByTestId('last-auto-clean');
    expect(line.textContent).toBe('Last automatic clean: 3 hours ago — moved 1.2 GB, freed 0 B');
  });

  it('says so when some rules failed', async () => {
    fetchLastAutoClean.mockResolvedValue({ at: Date.now() - 60_000, ok: false, mode: 'delete', movedBytes: 0, freedBytes: 2048, rulesCleaned: 1, rulesFailed: 2 });
    render();
    expect((await screen.findByTestId('last-auto-clean')).textContent).toMatch(/some rules failed; moved 0 B, freed 2 KB/);
  });

  it('is absent until a run has happened', async () => {
    render();
    await screen.findByRole('switch', { name: NAME });
    expect(screen.queryByTestId('last-auto-clean')).toBeNull();
  });
});
