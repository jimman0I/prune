// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen, cleanup, fireEvent } from '@testing-library/react';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import { DriveRootPrompt } from './DiskMap.jsx';

/** The "Read the whole drive" chooser: two options side by side, aligned
 * with the page rather than centred in it, stacking on a narrow window.
 * jsdom has no layout, so the classes that do that are what is asserted. */

vi.mock('../lib/api.js', () => ({
  fetchSettings: vi.fn(async () => ({})),
  updateSettings: vi.fn()
}));

afterEach(cleanup);

const render = (props = {}) =>
  renderScreen(<DriveRootPrompt path={'C:\\'} onFastScan={() => {}} onCrawl={() => {}} {...props} />);

describe('the drive-root chooser', () => {
  it('is left-aligned and capped, not a centred card, and wraps unbreakable text', async () => {
    render();
    const section = (await screen.findByText('Read the whole drive')).closest('section');
    for (const cls of ['w-full', 'max-w-[860px]', '[overflow-wrap:anywhere]']) {
      expect(section.classList.contains(cls), cls).toBe(true);
    }
    expect(section.classList.contains('mx-auto')).toBe(false);
  });

  it('lays the two options out side by side and stacks them when narrow', async () => {
    render();
    const grid = (await screen.findByRole('heading', { level: 3, name: 'Fast scan' })).closest('.grid');
    expect(grid.className).toContain('grid-cols-1');
    expect(grid.className).toContain('min-[640px]:grid-cols-2');
    expect(grid.querySelectorAll('h3')).toHaveLength(2);
  });

  it('marks the fast scan as recommended and says what it costs', async () => {
    render();
    expect(await screen.findByText('Recommended')).toBeTruthy();
    expect(screen.getByText(/Needs administrator approval/)).toBeTruthy();
    expect(screen.getByText(/cannot finish a whole drive/)).toBeTruthy();
  });

  it('names the drive without its trailing backslash', async () => {
    render();
    expect(await screen.findByText(/every file on C: in a few seconds/)).toBeTruthy();
  });

  it('still fires both buttons', async () => {
    const onFastScan = vi.fn();
    const onCrawl = vi.fn();
    render({ onFastScan, onCrawl });

    fireEvent.click(await screen.findByRole('button', { name: 'Fast scan (admin)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Walk folders instead' }));
    expect(onFastScan).toHaveBeenCalledTimes(1);
    expect(onCrawl).toHaveBeenCalledTimes(1);
  });

  it('disables the fast scan and says so while it is reading', async () => {
    render({ fastScanning: true });
    const button = await screen.findByRole('button', { name: 'Reading the drive…' });
    expect(button.disabled).toBe(true);
  });
});

describe('the recommended option', () => {
  it('says so in words and a neutral border, not in the accent colour', async () => {
    const { container } = render();
    await screen.findByText('Read the whole drive');
    expect(container.innerHTML).not.toContain('var(--accent-primary)');
  });
});
