// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen, cleanup, fireEvent } from '@testing-library/react';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import { DriveRootPrompt } from './DiskMap.jsx';

/** The "Read the whole drive" card must contain its own text: the card caps
 * its width (720px, which fits the 900px minimum window's content column of
 * 900 - 72 nav - 96 padding = 732px), wraps an unbreakable token instead of
 * overflowing, and lets the button row wrap. jsdom has no layout, so the
 * classes that do that are what is asserted. */

vi.mock('../lib/api.js', () => ({
  fetchSettings: vi.fn(async () => ({})),
  updateSettings: vi.fn()
}));

afterEach(cleanup);

function cardOf(el) {
  return el.closest('.glass-panel');
}

describe('the drive-root card', () => {
  it('caps and centres its width and wraps unbreakable text', async () => {
    renderScreen(<DriveRootPrompt path={'C:\\'} onFastScan={() => {}} onCrawl={() => {}} />);

    const card = cardOf(await screen.findByText('Read the whole drive'));
    for (const cls of ['max-w-[720px]', 'mx-auto', 'w-full', 'p-8', 'leading-[1.6]', '[overflow-wrap:anywhere]']) {
      expect(card.classList.contains(cls), cls).toBe(true);
    }
  });

  it('sizes the title and the paragraphs, with no dangling margin on the last one', async () => {
    renderScreen(<DriveRootPrompt path={'C:\\'} onFastScan={() => {}} onCrawl={() => {}} />);

    const title = await screen.findByText('Read the whole drive');
    expect(title.className).toContain('text-[18px]');
    expect(title.className).toContain('font-semibold');
    const paragraphs = cardOf(title).querySelectorAll('p');
    expect(paragraphs).toHaveLength(2);
    for (const p of paragraphs) {
      expect(p.className).toContain('text-[14px]');
      expect(p.className).toContain('text-[color:var(--text-secondary)]');
    }
    expect(paragraphs[0].className).toContain('mb-3');
    expect(paragraphs[1].className).toContain('mb-0');
  });

  it('lets the button row wrap, with a real gap', async () => {
    renderScreen(<DriveRootPrompt path={'C:\\'} onFastScan={() => {}} onCrawl={() => {}} />);

    const row = (await screen.findByRole('button', { name: 'Fast scan (admin)' })).parentElement;
    for (const cls of ['flex', 'flex-wrap', 'gap-3', 'mt-6']) {
      expect(row.classList.contains(cls), cls).toBe(true);
    }
  });

  it('still fires both buttons', async () => {
    const onFastScan = vi.fn();
    const onCrawl = vi.fn();
    renderScreen(<DriveRootPrompt path={'C:\\'} onFastScan={onFastScan} onCrawl={onCrawl} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Fast scan (admin)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Walk folders instead' }));
    expect(onFastScan).toHaveBeenCalledTimes(1);
    expect(onCrawl).toHaveBeenCalledTimes(1);
  });

  it('disables the fast scan and says so while it is reading', async () => {
    renderScreen(<DriveRootPrompt path={'C:\\'} onFastScan={() => {}} fastScanning onCrawl={() => {}} />);

    const button = await screen.findByRole('button', { name: 'Reading the drive…' });
    expect(button.disabled).toBe(true);
  });

  it('names the drive without its trailing backslash', async () => {
    renderScreen(<DriveRootPrompt path={'C:\\'} onFastScan={() => {}} onCrawl={() => {}} />);

    expect(await screen.findByText(/every file on C: in a few seconds/)).toBeTruthy();
  });
});
