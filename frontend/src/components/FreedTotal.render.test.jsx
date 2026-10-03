// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useState } from 'react';
import { screen, waitFor, act } from '@testing-library/react';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** The quiet "Prune has freed X since <date>" line under Clean recommended.
 * It says something only when there is something true to say: a total of zero,
 * or a total that could not be read, shows nothing at all. */

const fetchStats = vi.fn();
vi.mock('../lib/api.js', () => ({
  fetchStats: (...a) => fetchStats(...a),
  fetchSettings: vi.fn(async () => ({})), updateSettings: vi.fn()
}));

const FreedTotal = (await import('./FreedTotal.jsx')).default;

const GB = 1024 ** 3;
const SINCE = new Date(2026, 2, 5, 12, 0, 0).getTime();

beforeEach(() => vi.clearAllMocks());

describe('FreedTotal', () => {
  it('says how much has been freed, and since when', async () => {
    fetchStats.mockResolvedValue({ freedBytes: 12.4 * GB, since: SINCE });
    renderScreen(<FreedTotal />);
    const date = new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(SINCE);
    expect((await screen.findByTestId('freed-total')).textContent).toContain(`Prune has freed 12.4 GB since ${date}`);
  });

  it('says plainly that moves to Quarantine count only once it is emptied', async () => {
    fetchStats.mockResolvedValue({ freedBytes: GB, since: SINCE });
    renderScreen(<FreedTotal />);
    expect((await screen.findByTestId('freed-total')).textContent).toContain('Files moved to Quarantine count once you empty it.');
  });

  it('shows nothing before anything was freed', async () => {
    fetchStats.mockResolvedValue({ freedBytes: 0, since: null });
    renderScreen(<FreedTotal />);
    await waitFor(() => expect(fetchStats).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('freed-total')).toBeNull();
  });

  it('shows nothing when the total cannot be read', async () => {
    fetchStats.mockRejectedValue(new Error('down'));
    renderScreen(<FreedTotal />);
    await waitFor(() => expect(fetchStats).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('freed-total')).toBeNull();
  });

  it('leaves the date out rather than invent one', async () => {
    fetchStats.mockResolvedValue({ freedBytes: GB, since: null });
    renderScreen(<FreedTotal />);
    expect((await screen.findByTestId('freed-total')).textContent).toContain('Prune has freed 1 GB.');
  });

  it('asks again when the Dashboard comes back into view, and not before', async () => {
    fetchStats.mockResolvedValue({ freedBytes: GB, since: SINCE });
    let setActive;
    function Harness() {
      const [active, set] = useState(true);
      setActive = set;
      return <FreedTotal active={active} />;
    }
    renderScreen(<Harness />);
    await screen.findByTestId('freed-total');
    expect(fetchStats).toHaveBeenCalledTimes(1);

    // Leaving the screen asks nothing.
    fetchStats.mockResolvedValue({ freedBytes: 3 * GB, since: SINCE });
    act(() => setActive(false));
    expect(fetchStats).toHaveBeenCalledTimes(1);

    // Coming back reads the total again, and shows the new one.
    act(() => setActive(true));
    await waitFor(() => expect(fetchStats).toHaveBeenCalledTimes(2));
    expect((await screen.findByTestId('freed-total')).textContent).toContain('Prune has freed 3 GB');
  });

  it('writes the sentence and the date in the chosen language', async () => {
    const api = await import('../lib/api.js');
    api.fetchSettings.mockResolvedValue({ language: 'de' });
    fetchStats.mockResolvedValue({ freedBytes: 12.4 * GB, since: SINCE });
    renderScreen(<FreedTotal />);
    const date = new Intl.DateTimeFormat('de', { dateStyle: 'medium' }).format(SINCE);
    expect((await screen.findByTestId('freed-total')).textContent).toContain(`Prune hat seit ${date} 12.4 GB freigegeben`);
  });
});
