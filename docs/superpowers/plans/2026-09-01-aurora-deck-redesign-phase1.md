# Aurora Deck Redesign Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: none of superpowers'
> subagent-driven-development or executing-plans — per this project's own
> standing convention, execution happens by delegating each task below to
> Re:Route's Code Room (a fresh session per task, or per small task group),
> verified live afterward against the real running app before moving on.
> Steps use checkbox (`- [ ]`) syntax for tracking regardless of who
> executes them.

**Goal:** Replace unrevo's Prune-derived obsidian+cyan design system with
Aurora Deck (navy/coral/glass), and add a Dashboard landing screen in front
of the existing Applications list.

**Architecture:** A CSS custom-property token swap in `index.css`, converted
from being partially real properties + mostly hardcoded hex Tailwind
arbitrary values (the actual state discovered while planning — see Task 1)
into genuine `var(--token)` references everywhere, so future palette changes
touch one file. Two small new backend services (`diskSpace.js`,
`uninstallHistory.js`) follow this codebase's existing
PowerShell-shell-out / flat-file conventions exactly. A new `screen` state
in `App.jsx` plus a `NavRail` component are the entire "routing" layer —
no router library.

**Tech Stack:** Unchanged from Phase A — React + Vite + Tailwind + plain CSS
custom properties, Express + Node backend, Vitest. Two new Google Fonts
(IBM Plex Serif, JetBrains Mono). No other new dependencies.

---

## Real finding from planning (read before Task 1)

The spec assumed a "token swap" (`index.css`'s `:root` block) would
propagate everywhere. It won't: grepping every component file for literal
hex colors turns up **57 hardcoded hex values across ProgramList.jsx,
UninstallModal.jsx, LeftoverReview.jsx, and QuarantinePanel.jsx** — none of
them reference the CSS custom properties in `:root` at all (Phase A's
components were built with Tailwind arbitrary values like `text-[#a1a1aa]`
directly, not `text-[var(--text-secondary)]`). A real design-system swap
means converting these too, file by file — Tasks 3-6 below do exactly that,
converting each hardcoded hex value to its matching `var(--token)`
reference as part of the swap, which also fixes the underlying problem (a
future palette change won't need this same file-by-file hunt again).

---

## Task 1: Design tokens, fonts, and shared CSS classes

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Replace the `:root` token block**

Replace lines 7-21 (the entire existing `:root { ... }` block) with:

```css
:root {
  /* Surfaces */
  --bg-navy: #041638;
  --bg-panel: #181715;
  --glass-bg: rgba(4, 22, 56, 0.6);
  --glass-border: rgba(255, 255, 255, 0.08);

  /* Text */
  --text-primary: #faf9f5;
  --text-secondary: #a09d96;
  --text-muted: #71717a; /* kept -- Aurora Deck's brief doesn't specify a
                             third text tier, and several components need
                             one shade below --text-secondary for the
                             quietest labels (column headers, placeholders) */

  /* Functional accent -- coral, primary actions ONLY */
  --accent-coral: #f98074;
  --accent-coral-glow: rgba(249, 128, 116, 0.35);
  --accent-coral-soft: rgba(249, 128, 116, 0.12);

  /* Ambient / data-viz accents -- decorative and size-band coloring only,
     never an interactive element's color */
  --accent-purple: #8b5cf6;
  --accent-blue: #3b82f6;
  --accent-cyan: #06b6d4;

  --danger: #ec5162;
  --danger-soft: rgba(236, 81, 98, 0.12);
  --warning: #f59e0b;
  --warning-soft: rgba(245, 158, 11, 0.12);
  --success: #5db872;

  --border-subtle: rgba(255, 255, 255, 0.08);
}
```

- [ ] **Step 2: Add the two new font imports**

Replace line 1 (the existing `@import url(...Geist...)` line) with:

```css
@import url(https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&family=IBM+Plex+Serif:wght@400;500&family=JetBrains+Mono:wght@400;500&display=swap);
```

(This replaces the old separate Geist-only import; JetBrains Mono was
previously referenced by `.font-mono` but never actually loaded — line 70's
`font-family: 'JetBrains Mono', 'SF Mono', Menlo, monospace` was falling
back to the system mono font this whole time. This makes it real.)

- [ ] **Step 3: Add a `.display-heading` class for IBM Plex Serif headings**

Add after the existing `.font-mono` block (after line 72):

```css
.display-heading {
  font-family: 'IBM Plex Serif', Georgia, serif;
  font-weight: 400;
  letter-spacing: -0.01em;
}
```

- [ ] **Step 4: Update `body` and `body::before` to reference the new tokens**

Replace line 28 (`background: var(--bg-obsidian);`) with:

```css
  background: var(--bg-navy);
```

Replace lines 42-44 (the two `radial-gradient` lines inside `body::before`)
with:

```css
    radial-gradient(circle at 10% 10%, rgba(139, 92, 246, 0.08), transparent 30%),
    radial-gradient(circle at 90% 90%, rgba(6, 182, 212, 0.06), transparent 30%);
```

(Purple/cyan ambient glow instead of the old cyan/purple pairing -- same
positions, using the new `--accent-purple`/`--accent-cyan` values directly
since this is a `background-image` property, which can't reference a CSS
custom property inside `rgba()` without an extra `color-mix()` layer this
project doesn't need.)

- [ ] **Step 5: Update `.card` to use the new surface tokens**

Replace lines 63-67 (the `.card` block) with:

```css
.card {
  background: var(--bg-panel);
  border: 1px solid var(--border-subtle);
  border-radius: 16px;
}
```

- [ ] **Step 6: Add the shared `.glass-panel` class, replacing `.glass-strong`**

Replace lines 76-82 (the `.glass-strong` block and its comment) with:

```css
/* Glassmorphism -- every elevated surface: modals, stat cards, the nav
   rail, dashboard widgets. */
.glass-panel {
  background: var(--glass-bg);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}
```

- [ ] **Step 7: Update buttons -- pill radius, new tokens**

Replace lines 84-130 (the entire `.btn-primary`, `.btn-ghost`, `.btn-danger`
block) with:

```css
/* Buttons */
.btn-primary {
  background: linear-gradient(180deg, var(--accent-coral), #e8624f);
  color: #1a0604;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.25),
    0 8px 24px -8px var(--accent-coral-glow),
    0 2px 6px rgba(0, 0, 0, 0.35);
  transition: transform 140ms cubic-bezier(0.2, 0.9, 0.3, 1), box-shadow 200ms ease;
  font-weight: 600;
  letter-spacing: -0.01em;
  border-radius: 9999px;
  padding: 8px 20px;
  cursor: pointer;
}
.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.3),
    0 12px 32px -8px var(--accent-coral-glow),
    0 4px 10px rgba(0, 0, 0, 0.4);
}
.btn-primary:active { transform: translateY(0); }
.btn-primary:disabled { opacity: 0.5; cursor: default; transform: none; box-shadow: none; }

.btn-ghost {
  background: transparent;
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
  border-radius: 12px;
  padding: 8px 16px;
  cursor: pointer;
  transition: all 160ms ease;
}
.btn-ghost:hover { background: rgba(255, 255, 255, 0.04); border-color: rgba(255, 255, 255, 0.16); }

.btn-danger {
  background: var(--danger-soft);
  color: #f7a8b0;
  border: 1px solid rgba(236, 81, 98, 0.25);
  border-radius: 9999px;
  padding: 6px 14px;
  cursor: pointer;
  transition: all 160ms ease;
}
.btn-danger:hover { background: rgba(236, 81, 98, 0.2); color: #fbc7cc; }
```

- [ ] **Step 8: Update the checkbox and scrollbar to reference the new tokens**

Replace line 136 (`border: 1.5px solid #52525b;`) with:
```css
  border: 1.5px solid var(--text-muted);
```

Replace line 138 (`background: #0a0a0b;`) with:
```css
  background: var(--bg-navy);
```

Replace line 151 (`border: solid #001014;`) with:
```css
  border: solid #1a0604;
```

Replace line 158 (`::-webkit-scrollbar-thumb { background: #27272a; border-radius: 8px; border: 2px solid var(--bg-obsidian); }`) with:
```css
::-webkit-scrollbar-thumb { background: var(--border-subtle); border-radius: 8px; border: 2px solid var(--bg-navy); }
```

- [ ] **Step 9: Verify live**

Run `npm run dev` in `frontend/` (already covered by the project's existing
`unrevo-frontend` launch config), reload the running app. Expect: navy
background, coral hover on the search focus ring is NOT yet changed (that's
inside ProgramList.jsx, Task 3) -- at this point the page will look
partially migrated (navy background, old cyan focus rings) and that's
expected and fine, this task only touches shared CSS.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat(design): swap Prune tokens for Aurora Deck (navy/coral/glass)"
```

---

## Task 2: Backend disk-space service (TDD)

**Files:**
- Create: `backend/src/services/diskSpace.js`
- Test: `backend/src/services/diskSpace.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getSystemDriveSpace } from './diskSpace.js';
import * as powershell from './powershell.js';

describe('getSystemDriveSpace', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('returns freeBytes and totalBytes from a real-shaped PowerShell response', async () => {
    vi.spyOn(powershell, 'runPowerShellJson').mockResolvedValue({
      freeBytes: 214748364800,
      totalBytes: 1073741824000
    });
    const result = await getSystemDriveSpace();
    expect(result).toEqual({ freeBytes: 214748364800, totalBytes: 1073741824000 });
  });

  it('returns null when PowerShell returns nothing (drive query failed)', async () => {
    vi.spyOn(powershell, 'runPowerShellJson').mockResolvedValue(null);
    const result = await getSystemDriveSpace();
    expect(result).toBeNull();
  });

  it('returns null rather than dividing by zero when totalBytes is 0', async () => {
    vi.spyOn(powershell, 'runPowerShellJson').mockResolvedValue({ freeBytes: 0, totalBytes: 0 });
    const result = await getSystemDriveSpace();
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/services/diskSpace.test.js`
Expected: FAIL with "Cannot find module './diskSpace.js'"

- [ ] **Step 3: Write minimal implementation**

```js
import { runPowerShellJson } from './powershell.js';

/** Free/total bytes for the system drive (C:) -- same PowerShell-shell-out
 * chokepoint every other backend service already uses. Get-PSDrive's
 * Free/Used are already in bytes, no unit conversion needed. Returns null
 * (not 0/NaN) on any failure or a zero-total response, so the frontend
 * shows an honest "unavailable" state rather than a fabricated number. */
export async function getSystemDriveSpace() {
  const script = `
    $d = Get-PSDrive -Name C -ErrorAction Stop
    [PSCustomObject]@{ freeBytes = $d.Free; totalBytes = ($d.Free + $d.Used) } | ConvertTo-Json -Compress
  `;
  const raw = await runPowerShellJson(script);
  if (!raw || !raw.totalBytes) return null;
  return { freeBytes: raw.freeBytes, totalBytes: raw.totalBytes };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/services/diskSpace.test.js`
Expected: PASS (3/3)

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/diskSpace.js backend/src/services/diskSpace.test.js
git commit -m "feat(backend): add getSystemDriveSpace for the Dashboard's health score + storage stat"
```

---

## Task 3: Disk-space route

**Files:**
- Create: `backend/src/routes/diskSpace.js`
- Modify: `backend/src/index.js`

- [ ] **Step 1: Write the route**

```js
import { Router } from 'express';
import { getSystemDriveSpace } from '../services/diskSpace.js';

const router = Router();

router.get('/', async (_req, res) => {
  const space = await getSystemDriveSpace();
  if (!space) return res.status(503).json({ error: 'Could not read disk space.' });
  res.json(space);
});

export default router;
```

- [ ] **Step 2: Mount it**

In `backend/src/index.js`, add to the imports (alongside the existing
`programsRoutes`/`uninstallRoutes`/`leftoversRoutes`/`quarantineRoutes`
imports at the top):

```js
import diskSpaceRoutes from './routes/diskSpace.js';
```

And add to the route-mounting block (alongside the existing
`app.use('/api/programs', ...)` etc. lines):

```js
app.use('/api/disk-space', diskSpaceRoutes);
```

- [ ] **Step 3: Verify live**

With the backend running (`node src/index.js` in `backend/`, or the
existing `unrevo-backend` launch config), run:

```bash
curl http://127.0.0.1:3101/api/disk-space
```

Expected: a real JSON object like `{"freeBytes":123456789,"totalBytes":987654321}`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/diskSpace.js backend/src/index.js
git commit -m "feat(backend): mount GET /api/disk-space"
```

---

## Task 4: Backend uninstall-history service (TDD, real file I/O)

**Files:**
- Create: `backend/src/services/uninstallHistory.js`
- Test: `backend/src/services/uninstallHistory.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendHistoryEntry, getRecentHistory } from './uninstallHistory.js';

describe('uninstall history (real file I/O)', () => {
  let dir;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'unrevo-history-'));
    process.env.UNREVO_HISTORY_FILE = join(dir, 'uninstall-history.jsonl');
  });

  afterEach(() => {
    delete process.env.UNREVO_HISTORY_FILE;
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns an empty array when no history file exists yet', async () => {
    const entries = await getRecentHistory();
    expect(entries).toEqual([]);
  });

  it('appends an entry and reads it back', async () => {
    await appendHistoryEntry({ programName: '7-Zip 22.01', publisher: 'Igor Pavlov', sizeBytes: 4194304 });
    const entries = await getRecentHistory();
    expect(entries).toHaveLength(1);
    expect(entries[0].programName).toBe('7-Zip 22.01');
    expect(entries[0].sizeBytes).toBe(4194304);
    expect(typeof entries[0].timestamp).toBe('number');
  });

  it('returns entries newest-first', async () => {
    await appendHistoryEntry({ programName: 'First', publisher: 'A', sizeBytes: 1 });
    await appendHistoryEntry({ programName: 'Second', publisher: 'B', sizeBytes: 2 });
    const entries = await getRecentHistory();
    expect(entries.map(e => e.programName)).toEqual(['Second', 'First']);
  });

  it('caps at the given limit', async () => {
    for (let i = 0; i < 8; i++) {
      await appendHistoryEntry({ programName: `App ${i}`, publisher: 'X', sizeBytes: 1 });
    }
    const entries = await getRecentHistory(5);
    expect(entries).toHaveLength(5);
    expect(entries[0].programName).toBe('App 7'); // newest of the 8
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/services/uninstallHistory.test.js`
Expected: FAIL with "Cannot find module './uninstallHistory.js'"

- [ ] **Step 3: Write minimal implementation**

```js
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Path to the history file. A function, not a constant -- read at call
 * time so tests can point it at a scratch file via UNREVO_HISTORY_FILE,
 * matching quarantine.js's own UNREVO_QUARANTINE_ROOT override pattern. */
function historyFilePath() {
  return process.env.UNREVO_HISTORY_FILE
    || join(process.env.LOCALAPPDATA || process.cwd(), 'unrevo', 'uninstall-history.jsonl');
}

/** Appends one completed-uninstall record as a JSON line. A flat
 * append-only file, not a database -- Recent Activity only ever reads the
 * last few entries, and an append is the only write this ever needs. */
export async function appendHistoryEntry({ programName, publisher, sizeBytes }) {
  const path = historyFilePath();
  await mkdir(dirname(path), { recursive: true });
  const line = JSON.stringify({ programName, publisher, sizeBytes, timestamp: Date.now() });
  await appendFile(path, line + '\n', 'utf8');
}

/** Last `limit` entries, newest first. A full-file read is fine at this
 * scale (this file only ever grows by real uninstalls a person actually
 * runs -- hundreds of lines at most over the life of an install, not
 * millions) -- no need for a tail-seeking read. */
export async function getRecentHistory(limit = 5) {
  const path = historyFilePath();
  if (!existsSync(path)) return [];
  const raw = await readFile(path, 'utf8');
  const lines = raw.split('\n').filter(Boolean);
  return lines.slice(-limit).reverse().map(line => JSON.parse(line));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/services/uninstallHistory.test.js`
Expected: PASS (4/4)

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/uninstallHistory.js backend/src/services/uninstallHistory.test.js
git commit -m "feat(backend): add uninstall-history log for the Dashboard's Recent Activity"
```

---

## Task 5: Uninstall-history route

**Files:**
- Create: `backend/src/routes/uninstallHistory.js`
- Modify: `backend/src/index.js`

- [ ] **Step 1: Write the route**

```js
import { Router } from 'express';
import { getRecentHistory } from '../services/uninstallHistory.js';

const router = Router();

router.get('/', async (_req, res) => {
  const entries = await getRecentHistory(5);
  res.json({ entries });
});

export default router;
```

- [ ] **Step 2: Mount it**

Add to `backend/src/index.js`'s imports:

```js
import uninstallHistoryRoutes from './routes/uninstallHistory.js';
```

Add to the route-mounting block:

```js
app.use('/api/uninstall-history', uninstallHistoryRoutes);
```

- [ ] **Step 3: Verify live**

```bash
curl http://127.0.0.1:3101/api/uninstall-history
```

Expected: `{"entries":[]}` (nothing has been uninstalled through this build yet).

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/uninstallHistory.js backend/src/index.js
git commit -m "feat(backend): mount GET /api/uninstall-history"
```

---

## Task 6: Frontend API client additions (TDD)

**Files:**
- Modify: `frontend/src/lib/api.js`
- Test: `frontend/src/lib/api.diskSpace.test.js` (new)
- Test: `frontend/src/lib/api.uninstallHistory.test.js` (new)

- [ ] **Step 1: Write the failing tests**

`frontend/src/lib/api.diskSpace.test.js`:
```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchDiskSpace } from './api.js';

global.fetch = vi.fn();

describe('fetchDiskSpace', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns freeBytes/totalBytes on success', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ freeBytes: 100, totalBytes: 200 }) });
    const result = await fetchDiskSpace();
    expect(result).toEqual({ freeBytes: 100, totalBytes: 200 });
  });

  it('throws on API error', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ error: 'Could not read disk space.' }) });
    await expect(fetchDiskSpace()).rejects.toThrow('Could not read disk space.');
  });
});
```

`frontend/src/lib/api.uninstallHistory.test.js`:
```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchUninstallHistory } from './api.js';

global.fetch = vi.fn();

describe('fetchUninstallHistory', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns the entries array', async () => {
    const entries = [{ programName: '7-Zip', publisher: 'Igor Pavlov', sizeBytes: 4194304, timestamp: 1700000000000 }];
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ entries }) });
    const result = await fetchUninstallHistory();
    expect(result).toEqual(entries);
  });

  it('throws on API error', async () => {
    fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Server error' }) });
    await expect(fetchUninstallHistory()).rejects.toThrow('Server error');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/lib/api.diskSpace.test.js src/lib/api.uninstallHistory.test.js`
Expected: FAIL -- `fetchDiskSpace`/`fetchUninstallHistory` are not exported from `./api.js`

- [ ] **Step 3: Add the two functions**

Add to `frontend/src/lib/api.js` (after the existing `restoreQuarantineBatch`
function, following every other function in this file's exact
`fetch → check res.ok → return data` pattern):

```js
export async function fetchDiskSpace() {
  const res = await fetch(`${API_URL}/disk-space`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

export async function fetchUninstallHistory() {
  const res = await fetch(`${API_URL}/uninstall-history`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data.entries;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/lib/api.diskSpace.test.js src/lib/api.uninstallHistory.test.js`
Expected: PASS (4/4)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/api.js frontend/src/lib/api.diskSpace.test.js frontend/src/lib/api.uninstallHistory.test.js
git commit -m "feat(frontend): add fetchDiskSpace/fetchUninstallHistory API clients"
```

---

## Task 7: `sizeBadgeTone` and `formatRelativeTime` helpers (TDD)

**Files:**
- Create: `frontend/src/lib/sizeBadgeTone.js`
- Test: `frontend/src/lib/sizeBadgeTone.test.js`
- Create: `frontend/src/lib/formatRelativeTime.js`
- Test: `frontend/src/lib/formatRelativeTime.test.js`

- [ ] **Step 1: Write the failing tests**

`frontend/src/lib/sizeBadgeTone.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { sizeBadgeTone } from './sizeBadgeTone.js';

describe('sizeBadgeTone', () => {
  it('is cyan under 100MB', () => {
    expect(sizeBadgeTone(50 * 1024 * 1024)).toBe('cyan');
  });
  it('is blue from 100MB up to (not including) 1GB', () => {
    expect(sizeBadgeTone(100 * 1024 * 1024)).toBe('blue');
    expect(sizeBadgeTone(500 * 1024 * 1024)).toBe('blue');
  });
  it('is amber from 1GB up to (not including) 5GB', () => {
    expect(sizeBadgeTone(1024 * 1024 * 1024)).toBe('amber');
    expect(sizeBadgeTone(3 * 1024 * 1024 * 1024)).toBe('amber');
  });
  it('is coral at 5GB and above', () => {
    expect(sizeBadgeTone(5 * 1024 * 1024 * 1024)).toBe('coral');
    expect(sizeBadgeTone(40 * 1024 * 1024 * 1024)).toBe('coral');
  });
  it('is cyan for null/undefined/zero (unknown size)', () => {
    expect(sizeBadgeTone(null)).toBe('cyan');
    expect(sizeBadgeTone(undefined)).toBe('cyan');
    expect(sizeBadgeTone(0)).toBe('cyan');
  });
});
```

`frontend/src/lib/formatRelativeTime.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { formatRelativeTime } from './formatRelativeTime.js';

describe('formatRelativeTime', () => {
  it('shows seconds for under a minute', () => {
    expect(formatRelativeTime(Date.now() - 30 * 1000)).toBe('just now');
  });
  it('shows minutes for under an hour', () => {
    expect(formatRelativeTime(Date.now() - 5 * 60 * 1000)).toBe('5 minutes ago');
  });
  it('uses singular "minute" for exactly 1', () => {
    expect(formatRelativeTime(Date.now() - 60 * 1000)).toBe('1 minute ago');
  });
  it('shows hours for under a day', () => {
    expect(formatRelativeTime(Date.now() - 3 * 60 * 60 * 1000)).toBe('3 hours ago');
  });
  it('shows days for a week or less', () => {
    expect(formatRelativeTime(Date.now() - 2 * 24 * 60 * 60 * 1000)).toBe('2 days ago');
  });
  it('falls back to a real date beyond a week', () => {
    const tenDaysAgo = Date.now() - 10 * 24 * 60 * 60 * 1000;
    expect(formatRelativeTime(tenDaysAgo)).toBe(new Date(tenDaysAgo).toLocaleDateString());
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/lib/sizeBadgeTone.test.js src/lib/formatRelativeTime.test.js`
Expected: FAIL -- both modules don't exist yet

- [ ] **Step 3: Write the implementations**

`frontend/src/lib/sizeBadgeTone.js`:
```js
const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;

/** Which color band a program's size badge should use, per the Aurora Deck
 * brief's own size bands. Unknown/zero size (many system components report
 * no size at all) reads as the lowest tier rather than an error state. */
export function sizeBadgeTone(bytes) {
  if (!bytes) return 'cyan';
  if (bytes < 100 * MB) return 'cyan';
  if (bytes < 1 * GB) return 'blue';
  if (bytes < 5 * GB) return 'amber';
  return 'coral';
}
```

`frontend/src/lib/formatRelativeTime.js`:
```js
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/** "2 hours ago" style relative time for the Dashboard's Recent Activity
 * list. Falls back to a real localized date beyond a week -- "23 days ago"
 * stops being a useful number long before "10 minutes ago" does. */
export function formatRelativeTime(timestamp) {
  const diff = Date.now() - timestamp;
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) {
    const n = Math.floor(diff / MINUTE);
    return `${n} minute${n === 1 ? '' : 's'} ago`;
  }
  if (diff < DAY) {
    const n = Math.floor(diff / HOUR);
    return `${n} hour${n === 1 ? '' : 's'} ago`;
  }
  if (diff < WEEK) {
    const n = Math.floor(diff / DAY);
    return `${n} day${n === 1 ? '' : 's'} ago`;
  }
  return new Date(timestamp).toLocaleDateString();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/lib/sizeBadgeTone.test.js src/lib/formatRelativeTime.test.js`
Expected: PASS (11/11)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/sizeBadgeTone.js frontend/src/lib/sizeBadgeTone.test.js frontend/src/lib/formatRelativeTime.js frontend/src/lib/formatRelativeTime.test.js
git commit -m "feat(frontend): add sizeBadgeTone and formatRelativeTime helpers"
```

---

## Task 8: `NavRail` component

**Files:**
- Create: `frontend/src/components/NavRail.jsx`

- [ ] **Step 1: Write the component**

```jsx
const ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1.5"></rect>
      <rect x="14" y="3" width="7" height="5" rx="1.5"></rect>
      <rect x="14" y="12" width="7" height="9" rx="1.5"></rect>
      <rect x="3" y="16" width="7" height="5" rx="1.5"></rect>
    </svg>
  ) },
  { id: 'applications', label: 'Applications', icon: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="4" rx="1"></rect>
      <rect x="3" y="10" width="18" height="4" rx="1"></rect>
      <rect x="3" y="16" width="18" height="4" rx="1"></rect>
    </svg>
  ) }
];

export default function NavRail({ screen, onNavigate }) {
  return (
    <nav className="glass-panel flex flex-col items-center gap-2 py-6 w-[72px] shrink-0" aria-label="Main">
      {ITEMS.map((item) => {
        const active = screen === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            aria-current={active ? 'page' : undefined}
            title={item.label}
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
              active ? 'bg-[color:var(--accent-coral-soft)] text-[color:var(--accent-coral)]' : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-white/[0.04]'
            }`}
          >
            {item.icon}
          </button>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Verify it renders**

Not wired into `App.jsx` yet (Task 9) -- nothing to visually verify in
isolation. Confirm the file has no syntax errors: `cd frontend && npx vite build --mode development 2>&1 | head -20` should not mention `NavRail.jsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/NavRail.jsx
git commit -m "feat(frontend): add NavRail component"
```

---

## Task 9: Wire the navigation shell into `App.jsx`

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Add the screen state, import NavRail and Dashboard, restructure the layout**

Replace the entire file with:

```jsx
import { useState, useEffect } from 'react';
import NavRail from './components/NavRail.jsx';
import Dashboard from './components/Dashboard.jsx';
import ProgramList from './components/ProgramList.jsx';
import UninstallModal from './components/UninstallModal.jsx';
import QuarantinePanel from './components/QuarantinePanel.jsx';
import { fetchPrograms } from './lib/api.js';

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function App() {
  const [screen, setScreen] = useState('dashboard');
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [quarantineOpen, setQuarantineOpen] = useState(false);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchPrograms()
      .then((result) => { if (!cancelled) setPrograms(result); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const totalSize = programs.reduce((sum, program) => sum + (program.sizeBytes || 0), 0);

  return (
    <div className="App grain h-screen overflow-hidden flex">
      <NavRail screen={screen} onNavigate={setScreen} />
      <div className="flex-1 overflow-y-auto min-h-0">
        {screen === 'dashboard' && <Dashboard programs={programs} totalSize={totalSize} />}
        {screen === 'applications' && (
          <div className="px-12 py-10 max-w-[1400px]">
            <div className="flex items-baseline justify-between mb-8">
              <div>
                <div className="text-[11px] text-[color:var(--text-muted)] font-mono uppercase tracking-[0.16em] mb-2">
                  Application Manager
                </div>
                <h1 className="display-heading text-[30px] leading-none">
                  Installed applications
                </h1>
                <p className="text-[13px] text-[color:var(--text-secondary)] mt-2.5">
                  <span className="text-[color:var(--text-primary)] font-medium">{programs.length}</span> applications ·
                  <span className="text-[color:var(--text-primary)] font-medium">{formatBytes(totalSize)}</span> installed
                </p>
              </div>
              <button className="btn-ghost" onClick={() => setQuarantineOpen(true)}>Quarantine</button>
            </div>
            <ProgramList programs={programs} onUninstall={setSelectedProgram} />
          </div>
        )}
      </div>
      {selectedProgram && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <UninstallModal program={selectedProgram} onClose={() => setSelectedProgram(null)} />
        </div>
      )}
      {quarantineOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={(e) => { if (e.target === e.currentTarget) setQuarantineOpen(false); }}>
          <div className="glass-panel" style={{ padding: 24, width: 'min(560px, 90vw)', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button className="btn-ghost" onClick={() => setQuarantineOpen(false)}>Close</button>
            </div>
            <QuarantinePanel />
          </div>
        </div>
      )}
    </div>
  );
}
```

(`.glass-strong` → `.glass-panel` here too, matching Task 1's Step 6
rename; `loading`/`error` state stays -- still read by `ProgramList` itself
when it fetches independently in a context without the `programs` prop, per
its own existing fallback path.)

- [ ] **Step 2: Verify live**

This task will fail to render until Task 10 (Dashboard.jsx) exists --
implement Task 9 and Task 10 together, verify after both: reload the app,
confirm the NavRail appears on the left, Dashboard shows by default,
clicking the Applications icon switches to the existing app list (still
showing real data), clicking back to Dashboard works.

- [ ] **Step 3: Commit**

Commit together with Task 10 (an `App.jsx` importing a `Dashboard.jsx` that
doesn't exist yet won't build) -- see Task 10's own commit step.

---

## Task 10: `Dashboard` component

**Files:**
- Create: `frontend/src/components/Dashboard.jsx`

- [ ] **Step 1: Write the component**

```jsx
import { useEffect, useState } from 'react';
import { fetchDiskSpace, fetchUninstallHistory } from '../lib/api.js';
import { formatRelativeTime } from '../lib/formatRelativeTime.js';

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function HealthGauge({ percent }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = percent == null ? circumference : circumference * (1 - percent / 100);
  return (
    <div className="relative w-[140px] h-[140px] shrink-0">
      <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
        {percent != null && (
          <circle
            cx="70" cy="70" r={radius} fill="none"
            stroke="var(--accent-coral)" strokeWidth="10" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 500ms ease' }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="display-heading text-[32px] text-[color:var(--text-primary)]">
          {percent != null ? `${percent}%` : '—'}
        </span>
      </div>
    </div>
  );
}

export default function Dashboard({ programs, totalSize }) {
  const [diskSpace, setDiskSpace] = useState(null);
  const [diskSpaceError, setDiskSpaceError] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchDiskSpace()
      .then((result) => { if (!cancelled) setDiskSpace(result); })
      .catch((err) => { if (!cancelled) setDiskSpaceError(err.message); });
    fetchUninstallHistory()
      .then((entries) => { if (!cancelled) setHistory(entries); })
      .catch(() => { /* Recent Activity just shows empty on failure -- not worth a second error banner on a Dashboard already showing a disk-space one if that also failed */ });
    return () => { cancelled = true; };
  }, []);

  const healthScore = diskSpace ? Math.round((diskSpace.freeBytes / diskSpace.totalBytes) * 100) : null;

  return (
    <div className="px-12 py-10 max-w-[1400px]">
      <div className="text-[11px] text-[color:var(--text-muted)] font-mono uppercase tracking-[0.16em] mb-2">
        Overview
      </div>
      <h1 className="display-heading text-[36px] leading-none mb-8">Dashboard</h1>

      <div className="glass-panel flex items-center gap-6 p-8 mb-6">
        <HealthGauge percent={healthScore} />
        <div>
          <div className="text-[18px] font-medium text-[color:var(--text-primary)] mb-1">System Health</div>
          <div className="text-[13px] text-[color:var(--text-secondary)]">
            {diskSpaceError
              ? "Couldn't read disk space."
              : healthScore != null
                ? `${healthScore}% of your system drive is free.`
                : 'Reading disk space…'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="glass-panel p-6">
          <div className="text-[11px] text-[color:var(--text-muted)] uppercase tracking-[0.1em] font-medium mb-2">Total Storage</div>
          {diskSpace ? (
            <>
              <div className="text-[18px] font-medium text-[color:var(--text-primary)] mb-2">
                {formatBytes(diskSpace.totalBytes - diskSpace.freeBytes)} Used / {formatBytes(diskSpace.totalBytes)} Total
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.round((1 - diskSpace.freeBytes / diskSpace.totalBytes) * 100)}%`, background: 'var(--accent-coral)' }}
                />
              </div>
            </>
          ) : (
            <div className="text-[13px] text-[color:var(--text-secondary)]">{diskSpaceError || 'Loading…'}</div>
          )}
        </div>
        <div className="glass-panel p-6">
          <div className="text-[11px] text-[color:var(--text-muted)] uppercase tracking-[0.1em] font-medium mb-2">Installed Apps</div>
          <div className="display-heading text-[28px] text-[color:var(--text-primary)]">{programs.length}</div>
        </div>
        <div className="glass-panel p-6">
          <div className="text-[11px] text-[color:var(--text-muted)] uppercase tracking-[0.1em] font-medium mb-2">Junk Files</div>
          <div className="text-[13px] text-[color:var(--text-secondary)]">Run Smart Cleanup to find out.</div>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <button className="btn-primary" disabled title="Coming in a future update">Smart Scan</button>
        <button className="btn-ghost" disabled title="Coming in a future update">Disk Analyzer</button>
        <button className="btn-ghost" disabled title="Coming in a future update">Batch Uninstall</button>
      </div>

      <div className="glass-panel p-6">
        <button
          onClick={() => setHistoryOpen((o) => !o)}
          className="w-full flex items-center justify-between text-left"
        >
          <span className="text-[13px] font-medium text-[color:var(--text-primary)]">Recent Activity</span>
          <span className="text-[12px] text-[color:var(--text-muted)]">{historyOpen ? 'Hide' : 'Show'}</span>
        </button>
        {historyOpen && (
          <div className="mt-4">
            {history.length === 0 ? (
              <p className="text-[13px] text-[color:var(--text-secondary)]">No uninstalls yet.</p>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {history.map((entry) => (
                  <div key={entry.timestamp} className="flex items-center justify-between py-2.5">
                    <div>
                      <div className="text-[13px] text-[color:var(--text-primary)]">{entry.programName}</div>
                      <div className="text-[11px] text-[color:var(--text-muted)] font-mono">{formatRelativeTime(entry.timestamp)}</div>
                    </div>
                    <div className="text-[12px] font-mono text-[color:var(--text-secondary)]">{formatBytes(entry.sizeBytes)} freed</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify live (this + Task 9 together)**

`npm run dev` in `frontend/` (or reload if already running), `node
src/index.js` in `backend/`. Load the app: expect Dashboard as the default
screen, a real health-score percentage inside the gauge (not "—", assuming
`GET /api/disk-space` succeeds), real "Total Storage"/"Installed Apps"
numbers, "Junk Files" reading "Run Smart Cleanup to find out.", three
visibly-disabled Quick Action buttons, and "No uninstalls yet." under
Recent Activity (collapsible via its own header click). Click the
Applications nav icon: the existing app list still renders correctly with
real data.

- [ ] **Step 3: Commit (Task 9 + Task 10 together)**

```bash
git add frontend/src/App.jsx frontend/src/components/Dashboard.jsx
git commit -m "feat(frontend): add Dashboard landing screen with health gauge, quick stats, quick actions, recent activity"
```

---

## Task 11: Wire uninstall-history logging into `UninstallModal.jsx`

**Files:**
- Modify: `frontend/src/components/UninstallModal.jsx`

- [ ] **Step 1: Add the history-append call**

In `startUninstall` (the function that calls `streamUninstall`), add the
history append right after `streamUninstall` resolves successfully, before
moving to the `scanning` step. Find this block:

```js
      await streamUninstall(program.uninstallString, () => {});
      setStep('scanning');
```

Replace it with:

```js
      await streamUninstall(program.uninstallString, () => {});
      appendHistoryEntry({ programName: program.name, publisher: program.publisher, sizeBytes: program.sizeBytes }).catch(() => {
        // Best-effort logging -- a failed history write must never block
        // or fail the uninstall flow itself, the uninstall already
        // genuinely succeeded by this point.
      });
      setStep('scanning');
```

Add the import at the top of the file (alongside the existing
`scanForLeftovers`/`streamUninstall` import from `../lib/api.js`):

```js
import { scanForLeftovers, streamUninstall, appendHistoryEntry } from '../lib/api.js';
```

- [ ] **Step 2: Add the corresponding API client function**

This needs a backend endpoint too -- `POST /api/uninstall-history` doesn't
exist yet (Task 5 only added the `GET`). Add to
`backend/src/routes/uninstallHistory.js` (after the existing `GET '/'`
handler):

```js
router.post('/', async (req, res) => {
  const { programName, publisher, sizeBytes } = req.body;
  if (!programName) return res.status(400).json({ error: 'programName is required.' });
  await appendHistoryEntry({ programName, publisher, sizeBytes });
  res.json({ ok: true });
});
```

Add the import at the top of that same file:

```js
import { getRecentHistory, appendHistoryEntry } from '../services/uninstallHistory.js';
```

Add to `frontend/src/lib/api.js` (after `fetchUninstallHistory`):

```js
export async function appendHistoryEntry({ programName, publisher, sizeBytes }) {
  const res = await fetch(`${API_URL}/uninstall-history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ programName, publisher, sizeBytes })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}
```

- [ ] **Step 3: Verify live**

With the backend and frontend both running, confirm
`POST http://127.0.0.1:3101/api/uninstall-history` with a body like
`{"programName":"Test App","publisher":"Test","sizeBytes":1024}` (via
`curl -X POST ... -d '...'`) returns `{"ok":true}`, then `GET
/api/uninstall-history` shows that entry. Do NOT click "Start uninstall" in
the real UI against a real installed program to test this end-to-end --
that would actually uninstall something on this machine. The curl-based
check above is the safe equivalent.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/UninstallModal.jsx frontend/src/lib/api.js backend/src/routes/uninstallHistory.js
git commit -m "feat: log completed uninstalls to Recent Activity history"
```

---

## Task 12: `ProgramList.jsx` -- card redesign + hex-to-token conversion

**Files:**
- Modify: `frontend/src/components/ProgramList.jsx`

- [ ] **Step 1: Replace hardcoded hex values with token references**

Apply this exact mapping throughout the file (every occurrence, not just
the first):

| Old (hardcoded hex Tailwind class) | New |
|---|---|
| `text-[#52525b]` | `text-[color:var(--text-muted)]` |
| `bg-[#0c0c0e]` | `bg-[color:var(--bg-panel)]` |
| `border-[#18181b]` | `border-[color:var(--border-subtle)]` |
| `focus:border-[#06b6d4]` | `focus:border-[color:var(--accent-coral)]` |
| `focus:ring-[#06b6d4]/10` | `focus:ring-[color:var(--accent-coral)]/10` |
| `text-[#71717a]` | `text-[color:var(--text-muted)]` |
| `text-[#a1a1aa]` | `text-[color:var(--text-secondary)]` |
| `divide-[#18181b]` | `divide-[color:var(--border-subtle)]` |
| `hover:border-[#27272a]` | `hover:border-[color:var(--border-subtle)]` |
| `bg-[#f97316]/12` | `bg-[color:var(--warning-soft)]` |
| `text-[#fb923c]` | `text-[color:var(--warning)]` |
| `border-[#f97316]/25` | `border-[color:var(--warning)]/25` |
| `${program.color \|\| '#06b6d4'}` (in the icon-badge `style` object, both occurrences) | `${program.color || '#f98074'}` |

- [ ] **Step 2: Apply the card treatment and hover lift/glow to each row**

Find the row `<div>`'s className (currently `"grid grid-cols-[...] gap-4
items-center px-4 py-3 rounded-xl border border-transparent
hover:border-[color:var(--border-subtle)] hover:bg-white/[0.02] group
transition-colors"` after Step 1's mapping is applied). Replace it with:

```jsx
              className="glass-panel grid grid-cols-[48px_1fr_140px_140px_120px_140px] gap-4 items-center px-4 py-3 group transition-all hover:-translate-y-0.5 hover:shadow-[-4px_0_20px_rgba(249,128,116,0.3)]"
```

(`.glass-panel` already carries its own border/background/radius from Task
1 -- the old per-row `border border-transparent hover:border-[...]` and
`.card`-provided background are no longer needed on individual rows once
each row IS its own glass panel, matching the brief's "each row = glass
panel card" framing. This also means each row now needs its own visual
separation instead of relying on the outer `.card divide-y` — see Step 3.)

- [ ] **Step 3: Give the row list its own vertical gap instead of divider lines**

Find `<div className="space-y-1">` (the rows' wrapping div) — this already
has `space-y-1`, but 4px between what are now full glass-panel cards (not
divider-separated table rows) reads as cramped. Change it to:

```jsx
        <div className="space-y-2">
```

The outer `<div className="card divide-y divide-[color:var(--border-subtle)]">`
that wraps the header row + this list becomes just a plain wrapper now that
individual rows carry their own glass panel styling — change it to:

```jsx
      <div>
```

(The column-header row above it, `<div className="grid grid-cols-[...] ...
text-[color:var(--text-muted)] ...">`, is unaffected — it's a label row,
not a card, and stays as plain text over the page background.)

- [ ] **Step 4: Use `sizeBadgeTone` for the size column**

Add the import at the top of the file:

```js
import { sizeBadgeTone } from '../lib/sizeBadgeTone.js';
```

Find the size cell:
```jsx
              <div className="text-right">
                <div className="text-[13px] font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatBytes(program.sizeBytes)}</div>
              </div>
```

Replace with:
```jsx
              <div className="text-right">
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-[12px] font-medium ${
                    { cyan: 'bg-[color:var(--accent-cyan)]/12 text-[color:var(--accent-cyan)]',
                      blue: 'bg-[color:var(--accent-blue)]/12 text-[color:var(--accent-blue)]',
                      amber: 'bg-[color:var(--warning)]/12 text-[color:var(--warning)]',
                      coral: 'bg-[color:var(--accent-coral)]/12 text-[color:var(--accent-coral)]'
                    }[sizeBadgeTone(program.sizeBytes)]
                  }`}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {formatBytes(program.sizeBytes)}
                </span>
              </div>
```

- [ ] **Step 5: Verify live**

Reload the app, go to Applications. Confirm: navy/glass rows with visible
individual glass-panel edges, size badges color-coded (7-Zip's 4MB/5.6MB
should read cyan, ABBYY FineReader's 1.3GB should read amber, anything over
5GB -- check League of Legends' 39.3GB entry -- should read coral), hovering
a row lifts it slightly with a coral glow on the right edge, the search
input's focus ring is coral now (not cyan), the "Unused" filter pill's
active state still works, sort button still cycles correctly.

- [ ] **Step 6: Run tests, then commit**

```bash
cd frontend && npx vitest run
```
Expected: all existing tests still pass (this task is presentational, no
logic changed in a way any existing test covers).

```bash
git add frontend/src/components/ProgramList.jsx
git commit -m "feat(frontend): redesign app rows as Aurora Deck glass cards with size-coded badges"
```

---

## Task 13: `UninstallModal.jsx` -- hex-to-token conversion

**Files:**
- Modify: `frontend/src/components/UninstallModal.jsx`

- [ ] **Step 1: Apply the token mapping**

Same mapping table as Task 12 Step 1, applied to every hex occurrence in
this file. Additionally: `className="glass-strong ..."` on the outer
modal wrapper → `className="glass-panel ..."` (matching Task 1's rename).
The `border-[#27272a]` on the modal's header (`border-b
border-[#27272a]`) → `border-b border-[color:var(--border-subtle)]`. The
spinner's `border-[#06b6d4] border-t-transparent` →
`border-[color:var(--accent-coral)] border-t-transparent`. The progress-bar
gradient `bg-gradient-to-r from-[#0891b2] to-[#22d3ee]` →
`bg-gradient-to-r from-[color:var(--accent-coral)] to-[#e8624f]`.

- [ ] **Step 2: Verify live**

Click "Uninstall" on any program row to open the confirm step. Confirm:
glass modal background matches the rest of the app, "Start uninstall"
button is coral and pill-shaped (from Task 1's `.btn-primary` change, no
extra work needed here), Close button works. Do NOT click "Start uninstall"
itself.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/UninstallModal.jsx
git commit -m "feat(frontend): apply Aurora Deck tokens to UninstallModal"
```

---

## Task 14: `LeftoverReview.jsx` and `QuarantinePanel.jsx` -- hex-to-token conversion

**Files:**
- Modify: `frontend/src/components/LeftoverReview.jsx`
- Modify: `frontend/src/components/QuarantinePanel.jsx`

- [ ] **Step 1: Apply the token mapping to both files**

Same mapping table as Task 12 Step 1, plus:
`bg-[#f59e0b]/10 border-[#f59e0b]/25` (LeftoverReview's warning banner) →
`bg-[color:var(--warning-soft)] border-[color:var(--warning)]/25`;
`text-[#fcd34d]` → `text-[color:var(--warning)]`; `text-[#e4e4e7]` →
`text-[color:var(--text-primary)]`.

- [ ] **Step 2: Verify live**

These two only render inside flows that are hard to reach without a real
uninstall/quarantine batch (Leftover Review needs an actual completed
uninstall; Quarantine needs an actual quarantined batch, neither of which
exist on this dev machine). Verify by reading the rendered Quarantine modal
(still reachable via the Applications screen's own "Quarantine" button,
shows "No quarantined items." — confirm that text renders in the new
`--text-secondary` color, not broken/invisible) and by code review for
LeftoverReview.jsx (confirm no syntax errors: `cd frontend && npx vite
build --mode development 2>&1 | grep -i LeftoverReview` should show
nothing).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/LeftoverReview.jsx frontend/src/components/QuarantinePanel.jsx
git commit -m "feat(frontend): apply Aurora Deck tokens to LeftoverReview and QuarantinePanel"
```

---

## Task 15: Final verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run both test suites**

```bash
cd backend && npm test
cd ../frontend && npx vitest run
```
Expected: all green.

- [ ] **Step 2: Full live click-through**

With both servers running: Dashboard loads by default with a real health
percentage, real storage/app-count stats, honest junk-files placeholder,
three disabled quick actions, empty Recent Activity (collapsible). Nav to
Applications: real 128-program list as Aurora Deck glass cards, search
works, sort works, Unused filter pill works, hovering a row lifts+glows
coral, size badges are color-coded correctly across the size range. Open
Uninstall confirm step on any program (don't click Start), close it. Open
Quarantine (still empty). Nav back to Dashboard, confirm state didn't
break.

- [ ] **Step 3: Take a real screenshot at 1280x860 confirming the above**, then report to the user that Phase 1 is complete and verified.
