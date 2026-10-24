// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

const api = {
  pickPath: vi.fn(), startInstallMonitor: vi.fn(), fetchInstallMonitor: vi.fn(), finishInstallMonitor: vi.fn(),
  cancelInstallMonitor: vi.fn(), deleteInstallTrace: vi.fn(), fetchInstallTraces: vi.fn(), fetchSettings: vi.fn(),
  exportInstallTraces: vi.fn(), importInstallTraces: vi.fn()
};
vi.mock('../lib/api.js', () => ({
  pickPath: (...a) => api.pickPath(...a),
  startInstallMonitor: (...a) => api.startInstallMonitor(...a),
  fetchInstallMonitor: (...a) => api.fetchInstallMonitor(...a),
  finishInstallMonitor: (...a) => api.finishInstallMonitor(...a),
  cancelInstallMonitor: (...a) => api.cancelInstallMonitor(...a),
  deleteInstallTrace: (...a) => api.deleteInstallTrace(...a),
  fetchInstallTraces: (...a) => api.fetchInstallTraces(...a),
  fetchSettings: (...a) => api.fetchSettings(...a),
  exportInstallTraces: (...a) => api.exportInstallTraces(...a),
  importInstallTraces: (...a) => api.importInstallTraces(...a),
  updateSettings: vi.fn(async (p) => p)
}));
const saveBlob = vi.fn();
vi.mock('../lib/download.js', () => ({ saveBlob: (...a) => saveBlob(...a) }));
const toasts = vi.hoisted(() => ({ success: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
vi.mock('../hooks/useToasts.jsx', async (importOriginal) => ({ ...(await importOriginal()), useToasts: () => toasts }));

const InstallMonitorDialog = (await import('./InstallMonitorDialog.jsx')).default;

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchSettings.mockResolvedValue({});
  api.fetchInstallTraces.mockResolvedValue([]);
  api.fetchInstallMonitor.mockResolvedValue({ state: 'idle' });
});

describe('the install monitor dialog', () => {
  it('cannot start without an installer, and takes the path from Browse', async () => {
    api.pickPath.mockResolvedValue({ path: 'C:\\dl\\setup.exe' });
    const user = userEvent.setup();
    renderScreen(<InstallMonitorDialog onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Start monitoring' }).disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Browse…' }));
    expect(api.pickPath).toHaveBeenCalledWith('installer');
    await waitFor(() => expect(screen.getByLabelText('Installer').value).toBe('C:\\dl\\setup.exe'));
    expect(screen.getByRole('button', { name: 'Start monitoring' }).disabled).toBe(false);
  });

  it('starts the monitor and then shows that it is waiting, with Done installing available', async () => {
    api.startInstallMonitor.mockResolvedValue({ state: 'installing', installerPath: 'C:\\dl\\setup.exe' });
    api.fetchInstallMonitor
      .mockResolvedValueOnce({ state: 'idle' })
      .mockResolvedValue({ state: 'installing', installerPath: 'C:\\dl\\setup.exe' });
    const user = userEvent.setup();
    renderScreen(<InstallMonitorDialog onClose={vi.fn()} />);
    await user.type(screen.getByLabelText('Installer'), 'C:\\dl\\setup.exe');
    await user.click(screen.getByRole('button', { name: 'Start monitoring' }));
    expect(api.startInstallMonitor).toHaveBeenCalledWith('C:\\dl\\setup.exe');
    expect(await screen.findByText(/The installer is running/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Done installing' })).toBeTruthy();
  });

  it('resumes a monitor that was already running when the dialog opened', async () => {
    api.fetchInstallMonitor.mockResolvedValue({ state: 'exited', installerPath: 'C:\\dl\\a.exe' });
    renderScreen(<InstallMonitorDialog onClose={vi.fn()} />);
    expect(await screen.findByText(/The installer has closed/)).toBeTruthy();
  });

  it('asks for the comparison on Done installing', async () => {
    api.fetchInstallMonitor.mockResolvedValue({ state: 'exited', installerPath: 'C:\\dl\\a.exe' });
    api.finishInstallMonitor.mockResolvedValue({ state: 'analyzing' });
    const user = userEvent.setup();
    renderScreen(<InstallMonitorDialog onClose={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: 'Done installing' }));
    expect(api.finishInstallMonitor).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/Comparing this PC/)).toBeTruthy();
  });

  it('reports what was recorded when it is done', async () => {
    api.fetchInstallMonitor.mockResolvedValue({
      state: 'done', trace: { id: 'a'.repeat(16), programName: 'Acme', fileCount: 4, registryCount: 2, taskCount: 1, serviceCount: 0, partial: true }
    });
    renderScreen(<InstallMonitorDialog onClose={vi.fn()} />);
    expect(await screen.findByText(/Recorded the install of Acme/)).toBeTruthy();
    expect(screen.getByText(/4 files and folders, 2 registry entries, 1 scheduled tasks, 0 services/)).toBeTruthy();
    expect(screen.getByText(/may be incomplete/)).toBeTruthy();
  });

  it('says why a start failed', async () => {
    api.startInstallMonitor.mockRejectedValue(new Error('Only .exe and .msi installers can be monitored.'));
    const user = userEvent.setup();
    renderScreen(<InstallMonitorDialog onClose={vi.fn()} />);
    await user.type(screen.getByLabelText('Installer'), 'C:\\dl\\x.bat');
    await user.click(screen.getByRole('button', { name: 'Start monitoring' }));
    expect(await screen.findByText(/Couldn.t start monitoring: Only \.exe and \.msi/)).toBeTruthy();
  });

  it('lists the recorded installs and deletes one', async () => {
    api.fetchInstallTraces.mockResolvedValue([{ id: 'a'.repeat(16), programName: 'Acme', fileCount: 3, registryCount: 1 }]);
    api.deleteInstallTrace.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    renderScreen(<InstallMonitorDialog onClose={vi.fn()} />);
    expect(await screen.findByText('Acme')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Delete the record of Acme' }));
    await waitFor(() => expect(api.deleteInstallTrace).toHaveBeenCalledWith('a'.repeat(16)));
  });

  const file = { format: 'prune-install-traces', version: 1, traces: [] };
  const acme = { id: 'a'.repeat(16), programName: 'Acme', registryKey: 'HKLM:\\SOFTWARE\\U\\Acme', fileCount: 3, registryCount: 1 };

  it('exports one record, and all of them, as a .prunetraces file', async () => {
    api.fetchInstallTraces.mockResolvedValue([acme]);
    api.exportInstallTraces.mockResolvedValue(file);
    const user = userEvent.setup();
    renderScreen(<InstallMonitorDialog onClose={vi.fn()} />);

    await user.click(await screen.findByRole('button', { name: 'Export the record of Acme' }));
    await waitFor(() => expect(saveBlob).toHaveBeenCalledTimes(1));
    expect(api.exportInstallTraces).toHaveBeenLastCalledWith(acme.id);
    expect(saveBlob.mock.calls[0][1]).toBe('prune-install-trace-Acme.prunetraces');
    expect(JSON.parse(await saveBlob.mock.calls[0][0].text())).toEqual(file);

    await user.click(screen.getByRole('button', { name: 'Export all' }));
    await waitFor(() => expect(saveBlob).toHaveBeenCalledTimes(2));
    expect(api.exportInstallTraces).toHaveBeenLastCalledWith(undefined);
    expect(saveBlob.mock.calls[1][1]).toMatch(/^prune-install-traces-\d{4}-\d{2}-\d{2}\.prunetraces$/);
  });

  it('offers Import with nothing recorded yet, and reports what an import did', async () => {
    api.importInstallTraces.mockResolvedValue({ imported: 2, skipped: 1, rejected: 0, notInstalled: 1 });
    const user = userEvent.setup();
    renderScreen(<InstallMonitorDialog onClose={vi.fn()} />);
    expect(await screen.findByText('No installs recorded yet.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Export all' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Import…' })).toBeTruthy();

    const upload = new File(['{"format":"prune-install-traces"}'], 'backup.prunetraces', { type: 'application/json' });
    await user.upload(screen.getByTestId('import-traces-input'), upload);
    await waitFor(() => expect(api.importInstallTraces).toHaveBeenCalledWith('{"format":"prune-install-traces"}'));
    await waitFor(() => expect(toasts.success).toHaveBeenCalledWith('Install traces imported: 2. Already here, skipped: 1. Rejected: 0.'));
  });

  it('warns when some traces in the file were rejected, and says why a file was refused', async () => {
    api.importInstallTraces.mockResolvedValueOnce({ imported: 1, skipped: 0, rejected: 3, notInstalled: 0 });
    const user = userEvent.setup();
    renderScreen(<InstallMonitorDialog onClose={vi.fn()} />);
    const input = await screen.findByTestId('import-traces-input');
    await user.upload(input, new File(['{}'], 'a.prunetraces'));
    await waitFor(() => expect(toasts.warn).toHaveBeenCalledWith('Install traces imported: 1. Already here, skipped: 0. Rejected: 3.'));

    api.importInstallTraces.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'notTraceFile' }));
    await user.upload(input, new File(['{}'], 'b.prunetraces'));
    expect(await screen.findByText("That file isn't an install trace file exported by Prune.")).toBeTruthy();
  });

  it('refuses a file over the size cap without sending it', async () => {
    const user = userEvent.setup();
    renderScreen(<InstallMonitorDialog onClose={vi.fn()} />);
    const huge = new File(['x'], 'huge.prunetraces');
    Object.defineProperty(huge, 'size', { value: 17 * 1024 * 1024 });
    await user.upload(await screen.findByTestId('import-traces-input'), huge);
    expect(await screen.findByText(/too large to be an install trace file/)).toBeTruthy();
    expect(api.importInstallTraces).not.toHaveBeenCalled();
  });

  it('marks a record whose program is not installed on this PC', async () => {
    const gone = { ...acme, id: 'b'.repeat(16), programName: 'Gone', registryKey: 'HKLM:\\SOFTWARE\\U\\Gone' };
    api.fetchInstallTraces.mockResolvedValue([acme, gone]);
    renderScreen(<InstallMonitorDialog onClose={vi.fn()} programs={[{ name: 'Acme', registryKey: 'HKLM:\\SOFTWARE\\U\\Acme' }]} />);
    expect(await screen.findByText('Gone')).toBeTruthy();
    expect(screen.getAllByText('Not installed here')).toHaveLength(1);
    expect(screen.getByText('Not installed here').closest('li').textContent).toContain('Gone');
  });
});
