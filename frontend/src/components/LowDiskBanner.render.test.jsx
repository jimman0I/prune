// @vitest-environment jsdom
import { useState } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** The Dashboard's low-disk banner: it names the drive and what is left, offers
 * the two places that help, and is absent when nothing is wrong, when the
 * warning is off, or when the reading fails. */

const fetchLowDisk = vi.fn();
const fetchSettings = vi.fn();
vi.mock('../lib/api.js', () => ({
  fetchLowDisk: (...a) => fetchLowDisk(...a),
  fetchSettings: (...a) => fetchSettings(...a),
  updateSettings: vi.fn()
}));

const LowDiskBanner = (await import('./LowDiskBanner.jsx')).default;

const GB = 1024 ** 3;
const lowC = { drive: 'C:', label: 'Windows', freeBytes: 12.4 * GB, totalBytes: 250 * GB, percentFree: 5 };

beforeEach(() => {
  vi.clearAllMocks();
  fetchSettings.mockResolvedValue({ lowDiskWarning: 10 });
  fetchLowDisk.mockResolvedValue({ percent: 10, drives: [lowC] });
});

describe('LowDiskBanner', () => {
  it('names the drive and how much is free', async () => {
    renderScreen(<LowDiskBanner onNavigate={() => {}} />);
    const banner = await screen.findByTestId('low-disk-banner');
    expect(banner.textContent).toContain('Drive C: is running low on space: 12.4 GB free (5%).');
  });

  it('offers Deep Clean and Disk Map, and goes where it says', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    renderScreen(<LowDiskBanner onNavigate={onNavigate} />);
    await user.click(await screen.findByRole('button', { name: 'Open Deep Clean' }));
    expect(onNavigate).toHaveBeenLastCalledWith('deepclean');
    await user.click(screen.getByRole('button', { name: 'Open Disk Map' }));
    expect(onNavigate).toHaveBeenLastCalledWith('diskmap');
  });

  it('says every low drive, one line each, with one set of buttons', async () => {
    fetchLowDisk.mockResolvedValue({
      percent: 10,
      drives: [lowC, { drive: 'D:', label: '', freeBytes: 30 * GB, totalBytes: 500 * GB, percentFree: 6 }]
    });
    renderScreen(<LowDiskBanner onNavigate={() => {}} />);
    const banner = await screen.findByTestId('low-disk-banner');
    await waitFor(() => expect(banner.textContent).toContain('Drive D: is running low on space: 30 GB free (6%).'));
    expect(banner.textContent).toContain('Drive C:');
    expect(screen.getAllByRole('button', { name: 'Open Deep Clean' })).toHaveLength(1);
  });

  it('is announced politely, not as an alert', async () => {
    renderScreen(<LowDiskBanner onNavigate={() => {}} />);
    const banner = await screen.findByTestId('low-disk-banner');
    expect(banner.getAttribute('role')).toBe('status');
  });

  it('is not there when no drive is low', async () => {
    fetchLowDisk.mockResolvedValue({ percent: 10, drives: [] });
    renderScreen(<LowDiskBanner onNavigate={() => {}} />);
    await waitFor(() => expect(fetchLowDisk).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('low-disk-banner')).toBeNull();
  });

  it('is not there when the reading fails', async () => {
    fetchLowDisk.mockRejectedValue(new Error('down'));
    renderScreen(<LowDiskBanner onNavigate={() => {}} />);
    await waitFor(() => expect(fetchLowDisk).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('low-disk-banner')).toBeNull();
  });

  it('does not ask at all while the warning is off in Settings', async () => {
    fetchSettings.mockResolvedValue({ lowDiskWarning: 0 });
    renderScreen(<LowDiskBanner onNavigate={() => {}} />);
    await new Promise((r) => setTimeout(r, 40));
    expect(fetchLowDisk).not.toHaveBeenCalled();
    expect(screen.queryByTestId('low-disk-banner')).toBeNull();
  });

  it('reads the drives again when the Dashboard comes back into view', async () => {
    let setActive;
    function Harness() {
      const [active, set] = useState(true);
      setActive = set;
      return <LowDiskBanner active={active} onNavigate={() => {}} />;
    }
    renderScreen(<Harness />);
    await screen.findByTestId('low-disk-banner');
    expect(fetchLowDisk).toHaveBeenCalledTimes(1);

    act(() => setActive(false));
    expect(fetchLowDisk).toHaveBeenCalledTimes(1);
    fetchLowDisk.mockResolvedValue({ percent: 10, drives: [] });
    act(() => setActive(true));
    await waitFor(() => expect(fetchLowDisk).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByTestId('low-disk-banner')).toBeNull());
  });

  it('writes the warning in the chosen language', async () => {
    fetchSettings.mockResolvedValue({ lowDiskWarning: 10, language: 'de' });
    renderScreen(<LowDiskBanner onNavigate={() => {}} />);
    const banner = await screen.findByTestId('low-disk-banner');
    expect(banner.textContent).toContain('Laufwerk C: hat nur noch wenig freien Speicherplatz: 12.4 GB frei (5 %).');
  });
});
