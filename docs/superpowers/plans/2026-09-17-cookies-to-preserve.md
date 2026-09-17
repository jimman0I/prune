# Cookies to Preserve Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user see the real cookie domains on this machine and choose which to keep, closing the gap where `cookieKeepList` has existed as a setting since Phase C with no UI to populate it.

**Architecture:** A new backend function (`listCookieDomains`) reuses `cleaners.json`'s own `cookie`-action rules (already the single source of truth `executeRule`/`scanRule` dispatch against) to find every real cookie database on the machine, queries each via the bundled `sqlite3.exe` CLI for its distinct hosts and counts, and aggregates by normalized domain. A new route exposes it; a new Settings-page component renders it as a searchable, tickable list wired straight to the existing `cookieKeepList` setting via the same immediate-save pattern `excludeFolders` already uses.

**Tech Stack:** Node.js/Express backend, bundled `sqlite3.exe` CLI (no new dependency), React frontend, Vitest + Testing Library.

---

### Task 1: Export the three helpers the new listing code needs, and build `listCookieDomains`

**Files:**
- Modify: `backend/src/lib/cleanerRules.js:64` (export `resolveBespokeActionPaths`)
- Modify: `backend/src/lib/cleanerActions/cookieSql.js` (export `normalizeDomain`)
- Modify: `backend/src/lib/cleanerActions/cookie.js` (export `detectCookieTable`)
- Create: `backend/src/lib/cleanerActions/cookieDomains.js`
- Test: `backend/src/lib/cleanerActions/cookieDomains.test.js`

Three functions the new file needs already exist but are private to their modules. Exporting them changes nothing about their behavior — every existing test for `cleanerRules.js`, `cookieSql.js`, and `cookie.js` must still pass unchanged after this task.

- [ ] **Step 1: Export `resolveBespokeActionPaths`**

In `backend/src/lib/cleanerRules.js`, change line 64 from:

```js
function resolveBespokeActionPaths(expandedPath) {
```

to:

```js
export function resolveBespokeActionPaths(expandedPath) {
```

- [ ] **Step 2: Export `normalizeDomain`**

In `backend/src/lib/cleanerActions/cookieSql.js`, find:

```js
function normalizeDomain(domain) {
```

and change it to:

```js
export function normalizeDomain(domain) {
```

- [ ] **Step 3: Export `detectCookieTable`**

In `backend/src/lib/cleanerActions/cookie.js`, find:

```js
async function detectCookieTable(dbPath) {
```

and change it to:

```js
export async function detectCookieTable(dbPath) {
```

- [ ] **Step 4: Run the existing suites for all three files to confirm nothing broke**

Run: `cd backend && npx vitest run src/lib/cleanerRules.test.js src/lib/cleanerActions/cookieSql.test.js src/lib/cleanerActions/cookie.test.js`
Expected: PASS, same pass count as before this task (exporting a function changes nothing about its behavior).

- [ ] **Step 5: Write the failing tests for `listCookieDomains`**

Create `backend/src/lib/cleanerActions/cookieDomains.test.js`:

```js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sqlite3ExePath } from './sqliteVacuum.js';

const execFileAsync = promisify(execFile);

/** listCookieDomains reads its rule set via loadCleanerRules(), which
 * normally reads the real cleaners.json. Mocked here so these tests
 * exercise the aggregation/error-handling logic in isolation, against a
 * synthetic rule pointed at a temp directory, rather than depending on
 * the real cleaners.json's exact rule ids or real browser profiles on
 * whatever machine runs this suite. expandPath/resolveBespokeActionPaths
 * stay real (importOriginal), so the real glob-resolution logic is still
 * exercised end to end -- only WHICH rules exist is faked. */
const fixtureRules = [];
vi.mock('../cleanerRules.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, loadCleanerRules: () => fixtureRules };
});

const { listCookieDomains } = await import('./cookieDomains.js');

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
let savedAppData;
beforeEach(async () => {
  scratchDir = await mkdtemp(join(tmpdir(), 'prune-cookie-domains-test-'));
  savedAppData = process.env.APPDATA;
  process.env.APPDATA = scratchDir;
  fixtureRules.length = 0;
});
afterEach(async () => {
  await rm(scratchDir, { recursive: true, force: true });
  if (savedAppData === undefined) delete process.env.APPDATA;
  else process.env.APPDATA = savedAppData;
});

describe('listCookieDomains', () => {
  it('aggregates counts for the same domain across two profiles into one row', async () => {
    const profile1 = join(scratchDir, 'Browser', 'Default');
    const profile2 = join(scratchDir, 'Browser', 'Profile 1');
    await mkdir(profile1, { recursive: true });
    await mkdir(profile2, { recursive: true });
    await makeChromiumCookieDb(join(profile1, 'Cookies'), [{ host: 'example.com' }, { host: 'example.com' }]);
    await makeChromiumCookieDb(join(profile2, 'Cookies'), [{ host: 'example.com' }]);
    fixtureRules.push({
      id: 'test_cookies', category: 'Test', name: 'Test cookies',
      actions: [{ type: 'cookie', path: '%APPDATA%\\Browser\\*\\Cookies' }]
    });

    const result = await listCookieDomains();
    expect(result.domains).toEqual([{ domain: 'example.com', count: 3 }]);
    expect(result.errors).toEqual([]);
  });

  it('detects the Firefox schema too', async () => {
    const filePath = join(scratchDir, 'cookies.sqlite');
    await makeFirefoxCookieDb(filePath, [{ host: 'keep.com' }]);
    fixtureRules.push({
      id: 'test_firefox_cookies', category: 'Test', name: 'Test firefox cookies',
      actions: [{ type: 'cookie', path: '%APPDATA%\\cookies.sqlite' }]
    });

    const result = await listCookieDomains();
    expect(result.domains).toEqual([{ domain: 'keep.com', count: 1 }]);
  });

  it('sorts by count descending', async () => {
    const filePath = join(scratchDir, 'Cookies');
    await makeChromiumCookieDb(filePath, [
      { host: 'a.com' }, { host: 'b.com' }, { host: 'b.com' }, { host: 'b.com' }
    ]);
    fixtureRules.push({
      id: 'test_cookies', category: 'Test', name: 'Test cookies',
      actions: [{ type: 'cookie', path: '%APPDATA%\\Cookies' }]
    });

    const result = await listCookieDomains();
    expect(result.domains).toEqual([{ domain: 'b.com', count: 3 }, { domain: 'a.com', count: 1 }]);
  });

  it('skips a locked/corrupt file into errors rather than throwing', async () => {
    const filePath = join(scratchDir, 'Cookies');
    await writeFile(filePath, 'not a sqlite database at all');
    fixtureRules.push({
      id: 'test_cookies', category: 'Test', name: 'Test cookies',
      actions: [{ type: 'cookie', path: '%APPDATA%\\Cookies' }]
    });

    const result = await listCookieDomains();
    expect(result.domains).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].path).toBe(filePath);
  });

  it('returns empty domains and errors when no cookie files exist anywhere', async () => {
    fixtureRules.push({
      id: 'test_cookies', category: 'Test', name: 'Test cookies',
      actions: [{ type: 'cookie', path: '%APPDATA%\\DoesNotExist\\Cookies' }]
    });
    const result = await listCookieDomains();
    expect(result).toEqual({ domains: [], errors: [] });
  });

  it('normalizes host case and a leading dot the same way buildKeepPredicate matches, so counts merge correctly', async () => {
    const profile1 = join(scratchDir, 'A');
    const profile2 = join(scratchDir, 'B');
    await mkdir(profile1, { recursive: true });
    await mkdir(profile2, { recursive: true });
    await makeChromiumCookieDb(join(profile1, 'Cookies'), [{ host: 'Example.COM' }]);
    await makeChromiumCookieDb(join(profile2, 'Cookies'), [{ host: 'example.com' }]);
    fixtureRules.push(
      { id: 'a', category: 'Test', name: 'A', actions: [{ type: 'cookie', path: '%APPDATA%\\A\\Cookies' }] },
      { id: 'b', category: 'Test', name: 'B', actions: [{ type: 'cookie', path: '%APPDATA%\\B\\Cookies' }] }
    );
    const result = await listCookieDomains();
    expect(result.domains).toEqual([{ domain: 'example.com', count: 2 }]);
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `cd backend && npx vitest run src/lib/cleanerActions/cookieDomains.test.js`
Expected: FAIL — `Cannot find module './cookieDomains.js'` (the file doesn't exist yet).

- [ ] **Step 7: Write `listCookieDomains`**

Create `backend/src/lib/cleanerActions/cookieDomains.js`:

```js
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { loadCleanerRules, normalizeRule, expandPath, resolveBespokeActionPaths } from '../cleanerRules.js';
import { sqlite3ExePath } from './sqliteVacuum.js';
import { normalizeDomain } from './cookieSql.js';
import { detectCookieTable } from './cookie.js';

const execFileAsync = promisify(execFile);

/** Every real cookie database Prune already knows about, via the exact
 * same rule set executeRule/scanRule dispatch against -- cleaners.json's
 * own `cookie`-action rules, glob-resolved across browser profiles the
 * same way a real clean would resolve them. A hardcoded second path list
 * here would drift from cleaners.json the first time someone edits a
 * cookie rule there. */
function cookieDbPaths() {
  return loadCleanerRules()
    .flatMap((rule) => normalizeRule(rule).actions)
    .filter((action) => action.type === 'cookie')
    .flatMap((action) => resolveBespokeActionPaths(expandPath(action.path)));
}

/** Lists every distinct cookie domain found on this machine, with how
 * many cookies each one has, summed across every browser/profile that
 * has any. A file that can't be read as a recognized cookie database
 * (locked, corrupt, not a database at all) is skipped into `errors`
 * rather than aborting the rest -- same non-fatal-per-file posture
 * cookie.js's own execute() already takes for a single file. */
export async function listCookieDomains() {
  const counts = new Map();
  const errors = [];

  for (const dbPath of cookieDbPaths()) {
    if (!existsSync(dbPath)) continue;

    let table;
    try {
      table = await detectCookieTable(dbPath);
    } catch (err) {
      errors.push({ path: dbPath, reason: `not a valid cookie database: ${err.message}` });
      continue;
    }
    if (!table) {
      errors.push({ path: dbPath, reason: 'not a recognized cookie database' });
      continue;
    }

    try {
      const { stdout } = await execFileAsync(
        sqlite3ExePath(),
        [dbPath, `SELECT ${table.hostColumn}, COUNT(*) FROM ${table.tableName} GROUP BY ${table.hostColumn};`]
      );
      // The bundled sqlite3.exe CLI's default list-mode output, one row
      // per line, columns separated by '|' -- same format cookie.test.js
      // already relies on for its own single-column SELECT. lastIndexOf
      // rather than a plain split: a host value could theoretically
      // contain '|', and the count is always the last field regardless.
      for (const line of stdout.trim().split(/\r?\n/).filter(Boolean)) {
        const sep = line.lastIndexOf('|');
        if (sep === -1) continue;
        const host = line.slice(0, sep);
        const count = parseInt(line.slice(sep + 1), 10);
        if (!host || Number.isNaN(count)) continue;
        const domain = normalizeDomain(host);
        counts.set(domain, (counts.get(domain) ?? 0) + count);
      }
    } catch (err) {
      errors.push({ path: dbPath, reason: `could not read cookies: ${err.message}` });
    }
  }

  const domains = [...counts.entries()]
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count);

  return { domains, errors };
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `cd backend && npx vitest run src/lib/cleanerActions/cookieDomains.test.js`
Expected: PASS, 6/6.

- [ ] **Step 9: Commit**

```bash
git add backend/src/lib/cleanerRules.js backend/src/lib/cleanerActions/cookieSql.js backend/src/lib/cleanerActions/cookie.js backend/src/lib/cleanerActions/cookieDomains.js backend/src/lib/cleanerActions/cookieDomains.test.js
git commit -m "feat(cookies): list every real cookie domain on the machine, by count"
```

---

### Task 2: Expose it as a route

**Files:**
- Modify: `backend/src/routes/deepClean.js`
- Test: `backend/src/routes/deepClean.test.js`

- [ ] **Step 1: Write the failing route tests**

In `backend/src/routes/deepClean.test.js`, add this mock near the top, alongside the existing `vi.mock('../lib/cleanerRules.js', ...)` block:

```js
const listCookieDomains = vi.fn(async () => ({ domains: [{ domain: 'example.com', count: 3 }], errors: [] }));
vi.mock('../lib/cleanerActions/cookieDomains.js', () => ({
  listCookieDomains: (...a) => listCookieDomains(...a)
}));
```

Then add this describe block (anywhere alongside the other route describes):

```js
describe('GET /deep-clean/cookie-domains', () => {
  it('returns whatever listCookieDomains resolves, verbatim', async () => {
    const res = await server.call('/deep-clean/cookie-domains');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ domains: [{ domain: 'example.com', count: 3 }], errors: [] });
  });

  it('responds 500 with the error message if the scan throws', async () => {
    listCookieDomains.mockRejectedValueOnce(new Error('sqlite3.exe not found'));
    const res = await server.call('/deep-clean/cookie-domains');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('sqlite3.exe not found');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx vitest run src/routes/deepClean.test.js`
Expected: FAIL — `404` instead of `200` (the route doesn't exist yet).

- [ ] **Step 3: Add the route**

In `backend/src/routes/deepClean.js`, add the import alongside the existing ones at the top:

```js
import { listCookieDomains } from '../lib/cleanerActions/cookieDomains.js';
```

Then add the route, next to the other simple GET routes (e.g. right after the `/category-icons` route):

```js
router.get('/cookie-domains', async (req, res) => {
  try {
    res.json(await listCookieDomains());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && npx vitest run src/routes/deepClean.test.js`
Expected: PASS, all tests in this file including the 2 new ones.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/deepClean.js backend/src/routes/deepClean.test.js
git commit -m "feat(cookies): add GET /api/deep-clean/cookie-domains route"
```

---

### Task 3: Frontend fetch helper

**Files:**
- Modify: `frontend/src/lib/api.js`

No dedicated test for this step: every other plain `fetchXxx` wrapper in this file (`fetchDeepCleanRules`, `fetchDeepCleanScan`, etc.) has no direct unit test either — they're exercised through the component tests that mock `../lib/api.js`, which Task 4 does for this one.

- [ ] **Step 1: Add `fetchCookieDomains`**

In `frontend/src/lib/api.js`, add this function near the other Deep Clean fetchers (e.g. right after `fetchDeepCleanScan`):

```js
/** Every real cookie domain found on this machine, with how many cookies
 * each has. Throws on failure (unlike fetchCleanerCategoryIcons, which
 * swallows errors because icons are decoration) -- this is the result of
 * an explicit user click, and a scan that silently returned nothing would
 * look identical to "this machine truly has no cookies anywhere", which
 * is never true. */
export async function fetchCookieDomains() {
  const res = await fetch(`${API_URL}/deep-clean/cookie-domains`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return { domains: data.domains ?? [], errors: data.errors ?? [] };
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/api.js
git commit -m "feat(cookies): add fetchCookieDomains"
```

---

### Task 4: i18n keys, all 40 languages

Ordered before the component that uses them (Task 5) so every task's commit leaves the test suite green — a component referencing a key the catalog doesn't have yet would fail every one of its own render tests with a thrown "no translation" error, not a clean red-then-green TDD cycle.

**Files:**
- Modify: `frontend/src/i18n/catalog.js`

`frontend/src/i18n/catalog.test.js` already enforces that every language has exactly the same set of keys as English, matching types, with no blank values — this is the acceptance test for this task, and it is why the other 39 languages' actual translated text isn't spelled out word-for-word here: that test is what proves completion, the same way this project's own past i18n additions were done — real per-language translations added in the same commit as the feature, not deferred, with lower-confidence languages named in the commit rather than silently guessed at.

- [ ] **Step 1: Add the English keys**

In `frontend/src/i18n/catalog.js`, find the `en` language block's `settings.exclusions` object (around line 102) and add a new sibling key `cookiesToPreserve` immediately after it, inside the same `settings` object:

```js
      cookiesToPreserve: {
        title: 'Cookies to preserve',
        description: "Everything else in a browser's cookie file is gone the moment you clean it. Scan to see what's actually there, and tick anything worth keeping.",
        scanButton: 'Scan for cookies',
        scanning: 'Scanning…',
        filterPlaceholder: 'Filter domains…',
        countSuffix: (count) => `${count} cookie${count === 1 ? '' : 's'}`,
        none: 'No cookies found.',
        staleBadge: 'not seen this scan',
        scanErrorPrefix: (message) => `Couldn't scan for cookies: ${message}`,
        fileErrorsNote: (count) => `${count} file${count === 1 ? '' : 's'} couldn't be read and ${count === 1 ? 'was' : 'were'} skipped.`,
        checkboxAriaLabel: (domain) => `Keep cookies from ${domain}`
      },
```

- [ ] **Step 2: Run the catalog completeness test to see exactly which languages are missing the new key**

Run: `cd frontend && npx vitest run src/i18n/catalog.test.js`
Expected: FAIL — `"gives every language every key English has, and nothing extra"` lists every one of the other 39 language codes as missing `settings.cookiesToPreserve.*`.

- [ ] **Step 3: Add the same 11 keys to every other language block**

For each of the other 39 languages in `frontend/src/i18n/catalog.js`, find that language's own `settings.exclusions` object and add a `cookiesToPreserve` sibling with the same 11 keys (7 plain strings, 4 functions with identical parameter shapes to English), translated naturally into that language, matching the tone that language's own `settings.exclusions` block already uses. Flag any language translated with lower confidence in the commit message, the way this project's past i18n work has (previously flagged: Afrikaans, Welsh, Icelandic, Pashto, Albanian, Serbian — check those again here, since a new UI-facing feature is exactly where a rough translation is most visible).

- [ ] **Step 4: Run the catalog completeness test again**

Run: `cd frontend && npx vitest run src/i18n/catalog.test.js`
Expected: PASS — every language has the key, matching English's shape, no blanks.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/i18n/catalog.js
git commit -m "feat(cookies): add cookiesToPreserve strings, all 40 languages"
```

---

### Task 5: The Settings component

**Files:**
- Create: `frontend/src/components/CookieKeepListSettings.jsx`
- Test: `frontend/src/components/CookieKeepListSettings.render.test.jsx`

- [ ] **Step 1: Write the failing render tests**

Create `frontend/src/components/CookieKeepListSettings.render.test.jsx`:

```jsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

const fetchCookieDomains = vi.fn();

vi.mock('../lib/api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchCookieDomains: (...a) => fetchCookieDomains(...a)
}));

const CookieKeepListSettings = (await import('./CookieKeepListSettings.jsx')).default;

describe('CookieKeepListSettings', () => {
  it('scans, lists domains by count, and ticking one saves it into cookieKeepList', async () => {
    fetchCookieDomains.mockResolvedValue({
      domains: [{ domain: 'example.com', count: 12 }, { domain: 'other.com', count: 3 }],
      errors: []
    });
    const save = vi.fn();
    const user = userEvent.setup();
    renderScreen(<CookieKeepListSettings settings={{ cookieKeepList: [] }} save={save} />);

    await user.click(screen.getByRole('button', { name: 'Scan for cookies' }));
    await screen.findByText('example.com');

    await user.click(screen.getByRole('checkbox', { name: /example\.com/ }));
    expect(save).toHaveBeenCalledWith({ cookieKeepList: ['example.com'] });
  });

  it('unticks a checked domain, removing it from cookieKeepList', async () => {
    fetchCookieDomains.mockResolvedValue({ domains: [{ domain: 'example.com', count: 5 }], errors: [] });
    const save = vi.fn();
    const user = userEvent.setup();
    renderScreen(<CookieKeepListSettings settings={{ cookieKeepList: ['example.com'] }} save={save} />);

    await user.click(screen.getByRole('button', { name: 'Scan for cookies' }));
    await screen.findByText('example.com');

    await user.click(screen.getByRole('checkbox', { name: /example\.com/ }));
    expect(save).toHaveBeenCalledWith({ cookieKeepList: [] });
  });

  it('shows a domain already in cookieKeepList but absent from the latest scan as a stale, checked row', async () => {
    fetchCookieDomains.mockResolvedValue({ domains: [{ domain: 'other.com', count: 2 }], errors: [] });
    const user = userEvent.setup();
    renderScreen(<CookieKeepListSettings settings={{ cookieKeepList: ['gone-browser.com'] }} save={vi.fn()} />);

    // Renders even before a scan runs -- the setting isn't invisible.
    expect(screen.getByText('gone-browser.com')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Scan for cookies' }));
    await screen.findByText('other.com');
    expect(screen.getByRole('checkbox', { name: /gone-browser\.com/ })).toBeChecked();
  });

  it('filters the list by substring as the user types', async () => {
    fetchCookieDomains.mockResolvedValue({
      domains: [{ domain: 'example.com', count: 1 }, { domain: 'other.com', count: 1 }],
      errors: []
    });
    const user = userEvent.setup();
    renderScreen(<CookieKeepListSettings settings={{ cookieKeepList: [] }} save={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Scan for cookies' }));
    await screen.findByText('example.com');

    await user.type(screen.getByPlaceholderText('Filter domains…'), 'exam');
    expect(screen.getByText('example.com')).toBeTruthy();
    expect(screen.queryByText('other.com')).toBeNull();
  });

  it('shows a non-fatal note when some files could not be read', async () => {
    fetchCookieDomains.mockResolvedValue({
      domains: [{ domain: 'example.com', count: 1 }],
      errors: [{ path: 'C:\\locked\\Cookies', reason: 'could not read cookies: file is locked' }]
    });
    const user = userEvent.setup();
    renderScreen(<CookieKeepListSettings settings={{ cookieKeepList: [] }} save={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Scan for cookies' }));
    await screen.findByText(/couldn't be read/i);
  });

  it('shows the fetch error when the scan itself fails', async () => {
    fetchCookieDomains.mockRejectedValue(new Error('sqlite3.exe not found'));
    const user = userEvent.setup();
    renderScreen(<CookieKeepListSettings settings={{ cookieKeepList: [] }} save={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Scan for cookies' }));
    await screen.findByText(/sqlite3\.exe not found/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx vitest run src/components/CookieKeepListSettings.render.test.jsx`
Expected: FAIL — `Cannot find module './CookieKeepListSettings.jsx'`.

- [ ] **Step 3: Write the component**

Create `frontend/src/components/CookieKeepListSettings.jsx`:

```jsx
import { useState } from 'react';
import { fetchCookieDomains } from '../lib/api.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

/** Cookies to Preserve: closes the gap left by Phase C, which built
 * cookieKeepList's engine with no UI to populate it. Real data, not a
 * free-text field -- an explicit "Scan for cookies" click reads every
 * real cookie database this app already knows how to find (the same
 * `cookie`-action rules cleaners.json's own chrome/brave/edge_cookies
 * rules use), and the user ticks which domains survive a Deep Clean.
 *
 * No auto-scan on mount, matching Deep Clean's own Preview and Disk
 * Map's own fast-scan convention: nothing that reads every browser's
 * profile data happens without an explicit click. */
export default function CookieKeepListSettings({ settings, save }) {
  const { t } = useLanguage();
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState(null);
  const [filter, setFilter] = useState('');

  const keepList = Array.isArray(settings?.cookieKeepList) ? settings.cookieKeepList : [];

  const handleScan = async () => {
    setScanning(true);
    setScanError(null);
    try {
      setScanResult(await fetchCookieDomains());
    } catch (err) {
      setScanError(err.message);
    } finally {
      setScanning(false);
    }
  };

  const toggleDomain = (domain) => {
    save({
      cookieKeepList: keepList.includes(domain)
        ? keepList.filter((d) => d !== domain)
        : [...keepList, domain]
    });
  };

  const scannedDomains = scanResult?.domains ?? [];
  const scannedSet = new Set(scannedDomains.map((d) => d.domain));
  // A domain already in cookieKeepList (added on some earlier scan, or on
  // a machine that has since lost the browser that had it) still renders,
  // checked, even though nothing THIS scan measured -- same "don't hide
  // state" rule Deep Clean's own hidden-cleaners note already follows.
  const staleRows = keepList
    .filter((domain) => !scannedSet.has(domain))
    .map((domain) => ({ domain, count: null, stale: true }));
  const rows = [...scannedDomains, ...staleRows];
  const needle = filter.trim().toLowerCase();
  const filteredRows = needle ? rows.filter((row) => row.domain.toLowerCase().includes(needle)) : rows;

  return (
    <div className="glass-panel p-6">
      <div className="text-[14px] font-medium text-[color:var(--text-primary)] mb-1">
        {t('settings.cookiesToPreserve.title')}
      </div>
      <p className="text-[12.5px] text-[color:var(--text-secondary)] mb-4">
        {t('settings.cookiesToPreserve.description')}
      </p>

      <button
        className="btn-ghost px-3.5 py-2 rounded-lg text-[12px] font-medium disabled:opacity-50 mb-3"
        onClick={handleScan}
        disabled={scanning}
      >
        {scanning ? t('settings.cookiesToPreserve.scanning') : t('settings.cookiesToPreserve.scanButton')}
      </button>

      {scanError && (
        <p className="text-[12px] text-[color:var(--danger)] mb-3">
          {t('settings.cookiesToPreserve.scanErrorPrefix', scanError)}
        </p>
      )}

      {scanResult?.errors?.length > 0 && (
        <p className="text-[11.5px] text-[color:var(--warning)] mb-3">
          {t('settings.cookiesToPreserve.fileErrorsNote', scanResult.errors.length)}
        </p>
      )}

      {rows.length > 0 && (
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t('settings.cookiesToPreserve.filterPlaceholder')}
          className="w-full font-mono text-[12.5px] px-3 py-2 mb-3 rounded-lg bg-[color:var(--surface-hover)] border border-[color:var(--border-subtle)] text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)] focus:outline-none focus:border-[color:var(--accent-primary)]/50"
        />
      )}

      {scanResult && filteredRows.length === 0 && (
        <p className="text-[12.5px] text-[color:var(--text-muted)]">{t('settings.cookiesToPreserve.none')}</p>
      )}

      {filteredRows.length > 0 && (
        <div className="flex flex-col gap-1 max-h-[320px] overflow-y-auto">
          {filteredRows.map((row) => (
            <label
              key={row.domain}
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-[color:var(--surface-subtle)] cursor-pointer"
            >
              <span className="flex items-center gap-2 min-w-0">
                <input
                  type="checkbox"
                  className="prune-check"
                  checked={keepList.includes(row.domain)}
                  onChange={() => toggleDomain(row.domain)}
                  aria-label={t('settings.cookiesToPreserve.checkboxAriaLabel', row.domain)}
                />
                <span className="font-mono text-[12px] text-[color:var(--text-secondary)] truncate min-w-0">
                  {row.domain}
                </span>
                {row.stale && (
                  <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-px rounded border shrink-0 border-[color:var(--border-subtle)] text-[color:var(--text-muted)]">
                    {t('settings.cookiesToPreserve.staleBadge')}
                  </span>
                )}
              </span>
              {row.count !== null && (
                <span className="font-mono text-[11px] text-[color:var(--text-muted)] shrink-0">
                  {t('settings.cookiesToPreserve.countSuffix', row.count)}
                </span>
              )}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && npx vitest run src/components/CookieKeepListSettings.render.test.jsx`
Expected: PASS, 6/6 (Task 4 already added the English catalog keys these render).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/CookieKeepListSettings.jsx frontend/src/components/CookieKeepListSettings.render.test.jsx
git commit -m "feat(cookies): add CookieKeepListSettings component"
```

---

### Task 6: Wire the component into Settings

**Files:**
- Modify: `frontend/src/components/SettingsPage.jsx`
- Modify: `frontend/src/components/SettingsPage.render.test.jsx`

`SettingsPage.render.test.jsx` already has an `openCleanupTab()` helper (renders `<SettingsPage />` and clicks the "Cleanup" tab button) and mocks `../lib/api.js` as a full replacement object listing every function `SettingsPage.jsx` and its child components import — `fetchCookieDomains` must be added to that list or the import resolves to `undefined` once `CookieKeepListSettings.jsx` is wired in.

- [ ] **Step 1: Write the failing test**

In `frontend/src/components/SettingsPage.render.test.jsx`:

Add `fetchCookieDomains: vi.fn(async () => ({ domains: [], errors: [] }))` as a new line inside the existing `vi.mock('../lib/api.js', () => ({ ... }))` block (alongside `fetchDiskSpace: vi.fn(), fetchDiskHealth: vi.fn()`).

Add `cookieKeepList: []` as a new line inside the existing `DEFAULTS` object (alongside `excludeExtensions: []`).

Add this test inside a `describe('cookies to preserve', ...)` block (or alongside the other Cleanup-tab tests near line 306 onward):

```jsx
describe('cookies to preserve', () => {
  it('shows the panel on the Cleanup tab', async () => {
    await openCleanupTab();
    expect(await screen.findByText('Cookies to preserve')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx vitest run src/components/SettingsPage.render.test.jsx`
Expected: FAIL — `Cookies to preserve` not found (component not wired in yet).

- [ ] **Step 3: Wire it in**

In `frontend/src/components/SettingsPage.jsx`, add the import alongside the other component imports at the top (after `import ThemeToggle from './ThemeToggle.jsx';`):

```js
import CookieKeepListSettings from './CookieKeepListSettings.jsx';
```

Then render it inside the `{tab === 'cleanup' && (...)}` block, immediately after the exclusions `glass-panel` block's closing `</div>` (the one that follows the exclusions list, right before the sandbox-test `glass-panel` block):

```jsx
              <CookieKeepListSettings settings={settings} save={save} />
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && npx vitest run src/components/SettingsPage.render.test.jsx`
Expected: PASS, including the new test.

- [ ] **Step 5: Run the full frontend suite**

Run: `cd frontend && npx vitest run`
Expected: PASS, no regressions anywhere else in the suite.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/SettingsPage.jsx frontend/src/components/SettingsPage.render.test.jsx
git commit -m "feat(cookies): wire Cookies to Preserve into Settings > Cleanup"
```

---

### Task 7: Full-suite verification and manual check

**Files:** none (verification only)

- [ ] **Step 1: Run the full backend suite**

Run: `cd backend && npx vitest run`
Expected: PASS, no regressions.

- [ ] **Step 2: Run the full frontend suite**

Run: `cd frontend && npx vitest run`
Expected: PASS, no regressions.

- [ ] **Step 3: Manual verification in the running app**

Start the app (`preview_start` with the `prune-frontend` launch config, or the full Electron app if backend isn't already running). Open Settings → Cleanup, scroll to "Cookies to preserve", click "Scan for cookies", confirm real domains from installed browsers appear with real counts, tick one, reopen Settings and confirm it's still ticked (persisted), and confirm the empty-keep-list default behavior (a `cookie` action deletes the whole file) is unchanged for every domain never ticked — this is a change to a screen, not to `cookie.js`'s own execute() logic, but worth one real Deep Clean scan/preview afterward to confirm nothing about the existing cookie-cleaning rules regressed.

- [ ] **Step 4: Update the memory file**

If a persistent memory file for this project exists (`prune-project.md`), add a short entry noting Cookies to Preserve shipped, closing the Phase C UI gap.
