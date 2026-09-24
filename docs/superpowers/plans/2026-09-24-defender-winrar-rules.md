# Windows Defender and WinRAR Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add BleachBit-parity Deep Clean rules for Windows Defender (5) and WinRAR (2), plus the four small engine extensions they need.

**Spec:** `docs/superpowers/specs/2026-09-24-defender-winrar-rules-design.md`

**Architecture:** Rules are data in `backend/src/data/cleaners.json`. Engine changes stay inside the existing action modules: `resolveGlob` gains a `**` segment (delete.js), presence treats access-denied as present and `rulePathsExist` walks `actions` (cleanerRules.js), the `winreg` action gains single-value support, sync scan-time presence, and one quarantine batch per rule (winreg.js + cleanerRules.js). No frontend change: rule text is rendered verbatim from cleaners.json, not through the i18n catalog.

**Tech Stack:** Node.js ESM backend, Vitest, real `reg.exe` against per-process HKCU test keys.

**Standing rules for every task:** work directly on `master`; NO `Co-Authored-By` or any AI attribution line in commits; do not push or tag; do not touch CHANGELOG.md or version numbers. Run one backend test file at a time where reg.exe is involved (CONTRIBUTING.md). Use the Write/Edit tools for any file containing backslashes (bash heredocs halve them). Known unelevated failures to ignore: 3 tests in `src/services/pendingReboot.test.js` / `src/services/quarantine.test.js`.

---

### Task 1: Recursive `**` path segment

**Files:** Modify `backend/src/lib/cleanerActions/delete.js`; Test `backend/src/lib/cleanerRules.test.js`

- [ ] **Step 1: failing tests** -- add a `describe('recursive ** glob segment', ...)` block to `cleanerRules.test.js` (uses the file's existing `appDataDir` fixture and `%APPDATA%` expansion, driven through `scanRule`):
  1. `%APPDATA%\\rartest\\**\\*.tmp` with files `a.tmp` (top level), `sub\\b.TMP`, `sub\\deep\\c.tmp`, plus non-matching `keep.txt`, `sub\\keep.dat`: `fileCount` 3, `sizeBytes` = sum of the three, `present` true. (Zero-level, multi-level, case-insensitive.)
  2. Same folder with only non-matching files: `fileCount` 0, `present` false.
  3. Trailing `**` (`%APPDATA%\\rartest\\**`) counts every file under the folder, each once (no duplicates).
  4. A directory junction inside the tree (`fs.symlinkSync(outsideDir, join(tree, 'link'), 'junction')`, with `outsideDir` holding `x.tmp`) is NOT followed: `x.tmp` is not counted.
  5. Combined with a `*` segment: `%APPDATA%\\VirtualStore\\Program Files*\\WinRAR\\**\\*.tmp` finds a `.tmp` under both `Program Files\\WinRAR\\` and `Program Files (x86)\\WinRAR\\sub\\`.
- [ ] **Step 2:** run `npx vitest run src/lib/cleanerRules.test.js` in `backend/` -- the new tests fail.
- [ ] **Step 3: implement** in `delete.js`:

```js
export function resolveGlob(basePath, segments) {
  if (segments.length === 0) return [basePath];
  const [segment, ...rest] = segments;
  if (segment === '**') return resolveRecursive(basePath, rest);
  // ...existing body unchanged...
}

/** `**` -- zero or more directory levels, then `rest`. Only real
 * directories are descended into: a Dirent for a symlink or junction
 * reports isDirectory() false, so a junction loop can't recurse forever.
 * A trailing `**` is just its base path -- collectFiles already walks a
 * directory recursively, and expanding it here would list every file twice. */
function resolveRecursive(basePath, rest) {
  if (rest.length === 0) return [basePath];
  const matches = resolveGlob(basePath, rest);
  let entries;
  try {
    entries = readdirSync(basePath, { withFileTypes: true });
  } catch {
    return matches;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) matches.push(...resolveRecursive(join(basePath, entry.name), rest));
  }
  return matches;
}
```

  Update `resolveGlob`'s doc comment to mention the `**` segment.
- [ ] **Step 4:** the file's tests pass; then the full backend suite (`npx vitest run` in `backend/`) shows only the 3 known failures.
- [ ] **Step 5: commit** `feat(cleanerRules): support a recursive ** segment in rule paths`

### Task 2: Presence -- access-denied counts as present; `rulePathsExist` walks actions

**Files:** Modify `backend/src/lib/cleanerRules.js`; Test `backend/src/lib/cleanerRules.test.js`

- [ ] **Step 1: failing tests**
  1. `scanRule` on `{ id: 'denied', paths: ['%APPDATA%\\Denied\\Quick'] }` where the folder is NOT created but `vi.spyOn(fs, 'statSync')` throws `EPERM` (`Object.assign(new Error('EPERM'), { code: 'EPERM' })`) for exactly that path (call through otherwise): `present` true, `accessible` false, `sizeBytes` 0. (Real case: Defender's `Scans\History\Results\Quick` stats EPERM unelevated and `existsSync` returns false.)
  2. `rulePathsExist` on the same rule with the same spy: true. With `ENOENT` (no spy, folder absent): false.
  3. `rulePathsExist` on an actions-form rule: `{ id: 'a', actions: [{ type: 'delete', paths: ['%APPDATA%\\ActDir'] }] }` true when the folder exists, false when not; `{ actions: [{ type: 'chrome.history', path: '%APPDATA%\\Prof\\*\\History' }] }` true when `Prof\\Default\\History` exists as a file, false when not; `{ actions: [{ type: 'winreg', key: 'HKCU\\Software\\Nothing-here' }] }` true (unmeasured, kept visible); `{ actions: [{ type: 'shell', command: 'x' }] }` true.
  4. Existing `requiresProgram` gate tests keep passing unchanged.
- [ ] **Step 2:** run the file -- new tests fail.
- [ ] **Step 3: implement** in `cleanerRules.js`: add `statSync` to the `node:fs` import, and

```js
/** Whether a resolved path is there, counting "access denied" as there.
 * existsSync() returns false on EPERM, but Windows only answers "access
 * denied" for something that exists to deny -- Defender's scan-history
 * folders stat as EPERM to an unelevated process, and reading that as
 * "not installed" dimmed the row and let "hide cleaners that don't apply"
 * hide it, instead of showing "needs admin". Same EPERM/EACCES rule
 * collectFiles already uses for `accessible`. */
function pathExistsOrDenied(path) {
  try {
    statSync(path);
    return true;
  } catch (err) {
    return err?.code === 'EPERM' || err?.code === 'EACCES';
  }
}
```

  `rulePathsExistFor` uses `.some(pathExistsOrDenied)` instead of `.some((match) => existsSync(match))` (drop `existsSync` from the import if now unused). Rewrite `rulePathsExist`'s body after the `command`/`requiresProgram` guards:

```js
  for (const action of normalizeRule(rule).actions) {
    // Neither can be answered from the filesystem, and the pre-scan list
    // keeps an unmeasured rule rather than hiding it (visibleRules.js).
    if (action.type === 'shell' || action.type === 'winreg') return true;
    const rawPaths = action.type === 'delete' ? action.paths : [action.path];
    for (const rawPath of rawPaths || []) {
      if (rawPath && rulePathsExistFor(expandPath(rawPath))) return true;
    }
  }
  return false;
```

  Extend `rulePathsExist`'s doc comment: it used to read only `rule.paths`, so every actions-form rule (browser history/cookie/autofill) was reported absent before a scan and hidden by "hide cleaners that don't apply".
- [ ] **Step 4:** file passes; full backend suite shows only the 3 known failures (check `src/routes/deepClean*.test.js` especially).
- [ ] **Step 5: commit** `fix(cleanerRules): count access-denied paths as present, check actions-form rules before a scan`

### Task 3: `winreg` values, scan-time presence, one batch per rule

**Files:** Modify `backend/src/lib/cleanerActions/winreg.js`, `backend/src/lib/cleanerRules.js`; Test `backend/src/lib/cleanerActions/winreg.test.js`, `backend/src/lib/cleanerRules.test.js`

Background: `services/quarantine.js`'s `quarantineAndDelete` already accepts a registry target as either a key string or `{ path, valueName }`; for a value it exports the whole key to `.reg` and runs `reg delete <key> /v <value> /f`, and skips the protected-key check (that check is for whole keys). Batch dirs are named `${Date.now()}-${name}`, so two batches in one millisecond collide -- another reason to use one batch per rule.

- [ ] **Step 1: failing tests** in `winreg.test.js` (existing fixture: `TEST_KEY` with value `Marker`; scratch `UNREVO_QUARANTINE_ROOT`; `afterEach` already `reg delete TEST_KEY /f`, which removes subkeys too):
  1. `scan({ expandedKey: TEST_KEY, value: 'Marker' })` -> `{ present: true }`; `value: 'Nope'` -> `{ present: false }`; value on a missing key -> `{ present: false }`.
  2. `scanSync` gives the same three answers, plus key-only present/absent.
  3. `execute({ expandedKey: TEST_KEY, value: 'Marker' })` with a second value `Other` added first: `registryKeysRemoved` 1, `reg query TEST_KEY /v Marker` now fails, `reg query TEST_KEY /v Other` still succeeds, `quarantineBatch` holds a `.reg`.
  4. `executeAll([{ expandedKey: `${TEST_KEY}\\A` }, { expandedKey: `${TEST_KEY}\\B` }, { expandedKey: TEST_KEY, value: 'Marker' }, { expandedKey: `${TEST_KEY}\\Missing` }], 'Test Rule')` (A and B created first): `registryKeysRemoved` 3, and `readdir(scratchDir)` has exactly ONE entry (one batch).
  5. `executeAll` where nothing is present: `{ freedBytes: 0, registryKeysRemoved: 0, skipped: [] }` and `readdir(scratchDir)` is empty (no batch created).
  In `cleanerRules.test.js` (use a per-process key `HKCU\\Software\\prune-rules-winreg-${process.pid}`, cleaned up in `finally`):
  6. `scanRule` of a winreg-only rule whose keys don't exist -> `present: false`, `sizeBytes: null`.
  7. Same rule where only the SECOND action's key exists -> `present: true`.
  8. A rule with a value action (`{ type: 'winreg', key, value: 'V' }`) scans present only when that value exists.
  9. `executeRule` of a rule with two winreg actions (two existing subkeys) -> `registryKeysRemoved` 2 and exactly one directory in `quarantineDir`.
- [ ] **Step 2:** run each file -- new tests fail.
- [ ] **Step 3: implement `winreg.js`**

```js
import { execFile, execFileSync } from 'node:child_process';
// ...
function queryArgs({ expandedKey, value }) {
  return value ? ['query', expandedKey, '/v', value] : ['query', expandedKey];
}

export async function scan(action) {        // keep the doc comment; mention `value`
  try { await execFileAsync('reg', queryArgs(action)); return { present: true }; }
  catch { return { present: false }; }
}

/** scan(), synchronously -- for scanRule, which is synchronous by design
 * (it runs inside the rule-at-a-time streaming loop). ~45 ms per call. */
export function scanSync(action) {
  try { execFileSync('reg', queryArgs(action), { stdio: 'ignore', windowsHide: true }); return { present: true }; }
  catch { return { present: false }; }
}

/** quarantineAndDelete's two target spellings: a bare key string, or
 * { path, valueName } for one value inside a key. */
function toRegistryTarget({ expandedKey, value }) {
  return value ? { path: expandedKey, valueName: value } : expandedKey;
}
function describeTarget(entry) {
  return typeof entry === 'string' ? entry : `${entry.path} [${entry.valueName}]`;
}

/** Every winreg action of ONE rule, removed through ONE quarantine batch. */
export async function executeAll(actions, ruleName) {
  const present = [];
  for (const action of actions) {
    if ((await scan(action)).present) present.push(action);
  }
  if (present.length === 0) return { freedBytes: 0, registryKeysRemoved: 0, skipped: [] };

  const manifest = await quarantineAndDelete({
    programName: `Deep Clean: ${ruleName}`,
    files: [],
    registryKeys: present.map(toRegistryTarget)
  });
  return {
    freedBytes: 0,
    registryKeysRemoved: manifest.registryKeys.length,
    quarantineBatch: manifest.batchDir,
    skipped: manifest.failedRegistryKeys.map((entry) => ({ path: describeTarget(entry), reason: 'protected or could not be removed' }))
  };
}

export async function execute(action, ruleName) {
  return executeAll([action], ruleName);
}
```

  Keep/adapt the existing long doc comment on `execute` (move the substance to `executeAll`; note registryKeysRemoved counts keys and values alike).
- [ ] **Step 4: wire `cleanerRules.js`**
  - `scanRule` winreg branch replaces the unconditional `present = true` (and its "Revisit if..." comment) with:

```js
    } else if (action.type === 'winreg') {
      // A real check now: a winreg-only rule (WinRAR's history) must be
      // able to say "not on this machine". Synchronous reg.exe, ~45 ms a
      // call, skipped once anything in the rule is already present.
      if (!present && winregAction.scanSync({ expandedKey: expandPath(action.key), value: action.value }).present) present = true;
    }
```

  - `executeRule`: remove the per-action `winreg` branch from the loop; after the loop:

```js
  // All of a rule's registry targets go through ONE quarantine batch --
  // one Quarantine entry per rule, like a delete action's files, and no
  // two same-millisecond batches sharing a directory name.
  const winregActions = normalized.actions.filter((action) => action.type === 'winreg');
  if (winregActions.length > 0) {
    const result = await winregAction.executeAll(
      winregActions.map((action) => ({ expandedKey: expandPath(action.key), value: action.value })),
      rule.name
    );
    freedBytes += result.freedBytes;
    registryKeysRemoved = (registryKeysRemoved || 0) + result.registryKeysRemoved;
    skipped.push(...result.skipped);
    if (result.quarantineBatch) quarantineBatch = result.quarantineBatch;
  }
```

  - Update the `executeRule` doc bullet for `winreg` ("removes the rule's registry keys and single values through one quarantine batch").
- [ ] **Step 5:** `winreg.test.js` and `cleanerRules.test.js` pass (run separately); full backend suite shows only the 3 known failures.
- [ ] **Step 6: commit** `feat(winreg): remove single registry values, check presence at scan time, one quarantine batch per rule`

### Task 4: The seven rules, their icons, and the README count

**Files:** Modify `backend/src/data/cleaners.json`, `backend/src/data/cleanerIcons.json`, `README.md`; Test `backend/src/lib/cleanerRules.test.js`

- [ ] **Step 1: failing tests** in `cleanerRules.test.js`:
  - `describe('Windows Defender and WinRAR rules')`: each of the 7 ids exists with the category, `risky`, `recommended` and `is_safe` from the table below; `defender_quarantine`/`defender_backup` are `risky: true`, `recommended: false`, and their descriptions mention restoring / rolling back; no new rule carries `requiresProgram`; `winrar_history` has exactly 11 `winreg` actions -- the 9 keys and the 2 `{ key, value }` pairs listed below; `winrar_temp`'s paths use `**\\*.tmp`.
  - Extend `never recommends a rule that loses something the user can see` with `defender_history` and `winrar_history`.
  - (The existing structural tests -- no unexpanded token, no bare drive letter, `recommended` boolean everywhere, >half recommended, icon map covers every category -- will also exercise the new data.)
- [ ] **Step 2:** run -- fails.
- [ ] **Step 3: append to `cleaners.json`** (after `user_temp`, the current last rule), exactly:

```json
  {
    "id": "defender_history",
    "category": "Windows Defender",
    "name": "Scan history",
    "description": "Stored results of past Defender scans and the log that lists them. Protection is unaffected; Defender starts a new record with its next scan.",
    "paths": [
      "%PROGRAMDATA%\\Microsoft\\Windows Defender\\Scans\\History\\Results\\Quick",
      "%PROGRAMDATA%\\Microsoft\\Windows Defender\\Scans\\History\\Results\\Resource",
      "%PROGRAMDATA%\\Microsoft\\Windows Defender\\Scans\\History\\Service\\History.Log"
    ],
    "is_safe": true,
    "recommended": false
  },
  {
    "id": "defender_temp",
    "category": "Windows Defender",
    "name": "Temporary files",
    "description": "Update installers and logs Defender leaves behind in Windows' temp and update folders once it has used them.",
    "paths": [
      "%WINDIR%\\Temp\\MpCmdRun.log",
      "%WINDIR%\\Temp\\MpSigStub.log",
      "%WINDIR%\\SoftwareDistribution\\Download\\Install\\mpas-d.exe",
      "%WINDIR%\\SoftwareDistribution\\Download\\Install\\mpas-fe.exe",
      "%WINDIR%\\SoftwareDistribution\\Download\\Install\\mpas-fe_bd.exe",
      "%WINDIR%\\SoftwareDistribution\\Download\\Install\\AS_Engine.exe",
      "%WINDIR%\\SoftwareDistribution\\Download\\Install\\AS_Engine_Patch_*.exe",
      "%WINDIR%\\SoftwareDistribution\\Download\\Install\\AS_Base.exe",
      "%WINDIR%\\SoftwareDistribution\\Download\\Install\\AS_Base_Patch*.exe",
      "%WINDIR%\\SoftwareDistribution\\Download\\Install\\AS_Delta.exe",
      "%WINDIR%\\SoftwareDistribution\\Download\\Install\\AS_Delta_Patch_*.exe",
      "%PROGRAMDATA%\\Microsoft\\Windows Defender\\Definition Updates\\Updates"
    ],
    "is_safe": true,
    "recommended": true
  },
  {
    "id": "defender_quarantine",
    "category": "Windows Defender",
    "name": "Quarantined files",
    "description": "Files Defender caught and locked away. Quarantine is how Defender gives back a file it flagged by mistake -- once this is cleared, a false positive can never be restored.",
    "paths": [
      "%PROGRAMDATA%\\Microsoft\\Windows Defender\\Quarantine"
    ],
    "is_safe": false,
    "risky": true,
    "recommended": false
  },
  {
    "id": "defender_backup",
    "category": "Windows Defender",
    "name": "Definition backup",
    "description": "The previous set of virus definitions, kept so Defender can roll back a bad update. A new backup arrives with the next update, but until then there is nothing to roll back to.",
    "paths": [
      "%PROGRAMDATA%\\Microsoft\\Windows Defender\\Definition Updates\\Backup"
    ],
    "is_safe": false,
    "risky": true,
    "recommended": false
  },
  {
    "id": "defender_logs",
    "category": "Windows Defender",
    "name": "Logs",
    "description": "Defender's own service and diagnostic logs. Only useful when troubleshooting Defender itself; it writes new ones as it runs.",
    "paths": [
      "%PROGRAMDATA%\\Microsoft\\Windows Defender\\Scans\\History\\Service\\Detections.log",
      "%PROGRAMDATA%\\Microsoft\\Windows Defender\\Scans\\History\\Service\\History.Log",
      "%PROGRAMDATA%\\Microsoft\\Windows Defender\\Scans\\History\\Service\\Unknown.Log",
      "%PROGRAMDATA%\\Microsoft\\Windows Defender\\Support\\MPLog-*.log"
    ],
    "is_safe": true,
    "recommended": true
  },
  {
    "id": "winrar_history",
    "category": "WinRAR",
    "name": "History",
    "description": "WinRAR's remembered archive names, extract-to folders and search terms. The archives themselves are not touched.",
    "actions": [
      { "type": "winreg", "key": "HKCU\\Software\\WinRAR\\ArcHistory" },
      { "type": "winreg", "key": "HKCU\\Software\\WinRAR\\DialogEditHistory\\ArcName" },
      { "type": "winreg", "key": "HKCU\\Software\\WinRAR\\DialogEditHistory\\ArcCmtName" },
      { "type": "winreg", "key": "HKCU\\Software\\WinRAR\\DialogEditHistory\\ExtrPath" },
      { "type": "winreg", "key": "HKCU\\Software\\WinRAR\\DialogEditHistory\\FindArcNames" },
      { "type": "winreg", "key": "HKCU\\Software\\WinRAR\\DialogEditHistory\\FindNames" },
      { "type": "winreg", "key": "HKCU\\Software\\WinRAR\\DialogEditHistory\\FindText" },
      { "type": "winreg", "key": "HKCU\\Software\\WinRAR\\DialogEditHistory\\WizArcName" },
      { "type": "winreg", "key": "HKCU\\Software\\WinRAR SFX" },
      { "type": "winreg", "key": "HKCU\\Software\\WinRAR\\General", "value": "LastFolder" },
      { "type": "winreg", "key": "HKCU\\Software\\WinRAR\\General\\Info", "value": "CommentFile" }
    ],
    "is_safe": true,
    "recommended": false
  },
  {
    "id": "winrar_temp",
    "category": "WinRAR",
    "name": "Temporary files",
    "description": "Temp files WinRAR left behind in its own program folder. Archives and settings are untouched.",
    "paths": [
      "%LOCALAPPDATA%\\VirtualStore\\Program Files*\\WinRAR\\**\\*.tmp",
      "%PROGRAMFILES%\\WinRAR\\**\\*.tmp",
      "%PROGRAMFILES(X86)%\\WinRAR\\**\\*.tmp"
    ],
    "is_safe": true,
    "recommended": true
  }
```

- [ ] **Step 4: icons** -- add to `cleanerIcons.json` after `"Developer tools"` (mind the trailing comma):

```json
  "Windows Defender": [
    "%SYSTEMROOT%\\System32\\SecurityHealthSystray.exe",
    "%PROGRAMFILES%\\Windows Defender\\MpCmdRun.exe"
  ],
  "WinRAR": [
    "%PROGRAMFILES%\\WinRAR\\WinRAR.exe",
    "%PROGRAMFILES(X86)%\\WinRAR\\WinRAR.exe"
  ]
```

- [ ] **Step 5: README** -- `README.md` Deep Clean blurb: `74 rules across 29 categories` -> `87 rules across 31 categories` (verify by counting the real file: rules and distinct categories).
- [ ] **Step 6:** `cleanerRules.test.js` and `src/services/cleanerCategoryIcons.test.js` pass; full backend suite shows only the 3 known failures.
- [ ] **Step 7: commit** `feat(cleaners): add Windows Defender and WinRAR rules`

### After all tasks (controller)

- Frontend suite (`frontend/`, `npx vitest run`, expect 1139/1139) and electron suite (`cd electron && node --test "*.test.cjs"`, 35/35) -- neither should be affected; run to prove it.
- Real read-only scan of the 7 rules on this machine via `scanRule` + `rulePathsExist` (never `executeRule`), reported per rule.
