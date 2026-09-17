# BleachBit-Parity Engine, Phase D (per-app bespoke SQL) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 5 real, per-app bespoke cleaning action types — `chrome.history`, `chrome.autofill`, `chrome.keywords`, `mozilla.url.history`, `mozilla.favicons` — each ported from BleachBit's own `bleachbit/Special.py` but re-grounded against the REAL current schema (verified live on this machine for the Chrome-side ones; see the design spec for exact column/table evidence), not BleachBit's own stale version-branching logic.

**Architecture:** A new shared `backend/src/lib/cleanerActions/sqliteInspect.js` (one small existence-check helper, reused by every module in this phase, generalizing the pattern `cookie.js` already established for its own two-table detection). Five new action modules under `backend/src/lib/cleanerActions/`, each `scan(action)`/`execute(action, ruleName, guards)`, each quarantining the original file via `quarantineFileEdit()`'s `editFn` mode (Phase C) before running its own DELETE statements in place via the bundled `sqlite3.exe`. Wired into `cleanerRules.js`'s dispatcher as the 7th through 11th action types.

**Tech Stack:** Node.js (backend, ESM), Vitest, the bundled `sqlite3.exe` CLI.

**Spec:** `docs/superpowers/specs/2026-09-17-bleachbit-parity-phase-d-bespoke-sql-design.md`

---

## Before you start

```bash
cd backend && npm test
```

Expected: all pass except the 3 pre-existing, documented elevation-gated failures.

---

### Task 1: `sqliteInspect.js` — shared table-existence helper

**Files:**
- Create: `backend/src/lib/cleanerActions/sqliteInspect.js`
- Test: `backend/src/lib/cleanerActions/sqliteInspect.test.js`

- [ ] **Step 1: Write the failing tests**

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sqliteTableExists } from './sqliteInspect.js';
import { sqlite3ExePath } from './sqliteVacuum.js';

const execFileAsync = promisify(execFile);
let scratchDir;
beforeEach(async () => { scratchDir = await mkdtemp(join(tmpdir(), 'prune-sqlite-inspect-test-')); });
afterEach(async () => { await rm(scratchDir, { recursive: true, force: true }); });

describe('sqliteTableExists', () => {
  it('returns true when the table genuinely exists', async () => {
    const filePath = join(scratchDir, 'db.sqlite');
    await execFileAsync(sqlite3ExePath(), [filePath, 'CREATE TABLE urls (id INTEGER);']);
    expect(await sqliteTableExists(filePath, 'urls')).toBe(true);
  });

  it('returns false when the table does not exist', async () => {
    const filePath = join(scratchDir, 'db.sqlite');
    await execFileAsync(sqlite3ExePath(), [filePath, 'CREATE TABLE urls (id INTEGER);']);
    expect(await sqliteTableExists(filePath, 'visits')).toBe(false);
  });

  it('returns false (not a throw) for a file that is not a valid database', async () => {
    const filePath = join(scratchDir, 'notadb.txt');
    await (await import('node:fs/promises')).writeFile(filePath, 'plain text');
    expect(await sqliteTableExists(filePath, 'urls')).toBe(false);
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

```bash
cd backend && npx vitest run src/lib/cleanerActions/sqliteInspect.test.js
```

Expected: `FAIL` — module doesn't exist.

- [ ] **Step 3: Implement it**

```js
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { sqlite3ExePath } from './sqliteVacuum.js';

const execFileAsync = promisify(execFile);

/** True if `tableName` genuinely exists in the SQLite database at
 * `dbPath`, false for a missing table OR a file that isn't a valid
 * SQLite database at all (never throws for the latter -- every caller in
 * this phase treats "not a real database" and "the table just isn't
 * there" the same way: nothing to do). `tableName` must be a fixed,
 * hardcoded string from the CALLER (never end-user input) -- this
 * function interpolates it directly into SQL text handed to the
 * sqlite3.exe CLI, which has no parameter-binding mode over its
 * command-line interface, same constraint cookie.js's own table
 * detection already documented and relies on in Phase C. */
export async function sqliteTableExists(dbPath, tableName) {
  try {
    const { stdout } = await execFileAsync(
      sqlite3ExePath(),
      [dbPath, `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}';`]
    );
    return stdout.trim() === tableName;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run it, confirm it passes, commit**

```bash
npx vitest run src/lib/cleanerActions/sqliteInspect.test.js
git add backend/src/lib/cleanerActions/sqliteInspect.js backend/src/lib/cleanerActions/sqliteInspect.test.js
git commit -m "feat(cleanerActions): add sqliteTableExists, shared existence-check for Phase D"
```

---

### Task 2: `chromeAutofill.js`

**Files:**
- Create: `backend/src/lib/cleanerActions/chromeAutofill.js`
- Test: `backend/src/lib/cleanerActions/chromeAutofill.test.js`

The simplest of the five -- one table, no bookmark logic, no cross-file joins. Good first real cleaner to establish the shared shape (guard check, quarantine-via-editFn, before/after size) every other module in this phase repeats.

- [ ] **Step 1: Read `cookie.js`'s full current content again** for the exact `heldReason`/quarantine-branch/error-handling shape to match.

- [ ] **Step 2: Write the failing tests**

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scan, execute } from './chromeAutofill.js';
import { sqlite3ExePath } from './sqliteVacuum.js';

const execFileAsync = promisify(execFile);

async function makeWebDataDb(filePath, rows) {
  const values = rows.map(({ name, value }) => `('${name}', '${value}', '${value.toLowerCase()}')`).join(',');
  await execFileAsync(sqlite3ExePath(), [
    filePath,
    `CREATE TABLE autofill (name VARCHAR, value VARCHAR, value_lower VARCHAR); INSERT INTO autofill (name, value, value_lower) VALUES ${values};`
  ]);
}

let scratchDir;
let savedEnv;
beforeEach(async () => {
  scratchDir = await mkdtemp(join(tmpdir(), 'prune-chrome-autofill-test-'));
  savedEnv = process.env.UNREVO_QUARANTINE_ROOT;
  process.env.UNREVO_QUARANTINE_ROOT = await mkdtemp(join(tmpdir(), 'prune-chrome-autofill-qroot-'));
});
afterEach(async () => {
  await rm(scratchDir, { recursive: true, force: true });
  await rm(process.env.UNREVO_QUARANTINE_ROOT, { recursive: true, force: true });
  if (savedEnv === undefined) delete process.env.UNREVO_QUARANTINE_ROOT;
  else process.env.UNREVO_QUARANTINE_ROOT = savedEnv;
});

describe('chromeAutofill scan', () => {
  it('reports present:true and a real size', async () => {
    const filePath = join(scratchDir, 'Web Data');
    await makeWebDataDb(filePath, [{ name: 'email', value: 'a@b.com' }]);
    const result = scan({ expandedPath: filePath });
    expect(result.present).toBe(true);
    expect(result.sizeBytes).toBeGreaterThan(0);
  });

  it('reports present:false for a missing file', () => {
    expect(scan({ expandedPath: join(scratchDir, 'nope') }).present).toBe(false);
  });
});

describe('chromeAutofill execute', () => {
  it('clears the autofill table, quarantines the original, reports a real byte delta', async () => {
    const filePath = join(scratchDir, 'Web Data');
    await makeWebDataDb(filePath, Array.from({ length: 50 }, (_, i) => ({ name: 'field' + i, value: 'value-'.repeat(20) + i })));
    const before = (await readFile(filePath)).length;

    const result = await execute({ expandedPath: filePath }, 'Test Rule', {});

    const remaining = await execFileAsync(sqlite3ExePath(), [filePath, 'SELECT COUNT(*) FROM autofill;']);
    expect(remaining.stdout.trim()).toBe('0');
    expect(result.quarantineBatch).toBeTruthy();
    expect(result.freedBytes).toBeGreaterThanOrEqual(0);

    const batchFiles = await (await import('node:fs/promises')).readdir(result.quarantineBatch);
    const quarantinedFile = batchFiles.find((f) => f.startsWith('file-0-'));
    const quarantinedCount = await execFileAsync(sqlite3ExePath(), [join(result.quarantineBatch, quarantinedFile), 'SELECT COUNT(*) FROM autofill;']);
    expect(quarantinedCount.stdout.trim()).toBe('50');
  });

  it('reports 0 freedBytes for a missing file, no error', async () => {
    const result = await execute({ expandedPath: join(scratchDir, 'nope') }, 'Test Rule', {});
    expect(result.freedBytes).toBe(0);
    expect(result.skipped).toEqual([]);
  });

  it('skips a file with no autofill table, with a reason', async () => {
    const filePath = join(scratchDir, 'Web Data');
    await execFileAsync(sqlite3ExePath(), [filePath, 'CREATE TABLE something_else (id INTEGER);']);
    const result = await execute({ expandedPath: filePath }, 'Test Rule', {});
    expect(result.freedBytes).toBe(0);
    expect(result.skipped).toHaveLength(1);
  });

  it('respects excludeFolders', async () => {
    const filePath = join(scratchDir, 'Web Data');
    await makeWebDataDb(filePath, [{ name: 'email', value: 'a@b.com' }]);
    const result = await execute({ expandedPath: filePath }, 'Test Rule', { excludeFolders: [scratchDir] });
    expect(result.freedBytes).toBe(0);
    expect(result.skipped[0].reason).toMatch(/excluded/);
  });
});
```

- [ ] **Step 3: Run it, confirm it fails**

```bash
npx vitest run src/lib/cleanerActions/chromeAutofill.test.js
```

- [ ] **Step 4: Implement it**

```js
import { existsSync, statSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isExcluded, isTooRecent } from '../cleanGuards.js';
import { sqlite3ExePath } from './sqliteVacuum.js';
import { sqliteTableExists } from './sqliteInspect.js';
import { quarantineFileEdit } from '../../services/quarantine.js';

const execFileAsync = promisify(execFile);

function heldReason(expandedPath, mtimeMs, guards) {
  if (isExcluded(expandedPath, guards.excludeFolders, guards.excludeExtensions)) {
    return 'excluded by your own settings';
  }
  if (isTooRecent(mtimeMs, guards.skipRecentHours)) {
    return 'modified too recently';
  }
  return null;
}

/** Scans a chrome.autofill action: the Web Data file's current size, an
 * upper bound on what clearing the autofill table could reclaim. */
export function scan(action) {
  if (!existsSync(action.expandedPath)) {
    return { sizeBytes: 0, present: false };
  }
  return { sizeBytes: statSync(action.expandedPath).size, present: true };
}

/** Executes a chrome.autofill action: clears the `autofill` table (raw
 * form-field value history) and VACUUMs, quarantining the original
 * first. Scoped to ONLY this table -- see the design spec for why the
 * saved-profile/address tables BleachBit's own version also touches are
 * deliberately excluded (they don't exist under those names in the
 * current Chrome schema; the real current equivalent is a different,
 * riskier feature). A file with no `autofill` table (wrong file, or a
 * Web Data file from a version old enough not to have it) is skipped
 * with a reason, never touched. */
export async function execute(action, ruleName, guards = {}) {
  if (!existsSync(action.expandedPath)) {
    return { freedBytes: 0, skipped: [] };
  }
  const before = statSync(action.expandedPath);
  const reason = heldReason(action.expandedPath, before.mtimeMs, guards);
  if (reason) {
    return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason }] };
  }

  const hasTable = await sqliteTableExists(action.expandedPath, 'autofill');
  if (!hasTable) {
    return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason: 'not a recognized Chrome Web Data file' }] };
  }

  try {
    const manifest = await quarantineFileEdit({
      programName: `Deep Clean: ${ruleName}`,
      filePath: action.expandedPath,
      editFn: async (realPath) => {
        await execFileAsync(sqlite3ExePath(), [realPath, 'DELETE FROM autofill; VACUUM;']);
      }
    });
    const after = statSync(action.expandedPath).size;
    return { freedBytes: Math.max(0, before.size - after), quarantineBatch: manifest.batchDir, skipped: [] };
  } catch {
    return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason: 'could not clear autofill data: the database may be in use or corrupted' }] };
  }
}
```

- [ ] **Step 5: Run it, confirm it passes, run the full suite, commit**

```bash
npx vitest run src/lib/cleanerActions/chromeAutofill.test.js
npx vitest run
git add backend/src/lib/cleanerActions/chromeAutofill.js backend/src/lib/cleanerActions/chromeAutofill.test.js
git commit -m "feat(cleanerActions): add chrome.autofill, standalone"
```

---

### Task 3: `chromeKeywords.js`

**Files:**
- Create: `backend/src/lib/cleanerActions/chromeKeywords.js`
- Test: `backend/src/lib/cleanerActions/chromeKeywords.test.js`

Same shape as Task 2, one real difference: a WHERE predicate (only user-added keywords, `date_created != 0`, matching BleachBit's own predicate for "not a browser-shipped default engine") plus a `usage_count` reset, plus an existence-checked `keywords_backup` table (present on old Chrome only -- confirmed absent on this machine's real Web Data; must not assume it's there).

- [ ] **Step 1: Write the failing tests**

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scan, execute } from './chromeKeywords.js';
import { sqlite3ExePath } from './sqliteVacuum.js';

const execFileAsync = promisify(execFile);

async function makeKeywordsDb(filePath, rows, { withBackup = false } = {}) {
  const cols = "id INTEGER PRIMARY KEY, short_name VARCHAR, keyword VARCHAR, favicon_url VARCHAR, originating_url VARCHAR, suggest_url VARCHAR, date_created INTEGER, usage_count INTEGER";
  const values = rows.map(({ id, keyword, dateCreated, usageCount }) =>
    `(${id}, 'name', '${keyword}', '', '', '', ${dateCreated}, ${usageCount})`).join(',');
  let sql = `CREATE TABLE keywords (${cols}); INSERT INTO keywords (id, short_name, keyword, favicon_url, originating_url, suggest_url, date_created, usage_count) VALUES ${values};`;
  if (withBackup) sql += `CREATE TABLE keywords_backup (${cols});`;
  await execFileAsync(sqlite3ExePath(), [filePath, sql]);
}

let scratchDir;
let savedEnv;
beforeEach(async () => {
  scratchDir = await mkdtemp(join(tmpdir(), 'prune-chrome-keywords-test-'));
  savedEnv = process.env.UNREVO_QUARANTINE_ROOT;
  process.env.UNREVO_QUARANTINE_ROOT = await mkdtemp(join(tmpdir(), 'prune-chrome-keywords-qroot-'));
});
afterEach(async () => {
  await rm(scratchDir, { recursive: true, force: true });
  await rm(process.env.UNREVO_QUARANTINE_ROOT, { recursive: true, force: true });
  if (savedEnv === undefined) delete process.env.UNREVO_QUARANTINE_ROOT;
  else process.env.UNREVO_QUARANTINE_ROOT = savedEnv;
});

describe('chromeKeywords scan', () => {
  it('reports present:true for an existing Web Data file', async () => {
    const filePath = join(scratchDir, 'Web Data');
    await makeKeywordsDb(filePath, [{ id: 1, keyword: 'google.com', dateCreated: 0, usageCount: 0 }]);
    expect(scan({ expandedPath: filePath }).present).toBe(true);
  });
});

describe('chromeKeywords execute', () => {
  it('deletes only user-added keywords (date_created != 0), keeps browser defaults, resets usage_count', async () => {
    const filePath = join(scratchDir, 'Web Data');
    await makeKeywordsDb(filePath, [
      { id: 1, keyword: 'default-engine.com', dateCreated: 0, usageCount: 5 },
      { id: 2, keyword: 'my-custom-search.com', dateCreated: 1700000000, usageCount: 3 }
    ]);

    const result = await execute({ expandedPath: filePath }, 'Test Rule', {});

    const remaining = await execFileAsync(sqlite3ExePath(), [filePath, 'SELECT keyword, usage_count FROM keywords ORDER BY id;']);
    const rows = remaining.stdout.trim().split('\n');
    expect(rows).toEqual(['default-engine.com|0']); // custom one gone, default's usage_count reset to 0
    expect(result.quarantineBatch).toBeTruthy();
  });

  it('also clears keywords_backup when that table exists', async () => {
    const filePath = join(scratchDir, 'Web Data');
    await makeKeywordsDb(filePath, [{ id: 1, keyword: 'custom.com', dateCreated: 1700000000, usageCount: 1 }], { withBackup: true });
    await execFileAsync(sqlite3ExePath(), [filePath, "INSERT INTO keywords_backup (id, short_name, keyword, favicon_url, originating_url, suggest_url, date_created, usage_count) VALUES (1, 'name', 'custom.com', '', '', '', 1700000000, 1);"]);

    await execute({ expandedPath: filePath }, 'Test Rule', {});

    const remaining = await execFileAsync(sqlite3ExePath(), [filePath, 'SELECT COUNT(*) FROM keywords_backup;']);
    expect(remaining.stdout.trim()).toBe('0');
  });

  it('does not fail when keywords_backup does not exist (the normal, current-Chrome case)', async () => {
    const filePath = join(scratchDir, 'Web Data');
    await makeKeywordsDb(filePath, [{ id: 1, keyword: 'custom.com', dateCreated: 1700000000, usageCount: 1 }]);
    const result = await execute({ expandedPath: filePath }, 'Test Rule', {});
    expect(result.quarantineBatch).toBeTruthy();
  });

  it('skips a file with no keywords table', async () => {
    const filePath = join(scratchDir, 'Web Data');
    await execFileAsync(sqlite3ExePath(), [filePath, 'CREATE TABLE something_else (id INTEGER);']);
    const result = await execute({ expandedPath: filePath }, 'Test Rule', {});
    expect(result.skipped).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

```bash
npx vitest run src/lib/cleanerActions/chromeKeywords.test.js
```

- [ ] **Step 3: Implement it**

Same shape as `chromeAutofill.js` (`heldReason`, missing-file/excluded-guard handling identical -- copy that structure), with `execute`'s core `editFn` body:

```js
editFn: async (realPath) => {
  const hasBackup = await sqliteTableExists(realPath, 'keywords_backup');
  let sql = "DELETE FROM keywords WHERE NOT date_created = 0; UPDATE keywords SET usage_count = 0;";
  if (hasBackup) {
    sql += "DELETE FROM keywords_backup WHERE NOT date_created = 0; UPDATE keywords_backup SET usage_count = 0;";
  }
  sql += 'VACUUM;';
  await execFileAsync(sqlite3ExePath(), [realPath, sql]);
}
```

Guard the whole action on `sqliteTableExists(action.expandedPath, 'keywords')` first (same pattern as `chromeAutofill.js`'s `autofill`-table check), skipping with a reason if absent.

- [ ] **Step 4: Run it, confirm it passes, run the full suite, commit**

```bash
npx vitest run src/lib/cleanerActions/chromeKeywords.test.js
npx vitest run
git add backend/src/lib/cleanerActions/chromeKeywords.js backend/src/lib/cleanerActions/chromeKeywords.test.js
git commit -m "feat(cleanerActions): add chrome.keywords, standalone"
```

---

### Task 4: `chromeHistory.js`

**Files:**
- Create: `backend/src/lib/cleanerActions/chromeHistory.js`
- Test: `backend/src/lib/cleanerActions/chromeHistory.test.js`

The most involved of the Chrome-side cleaners: clears `urls`/`visits`/`keyword_search_terms`/`downloads`/`segments`/`segment_usage` while preserving bookmarked URLs, by reading the browser's own `Bookmarks` JSON file (same directory as `History`).

- [ ] **Step 1: Write the failing tests**

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scan, execute } from './chromeHistory.js';
import { sqlite3ExePath } from './sqliteVacuum.js';

const execFileAsync = promisify(execFile);

async function makeHistoryDb(filePath, urls) {
  const urlValues = urls.map(({ id, url, title }) => `(${id}, '${url}', '${title}', 1, 0, 1700000000, 0)`).join(',');
  const sql = `
    CREATE TABLE urls (id INTEGER PRIMARY KEY, url LONGVARCHAR, title LONGVARCHAR, visit_count INTEGER, typed_count INTEGER, last_visit_time INTEGER, hidden INTEGER);
    INSERT INTO urls VALUES ${urlValues};
    CREATE TABLE visits (id INTEGER PRIMARY KEY, url INTEGER, visit_time INTEGER);
    INSERT INTO visits (id, url, visit_time) VALUES (1, ${urls[0].id}, 1700000000);
    CREATE TABLE keyword_search_terms (keyword_id INTEGER, url_id INTEGER, term LONGVARCHAR, normalized_term LONGVARCHAR);
    INSERT INTO keyword_search_terms VALUES (1, ${urls[0].id}, 'search term', 'search term');
    CREATE TABLE downloads (id INTEGER PRIMARY KEY, current_path VARCHAR, target_path VARCHAR);
    INSERT INTO downloads (id, current_path, target_path) VALUES (1, 'C:\\file.exe', 'C:\\file.exe');
    CREATE TABLE segments (id INTEGER PRIMARY KEY, name VARCHAR, url_id INTEGER);
    INSERT INTO segments VALUES (1, 'segment', ${urls[0].id});
    CREATE TABLE segment_usage (id INTEGER PRIMARY KEY, segment_id INTEGER, time_slot INTEGER, visit_count INTEGER);
    INSERT INTO segment_usage VALUES (1, 1, 1700000000, 1);
    CREATE TABLE meta (key VARCHAR, value VARCHAR);
    INSERT INTO meta VALUES ('version', '70');
  `;
  await execFileAsync(sqlite3ExePath(), [filePath, sql]);
}

function makeBookmarksJson(bookmarkedUrls) {
  return JSON.stringify({
    roots: {
      bookmark_bar: {
        type: 'folder',
        children: bookmarkedUrls.map((url) => ({ type: 'url', url }))
      }
    }
  });
}

let scratchDir;
let savedEnv;
beforeEach(async () => {
  scratchDir = await mkdtemp(join(tmpdir(), 'prune-chrome-history-test-'));
  savedEnv = process.env.UNREVO_QUARANTINE_ROOT;
  process.env.UNREVO_QUARANTINE_ROOT = await mkdtemp(join(tmpdir(), 'prune-chrome-history-qroot-'));
});
afterEach(async () => {
  await rm(scratchDir, { recursive: true, force: true });
  await rm(process.env.UNREVO_QUARANTINE_ROOT, { recursive: true, force: true });
  if (savedEnv === undefined) delete process.env.UNREVO_QUARANTINE_ROOT;
  else process.env.UNREVO_QUARANTINE_ROOT = savedEnv;
});

describe('chromeHistory scan', () => {
  it('reports present:true for a real History file', async () => {
    const filePath = join(scratchDir, 'History');
    await makeHistoryDb(filePath, [{ id: 1, url: 'https://example.com', title: 'Example' }]);
    expect(scan({ expandedPath: filePath }).present).toBe(true);
  });
});

describe('chromeHistory execute', () => {
  it('clears history but keeps a bookmarked URL row in urls', async () => {
    const filePath = join(scratchDir, 'History');
    await makeHistoryDb(filePath, [
      { id: 1, url: 'https://bookmarked.com', title: 'Kept' },
      { id: 2, url: 'https://not-bookmarked.com', title: 'Gone' }
    ]);
    await writeFile(join(scratchDir, 'Bookmarks'), makeBookmarksJson(['https://bookmarked.com']));

    const result = await execute({ expandedPath: filePath }, 'Test Rule', {});

    const urls = await execFileAsync(sqlite3ExePath(), [filePath, 'SELECT url FROM urls;']);
    expect(urls.stdout.trim()).toBe('https://bookmarked.com');

    const visits = await execFileAsync(sqlite3ExePath(), [filePath, 'SELECT COUNT(*) FROM visits;']);
    expect(visits.stdout.trim()).toBe('0'); // visits clear unconditionally, even for the bookmarked URL

    const downloads = await execFileAsync(sqlite3ExePath(), [filePath, 'SELECT COUNT(*) FROM downloads;']);
    expect(downloads.stdout.trim()).toBe('0');

    expect(result.quarantineBatch).toBeTruthy();
  });

  it('clears everything when there is no Bookmarks file at all', async () => {
    const filePath = join(scratchDir, 'History');
    await makeHistoryDb(filePath, [{ id: 1, url: 'https://example.com', title: 'Example' }]);
    // No Bookmarks file written.

    await execute({ expandedPath: filePath }, 'Test Rule', {});

    const urls = await execFileAsync(sqlite3ExePath(), [filePath, 'SELECT COUNT(*) FROM urls;']);
    expect(urls.stdout.trim()).toBe('0');
  });

  it('skips a file with no urls table', async () => {
    const filePath = join(scratchDir, 'History');
    await execFileAsync(sqlite3ExePath(), [filePath, 'CREATE TABLE something_else (id INTEGER);']);
    const result = await execute({ expandedPath: filePath }, 'Test Rule', {});
    expect(result.skipped).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

```bash
npx vitest run src/lib/cleanerActions/chromeHistory.test.js
```

- [ ] **Step 3: Implement it**

```js
import { existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join } from 'node:path';
import { isExcluded, isTooRecent } from '../cleanGuards.js';
import { sqlite3ExePath } from './sqliteVacuum.js';
import { sqliteTableExists } from './sqliteInspect.js';
import { escapeSqlString } from './cookieSql.js';
import { quarantineFileEdit } from '../../services/quarantine.js';

const execFileAsync = promisify(execFile);

function heldReason(expandedPath, mtimeMs, guards) {
  if (isExcluded(expandedPath, guards.excludeFolders, guards.excludeExtensions)) {
    return 'excluded by your own settings';
  }
  if (isTooRecent(mtimeMs, guards.skipRecentHours)) {
    return 'modified too recently';
  }
  return null;
}

/** Collects every URL string bookmarked in a Chrome/Chromium `Bookmarks`
 * JSON file, walking `roots` recursively (folders have `children`, a
 * bookmark node has `type: "url"` and its own `url`). Returns an empty
 * array if the file doesn't exist or isn't valid JSON -- "no bookmarks
 * file" and "no bookmarks in it" both mean the same thing to the caller:
 * nothing extra to preserve. */
async function collectBookmarkUrls(historyPath) {
  const bookmarksPath = join(dirname(historyPath), 'Bookmarks');
  if (!existsSync(bookmarksPath)) return [];
  try {
    const data = JSON.parse(await readFile(bookmarksPath, 'utf8'));
    const urls = [];
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'folder' && Array.isArray(node.children)) {
        for (const child of node.children) walk(child);
      } else if (node.type === 'url' && typeof node.url === 'string') {
        urls.push(node.url);
      }
    };
    for (const root of Object.values(data.roots ?? {})) walk(root);
    return urls;
  } catch {
    return [];
  }
}

export function scan(action) {
  if (!existsSync(action.expandedPath)) {
    return { sizeBytes: 0, present: false };
  }
  return { sizeBytes: statSync(action.expandedPath).size, present: true };
}

/** Executes a chrome.history action: clears browsing history while
 * preserving bookmarked URLs' own rows in `urls` -- everything else
 * (visit timestamps, search terms, downloads, segment stats) clears
 * unconditionally, matching BleachBit's own real behavior: a bookmark
 * keeps working, but its "recently visited" trail does not survive.
 * Every table beyond `urls` is existence-checked before being touched,
 * since a Chrome build old or new enough not to have one of them should
 * not make the whole action fail. */
export async function execute(action, ruleName, guards = {}) {
  if (!existsSync(action.expandedPath)) {
    return { freedBytes: 0, skipped: [] };
  }
  const before = statSync(action.expandedPath);
  const reason = heldReason(action.expandedPath, before.mtimeMs, guards);
  if (reason) {
    return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason }] };
  }

  const hasUrls = await sqliteTableExists(action.expandedPath, 'urls');
  if (!hasUrls) {
    return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason: 'not a recognized Chrome History file' }] };
  }

  try {
    const manifest = await quarantineFileEdit({
      programName: `Deep Clean: ${ruleName}`,
      filePath: action.expandedPath,
      editFn: async (realPath) => {
        const bookmarkUrls = await collectBookmarkUrls(realPath);
        let urlsWhere = '';
        if (bookmarkUrls.length > 0) {
          const list = bookmarkUrls.map((u) => `'${escapeSqlString(u)}'`).join(',');
          urlsWhere = ` WHERE url NOT IN (${list})`;
        }
        let sql = `DELETE FROM urls${urlsWhere};`;
        for (const table of ['visits', 'keyword_search_terms', 'downloads', 'segments', 'segment_usage']) {
          if (await sqliteTableExists(realPath, table)) sql += `DELETE FROM ${table};`;
        }
        sql += 'VACUUM;';
        await execFileAsync(sqlite3ExePath(), [realPath, sql]);
      }
    });
    const after = statSync(action.expandedPath).size;
    return { freedBytes: Math.max(0, before.size - after), quarantineBatch: manifest.batchDir, skipped: [] };
  } catch {
    return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason: 'could not clear history: the database may be in use or corrupted' }] };
  }
}
```

Note: `sqliteTableExists` calls happen INSIDE `editFn`, against `realPath` (the real file, already backed up by `quarantineFileEdit` before `editFn` runs) -- this is deliberate and correct, not a mistake to "simplify" by moving them earlier, since the whole point of checking inside `editFn` right before each DELETE is to reflect the real file's real current schema at edit time.

- [ ] **Step 4: Run it, confirm it passes, run the full suite, commit**

```bash
npx vitest run src/lib/cleanerActions/chromeHistory.test.js
npx vitest run
git add backend/src/lib/cleanerActions/chromeHistory.js backend/src/lib/cleanerActions/chromeHistory.test.js
git commit -m "feat(cleanerActions): add chrome.history, standalone"
```

---

### Task 5: `mozillaUrlHistory.js`

**Files:**
- Create: `backend/src/lib/cleanerActions/mozillaUrlHistory.js`
- Test: `backend/src/lib/cleanerActions/mozillaUrlHistory.test.js`

Firefox/Firefox-family equivalent of Task 4, ported from BleachBit's real `delete_mozilla_url_history()` (already read in full this session). Every non-`moz_places` table is existence-checked, matching BleachBit's own defensive comments about tables that don't exist on all Firefox versions.

- [ ] **Step 1: Write the failing tests**

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scan, execute } from './mozillaUrlHistory.js';
import { sqlite3ExePath } from './sqliteVacuum.js';

const execFileAsync = promisify(execFile);

async function makePlacesDb(filePath) {
  const sql = `
    CREATE TABLE moz_bookmarks (id INTEGER PRIMARY KEY, fk INTEGER);
    CREATE TABLE moz_places (id INTEGER PRIMARY KEY, url LONGVARCHAR, rev_host LONGVARCHAR, title LONGVARCHAR, visit_count INTEGER, frecency INTEGER, last_visit_date INTEGER, favicon_id INTEGER);
    INSERT INTO moz_places (id, url, rev_host, title, visit_count, frecency) VALUES
      (1, 'https://bookmarked.com', 'moc.dekramkoob.', 'Kept', 5, 100),
      (2, 'https://not-bookmarked.com', 'moc.dekramkoobton.', 'Gone', 3, 50);
    INSERT INTO moz_bookmarks (id, fk) VALUES (1, 1);
    CREATE TABLE moz_historyvisits (id INTEGER PRIMARY KEY, place_id INTEGER);
    INSERT INTO moz_historyvisits (id, place_id) VALUES (1, 1), (2, 2);
    CREATE TABLE moz_inputhistory (place_id INTEGER, input VARCHAR);
    INSERT INTO moz_inputhistory (place_id, input) VALUES (2, 'typed text');
    CREATE TABLE moz_annos (id INTEGER PRIMARY KEY, place_id INTEGER, content VARCHAR);
    INSERT INTO moz_annos (id, place_id, content) VALUES (1, 2, 'annotation');
  `;
  await execFileAsync(sqlite3ExePath(), [filePath, sql]);
}

let scratchDir;
let savedEnv;
beforeEach(async () => {
  scratchDir = await mkdtemp(join(tmpdir(), 'prune-mozilla-history-test-'));
  savedEnv = process.env.UNREVO_QUARANTINE_ROOT;
  process.env.UNREVO_QUARANTINE_ROOT = await mkdtemp(join(tmpdir(), 'prune-mozilla-history-qroot-'));
});
afterEach(async () => {
  await rm(scratchDir, { recursive: true, force: true });
  await rm(process.env.UNREVO_QUARANTINE_ROOT, { recursive: true, force: true });
  if (savedEnv === undefined) delete process.env.UNREVO_QUARANTINE_ROOT;
  else process.env.UNREVO_QUARANTINE_ROOT = savedEnv;
});

describe('mozillaUrlHistory scan', () => {
  it('reports present:true for a real places.sqlite', async () => {
    const filePath = join(scratchDir, 'places.sqlite');
    await makePlacesDb(filePath);
    expect(scan({ expandedPath: filePath }).present).toBe(true);
  });
});

describe('mozillaUrlHistory execute', () => {
  it('keeps a bookmarked place, clears everything orphaned by removing the non-bookmarked one', async () => {
    const filePath = join(scratchDir, 'places.sqlite');
    await makePlacesDb(filePath);

    const result = await execute({ expandedPath: filePath }, 'Test Rule', {});

    const places = await execFileAsync(sqlite3ExePath(), [filePath, 'SELECT url, visit_count, frecency FROM moz_places ORDER BY url;']);
    expect(places.stdout.trim()).toBe('https://bookmarked.com|0|-1'); // bookmarked place survives, stats reset

    const visits = await execFileAsync(sqlite3ExePath(), [filePath, 'SELECT COUNT(*) FROM moz_historyvisits;']);
    expect(visits.stdout.trim()).toBe('0'); // all visits cleared unconditionally

    const input = await execFileAsync(sqlite3ExePath(), [filePath, 'SELECT COUNT(*) FROM moz_inputhistory;']);
    expect(input.stdout.trim()).toBe('0'); // orphaned input history (pointed at the deleted place) is gone

    expect(result.quarantineBatch).toBeTruthy();
  });

  it('skips a file with no moz_places table', async () => {
    const filePath = join(scratchDir, 'places.sqlite');
    await execFileAsync(sqlite3ExePath(), [filePath, 'CREATE TABLE something_else (id INTEGER);']);
    const result = await execute({ expandedPath: filePath }, 'Test Rule', {});
    expect(result.skipped).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

```bash
npx vitest run src/lib/cleanerActions/mozillaUrlHistory.test.js
```

- [ ] **Step 3: Implement it**

Follow `chromeHistory.js`'s exact shape (same `heldReason`, missing-file/guard handling). The `editFn` body, translating BleachBit's real `delete_mozilla_url_history()` (already read this session) into plain DELETEs with no shred-column-wiping and existence-checks for every table beyond `moz_places`/`moz_bookmarks`:

```js
editFn: async (realPath) => {
  const hasPlaces = await sqliteTableExists(realPath, 'moz_places');
  let sql = '';
  if (hasPlaces) {
    sql += `DELETE FROM moz_places WHERE id IN (
      SELECT moz_places.id FROM moz_places
      LEFT JOIN moz_bookmarks ON moz_bookmarks.fk = moz_places.id
      WHERE moz_bookmarks.id IS NULL
    );`;
    sql += 'UPDATE moz_places SET visit_count=0, frecency=-1, last_visit_date=NULL;';
  }
  if (hasPlaces && await sqliteTableExists(realPath, 'moz_annos')) {
    sql += `DELETE FROM moz_annos WHERE id IN (
      SELECT moz_annos.id FROM moz_annos
      LEFT JOIN moz_places ON moz_annos.place_id = moz_places.id
      WHERE moz_places.id IS NULL
    );`;
  }
  if (await sqliteTableExists(realPath, 'moz_historyvisits')) {
    sql += 'DELETE FROM moz_historyvisits;';
  }
  if (hasPlaces && await sqliteTableExists(realPath, 'moz_inputhistory')) {
    sql += `DELETE FROM moz_inputhistory WHERE place_id NOT IN (SELECT id FROM moz_places);`;
  }
  if (await sqliteTableExists(realPath, 'moz_origins')) {
    sql += 'DELETE FROM moz_origins WHERE id NOT IN (SELECT DISTINCT origin_id FROM moz_places);';
    sql += 'UPDATE moz_origins SET frecency=-1;';
  }
  if (await sqliteTableExists(realPath, 'moz_meta')) {
    sql += "DELETE FROM moz_meta WHERE key LIKE 'origin_frecency_%';";
  }
  if (await sqliteTableExists(realPath, 'moz_hosts')) {
    sql += 'DELETE FROM moz_hosts;';
  }
  sql += 'VACUUM;';
  await execFileAsync(sqlite3ExePath(), [realPath, sql]);
}
```

Guard the whole action on `sqliteTableExists(action.expandedPath, 'moz_places')` OR `sqliteTableExists(action.expandedPath, 'moz_historyvisits')` first (a file with NEITHER isn't a recognized places database at all) -- if both are absent, skip with a reason.

- [ ] **Step 4: Run it, confirm it passes, run the full suite, commit**

```bash
npx vitest run src/lib/cleanerActions/mozillaUrlHistory.test.js
npx vitest run
git add backend/src/lib/cleanerActions/mozillaUrlHistory.js backend/src/lib/cleanerActions/mozillaUrlHistory.test.js
git commit -m "feat(cleanerActions): add mozilla.url.history, standalone"
```

---

### Task 6: `mozillaFavicons.js`

**Files:**
- Create: `backend/src/lib/cleanerActions/mozillaFavicons.js`
- Test: `backend/src/lib/cleanerActions/mozillaFavicons.test.js`

The most involved cleaner in this phase: a favicons database cross-references bookmark URLs from a SIBLING `places.sqlite` file via a read-only `ATTACH DATABASE` -- `places.sqlite` itself is never written to, only read, and never quarantined (nothing in it changes).

- [ ] **Step 1: Write the failing tests**

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scan, execute } from './mozillaFavicons.js';
import { sqlite3ExePath } from './sqliteVacuum.js';

const execFileAsync = promisify(execFile);

async function makePlacesDb(filePath) {
  const sql = `
    CREATE TABLE moz_bookmarks (id INTEGER PRIMARY KEY, fk INTEGER);
    CREATE TABLE moz_places (id INTEGER PRIMARY KEY, url LONGVARCHAR);
    INSERT INTO moz_places (id, url) VALUES (1, 'https://bookmarked.com/some/deep/page');
    INSERT INTO moz_bookmarks (id, fk) VALUES (1, 1);
  `;
  await execFileAsync(sqlite3ExePath(), [filePath, sql]);
}

async function makeFaviconsDb(filePath) {
  const sql = `
    CREATE TABLE moz_icons (id INTEGER PRIMARY KEY, icon_url LONGVARCHAR, data BLOB);
    INSERT INTO moz_icons (id, icon_url, data) VALUES
      (1, 'https://bookmarked.com/favicon.ico', x'01'),
      (2, 'https://not-bookmarked.com/favicon.ico', x'02');
    CREATE TABLE moz_pages_w_icons (id INTEGER PRIMARY KEY, page_url LONGVARCHAR);
    INSERT INTO moz_pages_w_icons (id, page_url) VALUES
      (1, 'https://bookmarked.com/some/deep/page'),
      (2, 'https://not-bookmarked.com/');
    CREATE TABLE moz_icons_to_pages (page_id INTEGER, icon_id INTEGER);
    INSERT INTO moz_icons_to_pages (page_id, icon_id) VALUES (1, 1), (2, 2);
  `;
  await execFileAsync(sqlite3ExePath(), [filePath, sql]);
}

let scratchDir;
let savedEnv;
beforeEach(async () => {
  scratchDir = await mkdtemp(join(tmpdir(), 'prune-mozilla-favicons-test-'));
  savedEnv = process.env.UNREVO_QUARANTINE_ROOT;
  process.env.UNREVO_QUARANTINE_ROOT = await mkdtemp(join(tmpdir(), 'prune-mozilla-favicons-qroot-'));
});
afterEach(async () => {
  await rm(scratchDir, { recursive: true, force: true });
  await rm(process.env.UNREVO_QUARANTINE_ROOT, { recursive: true, force: true });
  if (savedEnv === undefined) delete process.env.UNREVO_QUARANTINE_ROOT;
  else process.env.UNREVO_QUARANTINE_ROOT = savedEnv;
});

describe('mozillaFavicons scan', () => {
  it('reports present:true for a real favicons database', async () => {
    const filePath = join(scratchDir, 'favicons.sqlite');
    await makeFaviconsDb(filePath);
    expect(scan({ expandedPath: filePath }).present).toBe(true);
  });
});

describe('mozillaFavicons execute', () => {
  it('keeps the bookmarked page/icon, removes the non-bookmarked one, leaves places.sqlite untouched', async () => {
    await makePlacesDb(join(scratchDir, 'places.sqlite'));
    const filePath = join(scratchDir, 'favicons.sqlite');
    await makeFaviconsDb(filePath);
    const placesBefore = await readFile(join(scratchDir, 'places.sqlite'));

    const result = await execute({ expandedPath: filePath }, 'Test Rule', {});

    const pages = await execFileAsync(sqlite3ExePath(), [filePath, 'SELECT page_url FROM moz_pages_w_icons;']);
    expect(pages.stdout.trim()).toBe('https://bookmarked.com/some/deep/page');

    const placesAfter = await readFile(join(scratchDir, 'places.sqlite'));
    expect(placesAfter).toEqual(placesBefore); // never mutated

    expect(result.quarantineBatch).toBeTruthy();
  });

  it('skips gracefully when there is no sibling places.sqlite', async () => {
    const filePath = join(scratchDir, 'favicons.sqlite');
    await makeFaviconsDb(filePath);
    // No places.sqlite written in scratchDir.

    const result = await execute({ expandedPath: filePath }, 'Test Rule', {});

    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toMatch(/places/i);
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

```bash
npx vitest run src/lib/cleanerActions/mozillaFavicons.test.js
```

- [ ] **Step 3: Implement it**

Ported from BleachBit's real `delete_mozilla_favicons()` (already read in full this session), simplified: this codebase's `moz_icons`/`moz_pages_w_icons`/`moz_icons_to_pages` schema (BleachBit's OWN documented schema, since Firefox's favicon-storage tables are unrelated to Chrome's and were not independently re-verified against a live Firefox install -- same honest caveat as Task 5) is used AS-IS, no domain-level "keep the whole domain if any page is bookmarked" logic from BleachBit's own `_remove_path_from_url` (that's an extra refinement on top of the base page-level bookmark check; page-level matching -- keep exactly the bookmarked page's own favicon, drop others -- is a safe, simpler starting behavior and a legitimate scope-narrowing decision, not a bug, given the added URL-parsing complexity BleachBit's domain-level version carries):

```js
import { existsSync, statSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join } from 'node:path';
import { isExcluded, isTooRecent } from '../cleanGuards.js';
import { sqlite3ExePath } from './sqliteVacuum.js';
import { sqliteTableExists } from './sqliteInspect.js';
import { escapeSqlString } from './cookieSql.js';
import { quarantineFileEdit } from '../../services/quarantine.js';

const execFileAsync = promisify(execFile);

function heldReason(expandedPath, mtimeMs, guards) {
  if (isExcluded(expandedPath, guards.excludeFolders, guards.excludeExtensions)) {
    return 'excluded by your own settings';
  }
  if (isTooRecent(mtimeMs, guards.skipRecentHours)) {
    return 'modified too recently';
  }
  return null;
}

export function scan(action) {
  if (!existsSync(action.expandedPath)) {
    return { sizeBytes: 0, present: false };
  }
  return { sizeBytes: statSync(action.expandedPath).size, present: true };
}

/** Executes a mozilla.favicons action: removes favicon entries for pages
 * that are not bookmarked, cross-referencing a SIBLING places.sqlite
 * (same directory) via a read-only ATTACH -- places.sqlite is never
 * written to and never quarantined, since nothing in it changes. Page-
 * level bookmark matching (keep exactly a bookmarked page's own icon),
 * not BleachBit's own domain-level refinement -- see this task's own
 * plan note for why that's a deliberate, safe scope decision. */
export async function execute(action, ruleName, guards = {}) {
  if (!existsSync(action.expandedPath)) {
    return { freedBytes: 0, skipped: [] };
  }
  const before = statSync(action.expandedPath);
  const reason = heldReason(action.expandedPath, before.mtimeMs, guards);
  if (reason) {
    return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason }] };
  }

  const hasIcons = await sqliteTableExists(action.expandedPath, 'moz_pages_w_icons');
  if (!hasIcons) {
    return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason: 'not a recognized Firefox favicons database' }] };
  }

  const placesPath = join(dirname(action.expandedPath), 'places.sqlite');
  if (!existsSync(placesPath)) {
    return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason: 'no sibling places.sqlite found to check bookmarks against' }] };
  }

  try {
    const manifest = await quarantineFileEdit({
      programName: `Deep Clean: ${ruleName}`,
      filePath: action.expandedPath,
      editFn: async (realPath) => {
        const escapedPlaces = escapeSqlString(placesPath);
        const bookmarkedUrlsQuery =
          `SELECT url FROM places.moz_places WHERE id IN (SELECT DISTINCT fk FROM places.moz_bookmarks WHERE fk IS NOT NULL)`;
        let sql = `ATTACH DATABASE '${escapedPlaces}' AS places;`;
        sql += `DELETE FROM moz_pages_w_icons WHERE page_url NOT IN (${bookmarkedUrlsQuery});`;
        if (await sqliteTableExists(realPath, 'moz_icons_to_pages')) {
          sql += `DELETE FROM moz_icons_to_pages WHERE page_id NOT IN (SELECT id FROM moz_pages_w_icons);`;
        }
        if (await sqliteTableExists(realPath, 'moz_icons') && await sqliteTableExists(realPath, 'moz_icons_to_pages')) {
          sql += `DELETE FROM moz_icons WHERE id NOT IN (SELECT icon_id FROM moz_icons_to_pages);`;
        }
        sql += 'VACUUM;';
        await execFileAsync(sqlite3ExePath(), [realPath, sql]);
      }
    });
    const after = statSync(action.expandedPath).size;
    return { freedBytes: Math.max(0, before.size - after), quarantineBatch: manifest.batchDir, skipped: [] };
  } catch {
    return { freedBytes: 0, skipped: [{ path: action.expandedPath, reason: 'could not clear favicons: the database may be in use or corrupted' }] };
  }
}
```

- [ ] **Step 4: Run it, confirm it passes, run the full suite, commit**

```bash
npx vitest run src/lib/cleanerActions/mozillaFavicons.test.js
npx vitest run
git add backend/src/lib/cleanerActions/mozillaFavicons.js backend/src/lib/cleanerActions/mozillaFavicons.test.js
git commit -m "feat(cleanerActions): add mozilla.favicons, standalone"
```

---

### Task 7: Wire all 5 into the dispatcher

**Files:**
- Modify: `backend/src/lib/cleanerRules.js`
- Test: `backend/src/lib/cleanerRules.test.js`

- [ ] **Step 1: Read the current dispatcher** (post-Phase-C, 6 action types already wired: shell/delete/sqlite.vacuum/winreg/json/cookie).

- [ ] **Step 2: Write the failing tests**

Add a `describe('phase D actions, wired', ...)` block to `cleanerRules.test.js` with ONE test per new action type (5 total), each building a minimal real fixture (reuse/adapt the fixture helpers from this phase's own action-module tests) and confirming `scanRule`/`executeRule` correctly dispatch to it -- matching the exact shape of the existing `cookie action, wired`/`json action, wired` blocks from prior phases.

- [ ] **Step 3: Run it, confirm it fails**

```bash
cd backend && npx vitest run src/lib/cleanerRules.test.js -t "phase D actions, wired"
```

- [ ] **Step 4: Implement the 5 dispatcher branches**

Add all 5 imports (`chromeAutofillAction`, `chromeKeywordsAction`, `chromeHistoryAction`, `mozillaUrlHistoryAction`, `mozillaFaviconsAction` -- or whatever naming convention keeps them unambiguous alongside the existing `cookieAction`/`jsonAction` imports). Add 5 `else if` branches to BOTH `scanRule` and `executeRule`, each following the EXACT merge pattern the `cookie`/`json` branches already use (`sizeBytes`/`present` for scan; `freedBytes`/`skipped`/`recycled`/`quarantineBatch` for execute -- note none of these 5 action types offer a Recycle Bin alternative the way `json`/`cookie` do, since they always go through `quarantineFileEdit`, never `autoQuarantine:false`-gated Recycle Bin branching; `recycled` simply never gets set by any of them, which is fine, the merge pattern already only sets it conditionally). Update both functions' doc comments to list all 5 new types.

- [ ] **Step 5: Run it, confirm it passes, run the full suite, commit**

```bash
npx vitest run src/lib/cleanerRules.test.js
npx vitest run
git add backend/src/lib/cleanerRules.js backend/src/lib/cleanerRules.test.js
git commit -m "feat(cleanerRules): wire chrome.history/autofill/keywords and mozilla.url.history/favicons into the dispatcher"
```

---

### Task 8: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full three-suite pass**

```bash
cd backend && npm test
cd ../frontend && npx vitest run
cd ../electron && npm test
```

Expected: backend all green except the 3 pre-existing elevation-gated failures (exact same composition as every prior phase: 2 in pendingReboot.test.js, 1 in quarantine.test.js); frontend and electron fully green (no frontend changes this phase).

- [ ] **Step 2: Cross-check against the spec**

Confirm: `chrome.favicons`/`chrome.databases_db` were NOT built (grep the whole diff for either string -- should find nothing beyond the spec/plan docs themselves). No new `cleaners.json` rules use any of the 5 new action types (`grep -cE '"type": "(chrome\.|mozilla\.)' backend/src/data/cleaners.json` should be 0). `chrome.autofill` touches only the `autofill` table (grep `chromeAutofill.js` for `autofill_profile`/`local_addresses`/`server_addresses`/`addresses` -- none should appear).

- [ ] **Step 3: Final comprehensive review**

Given this phase's real-world consequence (deleting actual browsing history/autofill/favicon data) and the number of new modules (6 including the shared helper), do one final read-through of all 6 new files together, checking: every module follows the identical `heldReason`/missing-file/quarantine-via-editFn shape; every DELETE predicate that's supposed to preserve something (bookmarks in chrome.history and mozilla.url.history) is verified correct by its own test, not just by the SQL looking right; no module was accidentally given a destructive default (e.g. an action that runs even when its target table doesn't exist, silently doing nothing dangerous, versus one that might accidentally match too much).
