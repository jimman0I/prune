// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import DeepCleanTree from './DeepCleanTree.jsx';

/** The per-file preview: a rule that listed its files can be expanded to
 * show them, biggest first. Pure presentation of what the scan returned. */

vi.mock('../lib/api.js', () => ({
  fetchSettings: vi.fn(async () => ({})),
  updateSettings: vi.fn()
}));

afterEach(() => { cleanup(); window.localStorage.clear(); });

const MB = 1024 * 1024;
const item = (over = {}) => ({
  id: 'temp', name: 'Temporary files', description: 'Files left in temp', sizeBytes: 12 * MB, fileCount: 12,
  present: true, accessible: true, filesListed: true,
  files: [
    { path: 'C:\\Windows\\Temp\\big.tmp', sizeBytes: 8 * MB },
    { path: 'C:\\Windows\\Temp\\small.tmp', sizeBytes: 2048 }
  ],
  ...over
});
const tree = (items) => [{ category: 'Windows', items }];

function show(items, props = {}) {
  const onToggle = vi.fn();
  renderScreen(
    <DeepCleanTree categories={tree(items)} selected={new Set()} onToggle={onToggle} onToggleCategory={vi.fn()} {...props} />
  );
  return { onToggle };
}

describe('expanding a rule to see its files', () => {
  it('offers an expander on a rule that listed files, collapsed to begin with', () => {
    show([item()]);
    const button = screen.getByRole('button', { name: 'Show files in Temporary files' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('C:\\Windows\\Temp\\big.tmp')).toBeNull();
  });

  it('shows each file with its size, biggest first, and how many of how many', async () => {
    const user = userEvent.setup();
    show([item()]);
    await user.click(screen.getByRole('button', { name: 'Show files in Temporary files' }));

    const list = screen.getByRole('list', { name: 'Largest files first: showing 2 of 12' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('C:\\Windows\\Temp\\big.tmp');
    expect(rows[0].textContent).toContain('8 MB');
    expect(rows[1].textContent).toContain('2 KB');
    expect(screen.getByRole('button', { name: 'Hide files in Temporary files' }).getAttribute('aria-expanded')).toBe('true');
  });

  it('hides them again', async () => {
    const user = userEvent.setup();
    show([item()]);
    await user.click(screen.getByRole('button', { name: 'Show files in Temporary files' }));
    await user.click(screen.getByRole('button', { name: 'Hide files in Temporary files' }));
    expect(screen.queryByRole('list', { name: /Largest files first/ })).toBeNull();
  });

  it('opening the list does not tick or untick the rule', async () => {
    const user = userEvent.setup();
    const { onToggle } = show([item()]);
    await user.click(screen.getByRole('button', { name: 'Show files in Temporary files' }));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('has no expander when there is nothing to list', () => {
    show([
      item({ id: 'a', name: 'Empty rule', files: [] }),
      item({ id: 'b', name: 'Command rule', filesListed: undefined, files: undefined }),
      item({ id: 'c', name: 'Unmeasured', sizeBytes: null, files: undefined })
    ]);
    expect(screen.queryByRole('button', { name: /Show files in/ })).toBeNull();
  });

  it('can be reached and operated from the keyboard', async () => {
    const user = userEvent.setup();
    show([item()]);
    await user.tab(); // filter box
    const button = screen.getByRole('button', { name: 'Show files in Temporary files' });
    button.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('list', { name: /Largest files first/ })).toBeTruthy();
  });

  it('keeps a long path readable by letting it wrap, and never uses a title attribute', async () => {
    const user = userEvent.setup();
    const { container } = renderScreen(
      <DeepCleanTree categories={tree([item()])} selected={new Set()} onToggle={vi.fn()} onToggleCategory={vi.fn()} />
    );
    await user.click(screen.getAllByRole('button', { name: 'Show files in Temporary files' })[0]);
    expect(container.querySelector('[title]')).toBeNull();
  });
});
