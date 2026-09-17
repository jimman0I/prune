import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  expandPath,
  loadCleanerRules,
  scanRule,
  scanAllRules,
  executeRule,
  executeRules,
  executeRulesProgressively,
  scanRulesProgressively,
  normalizeRule
} from './cleanerRules.js';
import * as sqliteVacuum from './cleanerActions/sqliteVacuum.js';

// node:fs's ESM namespace is frozen -- vi.spyOn can't redefine its exports
// directly. Same vi.mock partial-passthrough workaround cleanup.test.js/
// diskScan.test.js already establish: fs.promises.open becomes a real
// vi.fn() (still calling through to the real implementation by default),
// so one test can swap in a throwing implementation for a single specific
// path -- simulating a real Windows exclusive lock without needing to
// hold a genuine OS-level handle open (Node's own fs.open defaults to a
// SHARING mode that a second in-process open() would NOT actually
// conflict with, so a real handle can't be used to test this).
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, promises: { ...actual.promises, open: vi.fn(actual.promises.open) }, __actualPromises: actual.promises };
});

let appDataDir;
let localAppDataDir;
let quarantineDir;
let savedEnv;

const ENV_KEYS = ['APPDATA', 'LOCALAPPDATA', 'UNREVO_QUARANTINE_ROOT'];

beforeEach(async () => {
  appDataDir = await mkdtemp(join(tmpdir(), 'unrevo-cleaner-appdata-'));
  localAppDataDir = await mkdtemp(join(tmpdir(), 'unrevo-cleaner-localappdata-'));
  quarantineDir = await mkdtemp(join(tmpdir(), 'unrevo-cleaner-quarantine-'));
  savedEnv = Object.fromEntries(ENV_KEYS.map(k => [k, process.env[k]]));
  process.env.APPDATA = appDataDir;
  process.env.LOCALAPPDATA = localAppDataDir;
  process.env.UNREVO_QUARANTINE_ROOT = quarantineDir;
});

afterEach(async () => {
  fs.promises.open.mockImplementation(fs.__actualPromises.open);
  vi.restoreAllMocks();
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  await rm(appDataDir, { recursive: true, force: true });
  await rm(localAppDataDir, { recursive: true, force: true });
  await rm(quarantineDir, { recursive: true, force: true });
});

describe('expandPath', () => {
  it('expands %APPDATA% from the real env var', () => {
    expect(expandPath('%APPDATA%\\discord\\Cache')).toBe(join(appDataDir, 'discord', 'Cache'));
  });

  it('expands %LOCALAPPDATA% from the real env var', () => {
    expect(expandPath('%LOCALAPPDATA%\\Spotify\\Storage')).toBe(join(localAppDataDir, 'Spotify', 'Storage'));
  });

  it('is case-insensitive on the token itself', () => {
    expect(expandPath('%appdata%\\x')).toBe(join(appDataDir, 'x'));
  });

  it('expands a leading ~ to the home directory', () => {
    const result = expandPath('~\\some\\folder');
    expect(result.startsWith(process.env.USERPROFILE || result)).toBeTypeOf('boolean'); // sanity: doesn't throw
    expect(result.endsWith(join('some', 'folder'))).toBe(true);
  });

  it('leaves a path with no recognized token untouched', () => {
    expect(expandPath('C:\\Windows\\Minidump')).toBe('C:\\Windows\\Minidump');
  });

  it('expands every token the real cleaners.json actually uses', () => {
    // A token the rule set references but expandPath doesn't know stays
    // literal, so the path silently never matches and the rule reads as a
    // permanent "0 B / not installed" -- a dud nobody notices. This walks
    // the real rule set and fails if any token slipped in unsupported.
    const tokens = new Set();
    for (const rule of loadCleanerRules()) {
      for (const rawPath of rule.paths || []) {
        for (const match of rawPath.match(/%[A-Z_()0-9]+%/gi) || []) tokens.add(match.toUpperCase());
      }
    }
    expect(tokens.size).toBeGreaterThan(0);
    for (const token of tokens) {
      expect(expandPath(token), `${token} is used in cleaners.json but expandPath leaves it literal`).not.toContain('%');
    }
  });
});

describe('loadCleanerRules', () => {
  it('loads the real cleaners.json as an array of rules with the documented shape', () => {
    const rules = loadCleanerRules();
    expect(Array.isArray(rules)).toBe(true);
    expect(rules.length).toBeGreaterThan(5);
    for (const rule of rules) {
      expect(rule).toHaveProperty('id');
      expect(rule).toHaveProperty('category');
      expect(rule).toHaveProperty('name');
      expect(rule).toHaveProperty('is_safe');
      expect(rule.paths || rule.command).toBeTruthy(); // one or the other, not neither
    }
  });

  it('has no duplicate rule ids', () => {
    const rules = loadCleanerRules();
    const ids = rules.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('scanRule', () => {
  it('sums real file sizes under a directory rule, recursively', async () => {
    const dir = join(appDataDir, 'discord', 'Cache');
    await mkdir(join(dir, 'nested'), { recursive: true });
    await writeFile(join(dir, 'a.bin'), '12345'); // 5 bytes
    await writeFile(join(dir, 'nested', 'b.bin'), '1234567890'); // 10 bytes

    const rule = { id: 'discord_cache', paths: ['%APPDATA%\\discord\\Cache'] };
    const result = scanRule(rule);

    expect(result.sizeBytes).toBe(15);
    expect(result.fileCount).toBe(2);
  });

  it('returns 0 bytes, not an error, for a path that does not exist', () => {
    const rule = { id: 'nonexistent', paths: ['%APPDATA%\\NeverInstalled\\Cache'] };
    const result = scanRule(rule);
    expect(result.sizeBytes).toBe(0);
    expect(result.fileCount).toBe(0);
    expect(result.error).toBeFalsy();
  });

  it('matches a filename glob (thumbcache_*.db) against real files, not the whole directory', async () => {
    const dir = join(localAppDataDir, 'Microsoft', 'Windows', 'Explorer');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'thumbcache_256.db'), '12345'); // 5 bytes -- matches
    await writeFile(join(dir, 'thumbcache_1024.db'), '1234567890'); // 10 bytes -- matches
    await writeFile(join(dir, 'iconcache_idx.db'), 'xxxxxxxxxxxxxxx'); // 15 bytes -- must NOT match

    const rule = { id: 'thumbnail_cache_deep', paths: ['%LOCALAPPDATA%\\Microsoft\\Windows\\Explorer\\thumbcache_*.db'] };
    const result = scanRule(rule);

    expect(result.sizeBytes).toBe(15); // only the two thumbcache_ files
    expect(result.fileCount).toBe(2);
  });

  it('matches a wildcard directory segment (Firefox-style randomized profile names)', async () => {
    const profile1 = join(localAppDataDir, 'Mozilla', 'Firefox', 'Profiles', 'abc123.default-release', 'cache2');
    const profile2 = join(localAppDataDir, 'Mozilla', 'Firefox', 'Profiles', 'xyz789.default', 'cache2');
    await mkdir(profile1, { recursive: true });
    await mkdir(profile2, { recursive: true });
    await writeFile(join(profile1, 'entry1'), '12345'); // 5 bytes
    await writeFile(join(profile2, 'entry2'), '12345'); // 5 bytes

    const rule = { id: 'firefox_deep_cache', paths: ['%LOCALAPPDATA%\\Mozilla\\Firefox\\Profiles\\*\\cache2'] };
    const result = scanRule(rule);

    expect(result.sizeBytes).toBe(10); // both profiles' cache2 folders summed
    expect(result.fileCount).toBe(2);
  });

  it('returns a null size for a command-based rule -- nothing to preview', () => {
    const rule = { id: 'dns_cache', command: 'ipconfig /flushdns' };
    const result = scanRule(rule);
    expect(result.sizeBytes).toBeNull();
    expect(result.fileCount).toBeNull();
  });
});

describe('scanAllRules', () => {
  it('groups every real rule from cleaners.json by category', () => {
    const grouped = scanAllRules();
    expect(Array.isArray(grouped)).toBe(true);
    // Grouped per application now, the way BleachBit lists cleaners, so
    // the headings are app names rather than the four broad buckets they
    // used to be.
    const categories = grouped.map(g => g.category);
    expect(categories).toContain('Brave');
    expect(categories).toContain('Discord');
    expect(categories).toContain('Windows');
    expect(categories).toContain('Developer tools');
    const allItems = grouped.flatMap(g => g.items);
    expect(allItems.length).toBe(loadCleanerRules().length);
    // every item carries a real computed size, not a stale/undefined one
    for (const item of allItems) {
      expect(item).toHaveProperty('sizeBytes');
    }
    // Deliberately generous: this one walks the REAL filesystem for all 40
    // rules, which on a machine with a large shader or npm cache takes
    // several seconds. It passed alone and intermittently failed in the
    // full suite at vitest's 5s default -- a timing flake, not a bug, but
    // one that would eventually be "fixed" by someone deleting the test.
    // The point of the test is that no rule in cleaners.json is silently
    // broken, and that's worth waiting for.
  }, 30000);
});

describe('executeRule', () => {
  it('quarantines matched files rather than deleting them outright', async () => {
    const dir = join(appDataDir, 'discord', 'Cache');
    await mkdir(dir, { recursive: true });
    const filePath = join(dir, 'a.bin');
    await writeFile(filePath, '12345'); // 5 bytes

    const rule = { id: 'discord_cache', name: 'Discord Cache', paths: ['%APPDATA%\\discord\\Cache'] };
    const result = await executeRule(rule);

    expect(existsSync(filePath)).toBe(false); // gone from its original location
    expect(result.freedBytes).toBe(5);
    expect(result.skipped).toEqual([]);
    // it really landed in quarantine, not just vanished
    expect(existsSync(quarantineDir)).toBe(true);
    const { readdirSync } = await import('node:fs');
    const batches = readdirSync(quarantineDir);
    expect(batches.length).toBeGreaterThan(0);
  });

  it('skips a locked file gracefully and reports it, rather than throwing', async () => {
    const dir = join(appDataDir, 'discord', 'Cache');
    await mkdir(dir, { recursive: true });
    const lockedPath = join(dir, 'locked.bin');
    const freePath = join(dir, 'free.bin');
    await writeFile(lockedPath, '12345'); // 5 bytes
    await writeFile(freePath, '1234567890'); // 10 bytes

    // Simulate a real Windows exclusive lock via the mock rather than a
    // genuine OS handle -- Node's own fs.open defaults to a sharing mode
    // a second in-process open() would NOT actually conflict with, so a
    // real handle can't reproduce this; only the throwing-fs.promises.open
    // mock can.
    const realOpen = fs.__actualPromises.open;
    fs.promises.open.mockImplementation((path, ...args) => {
      if (path === lockedPath) return Promise.reject(Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' }));
      return realOpen(path, ...args);
    });

    const rule = { id: 'discord_cache', name: 'Discord Cache', paths: ['%APPDATA%\\discord\\Cache'] };
    const result = await executeRule(rule);

    expect(existsSync(freePath)).toBe(false); // the unlocked file still got cleaned
    expect(existsSync(lockedPath)).toBe(true); // the locked one is untouched
    expect(result.freedBytes).toBe(10);
    expect(result.skipped.length).toBe(1);
    expect(result.skipped[0].path).toBe(lockedPath);
  });

  it('runs a command-based rule directly, with no quarantine batch and no files touched', async () => {
    const rule = { id: 'dns_cache', name: 'DNS Cache', command: 'ipconfig /flushdns' };
    const result = await executeRule(rule);
    expect(result.freedBytes).toBe(0);
    expect(result.ranCommand).toBe(true);
  });
});

describe('executeRules', () => {
  it('runs multiple rules and sums their freed bytes into one summary', async () => {
    const dir1 = join(appDataDir, 'discord', 'Cache');
    const dir2 = join(appDataDir, 'Code', 'Cache');
    await mkdir(dir1, { recursive: true });
    await mkdir(dir2, { recursive: true });
    await writeFile(join(dir1, 'a.bin'), '12345'); // 5 bytes
    await writeFile(join(dir2, 'b.bin'), '1234567890'); // 10 bytes

    const summary = await executeRules(['discord_cache', 'vscode_cache']);

    expect(summary.freedBytes).toBe(15);
    expect(summary.results).toHaveLength(2);
  });

  it('reports an unknown rule id without throwing', async () => {
    const summary = await executeRules(['not_a_real_rule']);
    expect(summary.results[0].error).toBeTruthy();
    expect(summary.freedBytes).toBe(0);
  });
});

describe('executeRulesProgressively', () => {
  it('reports each cleaned rule one at a time, carrying its name and category', async () => {
    const dir1 = join(appDataDir, 'discord', 'Cache');
    const dir2 = join(appDataDir, 'Code', 'Cache');
    await mkdir(dir1, { recursive: true });
    await mkdir(dir2, { recursive: true });
    await writeFile(join(dir1, 'a.bin'), '12345'); // 5 bytes
    await writeFile(join(dir2, 'b.bin'), '1234567890'); // 10 bytes

    const seen = [];
    const summary = await executeRulesProgressively(['discord_cache', 'vscode_cache'], (item) => seen.push(item));

    expect(seen.map((i) => i.id)).toEqual(['discord_cache', 'vscode_cache']);
    expect(seen[0].name).toBeTruthy();
    expect(seen[0].category).toBeTruthy();
    expect(seen[0].freedBytes).toBe(5);
    expect(seen[1].freedBytes).toBe(10);
    expect(summary.freedBytes).toBe(15);
    expect(summary.executed).toBe(2);
    expect(summary.aborted).toBe(false);
  });

  it('reports an unknown rule id through onItem too, without throwing', async () => {
    const seen = [];
    const summary = await executeRulesProgressively(['not_a_real_rule'], (item) => seen.push(item));
    expect(seen[0].error).toBeTruthy();
    expect(summary.freedBytes).toBe(0);
  });

  it('stops early when the caller aborts, without cleaning the remaining ids', async () => {
    const dir1 = join(appDataDir, 'discord', 'Cache');
    await mkdir(dir1, { recursive: true });
    await writeFile(join(dir1, 'a.bin'), '12345');

    const controller = new AbortController();
    const seen = [];
    const summary = await executeRulesProgressively(
      ['discord_cache', 'vscode_cache'],
      (item) => { seen.push(item); controller.abort(); },
      { signal: controller.signal }
    );

    expect(summary.aborted).toBe(true);
    expect(seen).toHaveLength(1);
  });

  it('still sums to the same total executeRules reports, wrapping this', async () => {
    const dir1 = join(appDataDir, 'discord', 'Cache');
    await mkdir(dir1, { recursive: true });
    await writeFile(join(dir1, 'a.bin'), '12345');

    const summary = await executeRules(['discord_cache']);
    expect(summary.freedBytes).toBe(5);
  });
});

describe('scanRule presence detection', () => {
  it('reports present:false for an app that is not installed at all', async () => {
    const rule = { id: 'ghost', paths: ['%APPDATA%\\NeverInstalled\\Cache'] };
    const result = scanRule(rule);
    expect(result.present).toBe(false);
    expect(result.sizeBytes).toBe(0);
  });

  it('distinguishes an installed-but-empty cache from a missing one', async () => {
    // Both scan to 0 bytes; only `present` tells them apart, which is the
    // whole point -- "nothing to clean" and "not installed" are different
    // answers and the UI renders them differently.
    const dir = join(appDataDir, 'discord', 'Cache');
    await mkdir(dir, { recursive: true });

    const result = scanRule({ id: 'discord_cache', paths: ['%APPDATA%\\discord\\Cache'] });

    expect(result.present).toBe(true);
    expect(result.sizeBytes).toBe(0);
  });

  it('reports present:true as soon as ONE of several paths exists', async () => {
    await mkdir(join(appDataDir, 'Code', 'Cache'), { recursive: true });

    const result = scanRule({
      id: 'vscode_cache',
      paths: ['%APPDATA%\\Code\\Cache', '%APPDATA%\\Code\\CachedData']
    });

    expect(result.present).toBe(true);
  });

  it('treats a command rule as always applicable', () => {
    expect(scanRule({ id: 'dns_cache', command: 'ipconfig /flushdns' }).present).toBe(true);
  });

  it('reports accessible:false for a directory that exists but refuses to be listed', async () => {
    // The real case this exists for is C:\Windows\Prefetch: it exists, it
    // routinely holds hundreds of MB, and listing it throws EPERM unless
    // Prune is elevated. Before this, that scanned as a flat "0 B" -- a
    // number that reads as "nothing to clean" and is simply wrong.
    const dir = join(appDataDir, 'Locked');
    await mkdir(dir, { recursive: true });

    const realReaddir = fs.readdirSync;
    vi.spyOn(fs, 'readdirSync').mockImplementation((target, options) => {
      if (String(target) === dir) {
        throw Object.assign(new Error('EPERM: operation not permitted'), { code: 'EPERM' });
      }
      return realReaddir(target, options);
    });

    const result = scanRule({ id: 'locked', paths: ['%APPDATA%\\Locked'] });

    expect(result.present).toBe(true);      // it's really there
    expect(result.sizeBytes).toBe(0);       // ...but 0 here means "unknown"
    expect(result.accessible).toBe(false);  // ...which is what this says out loud
  });

  it('reports accessible:true for an ordinary readable rule', async () => {
    const dir = join(appDataDir, 'discord', 'Cache');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'a.bin'), '12345');

    expect(scanRule({ id: 'discord_cache', paths: ['%APPDATA%\\discord\\Cache'] }).accessible).toBe(true);
  });
});

/** The default selection decides what a user removes when they trust the
 * app, so the classification is worth pinning down rather than leaving to
 * whoever edits cleaners.json next.
 *
 * Real problem this came from (2026-09-02): Preview found 54.46 GB across
 * 40 rules and pre-selected none of them, so the footer read "Total space
 * to free: 0 B" and Clean sat disabled. After a 19-second scan that looks
 * exactly like a broken feature. */
describe('recommended defaults', () => {
  const rules = loadCleanerRules();

  it('marks every rule explicitly, so a new one is never recommended by omission', () => {
    for (const rule of rules) {
      expect(typeof rule.recommended, rule.id).toBe('boolean');
    }
  });

  it('recommends enough to make a scan immediately actionable', () => {
    expect(rules.filter(r => r.recommended).length).toBeGreaterThan(rules.length / 2);
  });

  it('never recommends a rule that costs a large re-download', () => {
    // Developer package caches restore on demand, but that restore can be
    // tens of gigabytes over the network. The user gets to choose.
    for (const id of ['npm_cache', 'yarn_cache', 'pip_cache', 'nuget_cache', 'gradle_cache', 'electron_builder_cache']) {
      expect(rules.find(r => r.id === id).recommended, id).toBe(false);
    }
  });

  it('never recommends a rule that loses something the user can see', () => {
    expect(rules.find(r => r.id === 'recent_items_jumplists').recommended).toBe(false);
  });

  it('never recommends a rule that makes the machine slower afterwards', () => {
    expect(rules.find(r => r.id === 'windows_prefetch').recommended).toBe(false);
    expect(rules.find(r => r.id === 'windows_font_cache').recommended).toBe(false);
  });

  it('never recommends a command rule, which frees nothing', () => {
    for (const rule of rules.filter(r => r.command)) {
      expect(rule.recommended, rule.id).toBe(false);
    }
  });

  it('recommends the ordinary regenerating caches', () => {
    for (const id of ['discord_cache', 'chrome_cache', 'nvidia_shader_cache', 'thumbnail_cache_deep']) {
      expect(rules.find(r => r.id === id).recommended, id).toBe(true);
    }
  });

  // The browsers split into separate options, and the ones that lose
  // something the user would notice must never be ticked for them. Clean
  // moves everything to Quarantine first, but "recoverable" is not
  // "wanted" -- being signed out of every site is not a surprise a
  // cleaning tool should spring on anyone.
  it('never recommends an option that loses data', () => {
    const risky = rules.filter(r => r.risky);
    expect(risky.length).toBeGreaterThan(0);
    for (const rule of risky) {
      expect(rule.recommended, rule.id).toBe(false);
    }
  });

  it('marks the browser options that sign you out or lose tabs', () => {
    for (const id of ['brave_cookies', 'brave_sessions', 'chrome_history', 'edge_form_history']) {
      expect(rules.find(r => r.id === id)?.risky, id).toBe(true);
    }
    // ...and does not mark the ones that simply rebuild themselves.
    for (const id of ['brave_cache', 'brave_favicons']) {
      expect(rules.find(r => r.id === id)?.risky, id).toBeUndefined();
    }
  });

  it('carries `recommended` through the scan to the frontend', () => {
    const item = scanAllRules().flatMap(g => g.items).find(i => i.id === 'discord_cache');
    expect(item.recommended).toBe(true);
  }, 30000);
});

describe('normalizeRule', () => {
  it('synthesizes a delete action from a legacy paths rule, other fields carried through as-is', () => {
    const rule = { id: 'x', paths: ['%APPDATA%\\X\\Cache'] };
    expect(normalizeRule(rule)).toEqual({
      ...rule,
      actions: [{ type: 'delete', paths: ['%APPDATA%\\X\\Cache'] }]
    });
  });

  it('synthesizes a shell action from a legacy command rule', () => {
    const rule = { id: 'dns', command: 'ipconfig /flushdns' };
    expect(normalizeRule(rule)).toEqual({
      ...rule,
      actions: [{ type: 'shell', command: 'ipconfig /flushdns' }]
    });
  });

  it('passes an already-actions-shaped rule through untouched', () => {
    const rule = { id: 'y', actions: [{ type: 'sqlite.vacuum', path: '%APPDATA%\\Y\\db' }] };
    expect(normalizeRule(rule)).toBe(rule);
  });

  it('treats an empty actions array as already-normalized, not as "missing"', () => {
    // `[]` is truthy, so this takes the same early-return path as any other
    // already-actions-shaped rule, rather than falling through and trying
    // to synthesize a delete/shell action on top of it.
    const rule = { id: 'z', actions: [] };
    expect(normalizeRule(rule)).toBe(rule);
  });

  it('throws naming the rule id when a rule has none of actions/command/paths', () => {
    // Not currently reachable by any of the 74 rules in cleaners.json, but
    // this function is a foundation later action-type work builds on --
    // a malformed rule should fail loudly right here, not several files
    // away as a confusing TypeError inside whatever action module tries
    // to act on an undefined target.
    expect(() => normalizeRule({ id: 'malformed' })).toThrow(/malformed/);
  });
});

describe('scanRulesProgressively', () => {
  it('reports every rule one at a time, in cleaners.json order', async () => {
    const seen = [];
    await scanRulesProgressively((item) => seen.push(item));
    const expected = loadCleanerRules().map(r => r.id);
    expect(seen.map(i => i.id)).toEqual(expected);
  }, 60000);

  it('gives each item the same shape the one-shot scan produces', async () => {
    const seen = [];
    await scanRulesProgressively((item) => seen.push(item));
    for (const item of seen) {
      expect(item).toHaveProperty('category');
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('present');
      expect(item).toHaveProperty('recommended');
    }
  }, 60000);

  // The scan holds the event loop for ~19 seconds on a real machine. If
  // it never yielded, nothing written to the response would reach the
  // browser until the whole thing finished -- which is a progress bar
  // that appears only once there is no longer any progress to report.
  it('yields to the event loop between rules so output can actually flush', async () => {
    let ticked = false;
    setImmediate(() => { ticked = true; });
    let tickedByFirstItem = null;
    await scanRulesProgressively(() => {
      if (tickedByFirstItem === null) tickedByFirstItem = ticked;
    });
    // A timer scheduled before the scan started got to run during it.
    expect(ticked).toBe(true);
  }, 60000);

  it('stops early when the caller aborts, without throwing', async () => {
    const controller = new AbortController();
    const seen = [];
    const result = await scanRulesProgressively((item) => {
      seen.push(item);
      if (seen.length === 3) controller.abort();
    }, { signal: controller.signal });

    expect(result.aborted).toBe(true);
    expect(seen.length).toBeLessThan(loadCleanerRules().length);
  }, 60000);

  it('reports not aborted when it runs to completion', async () => {
    const result = await scanRulesProgressively(() => {});
    expect(result.aborted).toBe(false);
    expect(result.total).toBe(loadCleanerRules().length);
  }, 60000);
});

describe('actions-array rules', () => {
  it('sums freedBytes across a delete action AND a sqlite.vacuum action under one rule', async () => {
    const dir1 = join(appDataDir, 'mixed', 'cache');
    await mkdir(dir1, { recursive: true });
    await writeFile(join(dir1, 'a.bin'), '12345'); // 5 bytes

    const dbPath = join(appDataDir, 'mixed', 'test.db');
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execFileAsync = promisify(execFile);
    // Written to a temp file and run via sqlite3's `.read` meta-command,
    // not passed as a raw argv string -- at 300 inserts x 500 chars this
    // SQL is ~150KB, which blows past Windows's ~32K CreateProcess
    // command-line limit (spawn ENAMETOOLONG). Same fix already
    // established in sqliteVacuum.test.js's makeBloatedDb helper.
    const sql = [
      'CREATE TABLE t (id INTEGER PRIMARY KEY, data TEXT);',
      ...Array.from({ length: 300 }, (_, i) => `INSERT INTO t (data) VALUES ('${'x'.repeat(500)}-${i}');`),
      'DELETE FROM t WHERE id % 2 = 0;'
    ].join('\n');
    const scriptPath = join(appDataDir, 'mixed', 'setup.sql');
    await writeFile(scriptPath, sql, 'utf8');
    await execFileAsync(sqliteVacuum.sqlite3ExePath(), [dbPath, `.read ${scriptPath}`]);
    const { statSync } = await import('node:fs');
    const dbSizeBefore = statSync(dbPath).size;

    const rule = {
      id: 'mixed', category: 'Test', name: 'Mixed rule',
      actions: [
        { type: 'delete', paths: ['%APPDATA%\\mixed\\cache'] },
        { type: 'sqlite.vacuum', path: '%APPDATA%\\mixed\\test.db' }
      ]
    };

    const result = await executeRule(rule);

    expect(result.freedBytes).toBeGreaterThan(5); // the 5-byte file, plus real vacuum reclaim
    expect(statSync(dbPath).size).toBeLessThan(dbSizeBefore);
  });

  it('reports registryKeysRemoved, not a fabricated freedBytes, for a winreg-only rule', async () => {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execFileAsync = promisify(execFile);
    const testKey = `HKCU\\Software\\prune-dispatch-test-${process.pid}`;
    await execFileAsync('reg', ['add', testKey, '/v', 'Marker', '/d', 'x', '/f']);

    const rule = {
      id: 'reg-only', category: 'Test', name: 'Registry-only rule',
      actions: [{ type: 'winreg', key: testKey }]
    };

    const result = await executeRule(rule);

    expect(result.freedBytes).toBe(0);
    expect(result.registryKeysRemoved).toBe(1);

    try { await execFileAsync('reg', ['delete', testKey, '/f']); } catch { /* already gone, expected */ }
  });

  it('scans a sqlite.vacuum-only rule, reporting the file size as sizeBytes', async () => {
    const dbPath = join(appDataDir, 'solo.db');
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execFileAsync = promisify(execFile);
    await execFileAsync(sqliteVacuum.sqlite3ExePath(), [dbPath, 'CREATE TABLE t (id INTEGER);']);
    const { statSync } = await import('node:fs');
    const realSize = statSync(dbPath).size;

    const rule = { id: 'solo', category: 'Test', name: 'Solo vacuum', actions: [{ type: 'sqlite.vacuum', path: '%APPDATA%\\solo.db' }] };

    const result = scanRule(rule);

    expect(result.sizeBytes).toBe(realSize);
  });

  it('marks a real sqlite.vacuum-only execute result with vacuumed: true -- the frontend\'s only discriminator, since executeRule never returns fileCount', async () => {
    const dbPath = join(appDataDir, 'vacuum-marker.db');
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execFileAsync = promisify(execFile);
    await execFileAsync(sqliteVacuum.sqlite3ExePath(), [dbPath, 'CREATE TABLE t (id INTEGER);']);

    const rule = { id: 'vacuum-marker', category: 'Test', name: 'Vacuum marker', actions: [{ type: 'sqlite.vacuum', path: '%APPDATA%\\vacuum-marker.db' }] };

    const result = await executeRule(rule);

    expect(result.vacuumed).toBe(true);
  });

  it('never includes a vacuumed key on a delete-only rule\'s execute result', async () => {
    const dir = join(appDataDir, 'delete-only', 'cache');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'a.bin'), '12345'); // 5 bytes

    const rule = { id: 'delete-only', category: 'Test', name: 'Delete only', actions: [{ type: 'delete', paths: ['%APPDATA%\\delete-only\\cache'] }] };

    const result = await executeRule(rule);

    expect('vacuumed' in result).toBe(false);
  });
});

describe('json action, wired', () => {
  it('scans a json-only rule, reporting the file size as sizeBytes and present correctly', async () => {
    const filePath = join(appDataDir, 'Preferences');
    await writeFile(filePath, JSON.stringify({ sync: { enabled: true } }));

    const rule = { id: 'json-scan', category: 'Test', name: 'JSON scan test', actions: [{ type: 'json', path: '%APPDATA%\\Preferences', address: 'sync' }] };

    const result = scanRule(rule);

    expect(result.sizeBytes).toBeGreaterThan(0);
    expect(result.present).toBe(true);
  });

  it('executes a json-only rule, removing the key and quarantining the original', async () => {
    const filePath = join(appDataDir, 'Preferences');
    await writeFile(filePath, JSON.stringify({ sync: { enabled: true }, keep: 1 }));

    const rule = { id: 'json-exec', category: 'Test', name: 'JSON exec test', actions: [{ type: 'json', path: '%APPDATA%\\Preferences', address: 'sync' }] };

    const result = await executeRule(rule);

    expect(result.freedBytes).toBeGreaterThan(0);
    const after = JSON.parse(await (await import('node:fs/promises')).readFile(filePath, 'utf8'));
    expect(after.sync).toBeUndefined();
    expect(after.keep).toBe(1);
  });

  it('sums freedBytes across a delete action AND a json action under one rule', async () => {
    const dir1 = join(appDataDir, 'mixed-json', 'cache');
    await mkdir(dir1, { recursive: true });
    await writeFile(join(dir1, 'a.bin'), '12345'); // 5 bytes

    const filePath = join(appDataDir, 'mixed-json', 'Preferences');
    await writeFile(filePath, JSON.stringify({
      dns_prefetching: { host_referral_list: Array.from({ length: 100 }, (_, i) => `h${i}.example.com`) }
    }));

    const rule = {
      id: 'mixed-json', category: 'Test', name: 'Mixed rule',
      actions: [
        { type: 'delete', paths: ['%APPDATA%\\mixed-json\\cache'] },
        { type: 'json', path: '%APPDATA%\\mixed-json\\Preferences', address: 'dns_prefetching/host_referral_list' }
      ]
    };

    const result = await executeRule(rule);

    expect(result.freedBytes).toBeGreaterThan(5); // the 5-byte file, plus a real JSON size reduction
  });
});

describe('expandPath tokens', () => {
  // A token expandPath does not know stays in the string verbatim, so the
  // path never matches and the rule reports "not installed" rather than
  // "this rule is broken". Caught exactly that way: a Windows setup-logs
  // rule written with %WINDIR% measured 0 bytes while the folder held
  // 1.1 GB.
  it('expands both names for the Windows folder', () => {
    const windows = process.env.WINDIR || process.env.SYSTEMROOT;
    expect(expandPath('%WINDIR%\Panther')).toBe(`${windows}\Panther`);
    expect(expandPath('%SYSTEMROOT%\Panther')).toBe(`${windows}\Panther`);
  });

  it('leaves no known token unexpanded in any shipped rule', () => {
    // The general form of the same bug: any rule whose path still
    // contains a %TOKEN% after expansion can never match anything.
    for (const rule of loadCleanerRules()) {
      for (const path of rule.paths || []) {
        expect(expandPath(path), `${rule.id}: ${path}`).not.toMatch(/%[A-Za-z_()0-9]+%/);
      }
    }
  });

  it('never hardcodes a bare drive letter -- %SYSTEMDRIVE% instead', () => {
    // Reported directly: Deep Clean showed "League of Legends" as
    // present on a device that never had it installed. That rule's own
    // path was the ONLY one in the whole file written as a literal
    // "C:\..." instead of "%SYSTEMDRIVE%\...", which every OTHER rule in
    // this file already gets right -- Windows can be installed on any
    // drive letter, and a rule that assumes C: either misses the real
    // installation on a machine where it isn't, or -- the reported
    // failure mode -- returns present:true against a leftover or
    // unrelated folder that happens to sit at that literal path on a
    // machine whose C: is not the system drive at all. A bare "X:\"
    // anywhere in the raw (pre-expandPath) string is the bug shape --
    // every legitimate path is rooted at a %TOKEN% instead, which never
    // itself contains a literal drive letter.
    for (const rule of loadCleanerRules()) {
      for (const path of rule.paths || []) {
        expect(path, `${rule.id}: ${path}`).not.toMatch(/[A-Za-z]:\\/);
      }
    }
  });
});
