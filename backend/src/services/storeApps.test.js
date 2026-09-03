import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeStoreApp, friendlyStoreName, publisherFromDn } from './storeApps.js';

describe('friendlyStoreName', () => {
  it('uses the manifest display name when there is one', () => {
    expect(friendlyStoreName('Realtek Audio Control', 'RealtekSemiconductorCorp.RealtekAudioControl'))
      .toBe('Realtek Audio Control');
  });

  // A manifest may name a string resource instead of a name. Resolving
  // those means loading the package's resource map, and "ms-resource:AppName"
  // on screen is worse than the identity we can already read.
  it('ignores a display name that is only a resource reference', () => {
    expect(friendlyStoreName('ms-resource:AppName', 'Microsoft.MinecraftJavaEdition'))
      .toBe('Minecraft Java Edition');
  });

  it('falls back to the last part of the package identity', () => {
    expect(friendlyStoreName('', '40459File-New-Project.EarTrumpet')).toBe('Ear Trumpet');
    expect(friendlyStoreName(null, 'Microsoft.XboxGameOverlay')).toBe('Xbox Game Overlay');
  });

  it('leaves runs of capitals alone', () => {
    expect(friendlyStoreName('', 'Microsoft.Xbox.TCUI')).toBe('TCUI');
  });

  it('returns null when there is nothing to name it', () => {
    expect(friendlyStoreName('', '')).toBeNull();
    expect(friendlyStoreName(null, null)).toBeNull();
  });
});

describe('publisherFromDn', () => {
  it('pulls the common name out of the certificate subject', () => {
    expect(publisherFromDn('CN=Realtek Semiconductor Corp, O=Realtek, L=Hsinchu, C=TW'))
      .toBe('Realtek Semiconductor Corp');
  });

  it('handles a quoted common name containing a comma', () => {
    expect(publisherFromDn('CN="Valve Corporation, Inc.", O=Valve')).toBe('Valve Corporation, Inc.');
  });

  it('falls back to the raw value when there is no CN', () => {
    expect(publisherFromDn('Contoso')).toBe('Contoso');
    expect(publisherFromDn('')).toBeNull();
  });
});

describe('normalizeStoreApp', () => {
  const raw = {
    name: '40459File-New-Project.EarTrumpet',
    packageFullName: '40459File-New-Project.EarTrumpet_2.3.0.0_x86__1sdd7yawvg6ne',
    publisher: 'CN=File-New-Project, O=File-New-Project',
    version: '2.3.0.0',
    installLocation: 'C:\\Program Files\\WindowsApps\\40459File-New-Project.EarTrumpet_2.3.0.0_x86__1sdd7yawvg6ne',
    displayName: 'EarTrumpet',
    architecture: 'X86',
    sizeBytes: 4300000
  };

  it('maps a package onto the shape the program list already renders', () => {
    expect(normalizeStoreApp(raw)).toMatchObject({
      name: 'EarTrumpet',
      publisher: 'File-New-Project',
      version: '2.3.0.0',
      sizeBytes: 4300000,
      architecture: '32-bit',
      source: 'store'
    });
  });

  it('keys on the package full name, which is unique per version', () => {
    // Registry ids are key names; these must not be able to collide with
    // them, and two versions of one package are two different installs.
    expect(normalizeStoreApp(raw).id).toBe('store:40459File-New-Project.EarTrumpet_2.3.0.0_x86__1sdd7yawvg6ne');
  });

  it('reports no size rather than zero when the folder could not be read', () => {
    // WindowsApps is ACL-restricted. Zero would read as "this app is
    // free", which is a claim; absent reads as "not measured".
    expect(normalizeStoreApp({ ...raw, sizeBytes: null }).sizeBytes).toBeNull();
    expect(normalizeStoreApp({ ...raw, sizeBytes: 0 }).sizeBytes).toBeNull();
  });

  it('maps the architecture the way the registry rows are already labelled', () => {
    expect(normalizeStoreApp({ ...raw, architecture: 'X64' }).architecture).toBe('64-bit');
    expect(normalizeStoreApp({ ...raw, architecture: 'Neutral' }).architecture).toBeNull();
  });

  it('refuses a package with no identity', () => {
    expect(normalizeStoreApp({ ...raw, packageFullName: '' })).toBeNull();
    expect(normalizeStoreApp(null)).toBeNull();
  });
});

describe('getStoreApps', () => {
  beforeEach(() => { vi.resetModules(); });

  it('returns an empty list rather than throwing when the query fails', async () => {
    vi.doMock('./powershell.js', () => ({
      runPowerShellJson: async () => { throw new Error('appx unavailable'); }
    }));
    const { getStoreApps } = await import('./storeApps.js');
    expect(await getStoreApps()).toEqual([]);
  });

  it('handles a single package coming back as a bare object', async () => {
    vi.doMock('./powershell.js', () => ({
      runPowerShellJson: async () => ({
        name: 'Microsoft.Paint',
        packageFullName: 'Microsoft.Paint_11_x64__8wekyb3d8bbwe',
        publisher: 'CN=Microsoft Corporation',
        version: '11.0.0.0',
        installLocation: 'C:\\Program Files\\WindowsApps\\Microsoft.Paint_11',
        displayName: 'Paint',
        architecture: 'X64',
        sizeBytes: 1000
      })
    }));
    const { getStoreApps } = await import('./storeApps.js');
    const apps = await getStoreApps();
    expect(apps).toHaveLength(1);
    expect(apps[0].name).toBe('Paint');
  });
});
