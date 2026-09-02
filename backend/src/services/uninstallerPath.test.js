import { describe, it, expect } from 'vitest';
import { parseUninstallerPath } from './uninstallerPath.js';

describe('parseUninstallerPath', () => {
  it('takes the quoted path and drops the switches after it', () => {
    expect(parseUninstallerPath('"C:\\Program Files\\App\\uninstall.exe" /S'))
      .toEqual({ executable: 'C:\\Program Files\\App\\uninstall.exe', isMsi: false });
  });

  it('handles a quoted path with no switches', () => {
    expect(parseUninstallerPath('"C:\\Program Files\\App\\uninstall.exe"').executable)
      .toBe('C:\\Program Files\\App\\uninstall.exe');
  });

  it('handles an unquoted path with no spaces', () => {
    expect(parseUninstallerPath('C:\\Apps\\thing\\uninst.exe /quiet').executable)
      .toBe('C:\\Apps\\thing\\uninst.exe');
  });

  it('keeps spaces in an unquoted path, cutting only at a real switch', () => {
    // The genuinely ambiguous case: an unquoted path containing spaces.
    // "C:\Program Files\App\uninstall.exe /S" has no quotes to lean on, so
    // splitting on the first space would truncate to "C:\Program". Cutting
    // at the first ` /` or ` -` token instead keeps the path intact, which
    // is what these strings almost always mean in practice.
    expect(parseUninstallerPath('C:\\Program Files\\App\\uninstall.exe /S').executable)
      .toBe('C:\\Program Files\\App\\uninstall.exe');
  });

  it('recognises MsiExec regardless of casing or argument order', () => {
    expect(parseUninstallerPath('MsiExec.exe /X{1234-5678}').isMsi).toBe(true);
    expect(parseUninstallerPath('msiexec /x {1234-5678}').isMsi).toBe(true);
    expect(parseUninstallerPath('"C:\\Windows\\System32\\msiexec.exe" /I{ABC}').isMsi).toBe(true);
  });

  it('does not mistake an ordinary uninstaller for MSI', () => {
    expect(parseUninstallerPath('"C:\\Games\\uninstall.exe" /S').isMsi).toBe(false);
  });

  it('returns null for missing or unusable input rather than throwing', () => {
    expect(parseUninstallerPath(null).executable).toBeNull();
    expect(parseUninstallerPath('').executable).toBeNull();
    expect(parseUninstallerPath('   ').executable).toBeNull();
  });

  it('handles a rundll32-style entry without pretending the DLL is the exe', () => {
    const result = parseUninstallerPath('rundll32.exe advpack.dll,LaunchINFSection thing.inf');
    expect(result.executable.toLowerCase()).toContain('rundll32.exe');
  });
});
