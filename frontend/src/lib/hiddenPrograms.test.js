import { describe, it, expect } from 'vitest';
import { programHideKey, isProgramHidden, withProgramHidden } from './hiddenPrograms.js';

const sevenZip = { id: '7-Zip', name: '7-Zip 25.01 (x64)', registryKey: 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\7-Zip' };
const sevenZip32 = { id: '7-Zip#2', name: '7-Zip 22.01', registryKey: 'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\7-Zip' };
const calculator = { id: 'store:Microsoft.WindowsCalculator_11.2405.2.0_x64__8wekyb3d8bbwe', source: 'store', packageName: 'Microsoft.WindowsCalculator' };

describe('programHideKey', () => {
  it('keys a registry program by its full key path, so the two 7-Zips stay two programs', () => {
    expect(programHideKey(sevenZip)).toBe('reg:hklm:\\software\\microsoft\\windows\\currentversion\\uninstall\\7-zip');
    expect(programHideKey(sevenZip32)).not.toBe(programHideKey(sevenZip));
  });

  it('keeps the same key when the dedupe suffix lands on the other entry next time', () => {
    expect(programHideKey({ ...sevenZip32, id: '7-Zip' })).toBe(programHideKey(sevenZip32));
  });

  it('keys a Store app by its package name, so an update does not unhide it', () => {
    const updated = { ...calculator, id: 'store:Microsoft.WindowsCalculator_11.2410.0.0_x64__8wekyb3d8bbwe' };
    expect(programHideKey(calculator)).toBe('store:microsoft.windowscalculator');
    expect(programHideKey(updated)).toBe(programHideKey(calculator));
  });

  it('falls back to the id for the other sources, without any dedupe suffix', () => {
    expect(programHideKey({ id: 'extension:chrome:Default:abc', source: 'extension' })).toBe('id:extension:chrome:default:abc');
    expect(programHideKey({ id: 'unregistered:C:\\Program Files\\Old#2', source: 'unregistered' })).toBe('id:unregistered:c:\\program files\\old');
  });

  it('has no key for nothing', () => {
    expect(programHideKey(null)).toBeNull();
    expect(programHideKey({})).toBeNull();
  });
});

describe('isProgramHidden / withProgramHidden', () => {
  it('adds a key once and takes it out again', () => {
    const once = withProgramHidden([], sevenZip, true);
    expect(withProgramHidden(once, sevenZip, true)).toEqual(once);
    expect(isProgramHidden(sevenZip, new Set(once))).toBe(true);
    expect(isProgramHidden(sevenZip32, new Set(once))).toBe(false);
    expect(withProgramHidden(once, sevenZip, false)).toEqual([]);
  });

  it('leaves the list alone for a program with no key, and survives a missing list', () => {
    expect(withProgramHidden(['x'], {}, true)).toEqual(['x']);
    expect(withProgramHidden(undefined, sevenZip, true)).toHaveLength(1);
  });
});
