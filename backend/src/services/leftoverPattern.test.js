import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { buildSearchPattern } from './leftoverPattern.js';

const execFileAsync = promisify(execFile);

describe('buildSearchPattern', () => {
  it('searches on every term it is given', () => {
    const pattern = buildSearchPattern('OldApp', 'Old Inc');
    expect(pattern).toContain('OldApp');
    expect(pattern).toContain('Old Inc');
    expect(pattern.split('|')).toHaveLength(2);
  });

  it('escapes regex metacharacters in a program name', () => {
    // "Rainbow Six (R) Siege" contains parentheses, which are a capture
    // group to the regex engine rather than literal text.
    expect(buildSearchPattern('Rainbow Six (R) Siege')).toContain('Rainbow Six \\(R\\) Siege');
  });

  it('ignores blank and missing terms', () => {
    expect(buildSearchPattern('OldApp', null)).not.toContain('|');
    expect(buildSearchPattern('OldApp', '   ')).not.toContain('|');
    expect(buildSearchPattern(undefined, 'Old Inc')).toContain('Old Inc');
  });

  it('is null when there is nothing to search on', () => {
    // An empty pattern matches every key and directory on the machine.
    expect(buildSearchPattern('', '')).toBeNull();
    expect(buildSearchPattern(null, undefined)).toBeNull();
    expect(buildSearchPattern()).toBeNull();
  });

  it('trims a term rather than searching for the spaces around it', () => {
    expect(buildSearchPattern('  OldApp  ')).toContain('OldApp');
    expect(buildSearchPattern('  OldApp  ')).not.toContain(' OldApp');
  });
});

/** The point of the pattern is what PowerShell's -match does with it, and
 * that is not something a string assertion can check. These run the real
 * operator against the real names that caused the problem. */
describe('buildSearchPattern (real PowerShell -match)', () => {
  async function matches(pattern, candidates) {
    const list = candidates.map((c) => `'${c}'`).join(',');
    const script = `@(${list}) | ForEach-Object { if ($_ -match '${pattern}') { $_ } }`;
    const { stdout } = await execFileAsync(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { timeout: 45000 }
    );
    return stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  }

  it('does not match a term that merely ends another word', async () => {
    // Found live: uninstalling Steam offered HKCU:\Software\Classes\msteams
    // and \msteamscanary -- Microsoft Teams -- already ticked for deletion.
    const hits = await matches(buildSearchPattern('Steam', 'Valve Corporation'), [
      'steam', 'steamlink', 'Steamsteamglobal', 'Valve Corporation', 'msteams', 'msteamscanary'
    ]);
    expect(hits).toEqual(['steam', 'steamlink', 'Steamsteamglobal', 'Valve Corporation']);
  }, 60000);

  it('still matches a name a program has extended with its own suffixes', async () => {
    // The trailing end is deliberately open: a program's own keys extend
    // its name far more often than not.
    const hits = await matches(buildSearchPattern('MuMuPlayer'), [
      'MuMuPlayer', 'MuMuPlayerGlobal.apk', 'MuMuPlayerGlobal', 'NotMuMuPlayer'
    ]);
    expect(hits).toEqual(['MuMuPlayer', 'MuMuPlayerGlobal.apk', 'MuMuPlayerGlobal']);
  }, 60000);

  it('does not let a very short term match inside a longer word', async () => {
    // Found live: TriClaude's publisher is "jim", and the registry scan
    // reads a startup entry's command line as well as its name. Every one
    // of those commands lives under C:\Users\jimmanol, so uninstalling
    // TriClaude offered Discord's and Roblox's startup entries, ticked.
    const hits = await matches(buildSearchPattern('TriClaude', 'jim'), [
      'jim', 'jim-tools', 'C:\\Users\\jim\\app.exe',
      'jimmanol', 'C:\\Users\\jimmanol\\AppData\\Roaming\\Discord\\Update.exe'
    ]);
    expect(hits).toEqual(['jim', 'jim-tools', 'C:\\Users\\jim\\app.exe']);
  }, 60000);

  it('still lets a short publisher match a key that is exactly its name', async () => {
    // The point is not to discard short terms -- HKLM:\Software\AMD is a
    // real leftover of a program published by AMD -- only to stop them
    // matching the middle of some other word.
    const hits = await matches(buildSearchPattern('AMD'), ['AMD', 'AMD Software', 'AMD-Chipset', 'AMDRyzenX']);
    expect(hits).toEqual(['AMD', 'AMD Software', 'AMD-Chipset']);
  }, 60000);

  it('leaves a term of ordinary length open at the end', async () => {
    // "Steam" has to keep matching "steamlink", so the closed end applies
    // only where a term is too short to be evidence on its own.
    const hits = await matches(buildSearchPattern('Steam'), ['steamlink']);
    expect(hits).toEqual(['steamlink']);
  }, 60000);

  it('treats a metacharacter in the name as the character it is', async () => {
    const hits = await matches(buildSearchPattern('Rainbow Six (R)'), [
      'Rainbow Six (R) Siege', 'Rainbow Six R Siege'
    ]);
    expect(hits).toEqual(['Rainbow Six (R) Siege']);
  }, 60000);
});
