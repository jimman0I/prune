// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen, cleanup, fireEvent, act } from '@testing-library/react';
import { MotionConfig } from 'framer-motion';
import { isCopyable } from '../testSupport/copyable.js';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import DiskScanProgress from './DiskScanProgress.jsx';

/** The Disk Map's scan progress card.
 *
 * The rule under every test here (the user's decision): a percentage is
 * drawn only when it is a real, finite number. Nothing is derived,
 * smoothed or invented, so an unknown percent must leave no number and no
 * aria-valuenow behind. */

vi.mock('../lib/api.js', () => ({
  fetchSettings: vi.fn(async () => ({})),
  updateSettings: vi.fn()
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const GB = 1024 ** 3;

function show(props) {
  return renderScreen(
    <MotionConfig reducedMotion="always">
      <DiskScanProgress {...props} />
    </MotionConfig>
  );
}

describe('idle', () => {
  it('renders nothing', () => {
    const { container } = show({ status: 'idle', path: 'C:\\' });
    expect(container.querySelector('.glass-panel')).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(container.textContent).toBe('');
  });
});

describe('scanning', () => {
  it('names the path in ONE monospace, truncating element and keeps the two breathing rings', async () => {
    show({ status: 'scanning', path: 'C:\\Users\\Someone', percent: null });

    const label = await screen.findByText('Scanning C:\\Users\\Someone');
    expect(label.className).toContain('font-mono');
    expect(label.className).toContain('truncate');
    expect(document.querySelectorAll('[style*="pulse-ring"]').length).toBe(2);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['NaN', NaN],
    ['a string', '42']
  ])('draws NO percent number when percent is %s', async (_name, percent) => {
    show({ status: 'scanning', path: 'C:\\', percent, files: 10, bytes: 100 });
    await screen.findByText('Scanning C:\\');

    expect(document.body.textContent).not.toContain('%');
    expect(screen.getByRole('progressbar').hasAttribute('aria-valuenow')).toBe(false);
  });

  it('draws the percent, and aria-valuenow/min/max, when it is a real number', async () => {
    show({ status: 'scanning', path: 'C:\\', percent: 42 });

    expect(await screen.findByText('42%')).toBeTruthy();
    const bar = screen.getByRole('progressbar', { name: 'Scan progress' });
    expect(bar.getAttribute('aria-valuenow')).toBe('42');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
    expect(bar.hasAttribute('data-indeterminate')).toBe(false);
  });

  it('treats a real 0 as a real percent', async () => {
    show({ status: 'scanning', path: 'C:\\', percent: 0 });

    expect(await screen.findByText('0%')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
  });

  it('is an indeterminate bar with no aria-valuenow, min or max when there is no percent', async () => {
    show({ status: 'scanning', path: 'C:\\Games', percent: null });
    await screen.findByText('Scanning C:\\Games');

    const bar = screen.getByRole('progressbar', { name: 'Scan progress' });
    expect(bar.hasAttribute('aria-valuenow')).toBe(false);
    expect(bar.hasAttribute('aria-valuemin')).toBe(false);
    expect(bar.hasAttribute('aria-valuemax')).toBe(false);
    expect(bar.getAttribute('data-indeterminate')).toBe('true');
    expect(bar.querySelector('.scan-indeterminate')).toBeTruthy();
  });

  it('shows the live counters, with no percent, when files are known but the total is not', async () => {
    show({ status: 'scanning', path: 'C:\\Games', percent: null, files: 1200, bytes: 5 * GB });

    expect(await screen.findByText(/1[,.]200/)).toBeTruthy();
    expect(document.body.textContent).toMatch(/1[,.]200 files scanned · 5 GB processed/);
    expect(document.body.textContent).not.toMatch(/\d\s*%/);
    expect(screen.getByText(/no percentage/)).toBeTruthy();
  });

  it('shows no counters at all when files is not a number', async () => {
    show({ status: 'scanning', path: 'C:\\Games', percent: null });
    await screen.findByText('Scanning C:\\Games');

    expect(document.body.textContent).not.toContain('files scanned');
  });

  it('does not say there is no percentage when there is one', async () => {
    show({ status: 'scanning', path: 'C:\\', percent: 37, files: 5, bytes: 10 });
    await screen.findByText('37%');

    expect(screen.queryByText(/no percentage/)).toBeNull();
  });

  it('renders the footer action passed as children', async () => {
    show({ status: 'scanning', path: 'C:\\', children: <button>Read the index</button> });

    expect(await screen.findByRole('button', { name: 'Read the index' })).toBeTruthy();
  });
});

describe('scanning in index mode (the fast scan)', () => {
  it('shows elapsed time and the no-progress note, never a percent or counters', async () => {
    show({ status: 'scanning', mode: 'index', path: 'C:\\', percent: 55, files: 9, bytes: 9 });

    expect(await screen.findByText('Elapsed 00:00')).toBeTruthy();
    expect(screen.getByText(/Windows reports no progress/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\d\s*%/);
    expect(document.body.textContent).not.toContain('files scanned');
    expect(screen.getByRole('progressbar').hasAttribute('aria-valuenow')).toBe(false);
  });

  it('ticks the elapsed time once a second, and clears its timer on unmount', async () => {
    vi.useFakeTimers();
    const setSpy = vi.spyOn(globalThis, 'setInterval');
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');
    const { unmount } = show({ status: 'scanning', mode: 'index', path: 'C:\\' });

    expect(screen.getByText('Elapsed 00:00')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.getByText('Elapsed 00:03')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(62_000); });
    expect(screen.getByText('Elapsed 01:05')).toBeTruthy();

    const ours = setSpy.mock.calls
      .map((call, i) => (call[1] === 1000 ? setSpy.mock.results[i].value : undefined))
      .filter((id) => id !== undefined);
    unmount();
    // Every interval the component started was cleared.
    for (const id of ours) expect(clearSpy).toHaveBeenCalledWith(id);
    expect(ours.length).toBeGreaterThan(0);
  });

  it('starts a 1-second interval only in index mode', () => {
    vi.useFakeTimers();
    const setSpy = vi.spyOn(globalThis, 'setInterval');
    show({ status: 'scanning', path: 'C:\\', percent: null });
    expect(setSpy.mock.calls.filter(([, ms]) => ms === 1000)).toHaveLength(0);
  });
});

describe('complete', () => {
  it('draws a checkmark whose path animates pathLength from 0', () => {
    const { container } = show({ status: 'complete', totalFiles: 1500, totalBytes: 2 * GB });

    const path = container.querySelector('svg path');
    expect(path).toBeTruthy();
    // framer-motion normalises the path to length 1 and drives a dash pair
    // "<drawn> <gap>" from pathLength. On the first render (initial
    // pathLength 0) nothing is drawn yet: the drawn part is 0.
    expect(path.getAttribute('pathLength')).toBe('1');
    expect(path.getAttribute('stroke-dasharray')).toBe('0 1');
  });

  it('says the counts when the totals are known', async () => {
    show({ status: 'complete', totalFiles: 1500, totalBytes: 2 * GB });

    expect(await screen.findByText(/^Scan complete — 1[,.]500 files, 2 GB$/)).toBeTruthy();
  });

  it('says plain "Scan complete" when the totals are not known', async () => {
    show({ status: 'complete' });

    expect(await screen.findByText('Scan complete')).toBeTruthy();
  });

  it('a scan that ran out of time says it stopped early, not complete, with a warning mark instead of the checkmark', async () => {
    const { container } = show({ status: 'complete', truncated: true, totalFiles: 82747, totalBytes: 34.8 * GB, onScanAgain: vi.fn() });

    expect(await screen.findByText(/^Scan stopped early — 82[,.]747 files, 34\.8 GB so far$/)).toBeTruthy();
    expect(screen.queryByText(/Scan complete/)).toBeNull();
    expect(screen.getByTestId('scan-stopped-mark')).toBeTruthy();
    // No self-drawing success checkmark.
    expect(container.querySelector('svg path[pathLength]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Scan again' })).toBeTruthy();
  });

  it('stopped early without known totals still does not say complete', async () => {
    show({ status: 'complete', truncated: true });

    expect(await screen.findByText('Scan stopped early')).toBeTruthy();
    expect(screen.queryByText(/Scan complete/)).toBeNull();
  });

  it('a scan that finished keeps the checkmark and the complete wording', async () => {
    const { container } = show({ status: 'complete', truncated: false, totalFiles: 5, totalBytes: 5 });

    expect(await screen.findByText(/^Scan complete — 5 files/)).toBeTruthy();
    expect(screen.queryByTestId('scan-stopped-mark')).toBeNull();
    expect(container.querySelector('svg path[pathLength]')).toBeTruthy();
  });

  it('calls onScanAgain from the Scan again button', async () => {
    const onScanAgain = vi.fn();
    show({ status: 'complete', totalFiles: 1, totalBytes: 1, onScanAgain });

    fireEvent.click(await screen.findByRole('button', { name: 'Scan again' }));
    expect(onScanAgain).toHaveBeenCalledTimes(1);
  });

  it('offers no Scan again button without a handler', async () => {
    show({ status: 'complete' });
    await screen.findByText('Scan complete');

    expect(screen.queryByRole('button', { name: 'Scan again' })).toBeNull();
  });
});

describe('complete, when a scan did not finish: ONE card says why and how much', () => {
  const coverage = { measured: 15.8 * GB, used: 835.1 * GB, percent: 2 };

  it('a scan the user stopped says so once, with the coverage sentence inside the same card', async () => {
    show({ status: 'complete', truncated: true, stoppedByUser: true, coverage, totalFiles: 25677, totalBytes: 15.8 * GB, onScanAgain: vi.fn() });

    const card = (await screen.findByRole('status'));
    expect(card.textContent).toMatch(/Scan stopped early — 25[,.]677 files, 15\.8 GB so far/);
    expect(card.textContent).toContain('You stopped this scan: it measured 15.8 GB of the 835.1 GB in use (2%).');
    // The wording that was wrong after Stop.
    expect(document.body.textContent).not.toMatch(/ran out of time/);
  });

  it('a scan that hit the time limit says that, in the same single card', async () => {
    show({ status: 'complete', truncated: true, stoppedByUser: false, coverage, totalFiles: 10, totalBytes: 10 });

    const card = await screen.findByRole('status');
    expect(card.textContent).toContain('This scan ran out of time: it measured 15.8 GB of the 835.1 GB in use (2%).');
    expect(document.body.textContent).not.toMatch(/You stopped/);
  });

  it('without a coverage figure it still explains, in its own words for each cause', async () => {
    const { unmount } = show({ status: 'complete', truncated: true, stoppedByUser: true, coverage: null });
    expect((await screen.findByRole('status')).textContent).toMatch(/You stopped this scan early\./);
    unmount();

    show({ status: 'complete', truncated: true, stoppedByUser: false, coverage: null });
    expect((await screen.findByRole('status')).textContent).toMatch(/ran out of time before it finished the drive/);
  });

  it('offers the fast scan inside the card and calls it', async () => {
    const onFastScan = vi.fn();
    show({ status: 'complete', truncated: true, coverage, onFastScan });

    fireEvent.click(await screen.findByRole('button', { name: 'Run a fast scan instead' }));
    expect(onFastScan).toHaveBeenCalledTimes(1);
  });

  it('says it is busy once the fast scan has started, and cannot be pressed again', async () => {
    show({ status: 'complete', truncated: true, coverage, onFastScan: vi.fn(), fastScanning: true });

    const button = await screen.findByRole('button', { name: 'Scanning drive…' });
    expect(button.disabled).toBe(true);
  });

  it('a finished scan has no coverage sentence and no fast-scan link, but is still a status region', async () => {
    show({ status: 'complete', truncated: false, coverage, onFastScan: vi.fn(), totalFiles: 5, totalBytes: 5 });

    const card = await screen.findByRole('status');
    expect(card.textContent).not.toMatch(/measured|You stopped|ran out of time/);
    expect(screen.queryByRole('button', { name: 'Run a fast scan instead' })).toBeNull();
  });
});

describe('error', () => {
  it('shows the message in a selectable element and calls onRetry from Retry', async () => {
    const onRetry = vi.fn();
    show({ status: 'error', message: 'Couldn\'t scan "D:\\": EACCES', onRetry });

    const message = await screen.findByText('Couldn\'t scan "D:\\": EACCES');
    expect(isCopyable(message)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('offers no Retry button without a handler', async () => {
    show({ status: 'error', message: 'nope' });
    await screen.findByText('nope');

    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });
});

describe('time left in a folder walk', () => {
  const walk = (extra) => show({ status: 'scanning', path: 'Folder', percent: null, files: 5, bytes: 5, ...extra });

  it('says "up to N s left", counting down from the server figure once a second', () => {
    vi.useFakeTimers();
    const receivedAt = Date.now();
    walk({ remainingMs: 30_000, remainingAt: receivedAt });

    expect(screen.getByTestId('scan-time-left').textContent).toBe('Up to 30 s left');
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByTestId('scan-time-left').textContent).toBe('Up to 25 s left');
    act(() => { vi.advanceTimersByTime(24_000); });
    expect(screen.getByTestId('scan-time-left').textContent).toBe('Up to 1 s left');
  });

  it('never claims certainty: the wording is always an upper bound', () => {
    walk({ remainingMs: 12_000, remainingAt: Date.now() });
    expect(screen.getByTestId('scan-time-left').textContent).toMatch(/^Up to /);
  });

  it('switches to the stopped-early wording at the limit instead of sitting on 0 s', () => {
    vi.useFakeTimers();
    walk({ remainingMs: 3000, remainingAt: Date.now() });

    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.getByTestId('scan-time-left').textContent).toBe('Scan stopped early');
    act(() => { vi.advanceTimersByTime(20_000); });
    expect(screen.getByTestId('scan-time-left').textContent).toBe('Scan stopped early');
    expect(document.body.textContent).not.toMatch(/\b0 s\b/);
  });

  it('shows a minutes form for longer figures', () => {
    walk({ remainingMs: 65_000, remainingAt: Date.now() });
    expect(screen.getByTestId('scan-time-left').textContent).toBe('Up to 1 min 5 s left');
  });

  it('shows nothing when the server sent no figure', () => {
    walk({});
    expect(screen.queryByTestId('scan-time-left')).toBeNull();
  });

  it('leaves the real percent bar exactly as it was and adds the line beneath it', () => {
    walk({ percent: 37, remainingMs: 20_000, remainingAt: Date.now() });

    expect(screen.getByText('37%')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('37');
    expect(screen.getByTestId('scan-time-left')).toBeTruthy();
  });

  it('has no animated number: the countdown is plain text, so reduced motion has nothing to turn off', () => {
    walk({ remainingMs: 10_000, remainingAt: Date.now() });
    const line = screen.getByTestId('scan-time-left');
    expect(line.children.length).toBe(0);
  });

  it('clears its once-a-second timer on unmount', () => {
    vi.useFakeTimers();
    const setSpy = vi.spyOn(globalThis, 'setInterval');
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');
    const { unmount } = walk({ remainingMs: 10_000, remainingAt: Date.now() });
    const ids = setSpy.mock.calls
      .map((call, i) => (call[1] === 1000 ? setSpy.mock.results[i].value : undefined))
      .filter((id) => id !== undefined);
    expect(ids.length).toBeGreaterThan(0);
    unmount();
    for (const id of ids) expect(clearSpy).toHaveBeenCalledWith(id);
  });
});

describe('time left in the fast scan', () => {
  const fast = (extra) => show({ status: 'scanning', mode: 'index', path: 'C:', ...extra });

  it('gives NO number the first time ever, only the plain elapsed copy', () => {
    fast({ expectedMs: null });

    expect(screen.queryByTestId('scan-time-left')).toBeNull();
    expect(screen.getByText('Elapsed 00:00')).toBeTruthy();
    expect(screen.getByText(/only the time so far/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/left/);
  });

  it('counts down from how long the last scan took, labelled as an estimate', () => {
    vi.useFakeTimers();
    fast({ expectedMs: 10_000 });

    expect(screen.getByTestId('scan-time-left').textContent).toBe('About 10 s left, based on your last scan');
    act(() => { vi.advanceTimersByTime(4000); });
    expect(screen.getByTestId('scan-time-left').textContent).toBe('About 6 s left, based on your last scan');
    expect(screen.queryByText(/only the time so far/)).toBeNull();
  });

  it('says it is taking longer when it runs past the last scan, and never shows 0 s', () => {
    vi.useFakeTimers();
    fast({ expectedMs: 5000 });

    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByTestId('scan-time-left').textContent).toBe('Taking longer than your last scan');
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(screen.getByTestId('scan-time-left').textContent).toBe('Taking longer than your last scan');
    expect(document.body.textContent).not.toMatch(/\b0 s\b/);
  });

  it('keeps the indeterminate bar and never draws a percent', () => {
    fast({ expectedMs: 10_000, percent: 55 });
    expect(screen.getByRole('progressbar').hasAttribute('aria-valuenow')).toBe(false);
    expect(document.body.textContent).not.toMatch(/\d\s*%/);
  });
});

describe('one indicator at a time', () => {
  const rings = () => document.querySelectorAll('[style*="pulse-ring"]').length;
  const spinner = () => document.querySelectorAll('.animate-spin').length;

  it('a real percent gets the bar and the counters only: no rings, no spinner', () => {
    show({ status: 'scanning', path: 'C:', percent: 42, files: 100, bytes: 100 });

    expect(rings()).toBe(0);
    expect(spinner()).toBe(0);
    expect(screen.getByText('42%')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('42');
    expect(screen.getByTestId('scan-counters')).toBeTruthy();
  });

  it('an indeterminate walk keeps the rings and the spinner, the only sign of life it has', () => {
    show({ status: 'scanning', path: 'Folder', percent: null, files: 100, bytes: 100 });

    expect(rings()).toBe(2);
    expect(spinner()).toBe(1);
  });

  it('the fast scan is indeterminate too, so it keeps them', () => {
    show({ status: 'scanning', mode: 'index', path: 'C:' });

    expect(rings()).toBe(2);
    expect(spinner()).toBe(1);
  });
});

describe('Stop', () => {
  it('halts a folder walk: calls onStop once and disables itself', () => {
    const onStop = vi.fn();
    show({ status: 'scanning', path: 'Folder', percent: null, onStop });

    const button = screen.getByRole('button', { name: 'Stop' });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(onStop).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(true);
  });

  it('says it is stopping once pressed, instead of sitting there looking unpressed', () => {
    show({ status: 'scanning', path: 'Folder', percent: null, onStop: vi.fn() });

    const button = screen.getByRole('button', { name: 'Stop' });
    fireEvent.click(button);

    expect(button.textContent).toBe('Stopping…');
  });

  it('is offered on a whole-drive walk with a real percent as well', () => {
    show({ status: 'scanning', path: 'C:', percent: 12, onStop: vi.fn() });
    expect(screen.getByRole('button', { name: 'Stop' })).toBeTruthy();
  });

  it('is absent when there is nothing to stop yet', () => {
    show({ status: 'scanning', path: 'Folder', percent: null });
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();
  });

  it('is NEVER offered for the fast scan, which cannot be interrupted mid-read', () => {
    show({ status: 'scanning', mode: 'index', path: 'C:', onStop: vi.fn() });
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();
  });
});
