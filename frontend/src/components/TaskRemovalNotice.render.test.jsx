// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import { isCopyable } from '../testSupport/copyable.js';
import TaskRemovalNotice from './TaskRemovalNotice.jsx';

describe('TaskRemovalNotice', () => {
  it('renders nothing when no task was part of the removal', () => {
    const { container } = renderScreen(<TaskRemovalNotice result={undefined} />);
    expect(container.textContent).toBe('');
    const empty = renderScreen(<TaskRemovalNotice result={{ removed: [], failed: [] }} />);
    expect(empty.container.textContent).toBe('');
  });

  it('says how many were removed and where their definitions are kept', () => {
    renderScreen(<TaskRemovalNotice result={{ removed: [{ name: 'A', path: '\\' }, { name: 'B', path: '\\' }], failed: [] }} />);
    expect(screen.getByText(/Scheduled tasks removed: 2/)).toBeTruthy();
    expect(screen.getByText(/saved under Backups/)).toBeTruthy();
  });

  it('names a task that could not be removed, with the reason', () => {
    renderScreen(<TaskRemovalNotice result={{
      removed: [],
      failed: [{ name: 'Updater', path: '\\Acme\\', reason: 'Removing it needs administrator approval, which was declined.', cancelled: true }]
    }} />);
    expect(screen.getByText(/could not be removed: 1/)).toBeTruthy();
    const reason = screen.getByText(/\\Acme\\Updater — Removing it needs administrator approval/);
    expect(isCopyable(reason)).toBe(true);
  });
});
