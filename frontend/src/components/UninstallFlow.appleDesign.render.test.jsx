// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** The uninstall dialogs after the Apple design pass: what they promise
 * about busy state, layout, the auto-remove shortcut, stopping a batch and
 * how a batch reports its outcome. The api module is mocked; nothing is
 * removed. */

const streamUninstall = vi.fn();
const scanForLeftovers = vi.fn();
const removeQuarantined = vi.fn();
const fetchSettings = vi.fn();
vi.mock('../lib/api.js', () => ({
  streamUninstall: (...a) => streamUninstall(...a),
  scanForLeftovers: (...a) => scanForLeftovers(...a),
  removeQuarantined: (...a) => removeQuarantined(...a),
  fetchSettings: (...a) => fetchSettings(...a),
  updateSettings: vi.fn(),
  scanForcedUninstall: vi.fn(),
  removeStoreApp: vi.fn(),
  appendHistoryEntry: vi.fn(async () => {})
}));

const UninstallModal = (await import('./UninstallModal.jsx')).default;
const BatchUninstallModal = (await import('./BatchUninstallModal.jsx')).default;
const LeftoverReview = (await import('./LeftoverReview.jsx')).default;

const mk = (id, name) => ({ id, name, publisher: 'Acme', sizeBytes: 1024, uninstallString: `"C:\\${name}\\u.exe"` });
const thing = mk('thing', 'Thing');
const found = {
  files: { ok: true, items: [{ path: 'C:\\Users\\jim\\AppData\\Roaming\\Thing', sizeBytes: 2048 }] },
  registryKeys: { ok: true, items: [] },
  scheduledTasks: { ok: true, items: [] }
};
const deferred = () => {
  let resolve; let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

beforeEach(() => {
  vi.clearAllMocks();
  streamUninstall.mockResolvedValue();
  scanForLeftovers.mockResolvedValue(found);
  removeQuarantined.mockResolvedValue({ destination: 'quarantine', files: [{ originalPath: 'x' }], registryKeys: [], totalSizeBytes: 1 });
  fetchSettings.mockResolvedValue({});
});

describe('busy state is reported and Close refuses while it holds', () => {
  it('single: busy through the uninstall, false while waiting on the person and when it unmounts', async () => {
    const run = deferred();
    streamUninstall.mockReturnValue(run.promise);
    const onBusyChange = vi.fn();
    const user = userEvent.setup();
    const { unmount } = renderScreen(<UninstallModal program={thing} onClose={vi.fn()} onBusyChange={onBusyChange} />);
    expect(screen.getByRole('button', { name: 'Close' }).disabled).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Start uninstalling' }));
    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(true));
    expect(screen.getByRole('button', { name: 'Close' }).disabled).toBe(true);

    await act(async () => { run.resolve(); await run.promise; });
    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(false));
    expect(screen.getAllByRole('button', { name: 'Close' })[0].disabled).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Scan for leftovers' }));
    await screen.findByRole('button', { name: 'Skip' });
    unmount();
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
  });

  it('batch: busy while the queue runs, Close disabled', async () => {
    const run = deferred();
    streamUninstall.mockReturnValue(run.promise);
    const onBusyChange = vi.fn();
    const user = userEvent.setup();
    renderScreen(<BatchUninstallModal programs={[thing, mk('b', 'Bee')]} onClose={vi.fn()} onBusyChange={onBusyChange} />);
    await user.click(screen.getByRole('button', { name: 'Start uninstalling' }));
    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(true));
    expect(screen.getByRole('button', { name: 'Close' }).disabled).toBe(true);
    await act(async () => { run.resolve(); await run.promise; });
  });
});

describe('progress makes no claim it cannot back', () => {
  it('shows a progressbar with no value, and the source has no invented widths or hard-coded coral', async () => {
    streamUninstall.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderScreen(<UninstallModal program={thing} onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Start uninstalling' }));

    const bar = await screen.findByRole('progressbar');
    expect(bar.hasAttribute('aria-valuenow')).toBe(false);
    expect(bar.querySelector('.scan-indeterminate')).toBeTruthy();

    const source = readFileSync('src/components/UninstallModal.jsx', 'utf8');
    expect(source).not.toMatch(/#e8624f/i);
    expect(source).not.toMatch(/progress=\{\d+\}/);
  });
});

describe('the auto-remove shortcut is for Quarantine only', () => {
  const box = () => screen.queryByRole('checkbox', { name: /Automatically remove/ });

  it.each([['recycle'], ['permanent']])('is not offered when leftovers go to %s', async (leftoverDestination) => {
    fetchSettings.mockResolvedValue({ leftoverDestination });
    renderScreen(<UninstallModal program={thing} onClose={vi.fn()} />);
    // Settings arrive after the first paint; wait for the box to be gone
    // (it is offered for the default destination until they do).
    await waitFor(() => expect(box()).toBeNull());
  });

  it('is offered for Quarantine', async () => {
    renderScreen(<UninstallModal program={thing} onClose={vi.fn()} />);
    expect(box()).toBeTruthy();
  });

  it('a box ticked before the destination turned out to be permanent cannot skip the review', async () => {
    let release;
    fetchSettings.mockReturnValue(new Promise((res) => { release = res; }));
    const user = userEvent.setup();
    renderScreen(<UninstallModal program={thing} onClose={vi.fn()} />);
    await user.click(box()); // ticked while settings are still unknown (default: Quarantine)
    await act(async () => { release({ leftoverDestination: 'permanent' }); });
    await waitFor(() => expect(box()).toBeNull());

    await user.click(screen.getByRole('button', { name: 'Start uninstalling' }));
    await user.click(await screen.findByRole('button', { name: 'Scan for leftovers' }));
    // Review is shown; nothing was removed on its own.
    expect(await screen.findByRole('button', { name: 'Delete permanently' })).toBeTruthy();
    expect(removeQuarantined).not.toHaveBeenCalled();
  });

  it('with the box ticked and Quarantine, the scan goes straight to removal as before', async () => {
    const user = userEvent.setup();
    renderScreen(<UninstallModal program={thing} onClose={vi.fn()} />);
    await user.click(box());
    await user.click(screen.getByRole('button', { name: 'Start uninstalling' }));
    await user.click(await screen.findByRole('button', { name: 'Scan for leftovers' }));
    await waitFor(() => expect(removeQuarantined).toHaveBeenCalledTimes(1));
  });
});

describe('layout at 900x600 (classes, since jsdom lays nothing out)', () => {
  it('both dialogs cap their height and scroll the body', () => {
    const { container, unmount } = renderScreen(<UninstallModal program={thing} onClose={vi.fn()} />);
    const single = container.querySelector('[data-modal-panel]');
    expect(single.className).toContain('max-h-[85vh]');
    expect(single.className).toContain('flex-col');
    expect(container.querySelector('[data-modal-body]').className).toMatch(/overflow-y-auto/);
    expect(container.querySelector('[data-modal-body]').className).toContain('min-h-0');
    unmount();

    const batch = renderScreen(<BatchUninstallModal programs={[thing, mk('b', 'Bee')]} onClose={vi.fn()} />).container;
    expect(batch.querySelector('[data-modal-panel]').className).toContain('max-h-[85vh]');
    expect(batch.querySelector('[data-modal-body]').className).toMatch(/overflow-y-auto/);
  });

  it('the leftover review keeps its action bar sticky, opaque, at the bottom', () => {
    const { container } = renderScreen(
      <LeftoverReview scanResult={found} selected={new Set(['files:0'])} onToggle={() => {}} onConfirm={() => {}} onSkip={() => {}} />
    );
    const bar = container.querySelector('[data-leftover-actions]');
    expect(bar.className).toContain('sticky');
    expect(bar.className).toContain('bottom-0');
    expect(bar.className).toContain('bg-[color:var(--bg-panel)]');
    expect(within(bar).getByRole('button', { name: 'Skip' })).toBeTruthy();
    expect(within(bar).getByRole('button', { name: 'Remove selected' })).toBeTruthy();
  });
});

describe('Stop after this one', () => {
  const trio = [mk('a', 'Aaa'), mk('b', 'Bbb'), mk('c', 'Ccc')];

  it('lets the running program finish, skips the rest, and still offers the leftover scan for the finished one', async () => {
    const first = deferred();
    streamUninstall.mockReturnValueOnce(first.promise);
    const user = userEvent.setup();
    renderScreen(<BatchUninstallModal programs={trio} onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Start uninstalling' }));

    await user.click(await screen.findByRole('button', { name: 'Stop after this one' }));
    expect(screen.getByRole('button', { name: 'Stopping after this one…' }).disabled).toBe(true);
    // The uninstaller that was running is not interrupted: still one call, still running.
    expect(streamUninstall).toHaveBeenCalledTimes(1);

    await act(async () => { first.resolve(); await first.promise; });
    await screen.findByRole('button', { name: 'Scan for leftovers' });
    expect(streamUninstall).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Scan for leftovers' }));
    await waitFor(() => expect(scanForLeftovers).toHaveBeenCalledTimes(1));
    expect(scanForLeftovers.mock.calls[0][0]).toBe('Aaa');

    const banner = await screen.findByRole('status');
    expect(banner.textContent).toContain('Uninstalled 1 of 3');
    expect(banner.getAttribute('data-outcome-tone')).toBe('warning');
    expect(screen.getByText('Stopped early. Not started: 2.')).toBeTruthy();
  });

  it('is not offered once the last program has started', async () => {
    const run = deferred();
    streamUninstall.mockReturnValue(run.promise);
    const user = userEvent.setup();
    renderScreen(<BatchUninstallModal programs={[thing]} onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Start uninstalling' }));
    await screen.findByText('uninstalling…');
    expect(screen.queryByRole('button', { name: 'Stop after this one' })).toBeNull();
    await act(async () => { run.resolve(); await run.promise; });
  });
});

describe('the outcome banner tone comes from the counts', () => {
  const trio = [mk('a', 'Aaa'), mk('b', 'Bbb'), mk('c', 'Ccc')];
  const runToReview = async (programs, settings = { scanLeftoversAfterUninstall: false }) => {
    fetchSettings.mockResolvedValue(settings);
    const user = userEvent.setup();
    renderScreen(<BatchUninstallModal programs={programs} onClose={vi.fn()} />);
    await waitFor(() => expect(fetchSettings).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: 'Start uninstalling' }));
    return (await screen.findByRole('status')).getAttribute('data-outcome-tone');
  };

  it('none succeeded is not green', async () => {
    streamUninstall.mockRejectedValue(new Error('boom'));
    expect(await runToReview(trio)).toBe('danger');
  });
  it('some succeeded is a warning', async () => {
    streamUninstall.mockRejectedValueOnce(new Error('boom'));
    expect(await runToReview(trio)).toBe('warning');
  });
  it('all succeeded is success', async () => {
    expect(await runToReview(trio)).toBe('success');
  });
});

describe('the confirm step', () => {
  it('has a Cancel beside Start uninstalling that closes without running anything', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderScreen(<BatchUninstallModal programs={[thing, mk('b', 'Bee')]} onClose={onClose} />);
    const start = screen.getByRole('button', { name: 'Start uninstalling' });
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect(cancel.parentElement).toBe(start.parentElement);
    await user.click(cancel);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(streamUninstall).not.toHaveBeenCalled();
  });

  it('a batch of one uses the single-program sentence and none of the queue talk', () => {
    renderScreen(<BatchUninstallModal programs={[thing]} onClose={vi.fn()} />);
    expect(screen.getByText("This runs Thing's own uninstaller, then scans for anything it leaves behind.")).toBeTruthy();
    expect(screen.queryByText(/One at a time/)).toBeNull();
  });

  it('a batch of two still explains the queue', () => {
    renderScreen(<BatchUninstallModal programs={[thing, mk('b', 'Bee')]} onClose={vi.fn()} />);
    expect(screen.getByText(/One at a time/)).toBeTruthy();
  });
});
