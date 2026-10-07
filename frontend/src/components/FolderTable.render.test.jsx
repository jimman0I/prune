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

describe('before the folder has been counted', () => {
  it('says it is counting, never that the folder is empty', async () => {
    renderScreen(<FolderTable folderRows={[]} counting onDrillDown={() => {}} />);
    expect((await screen.findByRole('status')).textContent).toMatch(/Counting folders/);
    expect(screen.queryByText(/Nothing to list/)).toBeNull();
  });

  it('says why counting failed and offers to try again', async () => {
    const onRetryCount = vi.fn();
    renderScreen(<FolderTable folderRows={[]} countError="tree too large" onRetryCount={onRetryCount} onDrillDown={() => {}} />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Couldn't count this folder: tree too large/);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetryCount).toHaveBeenCalledTimes(1);
  });

  it('still says the folder is empty once it has been counted and really is', async () => {
    renderScreen(<FolderTable folderRows={[]} onDrillDown={() => {}} />);
    expect(await screen.findByText('Nothing to list inside this folder.')).toBeTruthy();
  });

  it('keeps showing the last rows while a new count runs', async () => {
    renderScreen(<FolderTable folderRows={rows} counting onDrillDown={() => {}} />);
    expect(await screen.findByRole('table')).toBeTruthy();
    expect(screen.queryByText(/Counting folders/)).toBeNull();
  });
});
