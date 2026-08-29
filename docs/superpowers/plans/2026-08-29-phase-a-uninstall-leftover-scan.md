# unrevo Phase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A real, working Windows uninstaller — program list, run each program's real uninstaller, heuristically scan for and remove real leftover files/registry keys/scheduled tasks, with a quarantine+`.reg`-export safety net.

**Architecture:** Same 3-part shape as the sibling `triclaude-web` (Re:Route) project — `backend/` (Express + Node ESM, system queries shelled to PowerShell through one chokepoint), `frontend/` (React + Vite, dark "obsidian + cyan" design system lifted from the user's reference prototype), `electron/` (in-process backend via dynamic `import()`, no spawned child).

**Tech Stack:** Node.js (ESM), Express, PowerShell (via `child_process`), React 18, Vite, Electron + electron-builder, Vitest.

**Design doc:** `docs/superpowers/specs/2026-08-29-unrevo-uninstaller-design.md` — read it first; this plan implements it task by task and doesn't repeat its reasoning.

---

## Task 1: Scaffold `backend/`

**Files:**
- Create: `backend/package.json`
- Create: `backend/src/index.js`

- [ ] **Step 1: Create the backend package**

`backend/package.json`:
```json
{
  "name": "unrevo-backend",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.19.2"
  },
  "devDependencies": {
    "vitest": "^4.1.10"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `cd backend && npm install`
Expected: completes with no errors, `backend/node_modules` and `backend/package-lock.json` exist.

- [ ] **Step 3: Write the minimal Express entry**

`backend/src/index.js`:
```js
import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';

const PORT = process.env.UNREVO_BACKEND_PORT || 3101;

// A rejection escaping every route's own try/catch would otherwise crash
// the whole process — this is loaded in-process inside Electron's main
// process (see electron/main.cjs), so a crash here takes the whole app
// down, not just a request.
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));

// A `server.listen()` failure (most commonly EADDRINUSE — something else,
// or a second copy of this same backend, already bound to the port) fires
// as an 'error' EVENT on the server object, not a promise rejection — the
// unhandledRejection handler above never sees it. With no listener here,
// Node's default behavior for an unhandled EventEmitter 'error' is to
// throw, crashing the whole process instantly and silently. Loaded
// in-process inside Electron's main process, this crashes the ENTIRE APP
// during startup with no window and no visible reason beyond a native
// "a JavaScript error occurred" crash dialog.
const server = createServer(app);
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use — is another copy of unrevo (or its backend) already running? Close it and try again.`);
  } else {
    console.error('Backend server error:', err);
  }
  process.exitCode = 1;
});
server.listen(PORT, '127.0.0.1', () => {
  console.log(`unrevo backend listening on http://127.0.0.1:${PORT}`);
});
```

- [ ] **Step 4: Verify it starts**

Run: `cd backend && node src/index.js` (then Ctrl+C after confirming)
Expected: prints `unrevo backend listening on http://127.0.0.1:3101` with no errors.

- [ ] **Step 5: Commit**

```bash
cd backend
git add package.json package-lock.json src/index.js
git commit -m "chore(backend): scaffold Express entry with a health check"
```

---

## Task 2: `services/powershell.js` — the one PowerShell chokepoint

**Files:**
- Create: `backend/src/services/powershell.js`
- Test: `backend/src/services/powershell.test.js`

Every other backend service shells to PowerShell through this one function — mirrors Re:Route's own "provider calls go through the failover ladder, don't call a provider directly" convention (one chokepoint, not N ad-hoc `exec` calls scattered across services).

- [ ] **Step 1: Write the failing test**

`backend/src/services/powershell.test.js`:
```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

const execFileMock = vi.fn();
vi.mock('node:child_process', () => ({ execFile: (...args) => execFileMock(...args) }));

let runPowerShellJson;
beforeEach(async () => {
  execFileMock.mockReset();
  ({ runPowerShellJson } = await import('./powershell.js'));
});

describe('runPowerShellJson', () => {
  it('parses valid JSON stdout', async () => {
    execFileMock.mockImplementation((_cmd, _args, _opts, cb) => cb(null, '{"a":1}', ''));
    const result = await runPowerShellJson('Get-Something | ConvertTo-Json');
    expect(result).toEqual({ a: 1 });
  });

  it('resolves null for empty stdout (no matches)', async () => {
    execFileMock.mockImplementation((_cmd, _args, _opts, cb) => cb(null, '   ', ''));
    const result = await runPowerShellJson('Get-Nothing | ConvertTo-Json');
    expect(result).toBeNull();
  });

  it('rejects with a clear message on non-JSON stdout', async () => {
    execFileMock.mockImplementation((_cmd, _args, _opts, cb) => cb(null, 'not json', ''));
    await expect(runPowerShellJson('bad')).rejects.toThrow(/non-JSON/);
  });

  it('retries once on failure before succeeding', async () => {
    execFileMock
      .mockImplementationOnce((_cmd, _args, _opts, cb) => cb(new Error('boom'), '', 'stderr text'))
      .mockImplementationOnce((_cmd, _args, _opts, cb) => cb(null, '{"ok":true}', ''));
    const result = await runPowerShellJson('script', { retries: 1 });
    expect(result).toEqual({ ok: true });
    expect(execFileMock).toHaveBeenCalledTimes(2);
  });

  it('rejects with a clear message after exhausting retries', async () => {
    execFileMock.mockImplementation((_cmd, _args, _opts, cb) => cb(new Error('boom'), '', 'stderr text'));
    await expect(runPowerShellJson('script', { retries: 0 })).rejects.toThrow(/PowerShell command failed/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run src/services/powershell.test.js`
Expected: FAIL — `Cannot find module './powershell.js'` (or similar; the file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

`backend/src/services/powershell.js`:
```js
import { execFile } from 'node:child_process';

const TIMEOUT_MS = 15000;

/** Runs a PowerShell script, parses stdout as JSON. `-NoProfile
 * -NonInteractive` avoid a user's PowerShell profile slowing or altering
 * output; `-Command` (not `-File`) so callers pass a script string
 * directly, no temp file needed. Timeout + one retry (matching Re:Route's
 * own router-timeout precedent) — a hung call fails loud rather than
 * hanging the caller forever. */
export function runPowerShellJson(script, { timeoutMs = TIMEOUT_MS, retries = 1 } = {}) {
  return attempt(script, timeoutMs, retries);
}

function attempt(script, timeoutMs, retriesLeft) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          if (retriesLeft > 0) {
            attempt(script, timeoutMs, retriesLeft - 1).then(resolve, reject);
            return;
          }
          reject(new Error(`PowerShell command failed: ${err.message}${stderr ? ` — ${stderr.trim()}` : ''}`));
          return;
        }
        const trimmed = stdout.trim();
        if (!trimmed) { resolve(null); return; } // empty result is valid (e.g. no matches)
        try {
          resolve(JSON.parse(trimmed));
        } catch (parseErr) {
          reject(new Error(`PowerShell returned non-JSON output: ${parseErr.message}`));
        }
      }
    );
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npx vitest run src/services/powershell.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
cd backend
git add src/services/powershell.js src/services/powershell.test.js
git commit -m "feat(backend): add the one PowerShell exec-and-parse-JSON chokepoint"
```

---

## Task 3: `services/programs.js` — enumerate installed programs

**Files:**
- Create: `backend/src/services/programs.js`
- Test: `backend/src/services/programs.test.js`

- [ ] **Step 1: Write the failing test**

`backend/src/services/programs.test.js`:
```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

const runPowerShellJsonMock = vi.fn();
vi.mock('./powershell.js', () => ({ runPowerShellJson: (...args) => runPowerShellJsonMock(...args) }));

let listInstalledPrograms, normalizeProgram;
beforeEach(async () => {
  runPowerShellJsonMock.mockReset();
  ({ listInstalledPrograms, normalizeProgram } = await import('./programs.js'));
});

describe('normalizeProgram', () => {
  it('maps raw registry fields to the app shape, converting KB to bytes', () => {
    const result = normalizeProgram({
      id: '{GUID}', name: 'Google Chrome', publisher: 'Google LLC', version: '129.0',
      installDate: '20230115', estimatedSizeKb: 620000, uninstallString: 'MsiExec.exe /X{GUID}',
      installLocation: 'C:\\Program Files\\Google\\Chrome'
    });
    expect(result).toEqual({
      id: '{GUID}', name: 'Google Chrome', publisher: 'Google LLC', version: '129.0',
      installDate: '2023-01-15', sizeBytes: 620000 * 1024,
      uninstallString: 'MsiExec.exe /X{GUID}', installLocation: 'C:\\Program Files\\Google\\Chrome'
    });
  });

  it('defaults a missing publisher to "Unknown Publisher"', () => {
    expect(normalizeProgram({ id: 'x', name: 'Thing' }).publisher).toBe('Unknown Publisher');
  });

  it('returns null installDate for a missing or malformed value', () => {
    expect(normalizeProgram({ id: 'x', name: 'Thing', installDate: null }).installDate).toBeNull();
    expect(normalizeProgram({ id: 'x', name: 'Thing', installDate: 'not-a-date' }).installDate).toBeNull();
  });

  it('returns null sizeBytes when estimatedSizeKb is missing', () => {
    expect(normalizeProgram({ id: 'x', name: 'Thing' }).sizeBytes).toBeNull();
  });
});

describe('listInstalledPrograms', () => {
  it('returns an empty array when the registry query finds nothing', async () => {
    runPowerShellJsonMock.mockResolvedValue(null);
    expect(await listInstalledPrograms()).toEqual([]);
  });

  it('normalizes a single-object result (PowerShell collapses a 1-item array) into a 1-item array', async () => {
    runPowerShellJsonMock.mockResolvedValue({ id: 'x', name: 'Solo App' });
    const result = await listInstalledPrograms();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Solo App');
  });

  it('normalizes a multi-item array result', async () => {
    runPowerShellJsonMock.mockResolvedValue([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]);
    const result = await listInstalledPrograms();
    expect(result.map(p => p.name)).toEqual(['A', 'B']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run src/services/programs.test.js`
Expected: FAIL — `Cannot find module './programs.js'`.

- [ ] **Step 3: Write the implementation**

`backend/src/services/programs.js`:
```js
import { runPowerShellJson } from './powershell.js';

// Reads all three Uninstall registry locations Windows actually uses:
// HKLM 64-bit (machine-wide), HKLM WOW6432Node (32-bit apps on 64-bit
// Windows), and HKCU (per-user installs). One PowerShell call combining
// all three, not three separate calls — halves the PowerShell-process-
// spawn cost this pays on every program-list load. Store/UWP apps are NOT
// read here (Get-AppxPackage, a different mechanism) — out of scope for
// Phase A, see the design spec.
const ENUMERATE_SCRIPT = `
$paths = @(
  'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
)
Get-ItemProperty -Path $paths -ErrorAction SilentlyContinue |
  Where-Object { $_.DisplayName -and -not $_.SystemComponent } |
  Select-Object @{N='id';E={$_.PSChildName}}, @{N='name';E={$_.DisplayName}},
    @{N='publisher';E={$_.Publisher}}, @{N='version';E={$_.DisplayVersion}},
    @{N='installDate';E={$_.InstallDate}}, @{N='estimatedSizeKb';E={$_.EstimatedSize}},
    @{N='uninstallString';E={$_.UninstallString}}, @{N='installLocation';E={$_.InstallLocation}} |
  ConvertTo-Json -Compress
`;

/** Real installed programs, normalized. PowerShell's ConvertTo-Json
 * returns a single OBJECT (not an array) when exactly one result
 * matches — normalized to always return an array. */
export async function listInstalledPrograms() {
  const raw = await runPowerShellJson(ENUMERATE_SCRIPT);
  if (!raw) return [];
  const items = Array.isArray(raw) ? raw : [raw];
  return items.map(normalizeProgram);
}

/** Exported for direct testing — the raw-registry-shape-to-app-shape
 * mapping is the part worth unit-testing on its own. */
export function normalizeProgram(raw) {
  return {
    id: raw.id,
    name: raw.name,
    publisher: raw.publisher || 'Unknown Publisher',
    version: raw.version || '',
    installDate: parseRegistryDate(raw.installDate),
    // EstimatedSize is KB in the registry; the rest of the app works in bytes.
    sizeBytes: typeof raw.estimatedSizeKb === 'number' ? raw.estimatedSizeKb * 1024 : null,
    uninstallString: raw.uninstallString || null,
    installLocation: raw.installLocation || null
  };
}

/** Registry InstallDate is YYYYMMDD (a plain string) or absent. Returns an
 * ISO date string or null — never throws on a malformed value, since this
 * is third-party-controlled data. */
function parseRegistryDate(raw) {
  if (typeof raw !== 'string' || !/^\d{8}$/.test(raw)) return null;
  const year = raw.slice(0, 4), month = raw.slice(4, 6), day = raw.slice(6, 8);
  return `${year}-${month}-${day}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npx vitest run src/services/programs.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
cd backend
git add src/services/programs.js src/services/programs.test.js
git commit -m "feat(backend): enumerate installed programs across all 3 Uninstall hives"
```

---

## Task 4: `routes/programs.js`

**Files:**
- Create: `backend/src/routes/programs.js`
- Modify: `backend/src/index.js`

- [ ] **Step 1: Write the route**

`backend/src/routes/programs.js`:
```js
import { Router } from 'express';
import { listInstalledPrograms } from '../services/programs.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const programs = await listInstalledPrograms();
    res.json({ programs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
```

- [ ] **Step 2: Wire it into the app**

Modify `backend/src/index.js` — add the import near the top and the mount after the health route:
```js
import programsRoutes from './routes/programs.js';
```
```js
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/programs', programsRoutes);
```

- [ ] **Step 3: Verify it live**

Run: `cd backend && node src/index.js` (in one terminal), then in another:
`curl http://127.0.0.1:3101/api/programs`
Expected: a JSON body `{"programs":[...]}` listing real installed programs on the machine running this. Ctrl+C the server after confirming.

- [ ] **Step 4: Commit**

```bash
cd backend
git add src/routes/programs.js src/index.js
git commit -m "feat(backend): expose GET /api/programs"
```

---

## Task 5: `services/uninstall.js` — run a program's real uninstaller

**Files:**
- Create: `backend/src/services/uninstall.js`
- Test: `backend/src/services/uninstall.test.js`

- [ ] **Step 1: Write the failing test**

`backend/src/services/uninstall.test.js`:
```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';

const spawnMock = vi.fn();
vi.mock('node:child_process', () => ({ spawn: (...args) => spawnMock(...args) }));

let runUninstaller, withSilentFlag;
beforeEach(async () => {
  spawnMock.mockReset();
  ({ runUninstaller, withSilentFlag } = await import('./uninstall.js'));
});

describe('withSilentFlag', () => {
  it('appends /qn to a bare MsiExec uninstall string', () => {
    expect(withSilentFlag('MsiExec.exe /X{GUID}')).toBe('MsiExec.exe /X{GUID} /qn');
  });

  it('leaves an MsiExec string alone if it already has a quiet flag', () => {
    expect(withSilentFlag('MsiExec.exe /X{GUID} /qb')).toBe('MsiExec.exe /X{GUID} /qb');
  });

  it('leaves a non-MSI uninstaller string unchanged', () => {
    expect(withSilentFlag('"C:\\Program Files\\App\\uninst.exe" /S')).toBe('"C:\\Program Files\\App\\uninst.exe" /S');
  });
});

function makeFakeChild() {
  const child = new EventEmitter();
  child.stderr = new EventEmitter();
  return child;
}

describe('runUninstaller', () => {
  it('rejects immediately when there is no uninstall string', async () => {
    await expect(runUninstaller(null, () => {})).rejects.toThrow(/no registered uninstall command/);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('emits "running" with the resolved command, then "exited" with the exit code', async () => {
    const child = makeFakeChild();
    spawnMock.mockReturnValue(child);
    const events = [];
    const promise = runUninstaller('MsiExec.exe /X{GUID}', (type, data) => events.push([type, data]));
    child.emit('exit', 0);
    const result = await promise;
    expect(result).toEqual({ code: 0 });
    expect(events[0]).toEqual(['running', { command: 'MsiExec.exe /X{GUID} /qn' }]);
    expect(events[1]).toEqual(['exited', { code: 0, stderr: null }]);
  });

  it('captures stderr text and includes it in the exited event', async () => {
    const child = makeFakeChild();
    spawnMock.mockReturnValue(child);
    const events = [];
    const promise = runUninstaller('MsiExec.exe /X{GUID}', (type, data) => events.push([type, data]));
    child.stderr.emit('data', Buffer.from('a warning\n'));
    child.emit('exit', 1);
    await promise;
    expect(events[1]).toEqual(['exited', { code: 1, stderr: 'a warning' }]);
  });

  it('rejects if the child process fails to launch', async () => {
    const child = makeFakeChild();
    spawnMock.mockReturnValue(child);
    const promise = runUninstaller('bad command', () => {});
    child.emit('error', new Error('ENOENT'));
    await expect(promise).rejects.toThrow(/Failed to launch uninstaller/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run src/services/uninstall.test.js`
Expected: FAIL — `Cannot find module './uninstall.js'`.

- [ ] **Step 3: Write the implementation**

`backend/src/services/uninstall.js`:
```js
import { spawn } from 'node:child_process';

/** Runs a program's registered uninstaller. `onEvent('running'|'exited', {...})`
 * fires 'running' once with the resolved command before running it (so the
 * UI can show it live), then 'exited' with the code. The exit code is
 * surfaced but never used to gate whether the leftover scan runs
 * afterward — see routes/uninstall.js — uninstallers routinely report
 * success when they weren't, and vice versa. */
export function runUninstaller(uninstallString, onEvent) {
  return new Promise((resolve, reject) => {
    if (!uninstallString) {
      reject(new Error('This program has no registered uninstall command.'));
      return;
    }
    const command = withSilentFlag(uninstallString);
    onEvent('running', { command });

    // cmd.exe /c: an UninstallString is a raw shell command line (e.g.
    // `MsiExec.exe /X{GUID} /qn` or `"C:\...\uninst.exe" /S`), not a
    // single executable + argv array — cmd.exe is what correctly splits
    // quoted paths and flags the way the registry entry expects.
    const child = spawn('cmd.exe', ['/c', command], { windowsHide: true });
    let stderr = '';
    child.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (err) => reject(new Error(`Failed to launch uninstaller: ${err.message}`)));
    child.on('exit', (code) => {
      onEvent('exited', { code, stderr: stderr.trim() || null });
      resolve({ code });
    });
  });
}

/** MSI uninstall strings (MsiExec.exe /X{GUID}) run interactively by
 * default — appends /qn (quiet, no UI) if it's an MsiExec string that
 * doesn't already specify a UI mode. Non-MSI uninstallers run exactly as
 * registered: there's no universal silent flag, and guessing one wrong
 * risks passing a flag the installer doesn't understand. */
export function withSilentFlag(uninstallString) {
  const isMsiExec = /msiexec(\.exe)?/i.test(uninstallString);
  const alreadyHasQuietFlag = /\/q[nb]?\b/i.test(uninstallString);
  if (isMsiExec && !alreadyHasQuietFlag) return `${uninstallString} /qn`;
  return uninstallString;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npx vitest run src/services/uninstall.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
cd backend
git add src/services/uninstall.js src/services/uninstall.test.js
git commit -m "feat(backend): run a program's real registered uninstaller"
```

---

## Task 6: `routes/uninstall.js` — SSE endpoint

**Files:**
- Create: `backend/src/routes/uninstall.js`
- Modify: `backend/src/index.js`

- [ ] **Step 1: Write the route**

`backend/src/routes/uninstall.js`:
```js
import { Router } from 'express';
import { runUninstaller } from '../services/uninstall.js';

const router = Router();

function sendEvent(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

router.post('/', async (req, res) => {
  const { uninstallString } = req.body || {};
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  try {
    const result = await runUninstaller(uninstallString, (type, data) => sendEvent(res, type, data));
    sendEvent(res, 'done', result);
  } catch (err) {
    sendEvent(res, 'error', { message: err.message });
  } finally {
    res.end();
  }
});

export default router;
```

- [ ] **Step 2: Wire it into the app**

Modify `backend/src/index.js`:
```js
import uninstallRoutes from './routes/uninstall.js';
```
```js
app.use('/api/programs', programsRoutes);
app.use('/api/uninstall', uninstallRoutes);
```

- [ ] **Step 3: Verify it live**

Run: `cd backend && node src/index.js` (one terminal), then:
`curl -N -X POST http://127.0.0.1:3101/api/uninstall -H "Content-Type: application/json" -d "{\"uninstallString\": null}"`
Expected: streams `event: error\ndata: {"message":"This program has no registered uninstall command."}` — proves the SSE plumbing and the no-uninstall-string error path both work without needing a real uninstall. Ctrl+C the server after.

- [ ] **Step 4: Commit**

```bash
cd backend
git add src/routes/uninstall.js src/index.js
git commit -m "feat(backend): stream uninstall progress over POST /api/uninstall"
```

---

## Task 7: `services/leftoverScan.js` — heuristic leftover scan

**Files:**
- Create: `backend/src/services/leftoverScan.js`
- Test: `backend/src/services/leftoverScan.test.js`

- [ ] **Step 1: Write the failing test**

`backend/src/services/leftoverScan.test.js`:
```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

const runPowerShellJsonMock = vi.fn();
vi.mock('./powershell.js', () => ({ runPowerShellJson: (...args) => runPowerShellJsonMock(...args) }));

let scanForLeftovers;
beforeEach(async () => {
  runPowerShellJsonMock.mockReset();
  ({ scanForLeftovers } = await import('./leftoverScan.js'));
});

describe('scanForLeftovers', () => {
  it('returns files, registryKeys, and scheduledTasks from three independent scans', async () => {
    runPowerShellJsonMock
      .mockResolvedValueOnce([{ path: 'C:\\ProgramData\\OldApp', sizeBytes: 4096 }])
      .mockResolvedValueOnce([{ path: 'HKCU:\\Software\\OldApp' }])
      .mockResolvedValueOnce([{ name: 'OldAppUpdater', path: '\\OldApp\\' }]);

    const result = await scanForLeftovers({ name: 'OldApp', publisher: 'Old Inc' });

    expect(result.files).toEqual({ ok: true, items: [{ path: 'C:\\ProgramData\\OldApp', sizeBytes: 4096 }] });
    expect(result.registryKeys).toEqual({ ok: true, items: [{ path: 'HKCU:\\Software\\OldApp' }] });
    expect(result.scheduledTasks).toEqual({ ok: true, items: [{ name: 'OldAppUpdater', path: '\\OldApp\\' }] });
  });

  it('degrades one failing sub-scan to ok:false without failing the others', async () => {
    runPowerShellJsonMock
      .mockRejectedValueOnce(new Error('access denied'))
      .mockResolvedValueOnce([{ path: 'HKCU:\\Software\\OldApp' }])
      .mockResolvedValueOnce(null);

    const result = await scanForLeftovers({ name: 'OldApp', publisher: 'Old Inc' });

    expect(result.files).toEqual({ ok: false, items: [] });
    expect(result.registryKeys.ok).toBe(true);
    expect(result.scheduledTasks).toEqual({ ok: true, items: [] });
  });

  // Real bug this test exists to catch: an empty search pattern (name and
  // publisher both blank) matches EVERY string under PowerShell's -match
  // operator, which would silently return the whole registry/filesystem
  // as "leftovers." Each sub-scan must short-circuit to empty instead.
  it('returns empty results for a program with no name or publisher, calling PowerShell for none of the three scans', async () => {
    const result = await scanForLeftovers({ name: '', publisher: '' });
    expect(result).toEqual({
      files: { ok: true, items: [] },
      registryKeys: { ok: true, items: [] },
      scheduledTasks: { ok: true, items: [] }
    });
    expect(runPowerShellJsonMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run src/services/leftoverScan.test.js`
Expected: FAIL — `Cannot find module './leftoverScan.js'`.

- [ ] **Step 3: Write the implementation**

`backend/src/services/leftoverScan.js`:
```js
import { runPowerShellJson } from './powershell.js';

const SEARCH_ROOTS = [
  '$env:ProgramFiles', '${env:ProgramFiles(x86)}', '$env:APPDATA',
  '$env:LOCALAPPDATA', '$env:ProgramData', "$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs"
];

/** Heuristic leftover scan: files/folders and registry keys whose name
 * matches the program's name or publisher, plus scheduled tasks the
 * program registered. NOT a full before/after system snapshot — that's
 * Hunter mode (Phase B), deliberately deferred. Each of the three checks
 * runs independently so one failing (e.g. a locked directory) doesn't
 * take the other two down. */
export async function scanForLeftovers({ name, publisher }) {
  const [files, registryKeys, scheduledTasks] = await Promise.all([
    scanFiles(name, publisher).catch(() => ({ ok: false, items: [] })),
    scanRegistry(name, publisher).catch(() => ({ ok: false, items: [] })),
    scanScheduledTasks(name).catch(() => ({ ok: false, items: [] }))
  ]);
  return { files, registryKeys, scheduledTasks };
}

function escapeForRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function scanFiles(name, publisher) {
  const terms = [name, publisher].filter(Boolean).map(escapeForRegex);
  if (terms.length === 0) return { ok: true, items: [] };
  const pattern = terms.join('|');
  const roots = SEARCH_ROOTS.join(',');
  const script = `
$roots = @(${roots}) | Where-Object { $_ -and (Test-Path $_) }
$pattern = '${pattern}'
$roots | ForEach-Object {
  Get-ChildItem -Path $_ -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match $pattern }
} | Select-Object @{N='path';E={$_.FullName}}, @{N='sizeBytes';E={
    (Get-ChildItem $_.FullName -Recurse -File -ErrorAction SilentlyContinue |
      Measure-Object -Property Length -Sum).Sum
  }} | ConvertTo-Json -Compress
`;
  const raw = await runPowerShellJson(script);
  const items = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
  return { ok: true, items: items.map(i => ({ path: i.path, sizeBytes: i.sizeBytes || 0 })) };
}

async function scanRegistry(name, publisher) {
  const terms = [name, publisher].filter(Boolean).map(escapeForRegex);
  if (terms.length === 0) return { ok: true, items: [] };
  const pattern = terms.join('|');
  const script = `
$pattern = '${pattern}'
$roots = @('HKCU:\\Software', 'HKLM:\\Software')
$roots | ForEach-Object {
  Get-ChildItem -Path $_ -ErrorAction SilentlyContinue |
    Where-Object { $_.PSChildName -match $pattern }
} | Select-Object @{N='path';E={$_.Name}} | ConvertTo-Json -Compress
`;
  const raw = await runPowerShellJson(script);
  const items = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
  return { ok: true, items: items.map(i => ({ path: i.path })) };
}

async function scanScheduledTasks(name) {
  if (!name) return { ok: true, items: [] };
  const pattern = escapeForRegex(name);
  const script = `
$pattern = '${pattern}'
Get-ScheduledTask -ErrorAction SilentlyContinue |
  Where-Object { $_.TaskName -match $pattern -or $_.TaskPath -match $pattern } |
  Select-Object @{N='name';E={$_.TaskName}}, @{N='path';E={$_.TaskPath}} |
  ConvertTo-Json -Compress
`;
  const raw = await runPowerShellJson(script);
  const items = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
  return { ok: true, items };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npx vitest run src/services/leftoverScan.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd backend
git add src/services/leftoverScan.js src/services/leftoverScan.test.js
git commit -m "feat(backend): heuristic leftover scan across files, registry, scheduled tasks"
```

---

## Task 8: `routes/leftovers.js`

**Files:**
- Create: `backend/src/routes/leftovers.js`
- Modify: `backend/src/index.js`

- [ ] **Step 1: Write the route**

`backend/src/routes/leftovers.js`:
```js
import { Router } from 'express';
import { scanForLeftovers } from '../services/leftoverScan.js';

const router = Router();

router.post('/scan', async (req, res) => {
  const { name, publisher } = req.body || {};
  if (!name) { res.status(400).json({ error: 'name is required' }); return; }
  try {
    const result = await scanForLeftovers({ name, publisher });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
```

- [ ] **Step 2: Wire it into the app**

Modify `backend/src/index.js`:
```js
import leftoversRoutes from './routes/leftovers.js';
```
```js
app.use('/api/uninstall', uninstallRoutes);
app.use('/api/leftovers', leftoversRoutes);
```

- [ ] **Step 3: Verify it live**

Run: `cd backend && node src/index.js` (one terminal), then:
`curl -X POST http://127.0.0.1:3101/api/leftovers/scan -H "Content-Type: application/json" -d "{\"name\": \"NotepadPlusPlus\", \"publisher\": \"Notepad++ Team\"}"`
Expected: JSON with `files`/`registryKeys`/`scheduledTasks`, each `{ok: true, items: [...]}` — real results if you have that installed, empty arrays otherwise; either is correct, the point is a 200 response with no errors. Ctrl+C after.

- [ ] **Step 4: Commit**

```bash
cd backend
git add src/routes/leftovers.js src/index.js
git commit -m "feat(backend): expose POST /api/leftovers/scan"
```

---

## Task 9: `services/quarantine.js` — safety net (quarantine + `.reg` export + restore)

**Files:**
- Create: `backend/src/services/quarantine.js`
- Test: `backend/src/services/quarantine.test.js`

This is real, unmocked I/O — real file moves in a scratch temp dir, and real `reg.exe` calls against a **throwaway** `HKCU\Software\unrevo-test` key, never the real Uninstall hives. Matches the design spec's own testing section.

- [ ] **Step 1: Write the failing test**

`backend/src/services/quarantine.test.js`:
```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { quarantineAndDelete, restoreQuarantine } from './quarantine.js';

const execFileAsync = promisify(execFile);
const TEST_KEY = 'HKCU\\Software\\unrevo-test';

let scratchDir;
beforeEach(async () => {
  scratchDir = await mkdtemp(join(tmpdir(), 'unrevo-quarantine-test-'));
  process.env.UNREVO_QUARANTINE_ROOT = scratchDir;
  await execFileAsync('reg', ['add', TEST_KEY, '/v', 'Marker', '/d', 'test-value', '/f']);
});

afterEach(async () => {
  delete process.env.UNREVO_QUARANTINE_ROOT;
  await rm(scratchDir, { recursive: true, force: true });
  try { await execFileAsync('reg', ['delete', TEST_KEY, '/f']); } catch { /* already gone */ }
});

describe('quarantineAndDelete', () => {
  it('moves listed files into a quarantine batch folder', async () => {
    const filePath = join(scratchDir, 'leftover.txt');
    await writeFile(filePath, 'leftover content', 'utf8');

    const manifest = await quarantineAndDelete({ programName: 'OldApp', files: [filePath], registryKeys: [] });

    expect(existsSync(filePath)).toBe(false); // moved, not just copied
    expect(manifest.files).toHaveLength(1);
    expect(existsSync(manifest.files[0].quarantinedPath)).toBe(true);
    const content = await readFile(manifest.files[0].quarantinedPath, 'utf8');
    expect(content).toBe('leftover content');
  });

  it('exports and deletes a real registry key, writing a restorable .reg file', async () => {
    const manifest = await quarantineAndDelete({ programName: 'OldApp', files: [], registryKeys: ['HKCU:\\Software\\unrevo-test'] });

    await expect(execFileAsync('reg', ['query', TEST_KEY])).rejects.toThrow();
    expect(manifest.registryKeys).toEqual(['HKCU:\\Software\\unrevo-test']);
    expect(manifest.regFiles).toHaveLength(1);
    // reg.exe writes .reg files as UTF-16LE, not UTF-8 — reading it as utf8
    // would produce mojibake and this assertion would silently never match.
    const regContent = await readFile(manifest.regFiles[0], 'utf16le');
    expect(regContent).toMatch(/unrevo-test/i);
  });

  it('skips a file that no longer exists rather than throwing', async () => {
    const manifest = await quarantineAndDelete({ programName: 'OldApp', files: [join(scratchDir, 'nope.txt')], registryKeys: [] });
    expect(manifest.files).toEqual([]);
  });
});

describe('restoreQuarantine', () => {
  it('moves a quarantined file back to its original path', async () => {
    const filePath = join(scratchDir, 'restore-me.txt');
    await writeFile(filePath, 'restore content', 'utf8');
    const manifest = await quarantineAndDelete({ programName: 'OldApp', files: [filePath], registryKeys: [] });

    await restoreQuarantine(manifest.batchDir);

    expect(existsSync(filePath)).toBe(true);
    expect(await readFile(filePath, 'utf8')).toBe('restore content');
  });

  it('re-imports a quarantined registry key', async () => {
    const manifest = await quarantineAndDelete({ programName: 'OldApp', files: [], registryKeys: ['HKCU:\\Software\\unrevo-test'] });
    await expect(execFileAsync('reg', ['query', TEST_KEY])).rejects.toThrow();

    await restoreQuarantine(manifest.batchDir);

    const { stdout } = await execFileAsync('reg', ['query', TEST_KEY, '/v', 'Marker']);
    expect(stdout).toMatch(/test-value/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run src/services/quarantine.test.js`
Expected: FAIL — `Cannot find module './quarantine.js'`.

- [ ] **Step 3: Write the implementation**

`backend/src/services/quarantine.js`:
```js
import { mkdir, rename, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** Root directory quarantine operations write into. A function, not a
 * constant — read at call time, not import time — so tests can point it
 * at a scratch temp dir via UNREVO_QUARANTINE_ROOT without touching the
 * real %LOCALAPPDATA%\unrevo\quarantine on the dev machine. Same
 * env-var-override pattern Re:Route's REROUTE_DATA_DIR uses. */
export function quarantineRoot() {
  return process.env.UNREVO_QUARANTINE_ROOT
    || join(process.env.LOCALAPPDATA || process.cwd(), 'unrevo', 'quarantine');
}

function safeSegment(text) {
  return text.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 60) || 'unknown';
}

/** `HKCU:\Software\Foo` (PowerShell provider syntax) -> `HKCU\Software\Foo`
 * (reg.exe syntax) — the two tools disagree on both the drive-colon and
 * path-separator convention for the registry root. */
function toRegExeKeyPath(psPath) {
  return psPath.replace(/^HKCU:\\?/i, 'HKCU\\').replace(/^HKLM:\\?/i, 'HKLM\\');
}

/** Creates one quarantine batch: moves every listed file into it (atomic
 * rename, not copy-then-delete — no window where a file exists in both
 * places), exports every listed registry key BEFORE deleting any of them.
 *
 * `reg export` requires a real disk FileName — it does NOT support a
 * Unix-style `-`-for-stdout convention (confirmed via `reg export /?`).
 * Passing `-` just creates a literal file named `-`; the real export never
 * happens. Each key gets its OWN `.reg` file in the batch dir instead of
 * being combined into one — simpler than concatenating raw exports would
 * be anyway (each has its own `Windows Registry Editor Version 5.00`
 * header; naively joining them produces an invalid combined file).
 * Restoring means re-importing each of a batch's `.reg` files.
 *
 * A key that fails to export/delete (already gone, access denied) is
 * skipped rather than aborting the whole batch — same
 * partial-results-over-total-failure philosophy as the leftover scanner. */
export async function quarantineAndDelete({ programName, files, registryKeys }) {
  const batchDir = join(quarantineRoot(), `${Date.now()}-${safeSegment(programName)}`);
  await mkdir(batchDir, { recursive: true });

  const movedFiles = [];
  for (const filePath of files) {
    if (!existsSync(filePath)) continue;
    const dest = join(batchDir, `file-${movedFiles.length}-${basename(filePath)}`);
    await rename(filePath, dest);
    movedFiles.push({ originalPath: filePath, quarantinedPath: dest });
  }

  const exportedKeys = [];
  const regFiles = [];
  for (const keyPath of registryKeys) {
    const regFilePath = join(batchDir, `registry-${regFiles.length}.reg`);
    try {
      await execFileAsync('reg', ['export', toRegExeKeyPath(keyPath), regFilePath, '/y']);
      await execFileAsync('reg', ['delete', toRegExeKeyPath(keyPath), '/f']);
      exportedKeys.push(keyPath);
      regFiles.push(regFilePath);
    } catch {
      // skipped — see doc comment above
    }
  }

  const manifest = {
    programName, createdAt: Date.now(), batchDir,
    files: movedFiles, registryKeys: exportedKeys, regFiles
  };
  await writeFile(join(batchDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  return manifest;
}

/** Reverses one quarantine batch: moves every file back to its original
 * path and re-imports every one of the batch's `.reg` backups. Reads the
 * manifest written by quarantineAndDelete rather than taking a file list
 * as a caller-supplied argument, so a restore always operates on exactly
 * what was actually quarantined. */
export async function restoreQuarantine(batchDir) {
  const manifestPath = join(batchDir, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

  for (const { originalPath, quarantinedPath } of manifest.files) {
    if (existsSync(quarantinedPath)) await rename(quarantinedPath, originalPath);
  }
  for (const regFilePath of manifest.regFiles ?? []) {
    if (existsSync(regFilePath)) await execFileAsync('reg', ['import', regFilePath]);
  }
  return manifest;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npx vitest run src/services/quarantine.test.js`
Expected: PASS (5 tests). These make real `reg.exe` calls — confirm no leftover `HKCU\Software\unrevo-test` key remains afterward: `reg query HKCU\Software\unrevo-test` should report it not found.

- [ ] **Step 5: Commit**

```bash
cd backend
git add src/services/quarantine.js src/services/quarantine.test.js
git commit -m "feat(backend): quarantine + .reg-export safety net, with restore"
```

---

## Task 10: `services/restorePoint.js` — best-effort System Restore checkpoint

**Files:**
- Create: `backend/src/services/restorePoint.js`
- Test: `backend/src/services/restorePoint.test.js`

- [ ] **Step 1: Write the failing test**

`backend/src/services/restorePoint.test.js`:
```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

const runPowerShellJsonMock = vi.fn();
vi.mock('./powershell.js', () => ({ runPowerShellJson: (...args) => runPowerShellJsonMock(...args) }));

let tryCreateRestorePoint;
beforeEach(async () => {
  runPowerShellJsonMock.mockReset();
  ({ tryCreateRestorePoint } = await import('./restorePoint.js'));
});

describe('tryCreateRestorePoint', () => {
  it('returns created:true when the checkpoint succeeds', async () => {
    runPowerShellJsonMock.mockResolvedValue({ created: true });
    expect(await tryCreateRestorePoint('Uninstall OldApp')).toEqual({ created: true });
  });

  it('returns created:false with a reason when PowerShell reports failure (e.g. throttled)', async () => {
    runPowerShellJsonMock.mockResolvedValue({ created: false, reason: 'System Restore points can only be created once every 24 hours.' });
    const result = await tryCreateRestorePoint('Uninstall OldApp');
    expect(result.created).toBe(false);
    expect(result.reason).toMatch(/24 hours/);
  });

  it('never throws — a PowerShell exec failure degrades to created:false', async () => {
    runPowerShellJsonMock.mockRejectedValue(new Error('powershell.exe not found'));
    const result = await tryCreateRestorePoint('Uninstall OldApp');
    expect(result).toEqual({ created: false, reason: 'powershell.exe not found' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx vitest run src/services/restorePoint.test.js`
Expected: FAIL — `Cannot find module './restorePoint.js'`.

- [ ] **Step 3: Write the implementation**

`backend/src/services/restorePoint.js`:
```js
import { runPowerShellJson } from './powershell.js';

/** Best-effort System Restore checkpoint before a forced-removal batch —
 * NOT the primary safety net (see quarantine.js / the design spec: Windows
 * throttles Checkpoint-Computer to one per 24h by default, so relying on
 * it alone would silently leave a user's second uninstall of the day
 * unprotected). Never throws — a caller that awaits this and ignores a
 * false `created` is using it correctly. */
export async function tryCreateRestorePoint(description) {
  const script = `
try {
  Checkpoint-Computer -Description '${description.replace(/'/g, "''")}' -RestorePointType 'APPLICATION_UNINSTALL' -ErrorAction Stop
  ConvertTo-Json @{ created = $true }
} catch {
  ConvertTo-Json @{ created = $false; reason = $_.Exception.Message }
}
`;
  try {
    const result = await runPowerShellJson(script);
    return result || { created: false, reason: 'No response from PowerShell' };
  } catch (err) {
    return { created: false, reason: err.message };
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npx vitest run src/services/restorePoint.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd backend
git add src/services/restorePoint.js src/services/restorePoint.test.js
git commit -m "feat(backend): best-effort System Restore checkpoint before forced removal"
```

---

## Task 11: `routes/quarantine.js` — remove, list, restore

**Files:**
- Create: `backend/src/routes/quarantine.js`
- Modify: `backend/src/index.js`

Wires `restorePoint.js` and `quarantine.js` together: the restore-point attempt fires first (best-effort, result surfaced but never blocking), then the real quarantine+delete.

- [ ] **Step 1: Write the route**

`backend/src/routes/quarantine.js`:
```js
import { Router } from 'express';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { quarantineAndDelete, restoreQuarantine, quarantineRoot } from '../services/quarantine.js';
import { tryCreateRestorePoint } from '../services/restorePoint.js';

const router = Router();

router.post('/remove', async (req, res) => {
  const { programName, files, registryKeys } = req.body || {};
  if (!programName) { res.status(400).json({ error: 'programName is required' }); return; }
  try {
    const restorePoint = await tryCreateRestorePoint(`unrevo: forced removal of ${programName}`);
    const manifest = await quarantineAndDelete({ programName, files: files || [], registryKeys: registryKeys || [] });
    res.json({ ...manifest, restorePoint });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  const root = quarantineRoot();
  if (!existsSync(root)) { res.json({ batches: [] }); return; }
  const entries = await readdir(root, { withFileTypes: true });
  const batches = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = join(root, entry.name, 'manifest.json');
    if (!existsSync(manifestPath)) continue;
    try {
      batches.push(JSON.parse(await readFile(manifestPath, 'utf8')));
    } catch { /* skip a corrupted manifest rather than failing the whole list */ }
  }
  batches.sort((a, b) => b.createdAt - a.createdAt);
  res.json({ batches });
});

router.post('/:batchDir/restore', async (req, res) => {
  try {
    const manifest = await restoreQuarantine(join(quarantineRoot(), req.params.batchDir));
    res.json(manifest);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
```

- [ ] **Step 2: Wire it into the app**

Modify `backend/src/index.js`:
```js
import quarantineRoutes from './routes/quarantine.js';
```
```js
app.use('/api/leftovers', leftoversRoutes);
app.use('/api/quarantine', quarantineRoutes);
```

- [ ] **Step 3: Verify it live**

Run: `cd backend && node src/index.js` (one terminal), then:
```
curl http://127.0.0.1:3101/api/quarantine
```
Expected: `{"batches":[]}` (nothing quarantined yet on a fresh machine). Ctrl+C after.

- [ ] **Step 4: Commit**

```bash
cd backend
git add src/routes/quarantine.js src/index.js
git commit -m "feat(backend): expose quarantine remove/list/restore endpoints"
```

---

## Task 12: Full backend test run — checkpoint before the frontend

**Files:** none (verification-only task)

- [ ] **Step 1: Run every backend test**

Run: `cd backend && npm test`
Expected: all test files pass — `powershell.test.js`, `programs.test.js`, `uninstall.test.js`, `leftoverScan.test.js`, `quarantine.test.js`, `restorePoint.test.js`. If anything fails, fix it before moving on — the frontend tasks below assume a fully working backend to call against.

- [ ] **Step 2: Confirm the full route set live**

Run: `cd backend && node src/index.js`, then in another terminal:
```
curl http://127.0.0.1:3101/api/health
curl http://127.0.0.1:3101/api/programs
curl http://127.0.0.1:3101/api/quarantine
```
Expected: all three return 200 with sensible JSON. Ctrl+C the server after.

---

## Task 13: Scaffold `frontend/`

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/main.jsx`
- Create: `frontend/src/App.jsx`

- [ ] **Step 1: Create the frontend package**

`frontend/package.json`:
```json
{
  "name": "unrevo-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "@fontsource/jetbrains-mono": "^5.2.8",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^6.4.3",
    "vitest": "^4.1.10"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `cd frontend && npm install`
Expected: completes with no errors.

- [ ] **Step 3: Write the Vite config**

`frontend/vite.config.js`:
```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the production build works loaded via file://
  // (the packaged Electron app), not just from an http server root — same
  // reasoning as Re:Route's own vite.config.js.
  base: './',
  server: { port: 5174 }
});
```

- [ ] **Step 4: Write the HTML shell**

`frontend/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>unrevo</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Write the React entry**

`frontend/src/main.jsx`:
```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import './index.css';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 6: Write a placeholder App**

`frontend/src/App.jsx`:
```jsx
export default function App() {
  return <div className="app-shell">unrevo — loading...</div>;
}
```

- [ ] **Step 7: Verify the dev server starts**

Run: `cd frontend && npm run dev`
Expected: prints a local URL (http://localhost:5174). Open it in a browser — page shows "unrevo — loading..." with no console errors. Ctrl+C after confirming.

- [ ] **Step 8: Commit**

```bash
cd frontend
git add package.json package-lock.json vite.config.js index.html src/main.jsx src/App.jsx
git commit -m "chore(frontend): scaffold Vite + React entry"
```

---

## Task 14: Design tokens — `index.css`

**Files:**
- Create: `frontend/src/index.css`

Tokens lifted verbatim from the user's reference prototype ("Prune") — see the design spec's Visual system section.

- [ ] **Step 1: Write the stylesheet**

`frontend/src/index.css`:
```css
@import url(https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&display=swap);

:root {
  --bg-obsidian: #09090b;
  --bg-zinc: #18181b;
  --bg-zinc-hi: #1f1f23;
  --border-subtle: #27272a;
  --text-primary: #fafafa;
  --text-secondary: #a1a1aa;
  --text-muted: #71717a;
  --accent-cyan: #06b6d4;
  --accent-cyan-glow: rgba(6, 182, 212, 0.35);
  --accent-cyan-soft: rgba(6, 182, 212, 0.12);
  --danger: #ef4444;
  --warning: #f59e0b;
  --success: #10b981;
}

* { box-sizing: border-box; }

html, body, #root { height: 100%; margin: 0; }

body {
  background: var(--bg-obsidian);
  color: var(--text-primary);
  font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-feature-settings: 'cv11', 'ss01', 'ss03';
  letter-spacing: -0.01em;
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
}

.font-mono {
  font-family: 'JetBrains Mono', 'SF Mono', Menlo, monospace;
  letter-spacing: 0;
}

.app-shell { padding: 24px; }

/* Glassmorphism — modals and elevated panels */
.glass-strong {
  background: rgba(9, 9, 11, 0.85);
  backdrop-filter: blur(24px) saturate(160%);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

/* Buttons */
.btn-primary {
  background: linear-gradient(180deg, #0891b2, #06b6d4);
  color: #001014;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.25),
    0 8px 24px -8px rgba(6, 182, 212, 0.55),
    0 2px 6px rgba(0, 0, 0, 0.35);
  transition: transform 140ms cubic-bezier(0.2, 0.9, 0.3, 1), box-shadow 200ms ease;
  font-weight: 600;
  letter-spacing: -0.01em;
  border-radius: 8px;
  padding: 8px 16px;
  cursor: pointer;
}
.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.3),
    0 12px 32px -8px rgba(6, 182, 212, 0.7),
    0 4px 10px rgba(0, 0, 0, 0.4);
}
.btn-primary:active { transform: translateY(0); }
.btn-primary:disabled { opacity: 0.5; cursor: default; transform: none; box-shadow: none; }

.btn-ghost {
  background: transparent;
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
  border-radius: 8px;
  padding: 8px 16px;
  cursor: pointer;
  transition: all 160ms ease;
}
.btn-ghost:hover { background: rgba(255, 255, 255, 0.04); border-color: #3f3f46; }

.btn-danger {
  background: rgba(239, 68, 68, 0.12);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: 8px;
  padding: 6px 12px;
  cursor: pointer;
  transition: all 160ms ease;
}
.btn-danger:hover { background: rgba(239, 68, 68, 0.2); color: #fecaca; }

input[type="checkbox"].sleek {
  appearance: none;
  width: 16px;
  height: 16px;
  border: 1.5px solid #52525b;
  border-radius: 4px;
  background: #0a0a0b;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 140ms;
  flex-shrink: 0;
}
input[type="checkbox"].sleek:checked { background: var(--accent-cyan); border-color: var(--accent-cyan); }
input[type="checkbox"].sleek:checked::after {
  content: '';
  width: 4px;
  height: 8px;
  border: solid #001014;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg) translate(-1px, -1px);
}

::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #27272a; border-radius: 8px; border: 2px solid var(--bg-obsidian); }
::-webkit-scrollbar-thumb:hover { background: #3f3f46; }
```

- [ ] **Step 2: Verify it live**

Run: `cd frontend && npm run dev`, open the URL.
Expected: page background is near-black (#09090b), text is off-white — confirms the stylesheet loaded. Ctrl+C after.

- [ ] **Step 3: Commit**

```bash
cd frontend
git add src/index.css
git commit -m "feat(frontend): design tokens and base styles from the Prune reference"
```

---

## Task 15: `lib/api.js` — backend fetch wrappers + SSE reader

**Files:**
- Create: `frontend/src/lib/api.js`
- Test: `frontend/src/lib/api.test.js`

- [ ] **Step 1: Write the failing test**

Only `parseSSELine` is pure enough to unit test — matches this codebase's convention of testing pure logic, not fetch/DOM.

`frontend/src/lib/api.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { parseSSELine } from './api.js';

describe('parseSSELine', () => {
  it('parses an "event:" line', () => {
    expect(parseSSELine('event: running')).toEqual({ field: 'event', value: 'running' });
  });

  it('parses a "data:" line, trimming exactly one leading space per the SSE spec', () => {
    expect(parseSSELine('data: {"a":1}')).toEqual({ field: 'data', value: '{"a":1}' });
  });

  it('returns null for a blank line (the SSE block separator)', () => {
    expect(parseSSELine('')).toBeNull();
  });

  it('returns null for a line with no recognized field prefix', () => {
    expect(parseSSELine('not a field')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/api.test.js`
Expected: FAIL — `Cannot find module './api.js'`.

- [ ] **Step 3: Write the implementation**

`frontend/src/lib/api.js`:
```js
const API_URL = 'http://127.0.0.1:3101/api';

export async function fetchPrograms() {
  const res = await fetch(`${API_URL}/programs`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data.programs;
}

export async function scanForLeftovers(name, publisher) {
  const res = await fetch(`${API_URL}/leftovers/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, publisher })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

export async function removeQuarantined({ programName, files, registryKeys }) {
  const res = await fetch(`${API_URL}/quarantine/remove`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ programName, files, registryKeys })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

export async function fetchQuarantineBatches() {
  const res = await fetch(`${API_URL}/quarantine`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data.batches;
}

export async function restoreQuarantineBatch(batchDirName) {
  const res = await fetch(`${API_URL}/quarantine/${encodeURIComponent(batchDirName)}/restore`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

/** One line of an SSE block. `field` is 'event' or 'data'; anything else
 * (including a blank line, the block separator) is not a recognized
 * field and returns null. The SSE spec strips exactly one leading space
 * after the colon, not all leading whitespace. Exported for testing. */
export function parseSSELine(line) {
  const match = line.match(/^(event|data): ?(.*)$/);
  if (!match) return null;
  return { field: match[1], value: match[2] };
}

/** Streams POST /api/uninstall, calling onEvent(type, data) for each SSE
 * block as it arrives. Mirrors Re:Route's own SSE parsing shape (this
 * project's sibling app), adapted to this project's simpler two-field
 * (event/data) block format. */
export async function streamUninstall(uninstallString, onEvent) {
  const res = await fetch(`${API_URL}/uninstall`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uninstallString })
  });
  if (!res.ok || !res.body) throw new Error(`Request failed: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let currentEvent = 'message';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    let sep;
    while ((sep = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, sep);
      buf = buf.slice(sep + 1);
      const parsed = parseSSELine(line);
      if (!parsed) continue;
      if (parsed.field === 'event') currentEvent = parsed.value;
      else if (parsed.field === 'data') onEvent(currentEvent, JSON.parse(parsed.value));
    }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/api.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd frontend
git add src/lib/api.js src/lib/api.test.js
git commit -m "feat(frontend): backend API client, including SSE uninstall-stream reader"
```

---

## Task 16: `components/ProgramList.jsx`

**Files:**
- Create: `frontend/src/components/ProgramList.jsx`

- [ ] **Step 1: Write the component**

`frontend/src/components/ProgramList.jsx`:
```jsx
import { useEffect, useMemo, useState } from 'react';
import { fetchPrograms } from '../lib/api.js';

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function ProgramList({ onUninstall }) {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchPrograms()
      .then((result) => { if (!cancelled) setPrograms(result); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? programs.filter(p => p.name.toLowerCase().includes(q) || p.publisher.toLowerCase().includes(q))
      : programs;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [programs, query]);

  if (loading) return <div style={{ color: 'var(--text-muted)' }}>Loading installed programs…</div>;
  if (error) return <div style={{ color: 'var(--danger)' }}>Couldn't load programs: {error}</div>;

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search installed programs..."
        aria-label="Search installed programs"
        style={{
          width: '100%', background: 'var(--bg-zinc-hi)', border: '1px solid var(--border-subtle)',
          borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 13, marginBottom: 16
        }}
      />
      {filtered.length === 0 && <div style={{ color: 'var(--text-muted)' }}>No programs match your search.</div>}
      <div role="table" aria-label="Installed programs">
        {filtered.map((program) => (
          <div
            key={program.id}
            role="row"
            style={{
              display: 'grid', gridTemplateColumns: '1fr 100px 90px', gap: 12,
              alignItems: 'center', padding: '10px 4px', borderRadius: 10
            }}
          >
            <div>
              <div style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 500 }}>{program.name}</div>
              <div className="font-mono" style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                {program.publisher} · {program.version || 'unknown version'}
              </div>
            </div>
            <div className="font-mono" style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
              {formatBytes(program.sizeBytes)}
            </div>
            <button className="btn-ghost" onClick={() => onUninstall(program)}>Uninstall</button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it live**

This is wired into `App.jsx` and manually verified in Task 20's smoke test — no isolated verification step here (matches this codebase's convention: pure logic gets unit tests, JSX component wiring gets a manual/live check once assembled).

- [ ] **Step 3: Commit**

```bash
cd frontend
git add src/components/ProgramList.jsx
git commit -m "feat(frontend): ProgramList component"
```

---

## Task 17: `components/LeftoverReview.jsx`

**Files:**
- Create: `frontend/src/components/LeftoverReview.jsx`

Pure presentational — given scan results and selection state, renders grouped checkboxes. No data fetching of its own, matching the design spec's grouped/checkbox-selectable requirement.

- [ ] **Step 1: Write the component**

`frontend/src/components/LeftoverReview.jsx`:
```jsx
const GROUPS = [
  { key: 'files', label: 'Files & folders' },
  { key: 'registryKeys', label: 'Registry keys' },
  { key: 'scheduledTasks', label: 'Scheduled tasks' }
];

/** `scanResult` is { files, registryKeys, scheduledTasks }, each
 * { ok, items }. `selected` is a Set of "group:index" keys — all checked
 * by default is the caller's job (UninstallModal seeds it), not this
 * component's. */
export default function LeftoverReview({ scanResult, selected, onToggle, onConfirm, onSkip }) {
  const totalItems = GROUPS.reduce((sum, g) => sum + (scanResult[g.key]?.items?.length || 0), 0);

  if (totalItems === 0) {
    return (
      <div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No leftovers found.</p>
        <button className="btn-primary" onClick={onSkip}>Done</button>
      </div>
    );
  }

  return (
    <div>
      {GROUPS.map(({ key, label }) => {
        const group = scanResult[key];
        if (!group) return null;
        if (!group.ok) {
          return (
            <div key={key} style={{ marginBottom: 16 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6 }}>{label}</div>
              <div style={{ color: 'var(--warning)', fontSize: 12 }}>Couldn't check this.</div>
            </div>
          );
        }
        if (group.items.length === 0) return null;
        return (
          <div key={key} style={{ marginBottom: 16 }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6 }}>{label}</div>
            {group.items.map((item, i) => {
              const itemKey = `${key}:${i}`;
              return (
                <label key={itemKey} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    className="sleek"
                    checked={selected.has(itemKey)}
                    onChange={() => onToggle(itemKey)}
                  />
                  <span className="font-mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {item.path || item.name}
                  </span>
                </label>
              );
            })}
          </div>
        );
      })}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button className="btn-primary" onClick={onConfirm}>Remove selected</button>
        <button className="btn-ghost" onClick={onSkip}>Skip</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd frontend
git add src/components/LeftoverReview.jsx
git commit -m "feat(frontend): LeftoverReview component (grouped, checkbox-selectable)"
```

---

## Task 18: `components/UninstallModal.jsx`

**Files:**
- Create: `frontend/src/components/UninstallModal.jsx`

Orchestrates the whole flow: confirm → uninstalling → scanning → reviewing → removing → done. Matches the reference's own modal sequence (full-screen glass overlay, live command shown during "uninstalling").

- [ ] **Step 1: Write the component**

`frontend/src/components/UninstallModal.jsx`:
```jsx
import { useState } from 'react';
import { streamUninstall, scanForLeftovers, removeQuarantined } from '../lib/api.js';
import LeftoverReview from './LeftoverReview.jsx';

const GROUPS = ['files', 'registryKeys', 'scheduledTasks'];

/** All items in a scan result, selected by default — matches the design
 * spec: "all checked by default, user can uncheck anything." */
function allItemKeys(scanResult) {
  const keys = new Set();
  for (const group of GROUPS) {
    (scanResult[group]?.items || []).forEach((_, i) => keys.add(`${group}:${i}`));
  }
  return keys;
}

export default function UninstallModal({ program, onClose }) {
  const [phase, setPhase] = useState('confirm'); // confirm | uninstalling | scanning | reviewing | removing | done | error
  const [liveCommand, setLiveCommand] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [errorMessage, setErrorMessage] = useState(null);

  const startUninstall = async () => {
    setPhase('uninstalling');
    try {
      await streamUninstall(program.uninstallString, (type, data) => {
        if (type === 'running') setLiveCommand(data.command);
        if (type === 'error') { setErrorMessage(data.message); setPhase('error'); }
      });
      await runScan();
    } catch (err) {
      setErrorMessage(err.message);
      setPhase('error');
    }
  };

  const runScan = async () => {
    setPhase('scanning');
    try {
      const result = await scanForLeftovers(program.name, program.publisher);
      setScanResult(result);
      setSelected(allItemKeys(result));
      setPhase('reviewing');
    } catch (err) {
      setErrorMessage(err.message);
      setPhase('error');
    }
  };

  const toggleItem = (itemKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemKey)) next.delete(itemKey); else next.add(itemKey);
      return next;
    });
  };

  const confirmRemoval = async () => {
    setPhase('removing');
    try {
      const files = (scanResult.files?.items || [])
        .filter((_, i) => selected.has(`files:${i}`))
        .map((item) => item.path);
      const registryKeys = (scanResult.registryKeys?.items || [])
        .filter((_, i) => selected.has(`registryKeys:${i}`))
        .map((item) => item.path);
      await removeQuarantined({ programName: program.name, files, registryKeys });
      setPhase('done');
    } catch (err) {
      setErrorMessage(err.message);
      setPhase('error');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
      <div className="glass-strong" style={{ width: 'min(680px, 90vw)', borderRadius: 16, padding: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{program.name}</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 20 }}>{program.publisher}</div>

        {phase === 'confirm' && (
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              This will run {program.name}'s own uninstaller, then scan for and let you remove anything it leaves behind.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn-primary" onClick={startUninstall}>Uninstall</button>
              <button className="btn-ghost" onClick={onClose}>Cancel</button>
            </div>
          </div>
        )}

        {phase === 'uninstalling' && (
          <div>
            <div style={{ color: 'var(--accent-cyan)', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Running native uninstaller</div>
            {liveCommand && <div className="font-mono" style={{ color: 'var(--text-muted)', fontSize: 11 }}>{liveCommand}</div>}
          </div>
        )}

        {phase === 'scanning' && (
          <div>
            <div style={{ color: 'var(--accent-cyan)', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Scanning for leftovers…</div>
            <div className="font-mono" style={{ color: 'var(--text-muted)', fontSize: 11 }}>Checking filesystem, registry &amp; scheduled tasks…</div>
          </div>
        )}

        {phase === 'reviewing' && scanResult && (
          <LeftoverReview
            scanResult={scanResult}
            selected={selected}
            onToggle={toggleItem}
            onConfirm={confirmRemoval}
            onSkip={onClose}
          />
        )}

        {phase === 'removing' && (
          <div style={{ color: 'var(--accent-cyan)', fontSize: 12, fontWeight: 600 }}>Removing selected items…</div>
        )}

        {phase === 'done' && (
          <div>
            <p style={{ color: 'var(--success)', fontSize: 13 }}>Done. Removed items were moved to quarantine — recoverable from Settings if needed.</p>
            <button className="btn-primary" onClick={onClose}>Close</button>
          </div>
        )}

        {phase === 'error' && (
          <div>
            <p style={{ color: 'var(--danger)', fontSize: 13 }}>{errorMessage}</p>
            <button className="btn-ghost" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd frontend
git add src/components/UninstallModal.jsx
git commit -m "feat(frontend): UninstallModal (confirm -> uninstall -> scan -> review -> remove)"
```

---

## Task 19: `components/QuarantinePanel.jsx`

**Files:**
- Create: `frontend/src/components/QuarantinePanel.jsx`

- [ ] **Step 1: Write the component**

`frontend/src/components/QuarantinePanel.jsx`:
```jsx
import { useEffect, useState } from 'react';
import { fetchQuarantineBatches, restoreQuarantineBatch } from '../lib/api.js';

function batchDirName(batchDir) {
  // batchDir is a full path (backend/services/quarantine.js's own
  // batchDir field) — only the last segment is the route param the
  // restore endpoint expects.
  const parts = batchDir.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1];
}

export default function QuarantinePanel() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [restoringId, setRestoringId] = useState(null);

  const load = () => {
    setLoading(true);
    fetchQuarantineBatches()
      .then(setBatches)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleRestore = async (batch) => {
    setRestoringId(batch.batchDir);
    try {
      await restoreQuarantineBatch(batchDirName(batch.batchDir));
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setRestoringId(null);
    }
  };

  if (loading) return <div style={{ color: 'var(--text-muted)' }}>Loading…</div>;
  if (error) return <div style={{ color: 'var(--danger)' }}>{error}</div>;
  if (batches.length === 0) return <div style={{ color: 'var(--text-muted)' }}>Nothing removed yet.</div>;

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Recently removed</div>
      {batches.map((batch) => (
        <div key={batch.batchDir} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{batch.programName}</div>
            <div className="font-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {new Date(batch.createdAt).toLocaleString()} · {batch.files.length} file(s), {batch.registryKeys.length} key(s)
            </div>
          </div>
          <button className="btn-ghost" disabled={restoringId === batch.batchDir} onClick={() => handleRestore(batch)}>
            {restoringId === batch.batchDir ? 'Restoring…' : 'Restore'}
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd frontend
git add src/components/QuarantinePanel.jsx
git commit -m "feat(frontend): QuarantinePanel (recently-removed list with restore)"
```

---

## Task 20: Wire `App.jsx`, build, verify

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Wire the components together**

`frontend/src/App.jsx` (replace the placeholder from Task 13):
```jsx
import { useState } from 'react';
import ProgramList from './components/ProgramList.jsx';
import UninstallModal from './components/UninstallModal.jsx';
import QuarantinePanel from './components/QuarantinePanel.jsx';

export default function App() {
  const [uninstallTarget, setUninstallTarget] = useState(null);
  const [showQuarantine, setShowQuarantine] = useState(false);

  return (
    <div className="app-shell">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>unrevo</div>
        <button className="btn-ghost" onClick={() => setShowQuarantine((v) => !v)}>
          {showQuarantine ? 'Programs' : 'Recently removed'}
        </button>
      </div>

      {showQuarantine
        ? <QuarantinePanel />
        : <ProgramList onUninstall={setUninstallTarget} />}

      {uninstallTarget && (
        <UninstallModal program={uninstallTarget} onClose={() => setUninstallTarget(null)} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify live, backend + frontend together**

Run: `cd backend && node src/index.js` (one terminal), then `cd frontend && npm run dev` (another terminal), then open the printed URL.
Expected: the real installed-program list renders, search filters it, clicking "Uninstall" on any row opens the modal at the confirm phase showing that program's name/publisher. **Do not click Uninstall through to completion here** — this genuinely runs a real uninstaller. Close the modal (Cancel) to confirm the flow reaches confirm-phase correctly, then Ctrl+C both servers.

- [ ] **Step 3: Verify the production build**

Run: `cd frontend && npm run build`
Expected: completes with no errors, `frontend/dist/index.html` and `frontend/dist/assets/*` exist.

- [ ] **Step 4: Commit**

```bash
cd frontend
git add src/App.jsx
git commit -m "feat(frontend): wire ProgramList, UninstallModal, QuarantinePanel into App"
git add dist
git commit -m "chore(frontend): build dist for packaging"
```

---

## Task 21: Scaffold `electron/`

**Files:**
- Create: `electron/package.json`
- Create: `electron/main.cjs`
- Create: `electron/electron-builder.config.cjs`

- [ ] **Step 1: Create the electron package**

`electron/package.json`:
```json
{
  "name": "unrevo-desktop",
  "version": "0.1.0",
  "private": true,
  "description": "unrevo desktop app",
  "main": "main.cjs",
  "scripts": {
    "start": "electron .",
    "dist": "electron-builder -c electron-builder.config.cjs"
  },
  "devDependencies": {
    "electron": "^31.0.0",
    "electron-builder": "^24.13.3"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `cd electron && npm install`
Expected: completes with no errors (Electron downloads its binary — this can take a few minutes on first install).

- [ ] **Step 3: Write the main process**

`electron/main.cjs`:
```js
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const http = require('node:http');
const { pathToFileURL } = require('node:url');

const BACKEND_PORT = 3101;

function backendEntryPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'backend', 'src', 'index.js')
    : path.join(__dirname, '..', 'backend', 'src', 'index.js');
}

/** Where quarantine/backup data lives — outside the install directory so
 * an app upgrade never deletes it. Same reasoning as Re:Route's own
 * dataDir.js: userData survives upgrades, an install-relative path
 * doesn't. */
function quarantineRoot() {
  return app.isPackaged ? path.join(app.getPath('userData'), 'quarantine') : null;
}

/** Starts the Express backend in-process (it's ESM, loaded via dynamic
 * import) — same pattern as Re:Route's electron/main.cjs. */
async function startBackend() {
  const quarantineDir = quarantineRoot();
  if (quarantineDir) process.env.UNREVO_QUARANTINE_ROOT = quarantineDir;
  const entry = pathToFileURL(backendEntryPath()).href;
  await import(entry); // side effect: calls server.listen()
}

/** Polls the backend until it answers, so the window doesn't load before
 * it's up. */
function waitForBackend(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get({ host: '127.0.0.1', port: BACKEND_PORT, path: '/api/health', timeout: 1500 }, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() > deadline) { reject(new Error('Backend did not start in time.')); return; }
        setTimeout(tryOnce, 300);
      });
      req.on('timeout', () => req.destroy());
    };
    tryOnce();
  });
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 560,
    title: 'unrevo',
    backgroundColor: '#09090b',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Dev-mode navigation to the Vite dev server can genuinely fail (started
  // `npm start` before `npm run dev` was ready, Vite still restarting after
  // an HMR crash, wrong port) — a bare, uncaught rejection here left NO
  // trace of why beyond the window's own static `title` staying "unrevo"
  // as a fallback, which reads as "it loaded" when it didn't. Logged, not
  // silently swallowed; packaged mode (loadFile, a local file that either
  // exists or the build is broken) doesn't need the same handling.
  if (app.isPackaged) {
    await win.loadFile(path.join(process.resourcesPath, 'frontend-dist', 'index.html'));
  } else {
    win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
      console.error(`Failed to load the dev server at http://localhost:5174 (${errorDescription}, code ${errorCode}). Is "npm run dev" running in frontend/?`);
    });
    await win.loadURL('http://localhost:5174').catch(() => {}); // the did-fail-load listener above already reports this
  }
}

app.whenReady().then(async () => {
  await startBackend();
  await waitForBackend();
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

- [ ] **Step 4: Write the electron-builder config**

`electron/electron-builder.config.cjs`:
```js
module.exports = {
  appId: 'com.jimman0i.unrevo',
  productName: 'unrevo',
  directories: { output: 'dist' },
  files: ['main.cjs'],
  extraResources: [
    { from: '../backend/src', to: 'backend/src' },
    { from: '../backend/node_modules', to: 'backend/node_modules' },
    { from: '../backend/package.json', to: 'backend/package.json' },
    { from: '../frontend/dist', to: 'frontend-dist' }
  ],
  win: { target: 'nsis' },
  nsis: { oneClick: false, allowToChangeInstallationDirectory: true }
};
```

- [ ] **Step 5: Verify it live in dev mode**

Run: `cd backend && node src/index.js` (one terminal), `cd frontend && npm run dev` (another), then `cd electron && npm start` (a third).
Expected: an Electron window opens titled "unrevo", showing the real program list (same content as the browser check in Task 20). Close it, then Ctrl+C the backend and frontend dev servers.

- [ ] **Step 6: Commit**

```bash
cd electron
git add package.json package-lock.json main.cjs electron-builder.config.cjs
git commit -m "feat(electron): in-process-backend shell, mirrors Re:Route's main.cjs pattern"
```

---

## Task 22: Manual smoke test (packaged build)

**Files:** none — verification only, matching the design spec's "no automated test ever uninstalls a real program" and Re:Route's own "verify in the packaged app, not only in tests" convention.

- [ ] **Step 1: Build the installer**

Run: `cd electron && npm run dist`
Expected: completes, produces an NSIS installer under `electron/dist/`.

- [ ] **Step 2: Install a disposable test program**

Install any small, easily-removable freeware app you don't otherwise need (not something real you rely on) — this is the one deliberately-disposable target the design spec calls for.

- [ ] **Step 3: Run the packaged app end to end**

Install and launch the built unrevo. Confirm:
- The program list shows the disposable test app you just installed.
- Clicking Uninstall on it runs through confirm → uninstalling (showing a real command) → scanning → reviewing.
- Selecting/deselecting leftover items and clicking "Remove selected" actually removes them, and the "Recently removed" panel shows the batch.
- Clicking Restore on that batch puts the files/registry keys back.

- [ ] **Step 4: Report results**

Note any failures found during this pass — this is the point at which real system behavior (not fixture data) first gets exercised end to end. Fix any issues found before considering Phase A done.

---

## Self-review

**Spec coverage:**
- Program list, standard uninstall, heuristic leftover scan, forced removal — Tasks 3–4, 5–6, 7–8, 9–11, 16–20. Covered.
- Quarantine + `.reg` export safety net (not System Restore alone) — Task 9, wired ahead of System Restore in Task 11. Covered.
- Best-effort System Restore checkpoint — Task 10, wired in Task 11. Covered.
- PowerShell-only system queries, no native npm modules — Task 2 (the one chokepoint), used by every other service. Covered.
- 3-registry-hive enumeration, Store/UWP apps out of scope — Task 3. Covered.
- Visual system (Prune tokens) — Task 14. Covered.
- Testing approach (fixtures for pure logic, real I/O for quarantine, sandboxed registry subtree, no automated real uninstalls) — Tasks 2, 3, 5, 7, 9, 22. Covered.
- File layout matching the design spec's tree — Tasks 1, 13, 21 create exactly those files. Covered.

**Placeholder scan:** none found — every step has real, complete code or an exact command with expected output.

**Type consistency:** `program.uninstallString`/`.name`/`.publisher` (from `normalizeProgram`, Task 3) match what `UninstallModal.jsx` (Task 18) reads. `scanResult.{files,registryKeys,scheduledTasks}.{ok,items}` (from `scanForLeftovers`, Task 7) match what `LeftoverReview.jsx` (Task 17) and `UninstallModal.jsx`'s `allItemKeys` (Task 18) read. `manifest.{batchDir,programName,createdAt,files,registryKeys,regFiles}` (from `quarantineAndDelete`, Task 9) match what `routes/quarantine.js` (Task 11) and `QuarantinePanel.jsx` (Task 19) read.

---

Plan complete and saved to `docs/superpowers/plans/2026-08-29-phase-a-uninstall-leftover-scan.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
