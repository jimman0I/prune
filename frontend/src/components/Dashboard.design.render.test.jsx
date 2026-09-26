// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** The design rules the Dashboard redesign is held to: one question, one
 * neutral bar, no accent colour and no primary button anywhere on it, a quiet
 * row that is not a row of cards, and the ring and SMART grid kept behind a
 * disclosure.
 *
 * jsdom evaluates no CSS, so layout is asserted as the classes that carry it
 * and colour as the values the components emit; the real stacking at 960px,
 * the measured segment widths and both themes are checked live. */

const fetchDiskSpace = vi.fn();
const fetchDiskHealth = vi.fn();
const fetchUninstallHistory = vi.fn(async () => []);

vi.mock('../lib/api.js', () => ({
  fetchDiskSpace: (...a) => fetchDiskSpace(...a),
  fetchDiskHealth: (...a) => fetchDiskHealth(...a),
  unlockDiskWear: vi.fn(),
  fetchUninstallHistory: (...a) => fetchUninstallHistory(...a),
  fetchAutomation: vi.fn(async () => ({ enabled: false, nextRun: null, missed: 0 })),
  streamDeepCleanScan: vi.fn(() => new Promise(() => {})),
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
const programs = [
  { id: 'a', name: 'Alpha', sizeBytes: 50 * GB },
  { id: 'b', name: 'Bravo', sizeBytes: 20 * GB, health: { orphaned: true } }
];

beforeEach(() => {
  vi.clearAllMocks();
  fetchDiskSpace.mockResolvedValue({ freeBytes: 500 * GB, totalBytes: 1000 * GB });
  fetchDiskHealth.mockResolvedValue(drive());
});

const render = (props = {}) => renderScreen(
  <Dashboard programs={programs} programsMeasured onNavigate={() => {}} {...props} />
);
const ringArc = (container) => container.querySelector('svg[width="140"]').querySelectorAll('circle')[1];
const ringTrack = (container) => container.querySelector('svg[width="140"]').querySelector('circle');
const openDetails = async (user) => user.click(await screen.findByRole('button', { name: 'Drive details' }));

describe('what the Dashboard must not have', () => {
  it('has no primary button: nothing here is the one thing to do', async () => {
    const { container } = render();
    await screen.findByRole('button', { name: 'Measure' });
    expect(container.querySelectorAll('.btn-primary')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Deep Clean' })).toBeNull();
  });

  it('uses no accent colour, glow or gradient anywhere on the page', async () => {
    const user = userEvent.setup();
    const { container } = render();
    await openDetails(user);
    const html = container.innerHTML;
    expect(html).not.toContain('accent-primary');
    expect(html).not.toMatch(/glow/i);
    expect(html).not.toMatch(/gradient/i);
    expect(html).not.toContain('btn-primary');
  });

  it('has none of the old stat-card grid, and no native title tooltips', async () => {
    const { container } = render();
    await screen.findByRole('img', { name: /Drive space/ });
    expect(container.querySelector('.stagger')).toBeNull();
    expect(container.querySelector('.lift')).toBeNull();
    expect(screen.queryByText('Total storage')).toBeNull();
    expect(screen.queryByText('Installed apps')).toBeNull();
    expect(container.querySelectorAll('[title]')).toHaveLength(0);
  });

  it('has no functional text under 11px', async () => {
    const user = userEvent.setup();
    const { container } = render();
    await openDetails(user);
    expect(container.innerHTML).not.toMatch(/text-\[(?:[0-9]|10(?:\.\d+)?)px\]/);
  });
});

describe('the space bar', () => {
  it('is one image with a neutral ramp: bright programs, mid everything else, an empty outline for free', async () => {
    const { container } = render();
    const bar = await screen.findByRole('img', { name: /Drive space/ });
    expect(bar.className).toContain('space-bar');
    expect(bar.className).toContain('border');
    expect(bar.querySelector('.space-bar-programs').style.background).toBe('var(--text-secondary)');
    expect(bar.querySelector('.space-bar-other').style.background).toBe('var(--control-border)');
    expect(bar.querySelector('[data-segment="free"]').style.background).toBe('');
    expect(container.querySelectorAll('[role="img"]')).toHaveLength(1);
  });

  it('sets its figures in tabular numerals', async () => {
    render();
    const legend = (await screen.findByText('Installed programs')).closest('ul');
    for (const li of legend.querySelectorAll('li')) {
      const figure = li.querySelector('span.font-mono');
      if (figure) expect(figure.style.fontVariantNumeric).toBe('tabular-nums');
    }
  });

  it('turns only the free outline amber, and only under 10% free', async () => {
    fetchDiskSpace.mockResolvedValue({ freeBytes: 50 * GB, totalBytes: 1000 * GB }); // 5% free
    render();
    const free = (await screen.findByText('Free')).previousElementSibling;
    expect(free.style.border).toContain('var(--warning)');
  });

  it('keeps the free outline neutral at exactly 10% free', async () => {
    fetchDiskSpace.mockResolvedValue({ freeBytes: 100 * GB, totalBytes: 1000 * GB });
    render();
    const free = (await screen.findByText('Free')).previousElementSibling;
    expect(free.style.border).toContain('var(--control-border)');
  });
});

describe('the quiet row', () => {
  it('is one bordered row with dividers that stacks on narrow windows, not three cards', async () => {
    const { container } = render();
    await screen.findByRole('button', { name: 'Measure' });
    const row = container.querySelector('.min-\\[888px\\]\\:grid-cols-3');
    expect(row).toBeTruthy();
    expect(row.className).toContain('grid-cols-1');
    expect(row.className).toContain('min-[888px]:divide-x');
    expect(row.children).toHaveLength(3);
    for (const cell of row.children) expect(cell.className).not.toContain('glass-panel');
    // One surface holds all three.
    expect(row.parentElement.className).toContain('glass-panel');
  });

  it('gives each of its three items a title and a secondary button at most', async () => {
    const { container } = render();
    await screen.findByRole('button', { name: 'Measure' });
    const row = container.querySelector('.min-\\[888px\\]\\:grid-cols-3');
    const titles = [...row.children].map((c) => c.firstElementChild.textContent);
    expect(titles).toEqual(['Drive health', 'Junk files', 'Left behind']);
    for (const button of row.querySelectorAll('button')) expect(button.className).toContain('btn-ghost');
  });
});

describe('the health ring, now inside Drive details', () => {
  it('shows the score over 100, in the good colour, when it is 75 or more', async () => {
    const user = userEvent.setup();
    const { container } = render();
    await openDetails(user);
    expect(await screen.findByText('/100')).toBeTruthy();
    expect(ringArc(container).getAttribute('stroke')).toBe('var(--success)');
  });

  it('is caution-coloured from 50 to 74, even though the drive verdict itself is fine', async () => {
    // 65% life left: the drive verdict is "success" (above 25%), but the
    // score is 65, so the ring must NOT borrow that green for it.
    const user = userEvent.setup();
    fetchDiskHealth.mockResolvedValue(drive({ lifeRemainingPercent: 65 }));
    const { container } = render();
    await openDetails(user);
    expect(ringArc(container).getAttribute('stroke')).toBe('var(--warning)');
  });

  it('is problem-coloured below 50, and for a drive with media errors whatever its wear', async () => {
    const user = userEvent.setup();
    fetchDiskHealth.mockResolvedValue(drive({ smart: { mediaErrors: 4 } }));
    const { container } = render();
    await openDetails(user);
    expect(ringArc(container).getAttribute('stroke')).toBe('var(--danger)');
  });

  it('draws its empty track from the theme token, so it is visible in light mode', async () => {
    const user = userEvent.setup();
    const { container } = render();
    await openDetails(user);
    expect(ringTrack(container).getAttribute('stroke')).toBe('var(--surface-strong)');
  });

  it('carries no breakdown line: the ring is the drive and nothing else', async () => {
    const user = userEvent.setup();
    render();
    await openDetails(user);
    expect(screen.queryByText(/Storage \d+\/100/)).toBeNull();
    expect(screen.queryByText(/Error check/)).toBeNull();
  });

  it('has no CPU, memory or throughput gauges: Prune is a storage tool', async () => {
    const user = userEvent.setup();
    const { container } = render();
    await openDetails(user);
    expect(screen.queryByText('Right now')).toBeNull();
    expect(screen.queryByText('CPU')).toBeNull();
    expect(screen.queryByText('Memory')).toBeNull();
    expect(container.querySelectorAll('svg[width="64"]')).toHaveLength(0);
  });

  it('lets SMART labels wrap instead of truncating them', async () => {
    const user = userEvent.setup();
    fetchDiskHealth.mockResolvedValue(drive({
      smart: {
        powerOnHours: 10, powerCycles: 5, bytesWritten: 1e12, bytesRead: 2e12,
        availableSparePercent: 99, unsafeShutdowns: 0, mediaErrors: 0, errorLogEntries: 0
      }
    }));
    render();
    await openDetails(user);
    const label = await screen.findByText('Unsafe shutdowns');
    expect(label.className).not.toContain('truncate');
    expect(label.parentElement.parentElement.className).toContain('auto-fit');
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

  it('comes last on the page', async () => {
    const { container } = render();
    const toggle = await screen.findByRole('button', { name: 'Recent activity' });
    const panel = toggle.closest('.glass-panel');
    expect(panel.parentElement.lastElementChild).toBe(panel);
  });
});

describe('the page frame and order', () => {
  it('has a 30px page title like every other screen, then the one question', async () => {
    render();
    const title = await screen.findByRole('heading', { level: 1, name: 'Dashboard' });
    expect(title.className).toContain('text-[30px]');
    const question = screen.getByRole('heading', { level: 2, name: 'Where is my space going?' });
    expect(title.compareDocumentPosition(question) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const largest = screen.getByRole('heading', { name: 'Largest programs' });
    expect(question.compareDocumentPosition(largest) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('sits in the shared Page frame', async () => {
    const { container } = render();
    await screen.findByRole('img', { name: /Drive space/ });
    expect(container.firstElementChild.className).toContain('max-w-[1400px]');
  });

  it('puts the drive detail behind Drive details, closed by default', async () => {
    render();
    const toggle = await screen.findByRole('button', { name: 'Drive details' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Drive detail')).toBeNull();
  });
});

describe('the screen while reading', () => {
  it('does not show the used, free or program figures before disk space arrives', async () => {
    fetchDiskSpace.mockImplementation(() => new Promise(() => {}));
    render();
    expect(await screen.findByText('Reading drive space…')).toBeTruthy();
    expect(screen.queryByText(/ free/)).toBeNull();
    expect(screen.queryByText(/ used of /)).toBeNull();
  });
});
