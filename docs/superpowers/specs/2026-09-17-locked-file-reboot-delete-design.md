# Aggressive-Uninstaller Analysis + Locked-File Reboot-Delete: Design

## Why this doc exists

Requested: a technical breakdown of how an aggressive Windows uninstaller (Revo Uninstaller Pro-class) works — heuristic leftover scanning, registry traversal, locked-file bypass, MSI interaction — with an API map, control-flow graph, and pseudocode, to guide rewriting Prune's own uninstaller.

No proprietary binary was analyzed and none exists to analyze here. What follows is (a) the standard, publicly-documented Win32/MSI mechanism every tool in this category uses for each of the four vectors, and (b) an honest diff against what `C:\Games\shortcuts\lol\prune\backend\src\services\{leftoverScan,registryLeftovers,quarantine,preUninstall,silentUninstall}.js` already do. Three of the four vectors are already implemented to a standard matching or exceeding what's described below. The fourth — locked-file bypass — is a real, currently-missing capability, and is what this doc's implementation section actually builds.

## API Hook Map

| Vector | APIs a real implementation uses | Prune's equivalent |
|---|---|---|
| Heuristic file scan | `FindFirstFileW`/`FindNextFileW` (or `.NET`/PowerShell `Get-ChildItem`, same underlying `NtQueryDirectoryFile`) walking `%ProgramFiles%`, `%ProgramFiles(x86)%`, `%APPDATA%`, `%LOCALAPPDATA%`, `%ProgramData%`, Start Menu | `leftoverScan.js`'s `scanFiles()` — PowerShell `Get-ChildItem -Directory` over the same 7 roots (`SEARCH_ROOTS`), filtered by `leftoverPattern.js`'s word-boundary regex |
| Registry traversal | `RegOpenKeyExW`, `RegEnumKeyExW` (recursive), `RegEnumValueW`, `RegQueryValueExW` over `HKCU\Software`, `HKLM\Software`, and both `...\Uninstall` keys (32/64-bit views) | `registryLeftovers.js`'s `buildRegistryScript()` — a single PowerShell script walking the same roots via `Get-ChildItem -Recurse`, with `isProtectedKey()` refusing anything shallower than 3 segments or on an explicit OS-critical list |
| Locked-file bypass | `CreateFileW` (to detect a sharing violation), `MoveFileExW` with `MOVEFILE_DELAY_UNTIL_REBOOT` (writes to `HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\PendingFileRenameOperations`, a `REG_MULTI_SZ` of `\??\<source>` / `""` pairs the kernel replays at the next boot, before any user session starts) | **None** — `cleanerRules.js`'s `isFileAccessible()` and `quarantine.js`'s `rename()` both just skip a locked file into `skipped[]` with a reason. This doc's implementation section closes this. |
| MSI interaction | `MsiEnumProductsW`/`MsiGetProductInfoW` (or, simpler and what every real tool actually does, shell to `msiexec.exe /x {GUID} /qn /norestart` and let the Windows Installer service itself resolve component ref-counts and shared-DLL dependencies) | `silentUninstall.js` — already shells to `msiexec /qn /norestart` when the uninstall string is `MsiExec.exe`-shaped. This is the correct choice, not a shortcut: hand-parsing the MSI database to duplicate ref-count resolution the Installer service already does correctly is strictly worse (more code, a second implementation of the same logic, at risk of ever drifting from Windows' own MSI schema version changes) |

## Control Flow Graph (textual)

```
Uninstall Trigger (user picks a program, clicks Uninstall)
  |
  v
Native Uninstaller Execution
  - routes/uninstall.js resolves UninstallString / QuietUninstallString
  - silentUninstall.js picks the right silent flags per installer kind
    (msiexec /qn /norestart | NSIS /S | Squirrel -s | vendor's own quiet string)
  - runPreUninstall() optionally: System Restore point, full registry backup
    (both opt-in, both BEFORE the uninstaller runs)
  - spawn the resolved command, wait for exit
  |
  v
Post-Scan Leftover Sweep  (leftoverScan.js's scanForLeftovers)
  - scanFiles()          -- name/publisher regex over the 7 search roots
  - scanRegistryLeftovers() -- name/publisher regex over HKCU+HKLM\Software
                               and the Uninstall keys
  - scanScheduledTasks()  -- same regex over Get-ScheduledTask
  (all three run in parallel; one failing doesn't take the others down)
  |
  v
User Review  (LeftoverReview.jsx -- everything pre-ticked, user can untick)
  |
  v
Removal  (quarantineAndDelete -- files renamed into quarantine, NOT deleted
          outright; registry keys `reg export`'d to a .reg file THEN deleted)
  |
  +-- a file is locked (EBUSY/EPERM on open) -----------------+
  |                                                             v
  |                                          [NEW] scheduleDeleteOnReboot(path)
  |                                          writes \??\<path> + "" into
  |                                          PendingFileRenameOperations
  |                                          (admin required -- same
  |                                          elevation gate restore-point
  |                                          creation already uses)
  v
Reboot Scheduling  -- nothing to "schedule" beyond the registry write above;
                      the OS kernel itself replays PendingFileRenameOperations
                      during the NEXT boot's session-manager phase, before
                      any user-mode process (including Explorer) starts --
                      which is WHY this mechanism exists: it deletes a file
                      at the one moment nothing can be holding a handle to it.
```

## Pseudocode

### `ScanForLeftovers(AppName, GUID)` — already-shipped shape, shown for completeness

```cpp
// Mirrors leftoverScan.js's scanForLeftovers() + leftoverPattern.js's
// buildSearchPattern(). GUID is used for the registry Uninstall-key lookup
// specifically (that's where a GUID-keyed subkey actually lives) -- files
// on disk are never named by GUID, so the file scan matches on name/
// publisher only, same as the real implementation.
struct Leftover { string path; uint64 sizeBytes; };

vector<Leftover> ScanForLeftovers(string appName, string publisher, string guid) {
    string pattern = BuildWordBoundaryPattern(appName, publisher); // null if both empty
    if (pattern == null) return {};

    vector<Leftover> found;

    // 1. Filesystem: one level down from each of 7 known install roots.
    for (string root : { PROGRAMFILES, PROGRAMFILES_X86, APPDATA, LOCALAPPDATA,
                          LOCALAPPDATA "\\Programs", PROGRAMDATA,
                          APPDATA "\\Microsoft\\Windows\\Start Menu\\Programs" }) {
        for (DirEntry entry : FindFirstFileW/FindNextFileW(root, "*")) {
            if (entry.isDirectory && RegexMatch(entry.name, pattern)) {
                found.push_back({ entry.fullPath, RecursiveDirSize(entry.fullPath) });
            }
        }
    }

    // 2. Registry: HKCU/HKLM\Software, plus the Uninstall keys directly by GUID.
    for (HKEY root : { HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE }) {
        RecursiveRegistryWalk(root, "Software", [&](string keyPath, HKEY key) {
            if (IsProtectedKey(keyPath)) return; // depth < 3, or an OS-critical list
            if (RegexMatch(LastSegment(keyPath), pattern)) found.push_back({ keyPath, 0 });
        });
        string uninstallKey = root == HKEY_LOCAL_MACHINE
            ? "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\" + guid
            : "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\" + guid;
        if (guid != "" && RegKeyExists(root, uninstallKey)) found.push_back({ uninstallKey, 0 });
    }

    return found;
}
```

### `HandleLockedFile(FilePath)` — the actual new code (not pseudocode elsewhere; see implementation below)

```cpp
// What quarantine.js's file-move loop calls when rename() fails with a
// sharing violation, instead of only recording { path, reason: 'locked' }.
enum class UnlockResult { Freed, ScheduledForReboot, GaveUp };

UnlockResult HandleLockedFile(string filePath) {
    // Step 1: is anything actually holding it right now, or did it just
    // fail transiently (AV scan mid-flight)? One retry, short backoff --
    // never loop indefinitely, a genuinely-open file must not hang a batch.
    if (TryOpenExclusive(filePath)) return UnlockResult::Freed; // was transient

    Sleep(150ms);
    if (TryOpenExclusive(filePath)) return UnlockResult::Freed;

    // Step 2: cannot free it now -- schedule it for the next boot, the
    // one moment guaranteed nothing holds a handle to it. This is
    // MoveFileExW(filePath, NULL, MOVEFILE_DELAY_UNTIL_REBOOT)'s own
    // documented mechanism, reimplemented as a direct registry write
    // since Node has no MoveFileEx binding and this codebase's own
    // convention is to shell out rather than add a native module.
    if (!IsElevated()) return UnlockResult::GaveUp; // the registry key needs admin

    string valueName = "PendingFileRenameOperations";
    string keyPath = "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager";
    vector<string> pending = ReadRegMultiSZ(keyPath, valueName); // may not exist yet
    pending.push_back("\\??\\" + filePath); // the NT-namespace prefix the kernel expects
    pending.push_back("");                  // empty destination = delete, not rename
    WriteRegMultiSZ(keyPath, valueName, pending);

    return UnlockResult::ScheduledForReboot;
}
```

## Implementation scope for this session

Only the locked-file path is new work. It becomes a real Prune feature: **Settings → Uninstall gains "Delete locked files on next restart"**, off by default (same posture as `restorePointBeforeUninstall`/`registryBackupBeforeUninstall` — an admin-requiring, system-level opt-in, never silently on). When on, a file `quarantineAndDelete` cannot move because it's locked gets scheduled via `PendingFileRenameOperations` instead of only being reported as skipped, and the UI says so explicitly ("3 files will be removed the next time you restart") rather than silently disappearing from the skipped-files list.

Explicitly NOT in scope: process-based unlocking (finding and killing the process holding the handle) — Windows offers no supported enumerate-handle-owners API without either `NtQuerySystemInformation` (undocumented) or the Restart Manager API (`RmStartSession`/`RmRegisterResources`/`RmGetList`, which IS documented and IS what Explorer itself uses for "this file is open in X, close it and retry") . Restart Manager is a legitimate, real follow-up (a genuinely different, larger feature — enumerating and offering to close the owning app) but is its own scoped piece of work, not bundled into this one.
