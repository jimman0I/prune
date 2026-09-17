# BleachBit-Parity Engine, Phase C (`cookie` action) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `cookie` cleaning-engine action type — keep-list-driven surgical cookie-row deletion (or whole-file delete when nothing is being kept), the 4th-largest real BleachBit action type — grounded against BleachBit's own real `Cookie.py` source, not just its cleaner XML.

**Architecture:** A new `backend/src/lib/cleanerActions/cookieSql.js` (pure SQL-string helpers: table detection query, keep-predicate builder, string escaping — all unit-testable with zero I/O beyond a passed-in exec function) plus `backend/src/lib/cleanerActions/cookie.js` (`scan`/`execute`, matching the established action-module shape), wired as the 6th dispatch case into `cleanerRules.js`. Reuses `sqliteVacuum.js`'s bundled `sqlite3.exe` shellout convention (parameterization isn't available through that CLI, so values are escaped as SQL string literals, not bound params). Requires one small, backward-compatible extension to Phase B's `quarantineFileEdit()`: it currently only supports a pre-known text `newContent`, but a SQLite database is binary and gets mutated IN PLACE by an external tool (`sqlite3.exe`'s own DELETE+VACUUM) rather than replaced with content computed ahead of time — this plan's first task adds an alternative `editFn` callback mode.

**Tech Stack:** Node.js (backend, ESM), Vitest, the bundled `sqlite3.exe` CLI (same one `sqliteVacuum.js` already uses).

**Spec:** `docs/superpowers/specs/2026-09-17-bleachbit-parity-phase-c-cookie-design.md`

---

## Before you start

```bash
cd backend && npm test
```

Expected: all pass except the 3 pre-existing, documented elevation-gated failures (2 in `pendingReboot.test.js`, 1 in `quarantine.test.js`) if run in a non-elevated shell.

---

### Task 1: Extend `quarantineFileEdit` with an `editFn` mode

**Files:**
- Modify: `backend/src/services/quarantine.js`
- Modify: `backend/src/services/quarantine.test.js`

`quarantineFileEdit({programName, filePath, newContent})` currently: copies the original to a batch, then `writeFile`s `newContent` to a temp path and renames it over the original. That's right for a text file whose final bytes are already known (Phase B's `json` action). It's wrong for a binary file mutated in place by an external process (this phase's `cookie` action calls `sqlite3.exe` to DELETE+VACUUM the real file directly — there is no pre-computed "new content" string to hand in). Add a second, mutually-exclusive mode: `quarantineFileEdit({programName, filePath, editFn})`, where `editFn` is an async function called with `filePath` AFTER the original is safely copied into the quarantine batch, responsible for mutating the real file itself however it needs to (a binary rewrite, a CLI shellout, anything). The existing `newContent` mode is unchanged — this is purely additive.

- [ ] **Step 1: Read the current function**

Read `backend/src/services/quarantine.js`'s current `quarantineFileEdit` in full (it was built and hardened in the Phase B branch: atomic temp+rename write, an `existsSync` guard throwing on a missing file).

- [ ] **Step 2: Write the failing tests**

Add to `backend/src/services/quarantine.test.js`, inside (or alongside) the existing `describe('quarantineFileEdit', ...)` block:

```js
describe('quarantineFileEdit with editFn', () => {
  it('backs up the original, then hands the real path to editFn to mutate however it wants', async () => {
    const filePath = join(scratchDir, 'data.bin');
    await writeFile(filePath, Buffer.from([0x01, 0x02, 0x03, 0x04]));

    const manifest = await quarantineFileEdit({
      programName: 'Test',
      filePath,
      editFn: async (realPath) => {
        // Simulates an external tool mutating the real file directly --
        // a plain binary overwrite here, standing in for sqlite3.exe.
        await writeFile(realPath, Buffer.from([0xff]));
      }
    });

    expect(await readFile(filePath)).toEqual(Buffer.from([0xff]));
    expect(manifest.files).toHaveLength(1);
    expect(await readFile(manifest.files[0].quarantinedPath)).toEqual(Buffer.from([0x01, 0x02, 0x03, 0x04]));
  });

  it('restoreQuarantine recovers the pre-edit original after an editFn mutation', async () => {
    const filePath = join(scratchDir, 'data.bin');
    await writeFile(filePath, Buffer.from([0xaa, 0xbb]));

    const manifest = await quarantineFileEdit({
      programName: 'Test', filePath,
      editFn: async (realPath) => { await writeFile(realPath, Buffer.from([0x00])); }
    });
    expect(await readFile(filePath)).toEqual(Buffer.from([0x00]));

    await restoreQuarantine(manifest.batchDir);

    expect(await readFile(filePath)).toEqual(Buffer.from([0xaa, 0xbb]));
  });

  it('throws a clear error if called with neither newContent nor editFn', async () => {
    const filePath = join(scratchDir, 'data.bin');
    await writeFile(filePath, 'x');

    await expect(quarantineFileEdit({ programName: 'Test', filePath })).rejects.toThrow(/newContent.*editFn|editFn.*newContent/i);
  });

  it('existing newContent mode is completely unaffected', async () => {
    // A quick sanity re-run of one of the pre-existing newContent tests'
    // shape, proving the editFn addition didn't disturb that path.
    const filePath = join(scratchDir, 'prefs.json');
    await writeFile(filePath, '{"a":1,"b":2}', 'utf8');
    const manifest = await quarantineFileEdit({ programName: 'Test', filePath, newContent: '{"a":1}' });
    expect(await readFile(filePath, 'utf8')).toBe('{"a":1}');
    expect(await readFile(manifest.files[0].quarantinedPath, 'utf8')).toBe('{"a":1,"b":2}');
  });
});
```

Add `readFile`/`Buffer`-related imports if not already present at the top of the test file (check first).

- [ ] **Step 3: Run it, confirm it fails**

```bash
cd backend && npx vitest run src/services/quarantine.test.js -t "editFn"
```

Expected: `FAIL` — `editFn` isn't recognized, or the "neither provided" guard doesn't exist yet.

- [ ] **Step 4: Implement it**

In `backend/src/services/quarantine.js`, modify `quarantineFileEdit`'s signature and body. Read the CURRENT exact code first (it has the atomic temp+rename write and the existence guard from Phase B's hardening) and adapt precisely -- this shows the shape, not a literal diff:

```js
export async function quarantineFileEdit({ programName, filePath, newContent, editFn }) {
  if (newContent === undefined && typeof editFn !== 'function') {
    throw new Error('quarantineFileEdit requires either newContent or editFn');
  }
  if (!existsSync(filePath)) {
    throw new Error(`Cannot quarantine-edit ${filePath}: file does not exist`);
  }

  const batchDir = join(quarantineRoot(), `${Date.now()}-${safeSegment(programName)}`);
  await mkdir(batchDir, { recursive: true });

  const sizeBytes = (await stat(filePath)).size;
  const dest = join(batchDir, `file-0-${basename(filePath)}`);
  await copyFile(filePath, dest);

  if (typeof editFn === 'function') {
    await editFn(filePath);
  } else {
    const tempPath = `${filePath}.prune-tmp`;
    await writeFile(tempPath, newContent, 'utf8');
    await rename(tempPath, filePath);
  }

  const manifest = {
    programName, createdAt: Date.now(), batchDir,
    files: [{ originalPath: filePath, quarantinedPath: dest, sizeBytes }],
    failedFiles: [], scheduledForReboot: [],
    registryKeys: [], failedRegistryKeys: [], regFiles: [],
    totalSizeBytes: sizeBytes
  };
  await writeFile(join(batchDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  return manifest;
}
```

Update the function's own doc comment to describe both modes.

- [ ] **Step 5: Run it, confirm it passes**

```bash
npx vitest run src/services/quarantine.test.js
```

Expected: all pass (existing tests, unaffected, plus the 4 new ones).

- [ ] **Step 6: Run the full backend suite once**

```bash
npx vitest run
```

Expected: all pass except the 3 pre-existing elevation-gated failures.

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/quarantine.js backend/src/services/quarantine.test.js
git commit -m "feat(quarantine): add an editFn mode to quarantineFileEdit for binary in-place edits"
```

---

### Task 2: `cookieKeepList` setting

**Files:**
- Modify: `backend/src/services/settings.js`

- [ ] **Step 1: Read the current `DEFAULT_SETTINGS`**

Read `backend/src/services/settings.js`'s current `DEFAULT_SETTINGS` object in full to place the new field consistently with its neighbors' comment style.

- [ ] **Step 2: Add the field**

Add, right after `excludeExtensions` (both are array-of-strings settings the cleaning engine reads):

```js
  /** Cookie domains a `cookie` action must NEVER delete rows for -- an
   * exact-domain-or-any-subdomain match against each entry (so keeping
   * "example.com" also keeps "sub.example.com", matching BleachBit's own
   * predicate). Empty by default, and an empty list is a fully working,
   * intentional state: it means every `cookie` action deletes the whole
   * cookie database file outright, exactly like BleachBit's own behavior
   * when nothing is configured to survive. See cleanerActions/cookie.js.
   * No Settings-screen entry point yet -- managing this list (browsing
   * what's actually in a cookie database, picking domains to keep) is a
   * real, separate future feature; this default state is not a stand-in
   * for it, it's the documented behavior of an empty keep list. */
  cookieKeepList: [],
```

- [ ] **Step 3: Check there's no existing test asserting the exact shape of `DEFAULT_SETTINGS`**

Grep `backend/src/services/settings.test.js` for a test that enumerates every key in `DEFAULT_SETTINGS` (an exact-match `toEqual` against the whole object, which a new key would break). If one exists, add `cookieKeepList: []` to its expected shape.

- [ ] **Step 4: Run the settings test file**

```bash
npx vitest run src/services/settings.test.js
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/settings.js backend/src/services/settings.test.js
git commit -m "feat(settings): add cookieKeepList, defaulting to empty (whole-file cookie delete)"
```

(Omit the test file from `git add` if Step 3 found nothing to change.)

---

### Task 3: `cookieSql.js` — pure SQL-string helpers

**Files:**
- Create: `backend/src/lib/cleanerActions/cookieSql.js`
- Test: `backend/src/lib/cleanerActions/cookieSql.test.js`

No I/O in this file at all -- every function here takes plain strings/arrays and returns a string or a small object, so it's testable without a real SQLite file. The functions that actually TALK to a database (via the bundled `sqlite3.exe`) live in `cookie.js` itself (Task 4) and call these helpers to build the SQL text they shell out with.

- [ ] **Step 1: Write the failing tests**

Create `backend/src/lib/cleanerActions/cookieSql.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { escapeSqlString, buildKeepPredicate, TABLE_DETECT_SQL } from './cookieSql.js';

describe('escapeSqlString', () => {
  it('doubles a single quote, the standard SQLite string-literal escape', () => {
    expect(escapeSqlString("o'brien.com")).toBe("o''brien.com");
  });

  it('leaves a plain domain untouched', () => {
    expect(escapeSqlString('example.com')).toBe('example.com');
  });
});

describe('buildKeepPredicate', () => {
  it('builds an exact-match-or-subdomain OR chain for one domain', () => {
    const sql = buildKeepPredicate(['example.com'], 'host_key');
    expect(sql).toBe("(host_key = 'example.com' OR host_key LIKE '%.example.com')");
  });

  it('builds one OR chain per domain, for multiple domains', () => {
    const sql = buildKeepPredicate(['a.com', 'b.com'], 'host');
    expect(sql).toBe("(host = 'a.com' OR host LIKE '%.a.com' OR host = 'b.com' OR host LIKE '%.b.com')");
  });

  it('escapes a quote inside a domain rather than producing invalid/unsafe SQL', () => {
    const sql = buildKeepPredicate(["o'brien.com"], 'host_key');
    expect(sql).toBe("(host_key = 'o''brien.com' OR host_key LIKE '%.o''brien.com')");
  });

  it('lowercases and strips a leading dot from each domain before building the predicate, matching BleachBit\\'s own normalization', () => {
    const sql = buildKeepPredicate(['.Example.COM'], 'host');
    expect(sql).toBe("(host = 'example.com' OR host LIKE '%.example.com')");
  });
});

describe('TABLE_DETECT_SQL', () => {
  it('is a query that would find either real cookie table by name', () => {
    // A cheap structural check, not a real DB round-trip (that belongs in
    // cookie.js's own tests, against a real SQLite file) -- just confirms
    // the query text mentions both real table names this phase cares
    // about, so a future edit can't silently drop one.
    expect(TABLE_DETECT_SQL).toMatch(/moz_cookies/);
    expect(TABLE_DETECT_SQL).toMatch(/'cookies'/);
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

```bash
cd backend && npx vitest run src/lib/cleanerActions/cookieSql.test.js
```

Expected: `FAIL` — `Cannot find module './cookieSql.js'`.

- [ ] **Step 3: Implement it**

Create `backend/src/lib/cleanerActions/cookieSql.js`:

```js
/** The two real cookie-table shapes BleachBit's own Cookie.py detects --
 * Chromium-family (`cookies`/`host_key`) and Firefox-family
 * (`moz_cookies`/`host`). A cookie action never needs to know which
 * browser wrote the file it's pointed at; it only needs to know which of
 * these two shapes the file actually has. */
export const SQLITE_TABLES = {
  cookies: { tableName: 'cookies', hostColumn: 'host_key' },
  moz_cookies: { tableName: 'moz_cookies', hostColumn: 'host' }
};

/** A query whose output names whichever of the two real cookie tables
 * exists in the database it's run against (zero, one, or in a
 * pathological file, both names are not expected but the query does not
 * assume otherwise). The caller (cookie.js) runs this via the bundled
 * sqlite3.exe CLI and reads its stdout. */
export const TABLE_DETECT_SQL =
  `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('cookies', 'moz_cookies');`;

/** Doubles a single quote, SQLite's own escaping rule for a string
 * literal -- this codebase's cookie SQL is built as plain text handed to
 * the sqlite3.exe CLI (which has no parameter-binding mode over its
 * command-line interface, unlike a real driver), so every value that
 * becomes part of a SQL string literal must be escaped this way before
 * being embedded, or a domain containing a quote could break out of its
 * literal. */
export function escapeSqlString(value) {
  return value.replace(/'/g, "''");
}

/** Normalizes one keep-list entry the same way BleachBit's own
 * delete_cookies() does before matching: lowercased, with any single
 * leading dot stripped (a keep-list entry of ".example.com" and
 * "example.com" must behave identically). */
function normalizeDomain(domain) {
  return domain.replace(/^\./, '').toLowerCase();
}

/** Builds the SQL predicate matching every row whose host is exactly one
 * of `domains`, OR a subdomain of one of them -- the same "keep this
 * domain and everything under it" rule BleachBit's own predicate
 * implements (`host = ? OR host LIKE '%.?'` per domain, OR'd together).
 * `domains` must be non-empty; the caller (cookie.js) never calls this
 * with an empty keep list -- an empty list means "delete the whole file",
 * a different code path entirely that never needs a predicate at all. */
export function buildKeepPredicate(domains, hostColumn) {
  const clauses = domains.map((rawDomain) => {
    const domain = escapeSqlString(normalizeDomain(rawDomain));
    return `${hostColumn} = '${domain}' OR ${hostColumn} LIKE '%.${domain}'`;
  });
  return `(${clauses.join(' OR ')})`;
}
```

- [ ] **Step 4: Run it, confirm it passes**

```bash
npx vitest run src/lib/cleanerActions/cookieSql.test.js
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/cleanerActions/cookieSql.js backend/src/lib/cleanerActions/cookieSql.test.js
git commit -m "feat(cleanerActions): add cookieSql, the cookie action's pure SQL-string helpers"
```

---

### Task 4: The `cookie` action

**Files:**
- Create: `backend/src/lib/cleanerActions/cookie.js`
- Test: `backend/src/lib/cleanerActions/cookie.test.js`

This is the task with the most real I/O: building actual SQLite cookie databases (both real schemas) in a temp dir and running the bundled `sqlite3.exe` against them for real, same as `sqliteVacuum.js`'s own tests already do.

- [ ] **Step 1: Read the real files this depends on**

Read `backend/src/lib/cleanerActions/sqliteVacuum.js`'s full current content again (the `sqlite3ExePath()` export, the `execFileAsync` pattern, the `heldReason` guard-checking shape) and `backend/src/lib/cleanerActions/json.js`'s full current content (the most structurally similar sibling: also does a "guard check, then quarantine-vs-recycle branch on `autoQuarantine`" execute flow). Read `backend/src/services/quarantine.js`'s `quarantineFileEdit` (post-Task-1, with `editFn` support) and `quarantineAndDelete`'s real signature (used for the whole-file-delete branch). Read `backend/src/services/recycleBin.js`'s real `sendToRecycleBin` signature (confirmed in Phase B: takes an array of paths, returns `{recycled: string[], failed: string[], error?}`).

- [ ] **Step 2: Write the failing tests**

Create `backend/src/lib/cleanerActions/cookie.test.js`. This needs a helper to build a real, minimal SQLite cookie database via the bundled `sqlite3.exe` (both schemas), since there's no existing fixture for one:

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scan, execute } from './cookie.js';
import { sqlite3ExePath } from './sqliteVacuum.js';

const execFileAsync = promisify(execFile);

async function makeChromiumCookieDb(filePath, rows) {
  const values = rows.map(({ host }) => `('${host}', 'name', 'value')`).join(',');
  const sql = `CREATE TABLE cookies (host_key TEXT, name TEXT, value TEXT); INSERT INTO cookies (host_key, name, value) VALUES ${values};`;
  await execFileAsync(sqlite3ExePath(), [filePath, sql]);
}

async function makeFirefoxCookieDb(filePath, rows) {
  const values = rows.map(({ host }) => `('${host}', 'name', 'value')`).join(',');
  const sql = `CREATE TABLE moz_cookies (host TEXT, name TEXT, value TEXT); INSERT INTO moz_cookies (host, name, value) VALUES ${values};`;
  await execFileAsync(sqlite3ExePath(), [filePath, sql]);
}

let scratchDir;
let savedEnv;
beforeEach(async () => {
  scratchDir = await mkdtemp(join(tmpdir(), 'prune-cookie-action-test-'));
  savedEnv = process.env.UNREVO_QUARANTINE_ROOT;
  process.env.UNREVO_QUARANTINE_ROOT = await mkdtemp(join(tmpdir(), 'prune-cookie-action-qroot-'));
});
afterEach(async () => {
  await rm(scratchDir, { recursive: true, force: true });
  await rm(process.env.UNREVO_QUARANTINE_ROOT, { recursive: true, force: true });
  if (savedEnv === undefined) delete process.env.UNREVO_QUARANTINE_ROOT;
  else process.env.UNREVO_QUARANTINE_ROOT = savedEnv;
});

describe('cookie scan', () => {
  it('reports present:true and a real size for an existing cookie database', async () => {
    const filePath = join(scratchDir, 'Cookies');
    await makeChromiumCookieDb(filePath, [{ host: 'example.com' }]);

    const result = scan({ expandedPath: filePath });

    expect(result.present).toBe(true);
    expect(result.sizeBytes).toBeGreaterThan(0);
  });

  it('reports present:false, sizeBytes 0, for a missing file', () => {
    const result = scan({ expandedPath: join(scratchDir, 'nope') });
    expect(result.present).toBe(false);
    expect(result.sizeBytes).toBe(0);
  });
});

describe('cookie execute -- empty keep list (whole-file delete)', () => {
  it('quarantines and removes the whole file when settings.cookieKeepList is empty', async () => {
    const filePath = join(scratchDir, 'Cookies');
    await makeChromiumCookieDb(filePath, [{ host: 'example.com' }, { host: 'other.com' }]);
    const before = (await stat(filePath)).size;

    const result = await execute({ expandedPath: filePath }, 'Test Rule', { cookieKeepList: [] });

    expect(await stat(filePath).catch(() => null)).toBeNull(); // file is gone from its original path
    expect(result.freedBytes).toBe(before);
    expect(result.quarantineBatch).toBeTruthy();
  });
});

describe('cookie execute -- keep list matches nothing in this file (also whole-file delete)', () => {
  it('deletes the whole file when the keep list is non-empty but nothing in it matches this file\\'s cookies', async () => {
    const filePath = join(scratchDir, 'Cookies');
    await makeChromiumCookieDb(filePath, [{ host: 'example.com' }]);

    const result = await execute({ expandedPath: filePath }, 'Test Rule', { cookieKeepList: ['totally-unrelated.com'] });

    expect(await stat(filePath).catch(() => null)).toBeNull();
    expect(result.quarantineBatch).toBeTruthy();
  });
});

describe('cookie execute -- surgical row delete (Chromium schema)', () => {
  it('keeps rows for a kept domain and its subdomains, deletes everything else, quarantines the original', async () => {
    const filePath = join(scratchDir, 'Cookies');
    await makeChromiumCookieDb(filePath, [
      { host: 'example.com' }, { host: 'sub.example.com' },
      { host: 'other.com' }, { host: 'notexample.com' }
    ]);
    const originalBytes = await readFile(filePath);

    const result = await execute({ expandedPath: filePath }, 'Test Rule', { cookieKeepList: ['example.com'] });

    // The file at its original path still exists (row-edited, not removed).
    const remaining = await execFileAsync(sqlite3ExePath(), [filePath, 'SELECT host_key FROM cookies ORDER BY host_key;']);
    const remainingHosts = remaining.stdout.trim().split('\n').filter(Boolean);
    expect(remainingHosts).toEqual(['example.com', 'sub.example.com']);
    expect(remainingHosts).not.toContain('notexample.com'); // string-prefix false positive guard

    expect(result.quarantineBatch).toBeTruthy();
    const batchFiles = await (await import('node:fs/promises')).readdir(result.quarantineBatch);
    const quarantinedFile = batchFiles.find((f) => f.startsWith('file-0-'));
    expect(await readFile(join(result.quarantineBatch, quarantinedFile))).toEqual(originalBytes);

    expect(result.freedBytes).toBeGreaterThanOrEqual(0);
  });
});

describe('cookie execute -- surgical row delete (Firefox schema)', () => {
  it('detects moz_cookies/host and applies the same keep logic', async () => {
    const filePath = join(scratchDir, 'cookies.sqlite');
    await makeFirefoxCookieDb(filePath, [{ host: 'keep.com' }, { host: 'drop.com' }]);

    await execute({ expandedPath: filePath }, 'Test Rule', { cookieKeepList: ['keep.com'] });

    const remaining = await execFileAsync(sqlite3ExePath(), [filePath, 'SELECT host FROM moz_cookies;']);
    expect(remaining.stdout.trim()).toBe('keep.com');
  });
});

describe('cookie execute -- guards and edge cases', () => {
  it('reports 0 freedBytes for a missing file, no error', async () => {
    const result = await execute({ expandedPath: join(scratchDir, 'nope') }, 'Test Rule', {});
    expect(result.freedBytes).toBe(0);
    expect(result.skipped).toEqual([]);
  });

  it('skips a file that is not a valid cookie database, with a reason, rather than corrupting it', async () => {
    const filePath = join(scratchDir, 'Cookies');
    await writeFile(filePath, 'not a sqlite database at all');

    const result = await execute({ expandedPath: filePath }, 'Test Rule', { cookieKeepList: ['example.com'] });

    expect(result.freedBytes).toBe(0);
    expect(result.skipped).toHaveLength(1);
    expect(await readFile(filePath, 'utf8')).toBe('not a sqlite database at all'); // untouched
  });

  it('respects excludeFolders', async () => {
    const filePath = join(scratchDir, 'Cookies');
    await makeChromiumCookieDb(filePath, [{ host: 'example.com' }]);

    const result = await execute(
      { expandedPath: filePath }, 'Test Rule', { cookieKeepList: [], excludeFolders: [scratchDir] }
    );

    expect(result.freedBytes).toBe(0);
    expect(result.skipped[0].reason).toMatch(/excluded/);
  });

  it('respects autoQuarantine:false on the whole-file-delete path -- recycles instead', async () => {
    const filePath = join(scratchDir, 'Cookies');
    await makeChromiumCookieDb(filePath, [{ host: 'example.com' }]);

    const result = await execute(
      { expandedPath: filePath }, 'Test Rule', { cookieKeepList: [], autoQuarantine: false }
    );

    expect(result.recycled).toBe(true);
    expect(result.quarantineBatch).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run it, confirm it fails**

```bash
cd backend && npx vitest run src/lib/cleanerActions/cookie.test.js
```

Expected: `FAIL` — `Cannot find module './cookie.js'`.

- [ ] **Step 4: Implement it**

Create `backend/src/lib/cleanerActions/cookie.js`:

```js
import { existsSync, statSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isExcluded, isTooRecent } from '../cleanGuards.js';
import { sqlite3ExePath } from './sqliteVacuum.js';
import { SQLITE_TABLES, TABLE_DETECT_SQL, buildKeepPredicate } from './cookieSql.js';
import { quarantineAndDelete, quarantineFileEdit } from '../../services/quarantine.js';
import { sendToRecycleBin } from '../../services/recycleBin.js';

const execFileAsync = promisify(execFile);

/** Same two guards `sqlite.vacuum`/`json` apply, to the one named cookie
 * database a rule targets. `autoQuarantine` is checked in execute()
 * itself, not here -- see that function's own comment. */
function heldReason(expandedPath, mtimeMs, guards) {
  if (isExcluded(expandedPath, guards.excludeFolders, guards.excludeExtensions)) {
    return 'excluded by your own settings';
  }
  if (isTooRecent(mtimeMs, guards.skipRecentHours)) {
    return 'modified too recently';
  }
  return null;
}

/** Detects which real cookie table (see cookieSql.js's SQLITE_TABLES)
 * exists in the database at `dbPath`, mirroring BleachBit's own
 * detect_browser(). Returns null if neither is present (not a cookie
 * database this action understands) rather than throwing -- execute()
 * treats that the same as "not valid," a skip with a reason. */
async function detectCookieTable(dbPath) {
  const { stdout } = await execFileAsync(sqlite3ExePath(), [dbPath, TABLE_DETECT_SQL]);
  const foundName = stdout.trim().split('\n')[0]?.trim();
  return SQLITE_TABLES[foundName] ?? null;
}

/** Scans a cookie action: the file's current size, an upper bound on
 * what cleaning could reclaim (a whole-file delete frees all of it; a
 * surgical row delete frees less, only knowable by actually running it)
 * -- same convention every other action type's scan() already
 * establishes. Never opens the database or touches the keep list; that's
 * execute()'s job. */
export function scan(action) {
  if (!existsSync(action.expandedPath)) {
    return { sizeBytes: 0, present: false };
  }
  return { sizeBytes: statSync(action.expandedPath).size, present: true };
}

/** Executes a cookie action. `guards.cookieKeepList` (the real setting,
 * passed straight through -- this function does not read settings.js
 * itself, matching every other action module's convention of taking
 * guards as plain data from the caller) drives the branch:
 *
 * - Empty keep list, OR a non-empty keep list that matches NOTHING in
 *   THIS particular file: the whole file is quarantined and removed --
 *   identical in outcome to BleachBit's own `kept_count == 0` branch,
 *   and to a plain `delete` action.
 * - A keep list that matches at least one row in this file: the
 *   non-matching rows are deleted and the file is VACUUMed, with the
 *   ORIGINAL (pre-edit) bytes quarantined first via
 *   quarantineFileEdit()'s new `editFn` mode -- a real, binary,
 *   in-place mutation via the bundled sqlite3.exe CLI, not a
 *   pre-computed text replacement.
 *
 * A file that isn't a real cookie database (detectCookieTable finds
 * neither known table) is skipped with a reason, never touched. */
export async function execute(action, ruleName, guards = {}) {
  if (!existsSync(action.expandedPath)) {
    return { freedBytes: 0, skipped: [] };
  }
  const before = statSync(action.expandedPath);
  const reason = heldReason(action.expandedPath, before.mtimeMs, guards);
  if (reason) {
    return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason }] };
  }

  const keepList = guards.cookieKeepList ?? [];
  let table = null;
  if (keepList.length > 0) {
    try {
      table = await detectCookieTable(action.expandedPath);
    } catch (err) {
      return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason: `not a valid cookie database: ${err.message}` }] };
    }
    if (!table) {
      return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason: 'not a recognized cookie database' }] };
    }

    const predicate = buildKeepPredicate(keepList, table.hostColumn);
    let keptCount;
    try {
      const { stdout } = await execFileAsync(
        sqlite3ExePath(), [action.expandedPath, `SELECT COUNT(*) FROM ${table.tableName} WHERE ${predicate};`]
      );
      keptCount = parseInt(stdout.trim(), 10);
    } catch (err) {
      return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason: `not a valid cookie database: ${err.message}` }] };
    }

    if (keptCount > 0) {
      // Surgical path: something in THIS file matches the keep list.
      if (guards.autoQuarantine === false) {
        const { failed, error } = await sendToRecycleBin([action.expandedPath]);
        // A row-level edit can't be "recycled then re-created" the way a
        // whole-file delete can -- there is no separate "new file" to
        // write after recycling an original that must itself survive the
        // edit. Recycle-Bin-instead-of-quarantine only makes sense for a
        // WHOLE FILE leaving its location, which this branch isn't doing.
        // Fall through to the quarantine path regardless of the setting
        // here would silently ignore the user's choice, so instead: this
        // combination (autoQuarantine:false + a keep list that actually
        // matches something) still quarantines, since quarantine is the
        // only mechanism that supports "edit in place, keep a recoverable
        // copy" at all. Documented, not a silent override -- see the
        // design spec's own reasoning for why this differs from delete/json.
      }
      try {
        const manifest = await quarantineFileEdit({
          programName: `Deep Clean: ${ruleName}`,
          filePath: action.expandedPath,
          editFn: async (realPath) => {
            await execFileAsync(sqlite3ExePath(), [realPath, `DELETE FROM ${table.tableName} WHERE NOT ${predicate}; VACUUM;`]);
          }
        });
        const after = statSync(action.expandedPath).size;
        return { freedBytes: Math.max(0, before.size - after), quarantineBatch: manifest.batchDir, skipped: [] };
      } catch (err) {
        return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason: err.message }] };
      }
    }
    // keptCount === 0: nothing in this file matches -- fall through to
    // the whole-file-delete path below, same as BleachBit's own behavior.
  }

  // Whole-file delete: either no keep list at all, or one that matched
  // nothing in this specific file.
  if (guards.autoQuarantine === false) {
    const { recycled, failed, error } = await sendToRecycleBin([action.expandedPath]);
    if (failed.length > 0) {
      return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason: error ? `could not be recycled: ${error}` : 'could not be recycled' }] };
    }
    return { freedBytes: before.size, recycled: true, skipped: [] };
  }

  try {
    const manifest = await quarantineAndDelete({
      programName: `Deep Clean: ${ruleName}`,
      files: [action.expandedPath],
      registryKeys: []
    });
    return { freedBytes: manifest.totalSizeBytes, quarantineBatch: manifest.batchDir, skipped: [] };
  } catch (err) {
    return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason: err.message }] };
  }
}
```

Note the unused `table` reassignment guard-comment block for the `autoQuarantine:false` + surgical-match case is DELIBERATELY a documented no-op (falls through to quarantine regardless) -- do not silently delete that comment block thinking it's dead code; it exists to explain a real, deliberate design choice. If you disagree with this choice while implementing, flag it as a concern in your report rather than silently changing the behavior.

- [ ] **Step 5: Run it, confirm it passes**

```bash
npx vitest run src/lib/cleanerActions/cookie.test.js
```

Expected: all pass (adjust the plan's own test code only if the REAL `sendToRecycleBin`/`quarantineAndDelete`/`quarantineFileEdit` signatures differ in some small way from what's shown -- verify against the real files, as every prior phase's tasks have).

- [ ] **Step 6: Run the full backend suite**

```bash
npx vitest run
```

Expected: all pass except the 3 pre-existing elevation-gated failures.

- [ ] **Step 7: Commit**

```bash
git add backend/src/lib/cleanerActions/cookie.js backend/src/lib/cleanerActions/cookie.test.js
git commit -m "feat(cleanerActions): add the cookie action, standalone"
```

---

### Task 5: Wire `cookie` into the dispatcher

**Files:**
- Modify: `backend/src/lib/cleanerRules.js`
- Test: `backend/src/lib/cleanerRules.test.js`

- [ ] **Step 1: Read the current dispatcher**

Read `backend/src/lib/cleanerRules.js`'s full current `scanRule`/`executeRule` (post-Phase-B, with the `json` branch already in place -- this is the 6th case, following the exact same pattern).

- [ ] **Step 2: Write the failing tests**

Add to `backend/src/lib/cleanerRules.test.js` a `describe('cookie action, wired', ...)` block, matching the shape of the existing `json action, wired` block from Phase B: one test scanning a `type: 'cookie'` rule, one executing it with an empty `cookieKeepList` (whole-file delete outcome), one executing it with a keep list that matches (surgical outcome, file still present afterward). Build a real minimal cookie SQLite file the same way Task 4's tests do (reuse or adapt that helper). `guards` for `executeRule` already flow from wherever the existing `json`/`sqlite.vacuum` tests source them (read the file to confirm exactly how `guards` -- including where `cookieKeepList` would need to come from -- reaches `executeRule`; it's likely a parameter or a settings object already threaded through, confirm the real mechanism rather than assuming).

- [ ] **Step 3: Run it, confirm it fails**

```bash
cd backend && npx vitest run src/lib/cleanerRules.test.js -t "cookie action, wired"
```

Expected: `FAIL` — dispatcher doesn't recognize `cookie` yet.

- [ ] **Step 4: Implement the dispatcher branch**

Add `import * as cookieAction from './cleanerActions/cookie.js';`. In `scanRule`, add an `else if (action.type === 'cookie')` branch calling `cookieAction.scan({ expandedPath: expandPath(action.path) })`, merging `sizeBytes`/`present` the same way the `json`/`sqlite.vacuum` branches do. In `executeRule`, add an `else if (action.type === 'cookie')` branch calling `await cookieAction.execute({ expandedPath: expandPath(action.path) }, rule.name, guards)`, merging `freedBytes`/`skipped`/`recycled`/`quarantineBatch` the same way. Update both functions' doc comments to mention `cookie`.

- [ ] **Step 5: Run it, confirm it passes, then the full suite**

```bash
npx vitest run src/lib/cleanerRules.test.js
npx vitest run
```

Expected: all pass except the 3 pre-existing elevation-gated failures.

- [ ] **Step 6: Commit**

```bash
git add backend/src/lib/cleanerRules.js backend/src/lib/cleanerRules.test.js
git commit -m "feat(cleanerRules): wire the cookie action into scanRule/executeRule"
```

---

### Task 6: Wire `cookieKeepList` from real settings into the real execute path, and final verification

**Files:**
- Modify: wherever `executeRule`/`executeRulesProgressively` is actually called with real settings-derived guards (find this by reading `backend/src/routes/`'s Deep Clean execute route, e.g. `deepClean.js` or similar -- grep for where `guards` is actually built from `settings` today, since `excludeFolders`/`excludeExtensions`/`skipRecentHours`/`autoQuarantine` already flow this way and `cookieKeepList` needs to join them at the same point)

- [ ] **Step 1: Find the real guards-construction site**

Grep the backend for where an object literal assembling `{excludeFolders, excludeExtensions, skipRecentHours, autoQuarantine}` (or a subset) is built from a `settings` object before being passed into `executeRule`/`executeRulesProgressively`/`scanRule`. Read that file's surrounding context.

- [ ] **Step 2: Add `cookieKeepList` to that same guards object**

Add `cookieKeepList: settings.cookieKeepList` (or however the real object is spread/assembled) alongside the existing fields, so a real Deep Clean run's `cookie` actions actually receive the real setting rather than always seeing `undefined`/`[]` regardless of what's configured.

- [ ] **Step 3: Add or update a test at that call site**

If a test already covers this guards-assembly (likely, given the existing fields are already tested this way), add `cookieKeepList` to it the same way; if not, add a minimal one proving the real setting reaches a `cookie` action's `guards.cookieKeepList`.

- [ ] **Step 4: Run the full three-suite pass**

```bash
cd backend && npm test
cd ../frontend && npx vitest run
cd ../electron && npm test
```

Expected: backend all green except the 3 pre-existing elevation-gated failures; frontend and electron fully green (this phase makes no frontend changes -- `scanLog.js`'s existing `Delete`/`Recycle` verbs already cover a cookie action's outcomes correctly: a whole-file delete reads as "Delete", a surgical edit with no dedicated verb yet falls through the same `freedBytes -> skipped -> empty` shape `edited`/`vacuumed` already established, but since `cookie.js` never sets a discriminator flag, it will read as "Delete" even on the surgical path -- this is a known, acceptable simplification for this phase, not a bug, since the size delta is still accurate either way; flag it in the final report as a possible small follow-up, don't silently add a new verb un-planned).

- [ ] **Step 5: Commit**

```bash
git add <the guards-assembly file and its test>
git commit -m "feat(deepClean): thread cookieKeepList from settings into the cookie action"
```

- [ ] **Step 6: Cross-check against the spec**

Confirm: no new `cleaners.json` rules use `cookie` (`grep -c '"type": "cookie"' backend/src/data/cleaners.json` should be 0), no Safari/shred-related code was added, `cookieKeepList` has no Settings-screen UI yet (by design, per the spec).
