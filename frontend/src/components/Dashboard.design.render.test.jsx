// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** The Apple design pass's Dashboard rules: the health ring's colour and
 * "/100", the neutral storage bar, free space as the headline, the
 * collapsible Recent activity header, the single action, and the layout
 * classes that let the screen stack at 900px.
 *
 * jsdom evaluates no CSS, so layout is asserted as the classes that carry
 * it and colour as the stroke values the components emit; the real stacking
 * at a 900px window and the light-mode tracks are checked live. */

const fetchDiskSpace = vi.fn();
const fetchDiskHealth = vi.fn();
const fetchUninstallHistory = vi.fn(async () => []);

vi.mock('../lib/api.js', () => ({
  fetchDiskSpace: (...a) => fetchDiskSpace(...a),
  fetchDiskHealth: (...a) => fetchDiskHealth(...a),
  unlockDiskWear: vi.fn(),
  fetchUninstallHistory: (...a) => fetchUninstallHistory(...a),
  fetchAutomation: vi.fn(async () => ({ enabled: false, nextRun: null, missed: 0 })),
  fetchSettings: vi.fn(async () => ({})),
  updateSettings: vi.fn()
}));

const Dashboard = (await import('./Dashboard.jsx')).default;

const GB = 1024 ** 3;
const drive = (over = {}) => ({
  disks: [{
    deviceId: '0', model: 'Test NVMe', mediaType: 'SSD', healthStatus: 'Healthy',
    lifeRemainingPercent: 100, readErrorsUncorrected: 0, writeErrorsUncorrected: 0,
    smart: { mediaErrors: 0 }, ...over
  }]
});

beforeEach(() => {
  vi.clearAllMocks();
  fetchDiskSpace.mockResolvedValue({ freeBytes: 500 * GB, totalBytes: 1000 * GB });
  fetchDiskHealth.mockResolvedValue(drive());
});

const render = (programs = []) => renderScreen(<Dashboard programs={programs} totalSize={0} onNavigate={() => {}} />);
const ringArc = (container) => container.querySelector('svg[width="140"]').querySelectorAll('circle')[1];
const ringTrack = (container) => container.querySelector('svg[width="140"]').querySelector('circle');

describe('the health ring', () => {
  it('shows the score over 100, in the good colour, when it is 75 or more', async () => {
    const { container } = render();
    // 100% life left, no errors -> 100
    expect(await screen.findByText('100')).toBeTruthy();
    expect(screen.getByText('/100')).toBeTruthy();
    expect(ringArc(container).getAttribute('stroke')).toBe('var(--success)');
  });

  it('is caution-coloured from 50 to 74, even though the drive verdict itself is fine', async () => {
    // 65% life left: the drive verdict is "success" (above 25%), but the
    // score is 65, so the ring must NOT borrow that green for it.
    fetchDiskHealth.mockResolvedValue(drive({ lifeRemainingPercent: 65 }));
    const { container } = render();
    expect(await screen.findByText('65')).toBeTruthy();
    expect(ringArc(container).getAttribute('stroke')).toBe('var(--warning)');
  });

  it('is problem-coloured below 50', async () => {
    fetchDiskHealth.mockResolvedValue(drive({ lifeRemainingPercent: 35 }));
    const { container } = render();
    expect(await screen.findByText('35')).toBeTruthy();
    expect(ringArc(container).getAttribute('stroke')).toBe('var(--danger)');
  });

  it('is problem-coloured for a drive with media errors, even with full wear life', async () => {
    fetchDiskHealth.mockResolvedValue(drive({ smart: { mediaErrors: 4 } }));
    const { container } = render();
    expect(await screen.findByText('40')).toBeTruthy();
    expect(ringArc(container).getAttribute('stroke')).toBe('var(--danger)');
  });

  it('never shows a number, a band or "/100" before the drive has loaded', async () => {
    // The anti-fabrication gate: nothing has been measured, so no
    // healthy-looking figure may appear.
    fetchDiskHealth.mockImplementation(() => new Promise(() => {}));
    const { container } = render();
    expect(await screen.findByText('Reading drive health…')).toBeTruthy();
    expect(screen.queryByText('/100')).toBeNull();
    expect(container.querySelector('svg[width="140"]').querySelectorAll('circle')).toHaveLength(1);
  });

  it('does not wait for disk space: the score is the drive alone', async () => {
    fetchDiskSpace.mockImplementation(() => new Promise(() => {}));
    render();
    expect(await screen.findByText(/Test NVMe/)).toBeTruthy();
    expect(screen.getByText('/100')).toBeTruthy();
  });

  it('draws its empty track from the theme token, so it is visible in light mode', async () => {
    const { container } = render();
    await screen.findByText('/100');
    expect(ringTrack(container).getAttribute('stroke')).toBe('var(--surface-strong)');
  });

  it('carries no breakdown line: the ring is the drive and nothing else', async () => {
    render();
    await screen.findByText('/100');
    expect(screen.queryByText(/Storage \d+\/100/)).toBeNull();
    expect(screen.queryByText(/Error check/)).toBeNull();
  });
});

describe('the Total storage card', () => {
  it('leads with free space, with used and total beneath it', async () => {
    fetchDiskSpace.mockResolvedValue({ freeBytes: 100 * GB, totalBytes: 500 * GB });
    render();
    const headline = await screen.findByText('100 GB');
    expect(headline.parentElement.textContent).toMatch(/^100 GB\s*free$/);
    expect(screen.getByText('400 GB used / 500 GB total')).toBeTruthy();
    // Headline comes first in the card.
    const secondary = screen.getByText('400 GB used / 500 GB total');
    expect(headline.compareDocumentPosition(secondary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps the bar classes the forced-colors rules key on, in a neutral colour', async () => {
    const { container } = render();
    await screen.findByText('/100');
    const fill = container.querySelector('.storage-bar .storage-bar-fill');
    expect(fill).toBeTruthy();
    expect(fill.style.background).toContain('var(--text-secondary)');
    expect(fill.style.background).not.toContain('accent-primary');
  });

  it('goes amber only when free space is under 10%', async () => {
    fetchDiskSpace.mockResolvedValue({ freeBytes: 50 * GB, totalBytes: 1000 * GB }); // 5% free
    const { container } = render();
    await screen.findByText('/100');
    expect(container.querySelector('.storage-bar-fill').style.background).toContain('var(--warning)');
  });

  it('is not red for a nearly full drive, and stays neutral at exactly 10% free', async () => {
    fetchDiskSpace.mockResolvedValue({ freeBytes: 100 * GB, totalBytes: 1000 * GB });
    const { container } = render();
    await screen.findByText('/100');
    expect(container.querySelector('.storage-bar-fill').style.background).toContain('var(--text-secondary)');
  });
});

describe('Recent activity', () => {
  it('is a disclosure: aria-expanded flips, with a chevron and no Hide/Show word', async () => {
    const user = userEvent.setup();
    render();
    const toggle = await screen.findByRole('button', { name: 'Recent activity' });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.queryByText('Hide')).toBeNull();
    expect(screen.queryByText('Show')).toBeNull();
    expect(toggle.querySelector('svg')).toBeTruthy();
    expect(toggle.className).toContain('min-h-[28px]');

    await user.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('No uninstalls yet.')).toBeNull();
    // The chevron turns, not swaps.
    expect(toggle.querySelector('svg').getAttribute('class')).toContain('-rotate-90');
  });
});

describe('the action row', () => {
  it('has Deep clean and nothing else beside it: the rail already has Disk Map and Applications', async () => {
    render();
    await screen.findByText('/100');
    expect(screen.getByRole('button', { name: 'Deep Clean' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Disk Map' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Applications' })).toBeNull();
  });
});

describe('the page frame and layout', () => {
  it('has a 30px heading like every other screen', async () => {
    render();
    const heading = await screen.findByRole('heading', { level: 1, name: 'Dashboard' });
    expect(heading.className).toContain('text-[30px]');
    expect(heading.className).not.toContain('text-[36px]');
  });

  it('sits in the shared Page frame', async () => {
    const { container } = render();
    await screen.findByText('/100');
    expect(container.firstElementChild.className).toContain('max-w-[1400px]');
  });

  it('gives the drive-health panel the whole row, with no live-gauge panel beside it', async () => {
    const { container } = render();
    await screen.findByText('/100');
    const health = container.querySelector('svg[width="140"]').closest('.glass-panel');
    // Alone in its row: nothing shares the wrapper, and no fixed-width column.
    expect(health.parentElement.children).toHaveLength(1);
    expect(container.innerHTML).not.toContain('min-[1100px]:grid-cols-[');
    expect(container.innerHTML).not.toContain('w-[268px]');
  });

  it('has no CPU, memory or throughput gauges: Prune is a storage tool', async () => {
    const { container } = render();
    await screen.findByText('/100');
    expect(screen.queryByText('Right now')).toBeNull();
    expect(screen.queryByText('CPU')).toBeNull();
    expect(screen.queryByText('Memory')).toBeNull();
    expect(container.querySelectorAll('svg[width="64"]')).toHaveLength(0);
  });

  it('lets SMART labels wrap instead of truncating them', async () => {
    fetchDiskHealth.mockResolvedValue(drive({
      smart: {
        powerOnHours: 10, powerCycles: 5, bytesWritten: 1e12, bytesRead: 2e12,
        availableSparePercent: 99, unsafeShutdowns: 0, mediaErrors: 0, errorLogEntries: 0
      }
    }));
    render();
    const label = await screen.findByText('Unsafe shutdowns');
    expect(label.className).not.toContain('truncate');
    expect(label.parentElement.parentElement.className).toContain('auto-fit');
  });
});

describe('the screen while reading', () => {
  it('does not show the free-space headline before disk space arrives', async () => {
    fetchDiskSpace.mockImplementation(() => new Promise(() => {}));
    render();
    await waitFor(() => expect(fetchDiskSpace).toHaveBeenCalled());
    expect(screen.queryByText(/ free$/)).toBeNull();
    expect(await screen.findByText('Loading…')).toBeTruthy();
  });
});
