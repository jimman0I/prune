import { describe, it, expect } from 'vitest';
import { isBootstrapperPath, productFamily, genericIconIds } from './genericIcon.js';

const CACHE = 'C:\\ProgramData\\Package Cache\\{042d26ef-3dbe-4c25-95d3-4c1b11b235a7}\\vcredist_x64.exe';

describe('isBootstrapperPath', () => {
  it('recognises the WiX bundle cache', () => {
    expect(isBootstrapperPath(CACHE)).toBe(true);
    expect(isBootstrapperPath('C:/ProgramData/Package Cache/{x}/setup.exe')).toBe(true);
  });

  it('does not recognise an ordinary install directory', () => {
    // NVIDIA's three products share the real NVIDIA logo, taken from
    // their own install folder. Nothing here may ever put that at risk.
    expect(isBootstrapperPath('C:\\Program Files\\NVIDIA Corporation\\x\\y.exe')).toBe(false);
    expect(isBootstrapperPath('C:\\Program Files\\7-Zip\\7zFM.exe')).toBe(false);
    expect(isBootstrapperPath(null)).toBe(false);
  });

  it('is not fooled by a folder that merely contains the words', () => {
    expect(isBootstrapperPath('C:\\Apps\\My Package Cacher\\a.exe')).toBe(false);
  });
});

describe('productFamily', () => {
  it('collapses versions of one product', () => {
    expect(productFamily('Python 3.14.5 (64-bit)')).toBe(productFamily('Python 3.12.3 (64-bit)'));
    expect(productFamily('7-Zip 25.01 (x64)')).toBe(productFamily('7-Zip 22.01'));
  });

  it('collapses architectures of one product', () => {
    expect(productFamily('Microsoft Visual C++ 2013 Redistributable (x64) - 12.0.40664'))
      .toBe(productFamily('Microsoft Visual C++ 2013 Redistributable (x86) - 12.0.40664'));
  });

  it('keeps genuinely different products apart', () => {
    const vcredist = productFamily('Microsoft Visual C++ 2013 Redistributable (x64) - 12.0.40664');
    const runtime = productFamily('Microsoft Windows Desktop Runtime - 6.0.36 (x64)');
    const aspnet = productFamily('Microsoft ASP.NET Core 8.0.30 - Shared Framework (x64)');
    const sdk = productFamily('Microsoft .NET SDK 9.0.317 (x64)');
    expect(new Set([vcredist, runtime, aspnet, sdk]).size).toBe(4);
  });

  it('strips a version welded to the architecture', () => {
    // Real name from this machine, and the one shape a naive splitter
    // gets wrong: "7.6.5.0-x64" is a single token.
    expect(productFamily('PowerShell 7.6.5.0-x64')).toBe('powershell');
  });

  it('does not mistake a dotted product name for a version', () => {
    // "ASP.NET" and ".NET" are dots with letters in them, not numbers.
    expect(productFamily('Microsoft .NET SDK 9.0.317 (x64)')).toContain('.net');
    expect(productFamily('Microsoft ASP.NET Core 8.0.30 - Shared Framework (x64)')).toContain('asp.net');
  });

  it('leaves a name with no version alone', () => {
    expect(productFamily('Windows Assessment and Deployment Kit'))
      .toBe('windows assessment and deployment kit');
  });

  it('never returns nothing for a real name', () => {
    // A name that is ONLY a version would otherwise collapse to '', and
    // every such program would land in one enormous false family.
    expect(productFamily('2024')).toBe('2024');
    expect(productFamily('')).toBe('');
  });
});

describe('genericIconIds', () => {
  const bootstrapper = (id, name) => ({ id, name, path: CACHE, picture: 'WIX' });

  it('rejects an installer icon shared across unrelated products', () => {
    // The measured case: 19 programs on this machine took their
    // DisplayIcon from a WiX bootstrapper in Package Cache, and every one
    // of them extracted the SAME default setup glyph -- so nineteen rows
    // each claimed to be the other eighteen.
    const ids = genericIconIds([
      bootstrapper('a', 'Microsoft Visual C++ 2013 Redistributable (x64) - 12.0.40664'),
      bootstrapper('b', 'Microsoft Windows Desktop Runtime - 6.0.36 (x64)'),
      bootstrapper('c', 'PowerShell 7.6.5.0-x64')
    ]);
    expect(ids).toEqual(new Set(['a', 'b', 'c']));
  });

  it('keeps an installer icon shared only between versions of one product', () => {
    // Python's own bootstrapper embeds the real Python icon, and both
    // installed versions extract it. Refusing Package Cache outright
    // would have cost this -- and Viber's -- their icons.
    expect(genericIconIds([
      bootstrapper('a', 'Python 3.14.5 (64-bit)'),
      bootstrapper('b', 'Python 3.12.3 (64-bit)')
    ])).toEqual(new Set());
  });

  it('keeps an installer icon only one program uses', () => {
    expect(genericIconIds([bootstrapper('v', 'Viber')])).toEqual(new Set());
  });

  it('never rejects an icon taken from a real install directory', () => {
    // NVIDIA's logo across three DIFFERENT products, from NVIDIA's own
    // folder. Vendor branding is a legitimate reason to share a picture;
    // only a bootstrapper's default is not.
    const nvidia = (id, name) => ({ id, name, path: `C:\\Program Files\\NVIDIA Corporation\\${id}.exe`, picture: 'NV' });
    expect(genericIconIds([
      nvidia('a', 'NVIDIA Graphics Driver 596.49'),
      nvidia('b', 'NVIDIA HD Audio Driver 1.4.5.7'),
      nvidia('c', 'NVIDIA Broadcast 2.2.0')
    ])).toEqual(new Set());
  });

  it('spares a picture that any real product also uses', () => {
    // If one member took this picture from its own install folder, the
    // picture is that product's icon and the bootstrapper simply carries
    // a copy. Rejecting it would delete a real icon.
    expect(genericIconIds([
      bootstrapper('a', 'Some Redistributable 1.0'),
      { id: 'b', name: 'Totally Different App', path: 'C:\\Program Files\\App\\app.exe', picture: 'WIX' }
    ])).toEqual(new Set());
  });

  it('judges each picture separately', () => {
    const ids = genericIconIds([
      bootstrapper('a', 'Microsoft Visual C++ 2013 Redistributable (x64)'),
      bootstrapper('b', 'PowerShell 7.6.5.0-x64'),
      { id: 'p1', name: 'Python 3.14.5 (64-bit)', path: CACHE, picture: 'PY' },
      { id: 'p2', name: 'Python 3.12.3 (64-bit)', path: CACHE, picture: 'PY' }
    ]);
    expect(ids).toEqual(new Set(['a', 'b']));
  });

  it('copes with nothing', () => {
    expect(genericIconIds([])).toEqual(new Set());
    expect(genericIconIds(null)).toEqual(new Set());
  });
});
