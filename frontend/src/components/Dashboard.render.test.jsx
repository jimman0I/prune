// @vitest-environment jsdom
import { useState } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen, makeTestClient } from '../testSupport/renderScreen.jsx';
import { isCopyable } from '../testSupport/copyable.js';

/** The Dashboard: one question -- where is my space going? -- answered by a
 * stacked bar, the five largest programs, and a quiet row of three facts.
 *
 * These pin what the redesign has to keep true: numbers only ever appear
 * once, measured (never before both the disk and the program sizes are in);
 * the bar's segments are the measured figures; every button that leaves the
 * screen goes where it says; and the older behaviour that outlived the
 * redesign -- reads through the query layer, the elevated wear unlock
 * replacing the health reading -- still holds. */

const fetchDiskSpace = vi.fn();
const fetchDiskHealth = vi.fn();
const unlockDiskWear = vi.fn();
const fetchUninstallHistory = vi.fn(async () => []);
const fetchAutomation = vi.fn(async () => ({ enabled: false, nextRun: null, missed: 0 }));
const streamDeepCleanScan = vi.fn();

vi.mock('../lib/api.js', () => ({
  fetchDiskSpace: (...a) => fetchDiskSpace(...a),
  fetchDiskHealth: (...a) => fetchDiskHealth(...a),
  unlockDiskWear: (...a) => unlockDiskWear(...a),
  fetchUninstallHistory: (...a) => fetchUninstallHistory(...a),
  fetchAutomation: (...a) => fetchAutomation(...a),
  streamDeepCleanScan: (...a) => streamDeepCleanScan(...a),
  fetchStartupItems: vi.fn(), fetchStartupIcons: vi.fn(), setStartupItemEnabled: vi.fn(),
  fetchQuarantineBatches: vi.fn(), restoreQuarantineBatch: vi.fn(),
  deleteQuarantineBatch: vi.fn(), emptyQuarantine: vi.fn(),
  fetchSettings: vi.fn(async () => ({})), updateSettings: vi.fn()
}));

const Dashboard = (await import('./Dashboard.jsx')).default;

const GB = 1024 ** 3;
const prog = (name, gb, extra = {}) => ({ id: name, name, sizeBytes: gb === undefined ? undefined : gb * GB, ...extra });

beforeEach(() => {
  vi.clearAllMocks();
  fetchDiskSpace.mockResolvedValue({ freeBytes: 100 * GB, totalBytes: 500 * GB });
  fetchDiskHealth.mockResolvedValue({
    disks: [{ deviceId: '0', model: 'Test NVMe', mediaType: 'SSD', healthStatus: 'Healthy', lifeRemainingPercent: 93 }]
  });
  streamDeepCleanScan.mockImplementation(() => new Promise(() => {}));
});

const render = (props = {}) => renderScreen(
  <Dashboard programs={[]} programsMeasured onNavigate={() => {}} {...props} />
);
// A Dashboard whose props can change after mount, inside the providers
// renderScreen supplies -- what rerender() cannot do, since it drops them.
let setHarnessProps;
function Harness({ initial }) {
  const [props, setProps] = useState(initial);
  setHarnessProps = setProps;
  return <Dashboard onNavigate={() => {}} {...props} />;
}
const segment = (container, name) => container.querySelector(`[data-segment="${name}"]`);
const width = (el) => parseFloat(el.style.width);

describe('what can be copied', () => {
  it('the reason drive health could not be read', async () => {
    fetchDiskHealth.mockRejectedValue(new Error('WMI unavailable'));
    render();
    // Retried once before it reaches the screen.
    const message = await screen.findByText(/Couldn't read drive health: WMI unavailable/, {}, { timeout: 5000 });
    expect(isCopyable(message)).toBe(true);
  });
});

describe('the Dashboard reads', () => {
  it('shows disk space from the query layer, as one summary line', async () => {
    render();
    await waitFor(() => expect(fetchDiskSpace).toHaveBeenCalled());
    expect(await screen.findByText('400 GB used of 500 GB · 100 GB free')).toBeTruthy();
    expect(screen.getByText('Drive C:')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Where is my space going?' })).toBeTruthy();
  });

  it('says a health read failed rather than rendering an empty drive', async () => {
    // Not every machine exposes SMART. "No drives" is never true, so the
    // failure has to say so.
    fetchDiskHealth.mockRejectedValue(new Error('WMI unavailable'));
    render();
    // Generous, and deliberately so: useDiskHealth sets retry: 1, so the
    // failure is retried once with backoff before it reaches the screen.
    expect(await screen.findByText(/Couldn't read drive health: WMI unavailable/, {}, { timeout: 5000 }))
      .toBeTruthy();
  });

  it('says why disk space could not be read instead of drawing a bar', async () => {
    fetchDiskSpace.mockRejectedValue(new Error('E_DISK'));
    render();
    expect(await screen.findByText('E_DISK', {}, { timeout: 5000 })).toBeTruthy();
    expect(screen.queryByText(/ used of /)).toBeNull();
  });

  it('fetches each reading once even when two consumers ask', async () => {
    // Two Dashboards sharing one client dedupe through the cache; the old
    // local-state version issued a request per mount, and the drive-health
    // read is the slowest call on the screen.
    const client = makeTestClient();
    renderScreen(<Dashboard programs={[]} programsMeasured onNavigate={() => {}} />, { client });
    renderScreen(<Dashboard programs={[]} programsMeasured onNavigate={() => {}} />, { client });
    await waitFor(() => expect(fetchDiskHealth).toHaveBeenCalled());
    expect(fetchDiskHealth).toHaveBeenCalledTimes(1);
    expect(fetchDiskSpace).toHaveBeenCalledTimes(1);
  });
});

describe('the space bar', () => {
  const programs = [prog('Big', 150), prog('Small', 50), prog('No size'), prog('Ext')];

  it('splits used space into programs and everything else, with free, and says all three in words', async () => {
    const { container } = render({ programs });
    const bar = await screen.findByRole('img', { name: /Drive space/ });
    // 500 total, 100 free, 400 used; programs 200, everything else 200.
    expect(bar.getAttribute('aria-label')).toBe(
      'Drive space: installed programs 200 GB, everything else 200 GB, free 100 GB.'
    );
    expect(width(segment(container, 'programs'))).toBeCloseTo(40, 6);
    expect(width(segment(container, 'other'))).toBeCloseTo(40, 6);
    expect(width(segment(container, 'free'))).toBeCloseTo(20, 6);
  });

  it('repeats the figures as text in a legend, and says how many programs have no size', async () => {
    render({ programs });
    const legend = (await screen.findByText('Installed programs')).closest('ul');
    expect([...legend.children].map((li) => li.textContent)).toEqual([
      'Installed programs200 GB',
      'Everything else200 GB',
      'Free100 GB',
      '2 programs without a size'
    ]);
  });

  it('floors everything else at zero when the programs claim more than the drive uses', async () => {
    const { container } = render({ programs: [prog('Huge', 450)] });
    await screen.findByRole('img', { name: /everything else 0 B/ });
    expect(segment(container, 'other')).toBeNull();
    expect(width(segment(container, 'programs')) + width(segment(container, 'free'))).toBeCloseTo(100, 6);
    expect(screen.getByText('Program sizes add up to more than is used on this drive.')).toBeTruthy();
  });

  it('shows no program or everything-else figure until the program sizes are in', async () => {
    const { container } = render({ programs, programsMeasured: false });
    const bar = await screen.findByRole('img', { name: /Drive space/ });
    expect(bar.getAttribute('aria-label')).toBe(
      'Drive space: 400 GB used, 100 GB free. Installed programs are still being measured.'
    );
    // Two segments: used and free.
    expect(segment(container, 'programs')).toBeNull();
    expect(width(segment(container, 'other'))).toBeCloseTo(80, 6);
    expect(width(segment(container, 'free'))).toBeCloseTo(20, 6);
    expect(screen.getByText('Installed programs:')).toBeTruthy();
    expect(within(screen.getByText('Installed programs:').closest('li')).getByText('measuring…')).toBeTruthy();
    expect(screen.queryByText('Everything else')).toBeNull();
    expect(screen.queryByText('200 GB')).toBeNull();
  });

  it('shows no number at all, only a placeholder bar, before the disk answers', async () => {
    fetchDiskSpace.mockImplementation(() => new Promise(() => {}));
    const { container } = render({ programs });
    await waitFor(() => expect(fetchDiskSpace).toHaveBeenCalled());
    expect(screen.getByRole('img', { name: 'Reading drive space…' })).toBeTruthy();
    expect(container.querySelectorAll('[data-segment]')).toHaveLength(0);
    expect(screen.queryByText(/ used of /)).toBeNull();
  });

  it('never changes a figure once shown: the program figure appears only when sizes arrive', async () => {
    renderScreen(<Harness initial={{ programs, programsMeasured: false }} />);
    await screen.findByText('400 GB used of 500 GB · 100 GB free');
    const legendBefore = [...screen.getByText('Free').closest('ul').children].map((li) => li.textContent);
    expect(legendBefore).toEqual(['Used400 GB', 'Installed programs:measuring…', 'Free100 GB']);

    act(() => setHarnessProps({ programs, programsMeasured: true }));
    // The summary is exactly what it was; the used and free figures it
    // reported are still true, and the program split now exists beside them.
    expect(screen.getByText('400 GB used of 500 GB · 100 GB free')).toBeTruthy();
    const legendAfter = [...screen.getByText('Free').closest('ul').children].map((li) => li.textContent);
    expect(legendAfter).toContain('Free100 GB');
    expect(legendAfter).toContain('Installed programs200 GB');
  });
});

describe('Largest programs', () => {
  const many = [
    prog('Alpha', 10), prog('Bravo', 60), prog('Charlie', 30), prog('Delta', 5),
    prog('Echo', 45), prog('Foxtrot', 20), prog('Golf', 1), prog('Ext'), prog('Zero', 0)
  ];

  it('lists the five biggest measured programs, biggest first, with sizes', async () => {
    render({ programs: many });
    const list = (await screen.findByRole('heading', { name: 'Largest programs' })).closest('section').querySelector('ul');
    const rows = within(list).getAllByRole('button');
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.textContent)).toEqual([
      'Bravo60 GB', 'Echo45 GB', 'Charlie30 GB', 'Foxtrot20 GB', 'Alpha10 GB'
    ]);
  });

  it('draws each bar relative to the largest', async () => {
    const { container } = render({ programs: many });
    await screen.findByRole('heading', { name: 'Largest programs' });
    const widths = [...container.querySelectorAll('[data-bar="program"]')].map((b) => parseFloat(b.style.width));
    expect(widths[0]).toBe(100);
    expect(widths[1]).toBeCloseTo(75, 6);
    expect(widths[2]).toBeCloseTo(50, 6);
  });

  it('keeps a long name whole in the DOM, truncated only by CSS', async () => {
    const long = 'Microsoft Visual Studio Community 2022 with every optional workload installed';
    render({ programs: [prog(long, 5)] });
    const name = await screen.findByText(long);
    expect(name.className).toContain('truncate');
    expect(name.getAttribute('title')).toBeNull();
  });

  it('shows skeleton rows and no sizes while the program sizes are measured', async () => {
    render({ programs: many, programsMeasured: false });
    const section = (await screen.findByRole('heading', { name: 'Largest programs' })).closest('section');
    expect(section.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(within(section).queryAllByRole('listitem')).toHaveLength(0);
    expect(section.textContent).not.toMatch(/\d+ GB/);
    expect(within(section).queryByText(/installed$/)).toBeNull();
    expect(within(section).getByText('Measuring program sizes…')).toBeTruthy();
  });

  it('says so when nothing has a measured size', async () => {
    render({ programs: [prog('Ext')] });
    expect(await screen.findByText('No program has a measured size yet.')).toBeTruthy();
  });

  it('names the rest: what is not in the program list, and where to see it', async () => {
    render({ programs: [prog('Big', 150), prog('Small', 50)] });
    expect(await screen.findByText(/The other 200 GB is not in the program list\./)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'See it in Disk Map.' })).toBeTruthy();
  });

  it('leaves that sentence out when there is no remainder', async () => {
    render({ programs: [prog('Huge', 450)] });
    await screen.findByRole('heading', { name: 'Largest programs' });
    expect(screen.queryByText(/is not in the program list/)).toBeNull();
  });

  it('counts what is installed in the header, once measured', async () => {
    render({ programs: many });
    expect(await screen.findByText('9 installed')).toBeTruthy();
  });
});

describe('navigation', () => {
  it('opens Applications from a program row and from the header link', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render({ programs: [prog('Big', 150)], onNavigate });
    await user.click(await screen.findByRole('button', { name: /Big/ }));
    expect(onNavigate).toHaveBeenLastCalledWith('applications');
    await user.click(screen.getByRole('button', { name: 'Open Applications' }));
    expect(onNavigate).toHaveBeenCalledTimes(2);
    expect(onNavigate).toHaveBeenLastCalledWith('applications');
  });

  it('opens the Disk Map from "See it in Disk Map."', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render({ programs: [prog('Big', 150)], onNavigate });
    await user.click(await screen.findByRole('button', { name: 'See it in Disk Map.' }));
    expect(onNavigate).toHaveBeenCalledWith('diskmap');
  });

  it('opens Applications from Review when a failed uninstall left something behind', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render({ programs: [prog('Broken', 1, { health: { orphaned: true } })], onNavigate });
    await user.click(await screen.findByRole('button', { name: 'Review' }));
    expect(onNavigate).toHaveBeenCalledWith('applications');
  });
});

describe('Left behind', () => {
  it('says nothing is left behind, and offers no Review, when nothing is', async () => {
    render({ programs: [prog('Fine', 1, { health: {} })] });
    expect(await screen.findByText('Nothing left behind.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Review' })).toBeNull();
  });

  it('counts the programs, singular and plural', async () => {
    renderScreen(<Harness initial={{ programs: [prog('A', 1, { health: { orphaned: true } })], programsMeasured: true }} />);
    expect(await screen.findByText('1 program')).toBeTruthy();
    act(() => setHarnessProps({
      programs: [prog('A', 1, { health: { orphaned: true } }), prog('B', 1, { health: { orphaned: true } })],
      programsMeasured: true
    }));
    expect(await screen.findByText('2 programs')).toBeTruthy();
  });

  it('claims neither a count nor "nothing" before the list has settled', async () => {
    render({ programs: [], programsMeasured: false });
    await screen.findByRole('heading', { name: 'Where is my space going?' });
    expect(screen.queryByText('Nothing left behind.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Review' })).toBeNull();
  });
});

describe('Junk files', () => {
  it('starts as "Not measured" with a Measure button, and does not scan on its own', async () => {
    render();
    expect(await screen.findByText('Not measured')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Measure' })).toBeTruthy();
    expect(streamDeepCleanScan).not.toHaveBeenCalled();
  });

  it('measures on click, shows progress, then the measured total and an Open Deep Clean button', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    let emit;
    let finish;
    streamDeepCleanScan.mockImplementation((onEvent) => new Promise((resolve) => { emit = onEvent; finish = resolve; }));
    render({ onNavigate });

    await user.click(await screen.findByRole('button', { name: 'Measure' }));
    expect(screen.getByRole('button', { name: 'Measure' }).disabled).toBe(true);
    act(() => {
      emit('start', { total: 4 });
      emit('rule', { id: 'a', recommended: true, present: true, accessible: true, sizeBytes: 2 * GB });
      emit('rule', { id: 'b', recommended: true, present: true, accessible: true, sizeBytes: 1 * GB });
    });
    expect(screen.getByText('Measuring… 2 of 4')).toBeTruthy();
    // No running total while it is still counting.
    expect(screen.queryByText('3 GB')).toBeNull();

    await act(async () => { finish(); });
    expect(await screen.findByText('3 GB')).toBeTruthy();
    expect(screen.getByText('Across 2 recommended cleaners')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Measure' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Open Deep Clean' }));
    expect(onNavigate).toHaveBeenCalledWith('deepclean');
  });

  it('names the failure and lets it be tried again', async () => {
    const user = userEvent.setup();
    streamDeepCleanScan.mockRejectedValueOnce(new Error('E_SCAN'));
    render();
    await user.click(await screen.findByRole('button', { name: 'Measure' }));
    expect(await screen.findByText("Couldn't measure junk files: E_SCAN")).toBeTruthy();
    expect(screen.getByText('Not measured')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Measure' }).disabled).toBe(false);
  });
});

describe('Drive health', () => {
  const drive = (over = {}) => ({
    disks: [{
      deviceId: '0', model: 'Test NVMe', mediaType: 'SSD', healthStatus: 'Healthy',
      lifeRemainingPercent: 100, readErrorsUncorrected: 0, writeErrorsUncorrected: 0,
      smart: { mediaErrors: 0 }, ...over
    }]
  });

  it('summarises as a score out of 100 and one line of life left and temperature', async () => {
    fetchDiskHealth.mockResolvedValue(drive({ lifeRemainingPercent: 88, temperatureC: 41 }));
    render();
    expect(await screen.findByText('88 of 100')).toBeTruthy();
    expect(screen.getByText('88% life remaining · 41 °C')).toBeTruthy();
    expect(screen.getByText('Drive health')).toBeTruthy();
    expect(screen.queryByText('System health')).toBeNull();
  });

  it('is not moved by a nearly full disk or a broken app, which are shown on their own', async () => {
    fetchDiskHealth.mockResolvedValue(drive({ lifeRemainingPercent: 88 }));
    fetchDiskSpace.mockResolvedValue({ freeBytes: 10 * GB, totalBytes: 1000 * GB });
    render({ programs: [prog('Broken', 1, { health: { orphaned: true } })] });
    expect(await screen.findByText('88 of 100')).toBeTruthy();
  });

  it('drops a drive that reports media errors into the problem band, whatever its wear', async () => {
    fetchDiskHealth.mockResolvedValue(drive({ smart: { mediaErrors: 2 } }));
    render();
    expect(await screen.findByText('40 of 100')).toBeTruthy();
  });

  it('never shows a score before the drive has answered', async () => {
    fetchDiskHealth.mockImplementation(() => new Promise(() => {}));
    render();
    expect(await screen.findByText('Reading drive health…')).toBeTruthy();
    expect(screen.queryByText(/of 100/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Drive details' })).toBeNull();
  });

  it('does not wait for disk space: the score is the drive alone', async () => {
    fetchDiskSpace.mockImplementation(() => new Promise(() => {}));
    render();
    expect(await screen.findByText('93 of 100')).toBeTruthy();
  });

  it('keeps the detail collapsed until asked, then shows the model, ring and SMART grid', async () => {
    const user = userEvent.setup();
    fetchDiskHealth.mockResolvedValue(drive({
      temperatureC: 40,
      smart: {
        powerOnHours: 10, powerCycles: 5, bytesWritten: 1e12, bytesRead: 2e12,
        availableSparePercent: 99, unsafeShutdowns: 0, mediaErrors: 0, errorLogEntries: 0
      }
    }));
    const { container } = render();
    const toggle = await screen.findByRole('button', { name: 'Drive details' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText(/Test NVMe/)).toBeNull();
    expect(screen.queryByText('Unsafe shutdowns')).toBeNull();

    await user.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById(toggle.getAttribute('aria-controls'))).toBeTruthy();
    expect(screen.getByText('Drive detail')).toBeTruthy();
    expect(screen.getByText(/Test NVMe/)).toBeTruthy();
    expect(screen.getByText('Unsafe shutdowns')).toBeTruthy();
    expect(screen.getByText('/100')).toBeTruthy();
    expect(container.querySelector('svg[width="140"]')).toBeTruthy();

    await user.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText(/Test NVMe/)).toBeNull();
  });

  it('says what Windows reports, and where to unlock wear, when the drive gives no wear figure', async () => {
    const user = userEvent.setup();
    fetchDiskHealth.mockResolvedValue({
      disks: [{ deviceId: '0', model: 'Test NVMe', healthStatus: 'Healthy', lifeRemainingPercent: null }]
    });
    render();
    expect(await screen.findByText('Windows reports this drive Healthy.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Drive details' }));
    expect(screen.getByRole('button', { name: 'Read drive wear (admin)' })).toBeTruthy();
    expect(screen.getByText(/need administrator access/)).toBeTruthy();
  });

  it('replaces the reading with the elevated one after the wear unlock, not a refetch', async () => {
    const user = userEvent.setup();
    fetchDiskHealth.mockResolvedValue({
      disks: [{ deviceId: '0', model: 'Test NVMe', healthStatus: 'Healthy', lifeRemainingPercent: null }]
    });
    unlockDiskWear.mockResolvedValue({
      disks: [{ deviceId: '0', model: 'Test NVMe', healthStatus: 'Healthy', lifeRemainingPercent: 77 }],
      reliabilityAvailable: true
    });
    render();
    await user.click(await screen.findByRole('button', { name: 'Drive details' }));
    await user.click(screen.getByRole('button', { name: 'Read drive wear (admin)' }));
    expect(await screen.findByText('77 of 100')).toBeTruthy();
    expect(fetchDiskHealth).toHaveBeenCalledTimes(1);
  });
});
