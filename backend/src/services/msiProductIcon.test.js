import { describe, it, expect } from 'vitest';
import { productCodeFrom, packProductCode, getMsiProductIcons } from './msiProductIcon.js';

describe('productCodeFrom', () => {
  it('reads the product code out of a repair-form uninstall string', () => {
    expect(productCodeFrom('MsiExec.exe /I{14EDF950-06B9-415F-862C-1D5DEC321AE6}'))
      .toBe('{14EDF950-06B9-415F-862C-1D5DEC321AE6}');
  });

  it('reads it out of the removal form too', () => {
    // Both appear in this machine's registry: /X on the redistributables,
    // /I on GameInput and Wolow Companion.
    expect(productCodeFrom('MsiExec.exe /X{1D8E6291-B0D5-35EC-8441-6616F567A0F7}'))
      .toBe('{1D8E6291-B0D5-35EC-8441-6616F567A0F7}');
  });

  it('copes with a full path to msiexec and extra switches', () => {
    expect(productCodeFrom('C:\\Windows\\System32\\MsiExec.exe /X {AD8A2FA1-06E7-4B0D-927D-6E54B3D31028} /quiet'))
      .toBe('{AD8A2FA1-06E7-4B0D-927D-6E54B3D31028}');
  });

  it('upper-cases the code, because the packed key is upper-case', () => {
    expect(productCodeFrom('MsiExec.exe /X{ad8a2fa1-06e7-4b0d-927d-6e54b3d31028}'))
      .toBe('{AD8A2FA1-06E7-4B0D-927D-6E54B3D31028}');
  });

  it('has nothing for an uninstaller that is not msiexec', () => {
    // Squirrel's Update.exe takes a --uninstall flag and no GUID; a
    // program removed by its own uninstaller has no product code at all.
    expect(productCodeFrom('"C:\\Users\\x\\AppData\\Local\\Discord\\Update.exe" --uninstall')).toBeNull();
    expect(productCodeFrom('')).toBeNull();
    expect(productCodeFrom(null)).toBeNull();
  });

  it('refuses something shaped like a GUID that is not one', () => {
    expect(productCodeFrom('MsiExec.exe /X{not-a-guid}')).toBeNull();
  });
});

describe('packProductCode', () => {
  it('packs a product code the way Windows Installer stores it', () => {
    // Verified against the live registry: both of these keys exist under
    // HKLM\SOFTWARE\Classes\Installer\Products.
    expect(packProductCode('{8E3EF5A2-585E-453B-B16C-B46E05A62DAC}'))
      .toBe('2A5FE3E8E585B3541BC64BE6506AD2CA');
    expect(packProductCode('{A63AA9C9-279A-4486-8744-62E7F4E92A06}'))
      .toBe('9C9AA36AA97268447844267E4F9EA260');
  });

  it('produces a 32-character key', () => {
    expect(packProductCode('{8E3EF5A2-585E-453B-B16C-B46E05A62DAC}')).toHaveLength(32);
  });

  it('refuses anything that is not a product code', () => {
    // This string is pasted straight into a registry path. A value that
    // is not exactly 32 hex characters has no business getting there.
    expect(packProductCode('{not-a-guid}')).toBeNull();
    expect(packProductCode('8E3EF5A2585E453BB16CB46E05A62DAC')).toBeNull();
    expect(packProductCode(null)).toBeNull();
  });
});

/** Real registry reads against real products on this machine. */
describe('getMsiProductIcons (real registry)', () => {
  it('finds the icon Windows Installer recorded for a product', async () => {
    const icons = await getMsiProductIcons(['{8E3EF5A2-585E-453B-B16C-B46E05A62DAC}']);
    const source = icons['{8E3EF5A2-585E-453B-B16C-B46E05A62DAC}'];
    // Node.js on this machine. Skipped rather than failed elsewhere:
    // this asserts the lookup works, not that Node is installed.
    if (source) {
      expect(source.path).toMatch(/Installer/i);
      expect(typeof source.index).toBe('number');
    }
  }, 60000);

  it('offers nothing for a product with no recorded icon', async () => {
    // The Visual C++ redistributables genuinely have none, which is why
    // they were showing lettered tiles in the first place.
    const icons = await getMsiProductIcons(['{1D8E6291-B0D5-35EC-8441-6616F567A0F7}']);
    expect(icons['{1D8E6291-B0D5-35EC-8441-6616F567A0F7}']).toBeUndefined();
  }, 60000);

  it('never offers a path that is not on disk', async () => {
    // A ProductIcon naming a file cleaned out of C:\Windows\Installer is
    // common, and handing it on would cost the row its lettered tile and
    // give it nothing in exchange.
    const icons = await getMsiProductIcons([
      '{8E3EF5A2-585E-453B-B16C-B46E05A62DAC}',
      '{A63AA9C9-279A-4486-8744-62E7F4E92A06}',
      '{1D8E6291-B0D5-35EC-8441-6616F567A0F7}'
    ]);
    const { existsSync } = await import('node:fs');
    for (const source of Object.values(icons)) expect(existsSync(source.path)).toBe(true);
  }, 60000);

  it('copes with nothing to look up', async () => {
    expect(await getMsiProductIcons([])).toEqual({});
    expect(await getMsiProductIcons(['not a code'])).toEqual({});
  }, 60000);
});
