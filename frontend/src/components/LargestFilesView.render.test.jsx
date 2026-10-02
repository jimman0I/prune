// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import { LargestFilesView } from './LargestFilesView.jsx';

vi.mock('../lib/api.js', () => ({ fetchSettings: vi.fn(async () => ({})), updateSettings: vi.fn() }));

afterEach(cleanup);

const files = [
  { name: 'huge.iso', size: 9000, modified: Date.UTC(2020, 0, 5, 12), fullPath: 'D:\\huge.iso' },
  { name: 'new.log', size: 500, modified: Date.UTC(2026, 5, 20, 12), fullPath: 'D:\\new.log' },
  { name: 'undated.bin', size: 100, modified: null, fullPath: 'D:\\undated.bin' }
];

const order = () => screen.getAllByText(/^D:\\/).map((n) => n.textContent);

describe('the File view\'s dates and sorting', () => {
  it('shows when each file was last written, and a dash where that is unknown', async () => {
    renderScreen(<LargestFilesView files={files} icons={{}} />);
    await screen.findByText('huge.iso');
    const cells = screen.getAllByTestId('file-modified').map((c) => c.textContent);
    expect(cells[0]).toBe(new Date(files[0].modified).toLocaleDateString());
    expect(cells[2]).toBe('—');
  });

  it('lists the largest first, as it always did', async () => {
    renderScreen(<LargestFilesView files={files} icons={{}} />);
    await screen.findByText('huge.iso');
    expect(order()).toEqual(['D:\\huge.iso', 'D:\\new.log', 'D:\\undated.bin']);
  });

  it('re-orders by modified date, newest first, with undated files last', async () => {
    const user = userEvent.setup();
    renderScreen(<LargestFilesView files={files} icons={{}} />);
    const group = await screen.findByRole('group', { name: 'Sort by' });
    await user.click(within(group).getByRole('button', { name: 'Modified' }));
    expect(order()).toEqual(['D:\\new.log', 'D:\\huge.iso', 'D:\\undated.bin']);
    expect(within(group).getByRole('button', { name: 'Modified' }).getAttribute('aria-pressed')).toBe('true');

    await user.click(within(group).getByRole('button', { name: 'Modified' }));
    expect(order()).toEqual(['D:\\huge.iso', 'D:\\new.log', 'D:\\undated.bin']);
  });

  it('re-orders by name, A to Z first', async () => {
    const user = userEvent.setup();
    renderScreen(<LargestFilesView files={files} icons={{}} />);
    await user.click(await screen.findByRole('button', { name: 'Name' }));
    expect(order()).toEqual(['D:\\huge.iso', 'D:\\new.log', 'D:\\undated.bin']);
    await user.click(screen.getByRole('button', { name: 'Name' }));
    expect(order()).toEqual(['D:\\undated.bin', 'D:\\new.log', 'D:\\huge.iso']);
  });
});
