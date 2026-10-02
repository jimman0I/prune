// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

const api = {
  pickPath: vi.fn(), startInstallMonitor: vi.fn(), fetchInstallMonitor: vi.fn(), finishInstallMonitor: vi.fn(),
  cancelInstallMonitor: vi.fn(), deleteInstallTrace: vi.fn(), fetchInstallTraces: vi.fn(), fetchSettings: vi.fn()
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
  updateSettings: vi.fn(async (p) => p)
}));

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
});
