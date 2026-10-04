// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within, fireEvent, cleanup } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../hooks/useTheme.jsx';
import { LanguageProvider } from '../i18n/LanguageContext.jsx';
import { ToastProvider } from '../hooks/useToasts.jsx';
import { makeTestClient } from '../testSupport/renderScreen.jsx';
import ToastHost from './ToastHost.jsx';

/** Disk Map, Move to quarantine: the toast that reports it has Undo, which puts
 * the folder back through the Quarantine API. The treemap is mocked as in
 * DiskMap.language.render.test.jsx (recharts measures nothing in jsdom). */
vi.mock('recharts', async () => {
  const { cloneElement } = await import('react');
  return {
    ResponsiveContainer: ({ children }) => children,
    Treemap: ({ data, content }) => (data || []).map((node, i) =>
      cloneElement(content, { key: node.fullPath || node.name || i, ...node, x: 10, y: 10, width: 200, height: 120, depth: 1 })
    )
  };
});

const fetchDiskScan = vi.fn();
const quarantineDiskPath = vi.fn();
const restoreQuarantineBatch = vi.fn();
vi.mock('../lib/api.js', () => ({
  fetchSettings: vi.fn(async () => ({})),
  updateSettings: vi.fn(),
  fetchDiskSpace: vi.fn(async () => null),
  fetchDiskScan: (...a) => fetchDiskScan(...a),
  scanDriveFast: vi.fn(),
  fetchFileTypeIcons: vi.fn(async () => ({})),
  quarantineDiskPath: (...a) => quarantineDiskPath(...a),
  restoreQuarantineBatch: (...a) => restoreQuarantineBatch(...a),
  revealInExplorer: vi.fn()
}));

const DiskMap = (await import('./DiskMap.jsx')).default;

afterEach(cleanup);

const TREE = {
  name: '', type: 'directory', size: 10_000_000,
  children: [
    { name: 'Games', type: 'directory', size: 6_000_000, scanned: true, children: [{ name: 'game.pak', type: 'file', size: 5_000_000, scanned: true }] },
    { name: 'Docs', type: 'directory', size: 2_000_000, scanned: true }
  ]
};

beforeEach(() => {
  vi.clearAllMocks();
  fetchDiskScan.mockResolvedValue(TREE);
  restoreQuarantineBatch.mockResolvedValue({});
});

async function moveGamesToQuarantine() {
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  render(
    <QueryClientProvider client={makeTestClient()}>
      <ThemeProvider>
        <LanguageProvider>
          <ToastProvider>
            <DiskMap />
            <ToastHost />
          </ToastProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
  await user.click(await screen.findByRole('button', { name: 'Walk folders instead' }));
  await screen.findByRole('button', { name: 'Open Games' });
  fireEvent.contextMenu(screen.getByRole('button', { name: 'Open Games' }), { clientX: 40, clientY: 40 });
  await user.click(await screen.findByRole('menuitem', { name: 'Move to quarantine…' }));
  const dialog = await screen.findByRole('dialog', { name: 'Move to quarantine' });
  await user.click(within(dialog).getByRole('button', { name: 'Move to quarantine' }));
  return user;
}

describe('Move to quarantine from the Disk Map', () => {
  it('offers Undo on the toast that says it was moved', async () => {
    quarantineDiskPath.mockResolvedValue({ ok: true, batch: { batchDir: 'C:\\q\\1-diskmap-Games' } });
    await moveGamesToQuarantine();
    expect(await screen.findByText('Moved to quarantine: Games')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
    // The hint that it can be restored by hand is still there too.
    expect(screen.getByText('Restore it from the Quarantine screen.')).toBeTruthy();
  });

  it('puts the folder back, and says so by name', async () => {
    quarantineDiskPath.mockResolvedValue({ ok: true, batch: { batchDir: 'C:\\q\\1-diskmap-Games' } });
    const user = await moveGamesToQuarantine();
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(restoreQuarantineBatch).toHaveBeenCalledWith('C:\\q\\1-diskmap-Games');
    expect(await screen.findByText('Restored Games.')).toBeTruthy();
  });

  it('says so when it is no longer in Quarantine', async () => {
    quarantineDiskPath.mockResolvedValue({ ok: true, batch: { batchDir: 'C:\\q\\1-diskmap-Games' } });
    restoreQuarantineBatch.mockRejectedValue(new Error("ENOENT: no such file or directory, open 'manifest.json'"));
    const user = await moveGamesToQuarantine();
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(await screen.findByText("This is no longer in Quarantine, so it can't be restored.")).toBeTruthy();
  });

  it('has no Undo when the reply names no batch to bring back', async () => {
    quarantineDiskPath.mockResolvedValue({ ok: true });
    await moveGamesToQuarantine();
    expect(await screen.findByText('Moved to quarantine: Games')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });
});
