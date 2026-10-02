// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import { FolderTable } from './FolderTable.jsx';

vi.mock('../lib/api.js', () => ({ fetchSettings: vi.fn(async () => ({})), updateSettings: vi.fn() }));

afterEach(cleanup);

const row = (over) => ({
  name: 'x', fullPath: 'C:\\x', type: 'directory', size: 0, allocated: null, hardLink: false,
  percentOfParent: 0, modified: null, scanned: true, items: 1, files: 1, folders: 0, ...over
});

const rows = [
  row({ name: 'small', size: 1024, allocated: 4096 }),
  row({ name: 'sparse.vhdx', type: 'file', size: 800 * 1024 ** 2, allocated: 4 * 1024 ** 2 })
];

describe('the folder table\'s size columns', () => {
  it('shows Size and Allocated side by side when the scan measured both', async () => {
    renderScreen(<FolderTable folderRows={rows} onDrillDown={() => {}} />);
    const table = await screen.findByRole('table');
    const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toContain('Size');
    expect(headers).toContain('Allocated');
    const sparse = within(table).getByText('sparse.vhdx').closest('[role="row"]');
    expect(sparse.textContent).toMatch(/800 MB/);
    expect(sparse.textContent).toMatch(/4 MB/);
  });

  it('leaves the Allocated column out for a scan that never measured it', async () => {
    renderScreen(<FolderTable folderRows={rows.map((r) => ({ ...r, allocated: null }))} onDrillDown={() => {}} />);
    const table = await screen.findByRole('table');
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).not.toContain('Allocated');
  });

  it('sorts by allocated size, largest first on the first click', async () => {
    const user = userEvent.setup();
    renderScreen(<FolderTable folderRows={rows} onDrillDown={() => {}} />);
    const table = await screen.findByRole('table');
    await user.click(within(table).getByRole('button', { name: 'Allocated' }));
    const names = within(table).getAllByRole('row').slice(1).map((r) => r.textContent);
    expect(names[0]).toMatch(/sparse/); // 4 MB on disk outranks 4 KB, though its size is the headline
  });

  it('scrolls sideways rather than clipping a column', async () => {
    renderScreen(<FolderTable folderRows={rows} onDrillDown={() => {}} />);
    const table = await screen.findByRole('table');
    expect(table.className).toContain('overflow-x-auto');
    expect(table.className).not.toContain('overflow-hidden');
  });
});
