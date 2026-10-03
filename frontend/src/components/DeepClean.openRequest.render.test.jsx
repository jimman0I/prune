// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useState } from 'react';
import { screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** "Shred with Prune" (File Explorer's right-click menu) lands on Deep Clean as
 * a `shredRequest` prop: the Shred dialog opens with the path filled in, and
 * nothing is shredded. Opened by hand afterwards, the dialog starts empty again:
 * a request seeds one opening, not every later one. */

const fetchDeepCleanRules = vi.fn();
const streamDeepCleanScan = vi.fn();
const streamShred = vi.fn();
const previewShred = vi.fn();

vi.mock('../lib/api.js', () => ({
  fetchDeepCleanRules: (...a) => fetchDeepCleanRules(...a),
  streamDeepCleanScan: (...a) => streamDeepCleanScan(...a),
  streamDeepCleanExecute: vi.fn(),
  streamShred: (...a) => streamShred(...a),
  previewShred: (...a) => previewShred(...a),
  fetchSettings: vi.fn(async () => ({ excludeFolders: [], excludeExtensions: [], hideUnavailableRules: false, skipRecentHours: 24, acknowledgedCleanWarnings: [] })),
  updateSettings: vi.fn(async (p) => p),
  fetchCleanerCategoryIcons: vi.fn(async () => ({})),
  fetchWipeEstimate: vi.fn(),
  fetchStartupItems: vi.fn(), fetchStartupIcons: vi.fn(), setStartupItemEnabled: vi.fn(),
  fetchQuarantineBatches: vi.fn(), restoreQuarantineBatch: vi.fn(),
  deleteQuarantineBatch: vi.fn(), emptyQuarantine: vi.fn(),
  fetchDiskSpace: vi.fn(), fetchDiskHealth: vi.fn()
}));

const DeepClean = (await import('./DeepClean.jsx')).default;

let setRequest;
function Host() {
  const [request, set] = useState(null);
  setRequest = set;
  return <DeepClean shredRequest={request} />;
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchDeepCleanRules.mockResolvedValue([{ category: 'Windows', items: [{ id: 'temp', name: 'Temporary files', sizeBytes: null, fileCount: null }] }]);
  streamDeepCleanScan.mockImplementation(() => () => {});
});

describe('a shred request on Deep Clean', () => {
  it('opens the Shred dialog with the path in the list, and shreds nothing', async () => {
    renderScreen(<Host />);
    await screen.findByText('Temporary files');
    expect(screen.queryByRole('dialog')).toBeNull();

    act(() => setRequest({ paths: ['C:\\Users\\me\\old.docx'], nonce: 1 }));
    expect(await screen.findByRole('dialog', { name: 'Shred files and folders' })).toBeTruthy();
    expect(await screen.findByText('C:\\Users\\me\\old.docx')).toBeTruthy();
    expect(previewShred).not.toHaveBeenCalled();
    expect(streamShred).not.toHaveBeenCalled();
  });

  it('opens when Deep Clean is first mounted with the request already there (the screen was not open yet)', async () => {
    const user = userEvent.setup();
    renderScreen(<DeepClean shredRequest={{ paths: ['D:\\secret.txt'], nonce: 7 }} />);
    expect(await screen.findByText('D:\\secret.txt')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(streamShred).not.toHaveBeenCalled();
  });

  it('starts empty when opened by hand after the request was dealt with', async () => {
    const user = userEvent.setup();
    renderScreen(<Host />);
    await screen.findByText('Temporary files');
    act(() => setRequest({ paths: ['C:\\a.txt'], nonce: 1 }));
    await screen.findByText('C:\\a.txt');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Shred files…' }));
    expect(await screen.findByText('Nothing chosen yet.')).toBeTruthy();
    expect(screen.queryByText('C:\\a.txt')).toBeNull();
  });

  it('a second request opens it again, even for the same path', async () => {
    const user = userEvent.setup();
    renderScreen(<Host />);
    await screen.findByText('Temporary files');
    act(() => setRequest({ paths: ['C:\\a.txt'], nonce: 1 }));
    await screen.findByText('C:\\a.txt');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    act(() => setRequest({ paths: ['C:\\a.txt'], nonce: 2 }));
    expect(await screen.findByText('C:\\a.txt')).toBeTruthy();
    expect(screen.getByRole('dialog', { name: 'Shred files and folders' })).toBeTruthy();
  });
});
