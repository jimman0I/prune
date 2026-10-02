// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import LeftoverReview from './LeftoverReview.jsx';

/** The review, laid out by how sure the scan is. */

const scanResult = {
  files: { ok: true, protected: 2, items: [
    { path: 'D:\\Games\\Own', sizeBytes: 100, confidence: 'certain' },
    { path: 'C:\\ProgramData\\ByName', sizeBytes: 50, confidence: 'likely' },
    { path: 'C:\\ProgramData\\Publisher', sizeBytes: 10, confidence: 'possible' }
  ] },
  registryKeys: { ok: true, items: [{ path: 'HKCU\\Software\\Guess', confidence: 'possible' }] },
  scheduledTasks: { ok: true, items: [] }
};

const show = (props = {}) => renderScreen(
  <LeftoverReview
    scanResult={scanResult} selected={new Set(['files:0', 'files:1'])}
    onToggle={vi.fn()} onConfirm={vi.fn()} onSkip={vi.fn()} {...props}
  />
);

describe('tiers', () => {
  it('lays the review out as Certain, Likely, Possible, in that order', () => {
    const { container } = show();
    const tiers = [...container.querySelectorAll('section[data-tier]')].map((s) => s.getAttribute('data-tier'));
    expect(tiers).toEqual(['certain', 'likely', 'possible']);
    expect(screen.getByRole('heading', { name: 'Certain' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Possible' })).toBeTruthy();
  });

  it('explains each tier', () => {
    show();
    expect(screen.getByText(/Inside the program.s own folder/)).toBeTruthy();
    expect(screen.getByText(/Not ticked; check each one/)).toBeTruthy();
  });

  it('shows certain and likely items open, and keeps the possible ones folded until asked', async () => {
    const user = userEvent.setup();
    show();
    expect(screen.getByText('D:\\Games\\Own')).toBeTruthy();
    expect(screen.getByText('C:\\ProgramData\\ByName')).toBeTruthy();
    expect(screen.queryByText('C:\\ProgramData\\Publisher')).toBeNull();

    const possible = document.querySelector('section[data-tier="possible"]');
    await user.click(within(possible).getAllByRole('button', { name: /Files & folders/ })[0]);
    expect(screen.getByText('C:\\ProgramData\\Publisher')).toBeTruthy();
  });

  it('toggles an item by its place in the scan, whichever tier shows it', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    show({ onToggle });
    const possible = document.querySelector('section[data-tier="possible"]');
    await user.click(within(possible).getAllByRole('button', { name: /Files & folders/ })[0]);
    await user.click(within(possible).getAllByRole('checkbox')[0]);
    expect(onToggle).toHaveBeenCalledWith('files:2');
  });

  it('says how many results were left out to protect Windows and other programs', () => {
    show();
    expect(screen.getByText(/Left out because they belong to Windows or to other installed programs: 2/)).toBeTruthy();
  });

  it('says when the search stopped early', () => {
    show({ scanResult: { ...scanResult, files: { ...scanResult.files, truncated: true } } });
    expect(screen.getByText(/stopped early/)).toBeTruthy();
  });

  it('is the flat list it always was when the scan carries no tiers', () => {
    const plain = {
      files: { ok: true, items: [{ path: 'C:\\x', sizeBytes: 1 }] },
      registryKeys: { ok: true, items: [] }, scheduledTasks: { ok: true, items: [] }
    };
    const { container } = show({ scanResult: plain, selected: new Set() });
    expect(container.querySelector('section[data-tier]')).toBeNull();
    expect(screen.getByText('C:\\x')).toBeTruthy();
  });
});
