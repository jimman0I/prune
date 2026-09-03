import { describe, it, expect } from 'vitest';
import { runPowerShellJson } from './powershell.js';

/** Runs REAL PowerShell, deliberately.
 *
 * Every other test of a query in this project mocks this runner, which is
 * exactly how the bug these cover survived: powershell.exe is Windows
 * PowerShell 5.1, and its console output encoding is the machine's legacy
 * codepage rather than UTF-8. Anything outside that codepage came back as
 * question marks, or as bytes that are not valid UTF-8 at all -- which
 * fails JSON.parse and takes the whole query with it, not just the one
 * row.
 *
 * Found while listing Store apps on this machine: a Greek language pack
 * named "Ελληνικά - Πακέτο τοπικά προσαρμογής" failed the parse for all
 * 81 packages. The same fault would corrupt the program list itself for
 * anyone whose software is named in a non-Latin script.
 */
describe('PowerShell output encoding', () => {
  it('returns non-ASCII text intact', async () => {
    const result = await runPowerShellJson(
      `ConvertTo-Json -InputObject @{ text = 'Ελληνικά - Πακέτο' } -Compress`
    );
    expect(result.text).toBe('Ελληνικά - Πακέτο');
  });

  it('survives a mix of scripts in one payload', async () => {
    const result = await runPowerShellJson(
      `ConvertTo-Json -InputObject @{ a = 'café'; b = '日本語'; c = 'Ελληνικά'; d = 'plain' } -Compress`
    );
    expect(result).toEqual({ a: 'café', b: '日本語', c: 'Ελληνικά', d: 'plain' });
  });

  it('still parses ordinary ASCII output', async () => {
    const result = await runPowerShellJson(`ConvertTo-Json -InputObject @(1,2,3) -Compress`);
    expect(result).toEqual([1, 2, 3]);
  });
});
