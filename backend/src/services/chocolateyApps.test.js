import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { vi } from 'vitest';
import {
  parseNuspec, parseRegistrySnapshot, readChocolateyPackages, chocolateyRoot,
  chocolateyRows, managedPrograms, buildChocoUninstallScript, uninstallChocolateyPackage
} from './chocolateyApps.js';

const pythonPkg = { id: 'python314', version: '3.14.5', title: 'Python 3.14', authors: 'PSF', summary: '', folder: 'C:\\c\\lib\\python314', sizeBytes: 9, registryKeys: ['HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{py}'] };
const adkPkg = { id: 'windows-adk-oscdimg', version: '10.1', title: 'Oscdimg in PATH', authors: 'Microsoft', summary: 'Adds oscdimg', folder: 'C:\\c\\lib\\windows-adk-oscdimg', sizeBytes: 5, registryKeys: [] };

describe('chocolateyRows', () => {
  it('lists only the packages that have no Add/Remove entry of their own, shaped like programs', () => {
    expect(chocolateyRows([pythonPkg, adkPkg])).toEqual([{
      id: 'chocolatey:windows-adk-oscdimg', name: 'Oscdimg in PATH', publisher: 'Microsoft', version: '10.1',
      installLocation: 'C:\\c\\lib\\windows-adk-oscdimg', sizeBytes: 5, chocolateyId: 'windows-adk-oscdimg',
      description: 'Adds oscdimg', source: 'chocolatey'
    }]);
  });
  it('falls back to the package id when it has no title', () => {
    expect(chocolateyRows([{ ...adkPkg, title: '' }])[0].name).toBe('windows-adk-oscdimg');
  });
});

describe('managedPrograms', () => {
  it('names the package behind each listed program, however the key is spelled', () => {
    const programs = [
      { id: '{py}', registryKey: 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{PY}' },
      { id: 'other', registryKey: 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\other' }
    ];
    expect(managedPrograms([pythonPkg, adkPkg], programs)).toEqual({ '{py}': 'python314' });
  });
});

describe('uninstallChocolateyPackage', () => {
  it('builds the choco command with the id as a quoted literal', () => {
    const script = buildChocoUninstallScript('windows-adk-oscdimg', 'C:\\ProgramData\\chocolatey');
    expect(script).toContain("'C:\\ProgramData\\chocolatey\\bin\\choco.exe'");
    expect(script).toContain("'uninstall', 'windows-adk-oscdimg', '-y', '--no-progress'");
  });

  it('only uninstalls a package that is really installed, elevated, and reads the exit code', async () => {
    const runElevated = vi.fn().mockResolvedValue({ ok: true, data: { exitCode: 0 } });
    const read = vi.fn().mockResolvedValue([adkPkg]);
    expect(await uninstallChocolateyPackage('windows-adk-oscdimg', { runElevated, read })).toEqual({ ok: true });
    expect(runElevated).toHaveBeenCalledTimes(1);

    expect((await uninstallChocolateyPackage('not-installed', { runElevated, read })).ok).toBe(false);
    expect((await uninstallChocolateyPackage('x; rm -rf', { runElevated, read })).ok).toBe(false);
    expect(runElevated).toHaveBeenCalledTimes(1);
  });

  it('reports a non-zero exit as a failure with the code', async () => {
    const runElevated = vi.fn().mockResolvedValue({ ok: true, data: { exitCode: 1605 } });
    const result = await uninstallChocolateyPackage('windows-adk-oscdimg', { runElevated, read: async () => [adkPkg] });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/1605/);
  });
});

const nuspec = (id, version, title = '', authors = '', summary = '') => `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://schemas.microsoft.com/packaging/2015/06/nuspec.xsd">
  <metadata>
    <id>${id}</id>
    <version>${version}</version>
    <title>${title}</title>
    <authors>${authors}</authors>
    <summary>${summary}</summary>
  </metadata>
</package>`;

describe('parseNuspec', () => {
  it('reads the package identity and the words shown in the list', () => {
    expect(parseNuspec(nuspec('windows-adk-oscdimg', '10.1', 'Oscdimg.exe in PATH', 'Microsoft', 'Adds oscdimg to PATH')))
      .toEqual({ id: 'windows-adk-oscdimg', version: '10.1', title: 'Oscdimg.exe in PATH', authors: 'Microsoft', summary: 'Adds oscdimg to PATH' });
  });
  it('decodes XML entities and survives a missing field', () => {
    expect(parseNuspec(nuspec('a', '1', 'Tom &amp; Jerry')).title).toBe('Tom & Jerry');
    expect(parseNuspec('<package><metadata><id>x</id><version>2</version></metadata></package>')).toMatchObject({ id: 'x', version: '2', title: '' });
  });
  it('returns null for something that is not a nuspec', () => {
    expect(parseNuspec('not xml')).toBeNull();
  });
});

describe('parseRegistrySnapshot', () => {
  it('lists every uninstall key the package\'s installer created', () => {
    const xml = `<registrySnapshot><keys>
      <key displayName="Python 3.14.5 (64-bit)"><KeyPath>HKEY_CURRENT_USER\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{2fc3}</KeyPath></key>
      <key displayName="Python Executables"><KeyPath>HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{a1b2}</KeyPath></key>
    </keys></registrySnapshot>`;
    expect(parseRegistrySnapshot(xml)).toEqual([
      'HKEY_CURRENT_USER\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{2fc3}',
      'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{a1b2}'
    ]);
  });
});

describe('readChocolateyPackages', () => {
  let root;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'prune-choco-'));
    const pkg = (id, version, { registry, title } = {}) => {
      mkdirSync(join(root, 'lib', id, 'tools'), { recursive: true });
      writeFileSync(join(root, 'lib', id, `${id}.nuspec`), nuspec(id, version, title ?? id));
      writeFileSync(join(root, 'lib', id, 'tools', 'chocolateyInstall.ps1'), 'x'.repeat(100));
      mkdirSync(join(root, '.chocolatey', `${id}.${version}`), { recursive: true });
      if (registry) {
        writeFileSync(join(root, '.chocolatey', `${id}.${version}`, '.registry'),
          `<registrySnapshot><keys><key><KeyPath>${registry}</KeyPath></key></keys></registrySnapshot>`);
      }
    };
    pkg('python314', '3.14.5', { registry: 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{py}' });
    pkg('windows-adk-oscdimg', '10.1', { title: 'Oscdimg in PATH' });
    mkdirSync(join(root, 'lib', 'broken'), { recursive: true }); // no nuspec: skipped
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('reads each package, with the uninstall keys its installer made, if any', async () => {
    const packages = await readChocolateyPackages(root);
    const byId = Object.fromEntries(packages.map((p) => [p.id, p]));
    expect(Object.keys(byId).sort()).toEqual(['python314', 'windows-adk-oscdimg']);
    expect(byId.python314.registryKeys).toEqual(['HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{py}']);
    expect(byId['windows-adk-oscdimg']).toMatchObject({ title: 'Oscdimg in PATH', version: '10.1', registryKeys: [] });
    expect(byId['windows-adk-oscdimg'].sizeBytes).toBeGreaterThan(0);
    expect(byId['windows-adk-oscdimg'].folder).toBe(join(root, 'lib', 'windows-adk-oscdimg'));
  });

  it('is an empty list when Chocolatey is not installed', async () => {
    expect(await readChocolateyPackages(join(root, 'nope'))).toEqual([]);
  });
});

describe('chocolateyRoot', () => {
  it('prefers ChocolateyInstall and falls back to ProgramData', () => {
    expect(chocolateyRoot({ ChocolateyInstall: 'D:\\choco', ProgramData: 'C:\\ProgramData' })).toBe('D:\\choco');
    expect(chocolateyRoot({ ProgramData: 'C:\\ProgramData' })).toBe(join('C:\\ProgramData', 'chocolatey'));
  });
});
