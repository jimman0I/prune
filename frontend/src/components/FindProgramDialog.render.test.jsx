// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** "Find in Prune (uninstall)": a program or shortcut path goes in, and one of
 * four things comes out. A match hands the program to the ordinary uninstall
 * dialog straight away (that dialog asks before it removes anything); no match
 * offers Forced uninstall seeded with the file's name and folder; a Windows file
 * and an unreadable shortcut say so and offer nothing. The dialog only looks. */

const findProgramByFile = vi.fn();
vi.mock('../lib/api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  findProgramByFile: (...a) => findProgramByFile(...a)
}));

const FindProgramDialog = (await import('./FindProgramDialog.jsx')).default;

const PATH = 'D:\\Portable\\Cool App\\coolapp.exe';
const listed = [{ id: 'acme', name: 'Acme Studio', sizeBytes: 5 }];
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

function open(over = {}) {
  const props = { path: PATH, programs: listed, onClose: vi.fn(), onBusyChange: vi.fn(), onUninstall: vi.fn(), onForced: vi.fn(), ...over };
  return { props, ...renderScreen(<FindProgramDialog {...props} />) };
}

beforeEach(() => { vi.clearAllMocks(); });

describe('looking it up', () => {
  it('asks the backend about exactly the path it was given, says it is looking, and is busy meanwhile', async () => {
    const run = deferred();
    findProgramByFile.mockReturnValue(run.promise);
    const { props } = open();
    expect(await screen.findByText('Looking for the program…')).toBeTruthy();
    expect(screen.getByText(PATH)).toBeTruthy();
    expect(findProgramByFile).toHaveBeenCalledTimes(1);
    expect(findProgramByFile).toHaveBeenCalledWith(PATH);
    await waitFor(() => expect(props.onBusyChange).toHaveBeenLastCalledWith(true));
    run.resolve({ status: 'unmatched', exePath: PATH, name: 'coolapp', folder: 'D:\\Portable\\Cool App' });
    await waitFor(() => expect(props.onBusyChange).toHaveBeenLastCalledWith(false));
  });

  it('looks up once', async () => {
    findProgramByFile.mockResolvedValue({ status: 'windows', exePath: PATH });
    open();
    await screen.findByText(/part of Windows/);
    expect(findProgramByFile).toHaveBeenCalledTimes(1);
  });
});

describe('a match', () => {
  it('opens the ordinary uninstall dialog for the program, using the list\'s own copy of it', async () => {
    findProgramByFile.mockResolvedValue({ status: 'matched', via: 'program', exePath: PATH, program: { id: 'acme', name: 'Acme Studio' } });
    const { props } = open();
    await waitFor(() => expect(props.onUninstall).toHaveBeenCalledTimes(1));
    expect(props.onUninstall).toHaveBeenCalledWith(listed[0]);
    expect(props.onForced).not.toHaveBeenCalled();
  });

  it('falls back to the backend\'s copy when the program is not in the list yet', async () => {
    const found = { id: 'late', name: 'Late Program' };
    findProgramByFile.mockResolvedValue({ status: 'matched', exePath: PATH, program: found });
    const { props } = open();
    await waitFor(() => expect(props.onUninstall).toHaveBeenCalledWith(found));
  });

  it('removes nothing by itself: it only hands the program on', async () => {
    findProgramByFile.mockResolvedValue({ status: 'matched', exePath: PATH, program: { id: 'acme', name: 'Acme Studio' } });
    const { props } = open();
    await waitFor(() => expect(props.onUninstall).toHaveBeenCalled());
    expect(findProgramByFile).toHaveBeenCalledTimes(1);
  });
});

describe('no match', () => {
  const unmatched = { status: 'unmatched', via: 'program', exePath: PATH, name: 'coolapp', folder: 'D:\\Portable\\Cool App' };

  it('says so by the file\'s name and offers Forced uninstall, seeded with the name and folder', async () => {
    findProgramByFile.mockResolvedValue(unmatched);
    const { props } = open();
    expect(await screen.findByText("coolapp isn't in your list of installed programs.")).toBeTruthy();
    expect(screen.getByText(/Forced uninstall can look for what it left behind/)).toBeTruthy();
    expect(props.onUninstall).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Forced uninstall…' }));
    expect(props.onForced).toHaveBeenCalledWith({ name: 'coolapp', folder: 'D:\\Portable\\Cool App' });
  });

  it('Close closes, and starts nothing', async () => {
    findProgramByFile.mockResolvedValue(unmatched);
    const { props } = open();
    await screen.findByText(/isn't in your list/);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onForced).not.toHaveBeenCalled();
  });
});

describe('nothing to offer', () => {
  it('a file that is part of Windows: says so, and offers no uninstall of any kind', async () => {
    findProgramByFile.mockResolvedValue({ status: 'windows', exePath: 'C:\\Windows\\System32\\calc.exe' });
    open({ path: 'C:\\Windows\\System32\\calc.exe' });
    expect(await screen.findByText("That file is part of Windows, so Prune won't offer to uninstall it.")).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Forced uninstall…' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Uninstall' })).toBeNull();
  });

  it('a file that is gone', async () => {
    findProgramByFile.mockResolvedValue({ status: 'unresolved', reason: 'missing' });
    open();
    expect(await screen.findByText("That file isn't there any more.")).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Forced uninstall…' })).toBeNull();
  });

  it('a shortcut whose program cannot be told, for either reason', async () => {
    for (const reason of ['noTarget', 'notProgram']) {
      findProgramByFile.mockResolvedValue({ status: 'unresolved', reason });
      const { unmount } = open({ path: 'C:\\Users\\me\\Desktop\\Thing.lnk' });
      expect(await screen.findByText("Prune couldn't tell which program this shortcut opens.")).toBeTruthy();
      unmount();
    }
  });

  it('a lookup that failed: says why, with the reason, and offers nothing', async () => {
    findProgramByFile.mockRejectedValue(new Error('Only a program (.exe) or a shortcut (.lnk) can be looked up.'));
    open();
    expect(await screen.findByText(/Prune couldn't look that up: Only a program \(\.exe\) or a shortcut \(\.lnk\) can be looked up\./)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Forced uninstall…' })).toBeNull();
  });
});

describe('closing while it looks', () => {
  it('Close is unavailable while the lookup runs, and an answer that comes after unmounting does nothing', async () => {
    const run = deferred();
    findProgramByFile.mockReturnValue(run.promise);
    const { props, unmount } = open();
    await screen.findByText('Looking for the program…');
    expect(screen.getByRole('button', { name: 'Close' }).disabled).toBe(true);
    unmount();
    run.resolve({ status: 'matched', exePath: PATH, program: { id: 'acme', name: 'Acme Studio' } });
    await Promise.resolve();
    await Promise.resolve();
    expect(props.onUninstall).not.toHaveBeenCalled();
  });
});

describe('the markup', () => {
  it('has no native hover text', async () => {
    findProgramByFile.mockResolvedValue({ status: 'windows', exePath: PATH });
    const { container } = open();
    await screen.findByText(/part of Windows/);
    expect(container.querySelectorAll('[title]')).toHaveLength(0);
  });
});
