import { describe, it, expect } from 'vitest';
import { listInstalledProgramsViaReg } from './programsRegFallback.js';

/** Runs REAL reg.exe against this machine's real registry, deliberately
 * -- every other test of this module mocks runPowerShellText, which
 * would happily pass even if the real reg.exe output format didn't match
 * what parseRegQueryOutput expects.
 *
 * Only a shape assertion: a real machine has dozens of entries, and every
 * one of them has a name. No assertion on a specific program (CI's
 * registry has nothing this project installed). */
describe('listInstalledProgramsViaReg (live)', () => {
  it('finds real installed programs on this machine', async () => {
    const result = await listInstalledProgramsViaReg();
    expect(result.length).toBeGreaterThan(5);
    for (const program of result) {
      expect(typeof program.name).toBe('string');
      expect(program.name.length).toBeGreaterThan(0);
      expect(typeof program.id).toBe('string');
      expect(program.psPath).toMatch(/^Microsoft\.PowerShell\.Core\\Registry::HKEY_(LOCAL_MACHINE|CURRENT_USER)\\/);
    }
  }, 20000);
});
