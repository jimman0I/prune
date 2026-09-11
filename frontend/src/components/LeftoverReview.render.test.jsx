// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import { isCopyable } from '../testSupport/copyable.js';
import LeftoverReview from './LeftoverReview.jsx';

/** The review says where the ticked leftovers will go, before the click
 * that sends them there. "Remove selected" meant Quarantine when that was
 * the only place anything went. With the Recycle Bin and permanent
 * deletion now possible, the button alone no longer says what it does. */

const scanResult = {
  files: { ok: true, items: [{ path: 'C:\\Users\\jim\\AppData\\Roaming\\Thing', sizeBytes: 2048 }] },
  registryKeys: { ok: true, items: [{ path: 'HKCU\\Software\\Thing' }] },
  scheduledTasks: { ok: true, items: [] }
};
const selected = new Set(['files:0', 'registryKeys:0']);

const show = (props = {}) => renderScreen(
  <LeftoverReview scanResult={scanResult} selected={selected} onToggle={vi.fn()} onConfirm={vi.fn()} onSkip={vi.fn()} {...props} />
);

describe('what can be copied', () => {
  // Text selection is off across the app. A leftover's path stays on: it
  // is what somebody pastes into Explorer to look before removing it.
  it('each leftover path, file or registry key', () => {
    show();
    expect(isCopyable(screen.getByText('C:\\Users\\jim\\AppData\\Roaming\\Thing'))).toBe(true);
    expect(isCopyable(screen.getByText('HKCU\\Software\\Thing'))).toBe(true);
    expect(isCopyable(screen.getByRole('button', { name: 'Remove selected' }))).toBe(false);
  });
});

describe('where the leftovers go', () => {
  it('says Quarantine, and can be restored, by default', () => {
    show();
    expect(screen.getByText(/go to Quarantine/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove selected' })).toBeTruthy();
  });

  it('says the Recycle Bin, and that registry keys are still backed up', () => {
    show({ destination: 'recycle' });
    expect(screen.getByText(/Recycle Bin/)).toBeTruthy();
    expect(screen.getByText(/registry keys are backed up/i)).toBeTruthy();
  });

  it('says permanent deletion cannot be undone, and the button says so too', () => {
    show({ destination: 'permanent' });
    expect(screen.getByText(/deleted permanently/i)).toBeTruthy();
    expect(screen.getByText(/can.t be restored/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete permanently' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove selected' })).toBeNull();
  });

  it('falls back to Quarantine wording for a destination it does not know', () => {
    show({ destination: 'shred' });
    expect(screen.getByText(/go to Quarantine/i)).toBeTruthy();
  });
});

describe('excluded folders', () => {
  it('says how many folders were left out because of the exclusions', () => {
    renderScreen(
      <LeftoverReview
        scanResult={{ ...scanResult, files: { ...scanResult.files, excluded: 2 } }}
        selected={selected} onToggle={vi.fn()} onConfirm={vi.fn()} onSkip={vi.fn()}
      />
    );
    expect(screen.getByText(/2 folders left out because they.re in your exclusions/i)).toBeTruthy();
  });

  it('says nothing when none were', () => {
    show();
    expect(screen.queryByText(/left out because/i)).toBeNull();
  });
});
