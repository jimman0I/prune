# Windows Defender and WinRAR cleaner rules: design

## Why

Compared against the user's own BleachBit setup: BleachBit ships a Windows Defender cleaner and a WinRAR cleaner (every option ticked in the user's config), and Prune's Deep Clean has no rules for either. Approved direction: **full BleachBit parity** for both. BleachBit is GPL, so only the factual locations below were taken from its `windows_defender.xml` / `winrar.xml`; every name and description here is written fresh.

## Rules

Two new categories, appended to the end of `backend/src/data/cleaners.json` (Deep Clean groups by first appearance, so they land at the bottom of the tree). Rule text stays English-only in cleaners.json, exactly like every other rule: `DeepCleanTree.jsx` renders `item.name`/`item.description`/`group.category` verbatim, none of it goes through `frontend/src/i18n/catalog.js`, so there are no catalog keys to add.

### Windows Defender (5 rules, mirroring BleachBit's 5 options)

`%CommonAppData%` is `%PROGRAMDATA%` in Prune's token set; `%WinDir%` is `%WINDIR%`. `D` below is `%PROGRAMDATA%\Microsoft\Windows Defender`.

| id | name | risky | recommended | paths |
|---|---|---|---|---|
| `defender_history` | Scan history | no | **false** | `D\Scans\History\Results\Quick`, `D\Scans\History\Results\Resource`, `D\Scans\History\Service\History.Log` |
| `defender_temp` | Temporary files | no | true | `%WINDIR%\Temp\MpCmdRun.log`, `%WINDIR%\Temp\MpSigStub.log`, `%WINDIR%\SoftwareDistribution\Download\Install\` + `mpas-d.exe`, `mpas-fe.exe`, `mpas-fe_bd.exe`, `AS_Engine.exe`, `AS_Engine_Patch_*.exe`, `AS_Base.exe`, `AS_Base_Patch*.exe`, `AS_Delta.exe`, `AS_Delta_Patch_*.exe`, and `D\Definition Updates\Updates` |
| `defender_quarantine` | Quarantined files | **yes** | false | `D\Quarantine` |
| `defender_backup` | Definition backup | **yes** | false | `D\Definition Updates\Backup` |
| `defender_logs` | Logs | no | true | `D\Scans\History\Service\Detections.log`, `D\Scans\History\Service\History.Log`, `D\Scans\History\Service\Unknown.Log`, `D\Support\MPLog-*.log` |

Descriptions (plain language, what goes and what it costs):

- **Scan history** -- "Stored results of past Defender scans and the log that lists them. Protection is unaffected; Defender starts a new record with its next scan."
- **Temporary files** -- "Update installers and logs Defender leaves behind in Windows' temp and update folders once it has used them."
- **Quarantined files** -- "Files Defender caught and locked away. Quarantine is how Defender gives back a file it flagged by mistake -- once this is cleared, a false positive can never be restored."
- **Definition backup** -- "The previous set of virus definitions, kept so Defender can roll back a bad update. A new backup arrives with the next update, but until then there is nothing to roll back to."
- **Logs** -- "Defender's own service and diagnostic logs. Only useful when troubleshooting Defender itself; it writes new ones as it runs."

### WinRAR (2 rules)

| id | name | risky | recommended | action(s) |
|---|---|---|---|---|
| `winrar_history` | History | no | **false** | `winreg` keys `HKCU\Software\WinRAR\ArcHistory`, `HKCU\Software\WinRAR\DialogEditHistory\{ArcName, ArcCmtName, ExtrPath, FindArcNames, FindNames, FindText, WizArcName}`, `HKCU\Software\WinRAR SFX`; `winreg` VALUES `HKCU\Software\WinRAR\General` : `LastFolder` and `HKCU\Software\WinRAR\General\Info` : `CommentFile` |
| `winrar_temp` | Temporary files | no | true | `%LOCALAPPDATA%\VirtualStore\Program Files*\WinRAR\**\*.tmp`, `%PROGRAMFILES%\WinRAR\**\*.tmp`, `%PROGRAMFILES(X86)%\WinRAR\**\*.tmp` |

- **History** -- "WinRAR's remembered archive names, extract-to folders and search terms. The archives themselves are not touched."
- **Temporary files** -- "Temp files WinRAR left behind in its own program folder. Archives and settings are untouched."

`is_safe` follows the existing convention: `false` on the two risky rules, `true` on the rest.

### Decisions on `recommended`

The design fixed Quarantine and Backup as risky + not recommended. For the rest, the project's own pinned rules in `cleanerRules.test.js` decide it ("never recommends a rule that loses something the user can see"; `recent_items_jumplists` is the precedent for a history trace):

- `defender_history` and `winrar_history`: **not recommended** -- both are history a user can see (WinRAR's drop-downs, Defender's scan records). Not marked risky, per the approved design.
- `defender_temp`, `defender_logs`, `winrar_temp`: recommended -- leftover installers and diagnostic logs, the same class as `windows_cbs_logs` / `malwarebytes_logs`.

The "recommends more than half" pin stays satisfied (50 of 87).

### No `requiresProgram`

Deliberately not added. That gate is scoped to the 8 game/launcher rules; Defender is part of Windows, and WinRAR's registry history only exists if WinRAR was installed.

### Admin

Every Defender folder under `%PROGRAMDATA%` is access-denied to an unelevated process (measured on this machine). That surfaces through the existing scan-time `accessible: false` -> "needs admin" path; no rule flag. See engine change 2 for the one fix that makes it surface correctly.

## Engine changes (each the smallest correct extension, each with tests)

Grounded by reading `cleanerRules.js`, `cleanerActions/delete.js`, `cleanerActions/winreg.js` and `services/quarantine.js`.

### 1. Recursive `**` path segment (delete.js `resolveGlob`)

BleachBit's WinRAR temp option walks the whole folder for `*.tmp`. `resolveGlob` supported one `*` wildcard per segment (so `Program Files*` already works) but no recursion: `WinRAR\*.tmp` only matched the top level. Added: a segment that is exactly `**` matches zero or more directory levels. Directory symlinks/junctions are not followed (Dirent `isDirectory()` is false for them), so a junction loop cannot recurse forever. A trailing `**` resolves to its base path (which `collectFiles` already walks recursively). Rather than silently dropping BleachBit's recursive search, this is the extension.

Known imprecision, accepted: `**\*.tmp` also matches a *directory* named `something.tmp` (and would then collect its contents). BleachBit's walk matches files only. Not worth a file-only mode for a program folder that has never contained such a directory.

### 2. Access-denied means present (cleanerRules.js `rulePathsExistFor`)

`existsSync` returns `false` on `EPERM`. Measured unelevated: `...\Scans\History\Results\Quick` stats as `EPERM`, so `existsSync` says it does not exist -- the Defender history rule scanned as `present: false` + `accessible: false`, which dims the row and makes "hide cleaners that don't apply" hide it entirely, instead of showing "needs admin". Fixed: a path whose `stat` fails with `EPERM`/`EACCES` counts as present (Windows only answers "access denied" for something that is there to deny). This is the same `isAccessDenied` rule `collectFiles` already uses for `accessible`.

### 3. `rulePathsExist` walks actions-form rules (cleanerRules.js)

Found while grounding: `rulePathsExist` (used by `GET /api/deep-clean/rules`, the pre-scan tree) only read `rule.paths`, so every `actions`-form rule -- the browser history/cookie/autofill rules, and the new `winrar_history` -- reported `present: false` before a scan and was hidden when "hide cleaners that don't apply" was on. Fixed by walking `normalizeRule(rule).actions`: `delete` paths and single-`path` bespoke actions are checked the same way the scan checks them; `shell` and `winreg` count as present (not cheaply measurable; the pre-scan list keeps an unmeasured rule rather than hiding it, per `visibleRules.js`'s own contract). Pre-existing bug; fixed here because the new WinRAR history rule depends on it.

### 4. `winreg` action: single values, real scan-time presence, one batch per rule (winreg.js, cleanerRules.js)

- **Values.** The action gains an optional `value` field: `{ "type": "winreg", "key": "...", "value": "LastFolder" }` removes only that value. `quarantineAndDelete` already accepts `{ path, valueName }` registry targets (added for startup entries): it exports the whole key to a `.reg` first (restore merges it back) and runs `reg delete <key> /v <value> /f`. Scan checks `reg query <key> /v <value>`. A missing key or value is "not present", never an error.
- **Scan-time presence.** `scanRule` used to report every `winreg` action as `present: true` unconditionally (its own comment said to revisit "if a future rule needs an accurate pre-scan presence check for a registry-only rule" -- `winrar_history` is that rule). Now a synchronous `reg query` per action (`winreg.scanSync`), short-circuiting once one is found. Cost measured on this machine: ~45 ms per `reg.exe` spawn, so at worst ~0.5 s for WinRAR's 11 targets inside a scan that already takes tens of seconds. `/rules` does not pay it (see change 3).
- **One quarantine batch per rule.** `executeRule` used to call `winreg.execute` once per action, i.e. one quarantine batch per key: eleven "Deep Clean: History" batches in the Quarantine screen for one rule, with only the last reported back, and two batches created in the same millisecond would share a directory name and overwrite each other's `registry-0.reg` + `manifest.json` (batch dirs are named `${Date.now()}-${name}`). Now all of a rule's `winreg` actions are resolved together and removed through ONE `quarantineAndDelete` call (`winreg.executeAll`). `registryKeysRemoved` counts keys and values alike.

A `winreg`-only rule still has no byte size (`sizeBytes: null`), exactly like the DNS-flush command rule: the tree shows a dash and, like that rule, never reveals its description (the description is gated on a measured size). Accepted as the existing behavior for unmeasurable rules; the scan log shows "nothing to measure".

## Category icons

`cleanerCategoryIcons.test.js` requires every category to declare an icon source in `backend/src/data/cleanerIcons.json`:

- **Windows Defender**: `%SYSTEMROOT%\System32\SecurityHealthSystray.exe` (the blue Windows Security shield -- extracted and checked on this machine), then `%PROGRAMFILES%\Windows Defender\MpCmdRun.exe` as fallback.
- **WinRAR**: `%PROGRAMFILES%\WinRAR\WinRAR.exe`, `%PROGRAMFILES(X86)%\WinRAR\WinRAR.exe`.

## BleachBit paths: support status

Every BleachBit path in both cleaners is supported. Deliberate differences:

- **Superset:** `%PROGRAMFILES(X86)%\WinRAR` is added to the temp rule alongside `%PROGRAMFILES%\WinRAR`. BleachBit already wildcards `Program Files*` for the VirtualStore copy precisely because WinRAR can be the 32-bit build; the install folder gets the same treatment.
- **Overlap, kept for parity:** `defender_temp`'s `SoftwareDistribution\Download\Install\*` files are also inside the existing `windows_update_leftovers` rule, and `MpSigStub.log`/`MpCmdRun.log` inside `windows_system_temp`; `Service\History.Log` is in both `defender_history` and `defender_logs` (as in BleachBit). Clean is safe with overlaps -- the first rule moves a file, the second finds it gone -- but a scan total can count an overlapping file twice. That was already true of `windows_cbs_logs`/`windows_servicing_logs` (both list `Logs\DISM`).
- **Known limitation, pre-existing, not fixed:** a glob segment under a directory that refuses listing (`Support\MPLog-*.log` unelevated) resolves to no matches without reporting a denial. It does not change any result here: the same `defender_logs` rule's `Scans\History\Service\*` files are themselves denied, so the rule still reports "needs admin".
- **Unverified:** whether an elevated Prune can actually move files out of Defender's folders while Tamper Protection is on. Reading works elevated (measured). Moving needs a UAC prompt and touches protected files, so it is left to an end-to-end check by a person; if Tamper Protection refuses, the existing per-file "locked or inaccessible" skip path reports it rather than failing the clean.

## Real machine state (read-only, 2026-09-24, unelevated)

- `%WINDIR%\Temp\MpSigStub.log` exists, 154 KB; `MpCmdRun.log` absent.
- Every folder under `%PROGRAMDATA%\Microsoft\Windows Defender\Scans\History` is `EPERM` (stat and list); `Quarantine`, `Definition Updates\Backup`, `Support` exist but refuse listing; `Definition Updates\Updates` is listable and empty.
- WinRAR installed at `C:\Program Files\WinRAR`. Of the 11 history targets only `HKCU\Software\WinRAR\General` : `LastFolder` exists; `DialogEditHistory` exists but holds only `DictSize` (not a BleachBit target), and `ArcHistory`, `WinRAR SFX` and `General\Info` : `CommentFile` are absent.

## Testing

- `**`: zero-level and multi-level matches, case-insensitive `*.TMP`, trailing `**`, no match -> nothing, junction not followed.
- Presence: an `EPERM` path counts as present (mocked `statSync`), and scans as present + `accessible: false`; `rulePathsExist` on an actions-form rule with a `delete` action, a bespoke `path` action, a `winreg` action.
- `winreg`: value present/absent scan (sync and async) against a real per-process HKCU test key; value delete removes only that value and leaves a sibling; `executeAll` produces exactly one quarantine batch for several targets, reports 0 and creates no batch when nothing is present; `scanRule` reports a `winreg`-only rule `present: false` when none of its keys exist.
- Rule data: the 7 ids exist with the categories, risky/recommended flags above; every path passes the existing structural tests (no unexpanded token, no bare drive letter); icon map covers both categories.
- Real read-only scan of the 7 rules on this machine through `scanRule` (no execute).
