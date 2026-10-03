// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { screen, waitFor, fireEvent, act, within } from '@testing-library/react';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** The Applications tools open the "find it" dialog for a request: File
 * Explorer's "Find in Prune (uninstall)" and a program dropped on the screen
 * both arrive as `findRequest` ({ path, nonce }).
 *
 * A match hands the program on to the ordinary uninstall dialog; no match
 * opens Forced uninstall seeded with the file's name and folder. And a request
 * never replaces a tools dialog that is in the middle of a scan or a removal:
 * it waits for that to finish. */

const findProgramByFile = vi.fn();
vi.mock('../lib/api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  findProgramByFile: (...a) => findProgramByFile(...a)
}));
// The other tool dialogs are not what is under test; the forced dialog is a
// stand-in that shows what it was seeded with and can report itself busy.
vi.mock('./ForcedUninstallDialog.jsx', () => ({
  default: ({ initialName, initialFolder, onClose, onBusyChange }) => (
    <div role="group" aria-label="forced stand-in">
      <span>forced: {initialName} | {initialFolder}</span>
      <button onClick={() => onBusyChange?.(true)}>start removal</button>
      <button onClick={() => onBusyChange?.(false)}>finish removal</button>
      <button onClick={onClose}>close forced</button>
    </div>
  )
}));
vi.mock('./HunterDialog.jsx', () => ({ default: () => <div>hunter stand-in</div> }));
vi.mock('./InstallMonitorDialog.jsx', () => ({ default: () => <div>monitor stand-in</div> }));

const ApplicationsTools = (await import('./ApplicationsTools.jsx')).default;

const programs = [{ id: 'acme', name: 'Acme Studio' }];
let setRequest;
let handlers;
function Host() {
  const [request, set] = useState(null);
  setRequest = set;
  return <ApplicationsTools programs={programs} findRequest={request} {...handlers} />;
}
const send = (path, nonce) => act(() => setRequest({ path, nonce }));

beforeEach(() => {
  vi.clearAllMocks();
  handlers = { onChanged: vi.fn(), onUninstall: vi.fn() };
});

describe('a find request', () => {
  it('looks the file up in a dialog, and a match goes to the ordinary uninstall dialog', async () => {
    findProgramByFile.mockResolvedValue({ status: 'matched', exePath: 'C:\\Program Files\\Acme\\acme.exe', program: { id: 'acme', name: 'Acme Studio' } });
    renderScreen(<Host />);
    send('C:\\Program Files\\Acme\\acme.exe', 1);
    expect(await screen.findByRole('dialog', { name: 'Find in Prune' })).toBeTruthy();
    await waitFor(() => expect(handlers.onUninstall).toHaveBeenCalledWith(programs[0]));
    expect(findProgramByFile).toHaveBeenCalledWith('C:\\Program Files\\Acme\\acme.exe');
    // The find dialog is gone, handed over.
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('no match: says so, and Forced uninstall opens seeded with the file\'s name and folder', async () => {
    findProgramByFile.mockResolvedValue({ status: 'unmatched', exePath: 'D:\\Portable\\coolapp.exe', name: 'coolapp', folder: 'D:\\Portable' });
    renderScreen(<Host />);
    send('D:\\Portable\\coolapp.exe', 1);
    expect(await screen.findByText("coolapp isn't in your list of installed programs.")).toBeTruthy();
    expect(handlers.onUninstall).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Forced uninstall…' }));
    expect(await screen.findByText('forced: coolapp | D:\\Portable')).toBeTruthy();
  });

  it('closing the find dialog does not refresh the program list: nothing changed', async () => {
    findProgramByFile.mockResolvedValue({ status: 'windows', exePath: 'C:\\Windows\\x.exe' });
    renderScreen(<Host />);
    send('C:\\Windows\\x.exe', 1);
    await screen.findByText(/part of Windows/);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(handlers.onChanged).not.toHaveBeenCalled();
  });

  it('opens when the tools mount with the request already there (the screen had not been opened yet)', async () => {
    findProgramByFile.mockResolvedValue({ status: 'windows', exePath: 'C:\\Windows\\x.exe' });
    renderScreen(<ApplicationsTools programs={programs} findRequest={{ path: 'C:\\Windows\\x.exe', nonce: 5 }} onChanged={vi.fn()} onUninstall={vi.fn()} />);
    expect(await screen.findByRole('dialog', { name: 'Find in Prune' })).toBeTruthy();
    expect(findProgramByFile).toHaveBeenCalledWith('C:\\Windows\\x.exe');
  });

  it('a second request for the same file looks it up again', async () => {
    findProgramByFile.mockResolvedValue({ status: 'windows', exePath: 'C:\\Windows\\x.exe' });
    renderScreen(<Host />);
    send('C:\\Windows\\x.exe', 1);
    await screen.findByText(/part of Windows/);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    send('C:\\Windows\\x.exe', 2);
    await waitFor(() => expect(findProgramByFile).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('dialog', { name: 'Find in Prune' })).toBeTruthy();
  });
});

describe('a request while a tool is busy', () => {
  it('waits for a removal in progress, then looks the file up; the removal is never replaced', async () => {
    findProgramByFile.mockResolvedValue({ status: 'windows', exePath: 'C:\\Windows\\x.exe' });
    renderScreen(<Host />);
    fireEvent.click(screen.getByRole('button', { name: 'Forced uninstall…' }));
    await screen.findByRole('group', { name: 'forced stand-in' });
    fireEvent.click(screen.getByRole('button', { name: 'start removal' }));

    send('C:\\Windows\\x.exe', 1);
    await act(async () => { await Promise.resolve(); });
    expect(findProgramByFile).not.toHaveBeenCalled();
    expect(screen.getByRole('group', { name: 'forced stand-in' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'finish removal' }));
    expect(await screen.findByRole('dialog', { name: 'Find in Prune' })).toBeTruthy();
    expect(findProgramByFile).toHaveBeenCalledTimes(1);
  });

  it('replaces a tools dialog that is only sitting open', async () => {
    findProgramByFile.mockResolvedValue({ status: 'windows', exePath: 'C:\\Windows\\x.exe' });
    renderScreen(<Host />);
    fireEvent.click(screen.getByRole('button', { name: 'Forced uninstall…' }));
    await screen.findByRole('group', { name: 'forced stand-in' });
    send('C:\\Windows\\x.exe', 1);
    expect(await screen.findByRole('dialog', { name: 'Find in Prune' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'forced stand-in' })).toBeNull();
  });
});
