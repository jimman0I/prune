import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestServer } from '../testSupport/routeServer.js';

/** The program sources the uninstall registry does not cover: Chocolatey
 * packages, unregistered Program Files folders, Windows features and
 * Windows updates. The services are tested on their own; this checks the
 * routes hand the request through and map the answers. */

const listInstalledPrograms = vi.fn(async () => [{ id: 'p1', name: 'Python', registryKey: 'HKLM:\\X\\{py}' }]);
vi.mock('../services/programs.js', () => ({ listInstalledPrograms: (...a) => listInstalledPrograms(...a) }));

const readChocolateyPackages = vi.fn();
const uninstallChocolateyPackage = vi.fn();
vi.mock('../services/chocolateyApps.js', async (orig) => ({
  ...(await orig()),
  readChocolateyPackages: (...a) => readChocolateyPackages(...a),
  uninstallChocolateyPackage: (...a) => uninstallChocolateyPackage(...a)
}));

const listUnregisteredPrograms = vi.fn();
vi.mock('../services/unregisteredFolders.js', () => ({ listUnregisteredPrograms: (...a) => listUnregisteredPrograms(...a) }));

const disableWindowsFeature = vi.fn();
const uninstallWindowsUpdate = vi.fn();
vi.mock('../services/windowsComponents.js', () => ({
  listWindowsFeatures: async () => [{ id: 'feature:X', source: 'feature' }],
  listWindowsUpdates: async () => [{ id: 'update:KB1', source: 'update' }],
  disableWindowsFeature: (...a) => disableWindowsFeature(...a),
  uninstallWindowsUpdate: (...a) => uninstallWindowsUpdate(...a)
}));

const scanOtherAccounts = vi.fn();
vi.mock('../services/otherAccounts.js', () => ({
  getOtherAccounts: async () => ({ profiles: [{ sid: 'S-1-5-21-1-2-3-1005', name: 'nikos' }], scan: null }),
  scanOtherAccounts: (...a) => scanOtherAccounts(...a)
}));

vi.mock('../services/programSignatures.js', () => ({ getProgramSignatures: async () => ({ p1: { status: 'valid', signer: 'PSF' } }) }));

const post = (path, body) => server.call(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => vi.clearAllMocks());

describe('GET /programs/chocolatey', () => {
  it('lists the packages with no entry of their own and tags the programs a package installed', async () => {
    readChocolateyPackages.mockResolvedValue([
      { id: 'python314', version: '3', title: 'Python', authors: 'PSF', summary: '', folder: 'C:\\c\\lib\\python314', sizeBytes: 1, registryKeys: ['HKEY_LOCAL_MACHINE\\X\\{py}'] },
      { id: 'shim', version: '1', title: 'Shim', authors: 'A', summary: '', folder: 'C:\\c\\lib\\shim', sizeBytes: 2, registryKeys: [] }
    ]);
    const res = await server.call('/programs/chocolatey');
    expect(res.status).toBe(200);
    expect(res.body.apps.map((a) => a.id)).toEqual(['chocolatey:shim']);
    expect(res.body.managed).toEqual({ p1: 'python314' });
  });

  it('does not read the program list when Chocolatey is not installed', async () => {
    readChocolateyPackages.mockResolvedValue([]);
    const res = await server.call('/programs/chocolatey');
    expect(res.body).toEqual({ apps: [], managed: {} });
    expect(listInstalledPrograms).not.toHaveBeenCalled();
  });
});

describe('removal routes', () => {
  it('passes the id through and maps refusals to 409', async () => {
    uninstallChocolateyPackage.mockResolvedValue({ ok: true });
    expect((await post('/programs/chocolatey/remove', { id: 'shim' })).body).toEqual({ ok: true });
    expect(uninstallChocolateyPackage).toHaveBeenCalledWith('shim');

    uninstallChocolateyPackage.mockResolvedValue({ ok: false, error: 'That package is no longer installed.' });
    expect((await post('/programs/chocolatey/remove', { id: 'gone' })).status).toBe(409);
  });

  it('treats a cancelled prompt and a restore-point question as ordinary answers', async () => {
    disableWindowsFeature.mockResolvedValue({ ok: false, needsConsent: true, reason: 'off' });
    const res = await post('/programs/windows-features/disable', { name: 'X' });
    expect(res.status).toBe(200);
    expect(res.body.needsConsent).toBe(true);
    expect(disableWindowsFeature).toHaveBeenCalledWith('X', { allowWithoutRestorePoint: false });

    uninstallWindowsUpdate.mockResolvedValue({ ok: false, cancelled: true });
    expect((await post('/programs/windows-updates/uninstall', { kb: 'KB1', allowWithoutRestorePoint: true })).status).toBe(200);
    expect(uninstallWindowsUpdate).toHaveBeenCalledWith('KB1', { allowWithoutRestorePoint: true });
  });

  it('only a literal true skips the restore point', async () => {
    disableWindowsFeature.mockResolvedValue({ ok: true });
    await post('/programs/windows-features/disable', { name: 'X', allowWithoutRestorePoint: 'yes' });
    expect(disableWindowsFeature).toHaveBeenCalledWith('X', { allowWithoutRestorePoint: false });
  });
});

describe('GET /programs/signatures', () => {
  it('serves each program\'s signature by id', async () => {
    expect((await server.call('/programs/signatures')).body).toEqual({ signatures: { p1: { status: 'valid', signer: 'PSF' } } });
  });
});

describe('other accounts', () => {
  it('lists the accounts without elevating, and scans only on a POST', async () => {
    expect((await server.call('/programs/other-accounts')).body.profiles[0].name).toBe('nikos');
    expect(scanOtherAccounts).not.toHaveBeenCalled();
    scanOtherAccounts.mockResolvedValue({ ok: false, cancelled: true });
    const res = await post('/programs/other-accounts/scan', {});
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: false, cancelled: true });
  });
});

describe('list routes', () => {
  it('serve unregistered folders, features and updates', async () => {
    listUnregisteredPrograms.mockResolvedValue([{ id: 'unregistered:C:\\PF\\Old', source: 'unregistered' }]);
    expect((await server.call('/programs/unregistered')).body.apps).toHaveLength(1);
    expect(listUnregisteredPrograms).toHaveBeenCalledWith([{ id: 'p1', name: 'Python', registryKey: 'HKLM:\\X\\{py}' }]);
    expect((await server.call('/programs/windows-features')).body.features[0].source).toBe('feature');
    expect((await server.call('/programs/windows-updates')).body.updates[0].source).toBe('update');
  });
});
