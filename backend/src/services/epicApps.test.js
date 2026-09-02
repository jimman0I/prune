import { describe, it, expect } from 'vitest';
import { parseEpicManifest } from './epicApps.js';

/** Shape of a real Epic Games Launcher .item manifest. Only the fields
 * this needs are asserted; a real file carries about forty more.
 *
 * Note the FORWARD slashes in InstallLocation -- Epic writes paths that
 * way, which is exactly the separator mismatch that already made the
 * nested-folder exclusion silently do nothing once before. */
const MANIFEST = JSON.stringify({
  FormatVersion: 0,
  bIsIncompleteInstall: false,
  LaunchExecutable: 'FortniteGame/Binaries/Win64/FortniteClient-Win64-Shipping.exe',
  AppName: 'Fortnite',
  CatalogItemId: '4fe75bbc5a674f4f9b356b5c90567da5',
  InstallLocation: 'C:/Program Files/Epic Games/Fortnite',
  InstallSize: 32212254720,
  DisplayName: 'Fortnite',
  bIsApplication: true
});

describe('parseEpicManifest', () => {
  it('reads the name, location and size', () => {
    const app = parseEpicManifest(MANIFEST);
    expect(app.displayName).toBe('Fortnite');
    expect(app.appName).toBe('Fortnite');
    expect(app.sizeBytes).toBe(32212254720);
  });

  it('normalizes the forward slashes Epic writes into Windows separators', () => {
    // Left as-is, this path would never match the backslashed one the
    // Windows registry records for the same folder.
    expect(parseEpicManifest(MANIFEST).installLocation)
      .toBe('C:\\Program Files\\Epic Games\\Fortnite');
  });

  // An install that was interrupted reports a size for what it intended
  // to be, not what is on disk.
  it('ignores an incomplete install', () => {
    const partial = JSON.stringify({ ...JSON.parse(MANIFEST), bIsIncompleteInstall: true });
    expect(parseEpicManifest(partial)).toBeNull();
  });

  it('returns null for a zero or missing size', () => {
    expect(parseEpicManifest(JSON.stringify({ ...JSON.parse(MANIFEST), InstallSize: 0 })).sizeBytes).toBeNull();
    const noSize = JSON.parse(MANIFEST);
    delete noSize.InstallSize;
    expect(parseEpicManifest(JSON.stringify(noSize)).sizeBytes).toBeNull();
  });

  it('needs a location to be useful', () => {
    const noLocation = JSON.parse(MANIFEST);
    delete noLocation.InstallLocation;
    expect(parseEpicManifest(JSON.stringify(noLocation))).toBeNull();
  });

  it('survives malformed JSON rather than throwing', () => {
    expect(parseEpicManifest('{ not json')).toBeNull();
    expect(parseEpicManifest('')).toBeNull();
    expect(parseEpicManifest(null)).toBeNull();
  });
});
