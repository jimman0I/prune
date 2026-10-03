// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from './testSupport/renderScreen.jsx';

/** What File Explorer's right-click entries and a dropped program do to the
 * app, mounted the way the app mounts it.
 *
 *   --shred <path>          switches to Deep Clean and hands the path to its
 *                           Shred dialog. Nothing is shredded.
 *   --find-program <path>   switches to Applications, looks the file up, and a
 *                           match opens the ordinary uninstall dialog; no match
 *                           offers Forced uninstall seeded with the name/folder.
 *   a dropped .exe / .lnk   the same find flow.
 *
 * The desktop bridge is a stub that captures the page's listener; the api is
 * mocked and nothing is removed. */

vi.mock('./components/ProgramList.jsx', () => ({
  default: ({ onUninstall }) => <div><button onClick={() => onUninstall({ id: 'thing', name: 'Thing', publisher: 'Acme', uninstallString: '"C:\\Thing\\uninst.exe"', sizeBytes: 1 })}>open single</button></div>
}));
const stub = (name) => () => <div>{name} screen</div>;
vi.mock('./components/Dashboard.jsx', () => ({ default: stub('dashboard') }));
vi.mock('./components/DiskMap.jsx', () => ({ default: stub('diskmap') }));
vi.mock('./components/QuarantineManager.jsx', () => ({ default: stub('quarantine') }));
vi.mock('./components/StartupItems.jsx', () => ({ default: stub('startup') }));
vi.mock('./components/SettingsPage.jsx', () => ({ default: stub('settings') }));
vi.mock('./components/Duplicates.jsx', () => ({ default: stub('duplicates') }));
vi.mock('./components/DeepClean.jsx', () => ({
  default: ({ shredRequest }) => <div data-testid="deepclean">deepclean screen {shredRequest ? JSON.stringify(shredRequest) : 'no request'}</div>
}));

const findProgramByFile = vi.fn();
const streamUninstall = vi.fn();
vi.mock('./lib/api.js', () => ({
  findProgramByFile: (...a) => findProgramByFile(...a),
  streamUninstall: (...a) => streamUninstall(...a),
  removeStoreApp: vi.fn(),
  scanForLeftovers: vi.fn(async () => ({ files: { ok: true, items: [] }, registryKeys: { ok: true, items: [] }, scheduledTasks: { ok: true, items: [] } })),
  scanForcedUninstall: vi.fn(async () => ({})),
  removeQuarantined: vi.fn(async () => ({ files: [], registryKeys: [] })),
  appendHistoryEntry: vi.fn(async () => ({})),
  fetchSettings: vi.fn(async () => ({})),
  updateSettings: vi.fn(async () => ({})),
  fetchUpdateCheck: vi.fn(async () => ({ enabled: false, current: '0.0.0' })),
  fetchCleanerCategoryIcons: vi.fn(async () => ({})),
  fetchStartupItems: vi.fn(async () => []),
  fetchStartupIcons: vi.fn(async () => ({})),
  fetchQuarantineBatches: vi.fn(async () => ({ batches: [] })),
  fetchProgramIcons: vi.fn(async () => ({})),
  fetchPackageIcons: vi.fn(async () => ({})),
  pickPath: vi.fn()
}));

const refresh = vi.fn();
const listed = [{ id: 'thing', name: 'Thing', publisher: 'Acme', uninstallString: '"C:\\Thing\\uninst.exe"', sizeBytes: 1024 }];
vi.mock('./hooks/usePrograms.js', () => ({
  useProgramData: () => ({
    programs: listed, icons: {}, totalSize: 0, extensions: [], running: {},
    loading: false, error: null, refresh: (...a) => refresh(...a)
  })
}));

const App = (await import('./App.jsx')).default;

let deliver;
const stopListening = vi.fn();
const pathForFile = vi.fn((file) => ({ 'coolapp.exe': 'D:\\Portable\\Cool App\\coolapp.exe', 'Thing.lnk': 'C:\\Users\\me\\Desktop\\Thing.lnk' }[file.name] ?? ''));
const request = (kind, path) => act(() => deliver({ kind, path }));
const screenOf = (text) => screen.getByText(text, { exact: false }).closest('.screen');
const isShown = (text) => screenOf(text).style.display !== 'none';
const dragData = (files) => ({ dataTransfer: { types: ['Files'], files, dropEffect: 'none' } });

const mount = () => renderScreen(<App />);

beforeEach(() => {
  vi.clearAllMocks();
  window.pruneWindow = {
    onOpenRequest: vi.fn((cb) => { deliver = cb; return stopListening; }),
    pathForFile: (...a) => pathForFile(...a)
  };
});
afterEach(() => { delete window.pruneWindow; });

describe('Shred with Prune', () => {
  it('switches to Deep Clean and hands the path to it, as a request that has a nonce of its own', async () => {
    mount();
    await waitFor(() => expect(window.pruneWindow.onOpenRequest).toHaveBeenCalledTimes(1));
    request('shred', 'C:\\Users\\me\\old.docx');
    const deepClean = await screen.findByTestId('deepclean');
    expect(deepClean.textContent).toContain('"paths":["C:\\\\Users\\\\me\\\\old.docx"]');
    expect(isShown('deepclean screen')).toBe(true);
    expect(isShown('dashboard screen')).toBe(false);
  });

  it('a second request is a new request even for the same file', async () => {
    mount();
    await waitFor(() => expect(deliver).toBeTypeOf('function'));
    request('shred', 'C:\\a.txt');
    const first = (await screen.findByTestId('deepclean')).textContent;
    request('shred', 'C:\\a.txt');
    await waitFor(() => expect(screen.getByTestId('deepclean').textContent).not.toBe(first));
  });
});

describe('Find in Prune (uninstall)', () => {
  it('switches to Applications and opens the ordinary uninstall dialog for a match', async () => {
    findProgramByFile.mockResolvedValue({ status: 'matched', via: 'program', exePath: 'C:\\Thing\\thing.exe', program: { id: 'thing', name: 'Thing' } });
    mount();
    await waitFor(() => expect(deliver).toBeTypeOf('function'));
    request('find-program', 'C:\\Thing\\thing.exe');
    await screen.findByRole('dialog', { name: /Thing/ });
    expect(findProgramByFile).toHaveBeenCalledWith('C:\\Thing\\thing.exe');
    expect(await screen.findByRole('button', { name: 'Start uninstalling' })).toBeTruthy();
    expect(isShown('Installed')).toBe(true);
    // Looking it up removed nothing.
    expect(streamUninstall).not.toHaveBeenCalled();
  });

  it('offers Forced uninstall seeded with the file\'s name and folder when nothing matches', async () => {
    const user = userEvent.setup();
    findProgramByFile.mockResolvedValue({ status: 'unmatched', exePath: 'D:\\Portable\\Cool App\\coolapp.exe', name: 'coolapp', folder: 'D:\\Portable\\Cool App' });
    mount();
    await waitFor(() => expect(deliver).toBeTypeOf('function'));
    request('find-program', 'D:\\Portable\\Cool App\\coolapp.exe');
    expect(await screen.findByText("coolapp isn't in your list of installed programs.")).toBeTruthy();
    await user.click(screen.getAllByRole('button', { name: 'Forced uninstall…' }).at(-1));
    expect(await screen.findByDisplayValue('coolapp')).toBeTruthy();
    expect(screen.getByDisplayValue('D:\\Portable\\Cool App')).toBeTruthy();
    expect(streamUninstall).not.toHaveBeenCalled();
  });

  it('waits while an uninstall dialog is open, and is never allowed to swap the program being uninstalled', async () => {
    const user = userEvent.setup();
    findProgramByFile.mockResolvedValue({ status: 'windows', exePath: 'C:\\Windows\\x.exe' });
    mount();
    await waitFor(() => expect(deliver).toBeTypeOf('function'));
    fireEvent.keyDown(document.body, { key: '3', ctrlKey: true });
    await user.click(await screen.findByRole('button', { name: 'open single' }));
    await screen.findByRole('button', { name: 'Start uninstalling' });

    request('find-program', 'C:\\Windows\\x.exe');
    await act(async () => { await Promise.resolve(); });
    expect(findProgramByFile).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: /Thing/ })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(findProgramByFile).toHaveBeenCalledWith('C:\\Windows\\x.exe'));
    expect(await screen.findByText(/part of Windows/)).toBeTruthy();
  });
});

describe('a program dropped on Applications', () => {
  it('runs the same find flow with the dropped file\'s real path', async () => {
    findProgramByFile.mockResolvedValue({ status: 'unmatched', exePath: 'D:\\Portable\\Cool App\\coolapp.exe', name: 'coolapp', folder: 'D:\\Portable\\Cool App' });
    mount();
    fireEvent.keyDown(document.body, { key: '3', ctrlKey: true });
    const zone = await screen.findByTestId('program-drop-zone');
    fireEvent.dragEnter(zone, dragData([]));
    expect(screen.getByText('Drop a program or shortcut to find it')).toBeTruthy();
    fireEvent.drop(zone, dragData([{ name: 'coolapp.exe' }]));
    await waitFor(() => expect(findProgramByFile).toHaveBeenCalledWith('D:\\Portable\\Cool App\\coolapp.exe'));
    expect(await screen.findByText("coolapp isn't in your list of installed programs.")).toBeTruthy();
  });

  it('is only on the Applications screen', async () => {
    mount();
    await screen.findByText('dashboard screen');
    expect(screen.queryByTestId('program-drop-zone')).toBeNull();
  });
});

describe('the bridge', () => {
  it('ignores a request that does not check out, and stops listening when the app goes away', async () => {
    const { unmount } = mount();
    await waitFor(() => expect(deliver).toBeTypeOf('function'));
    act(() => deliver({ kind: 'delete', path: 'C:\\a.txt' }));
    act(() => deliver({ kind: 'shred', path: '..\\a.txt' }));
    act(() => deliver(null));
    expect(screen.queryByTestId('deepclean')).toBeNull();
    expect(findProgramByFile).not.toHaveBeenCalled();
    unmount();
    expect(stopListening).toHaveBeenCalled();
  });

  it('the app is fine without a desktop bridge (a browser)', async () => {
    delete window.pruneWindow;
    mount();
    expect(await screen.findByText('dashboard screen')).toBeTruthy();
  });
});
