import { describe, it, expect } from 'vitest';
import { rulePathsExist, loadCleanerRules } from './cleanerRules.js';

/** Whether a rule applies to this machine, asked of the REAL function.
 *
 * This file exists because of a bug that shipped into a packaged build.
 * /deep-clean/rules started calling rulePathsExist directly and threw
 * "rule.paths is not iterable" on the one command rule in the set --
 * dns_cache, which is `ipconfig /flushdns` and has no paths at all.
 * scanRule had always guarded that case before reaching the function, so
 * lifting the function out of its calling context left the guard behind.
 *
 * The route's own test could not have caught it: it mocks rulePathsExist,
 * so the real one never ran against real data. That is the gap this file
 * closes -- it executes the actual function over the actual shipped rule
 * set.
 */

describe('rulePathsExist', () => {
  it('does not throw on any rule in the shipped set', () => {
    // The whole bug, as one assertion. 74 rules, one of which has no
    // paths key at all.
    for (const rule of loadCleanerRules()) {
      expect(() => rulePathsExist(rule), rule.id).not.toThrow();
    }
  });

  it('calls a command rule applicable, having no paths to check', () => {
    // `ipconfig /flushdns` works whether or not anything is cached, so
    // "not installed" would be the wrong answer as well as a crash.
    expect(rulePathsExist({ id: 'dns_cache', command: 'ipconfig /flushdns' })).toBe(true);
  });

  it('survives a rule with no paths and no command', () => {
    expect(rulePathsExist({ id: 'malformed' })).toBe(false);
    expect(rulePathsExist({ id: 'empty', paths: [] })).toBe(false);
  });

  it('is false for a path that is not on this machine', () => {
    expect(rulePathsExist({ id: 'nope', paths: ['X:\\definitely\\not\\here'] })).toBe(false);
  });

  it('is true for a path that really is', () => {
    // Expanded through the same token reader the rule set uses, so this
    // covers expansion as well as existence.
    expect(rulePathsExist({ id: 'win', paths: ['%SYSTEMROOT%\\explorer.exe'] })).toBe(true);
  });

  it('resolves a wildcard segment the way the rule set writes them', () => {
    // Chrome-family rules all glob the profile folder:
    // "...\\User Data\\*\\Cache". A star in a MIDDLE segment has to be
    // walked rather than handed to existsSync, and this is the assertion
    // that proves the walk happens: C:\Windows\explorer.exe would match a
    // plain existsSync, but C:\Windows\*\explorer.exe only resolves if
    // the directory listing is actually read. It matches SysWOW64's copy.
    expect(rulePathsExist({ id: 'glob', paths: ['%SYSTEMROOT%\\*\\explorer.exe'] })).toBe(true);
    // A star that matches directories but leads nowhere real.
    expect(rulePathsExist({ id: 'glob-miss', paths: ['%SYSTEMROOT%\\*\\definitely-not-here.exe'] })).toBe(false);
    // A trailing-name glob, the other shape the rule set uses
    // ("thumbcache_*.db").
    expect(rulePathsExist({ id: 'glob-tail', paths: ['%SYSTEMROOT%\\explor*.exe'] })).toBe(true);
  });
});
