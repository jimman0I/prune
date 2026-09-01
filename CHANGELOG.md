# Changelog

All notable changes to unrevo are documented here.

## v1.0.0

First stable release. unrevo is a local, offline uninstaller and cleanup
utility for Windows: it reads the real Uninstall registry (HKLM 64-bit,
HKLM WOW6432Node, HKCU), runs each program's own registered uninstaller,
then goes further than Windows' own "Apps & features" by scanning for what
that uninstaller leaves behind and giving you a safe, reversible way to
remove it.

### Uninstaller

- Enumerates every installed program across all three Uninstall registry
  hives Windows actually uses, deduplicated where a program's registry key
  collides across hives.
- Runs a program's own registered uninstall command (`MsiExec.exe /X{id}
  /qn` for MSI installs, or the program's own uninstall string), streamed
  live over SSE so the UI shows real progress, not a fake bar.
- Best-effort System Restore checkpoint before a forced removal — not the
  primary safety net (Windows throttles checkpoints to one per 24h), but
  cheap extra protection when available.

### Leftover scan & Quarantine

- After an uninstall, scans for files/folders, registry keys, and
  scheduled tasks left behind — matched heuristically against the
  program's name and publisher across Program Files, AppData, ProgramData,
  and the Start Menu.
- Nothing selected for removal is deleted outright: it's moved into
  Quarantine first (files via atomic rename, registry keys exported to
  `.reg` backups before deletion), so a bad match is always recoverable.
- **Quarantine Manager**: browse every quarantined batch — program name,
  real quarantine date, total size, and each file's original path.
  Restore a batch back to where it came from, or delete it permanently
  (behind a real two-step inline confirmation, never a native
  `window.confirm`). Empty the whole quarantine at once, same
  confirmation gate.

### Disk Map

- Interactive treemap of disk usage, built from a real async, abortable
  filesystem scan — navigate into any folder, see what's actually eating
  space, colored and size-badged by how much each entry holds.

### Smart Cleanup

- One-click junk scan across four real categories: Temp Files, Thumbnail
  Cache, Recycle Bin (sized via the Shell.Application COM object, not an
  estimate), and Browser Cache.
- Toggle categories on or off, see the real reclaimable total update live,
  then clean — quarantined by default (see Settings), so cleanup is
  reversible too.

### Settings

- **Cleanup**: folders to always exclude from Smart Cleanup and the
  leftover scanner; an Auto-Quarantine toggle controlling whether removed
  files go to Quarantine first or are deleted outright.
- **Sandbox Test**: runs the real cleanup engine — the same `scanJunk()`
  and `executeCleanup()` functions Smart Cleanup itself calls — against a
  throwaway temp directory, never your actual Temp, Windows Temp, or
  thumbnail cache, and reports a real per-step pass/fail result. A way to
  prove the destructive logic actually works before trusting it on real
  files.
- **About**: app name, version, and a one-line description.

### Dashboard

- System health gauge (free space as a percentage of total), total
  storage used/free, installed app count, and a Recent Activity log of
  past uninstalls with how much space each one freed.

### Packaging

- Windows NSIS installer and a portable `.zip`, built via `electron-builder`.
- Quarantine data and settings live under the user's real AppData
  directory (`app.getPath('userData')`), never inside the install
  directory — an app upgrade never touches or deletes them.
- The backend has zero native (compiled) dependencies — the registry
  reader and PowerShell COM interop for Recycle Bin sizing both shell out
  to `reg.exe`/`powershell.exe`, binaries already on every Windows
  machine, nothing to bundle or rebuild per-platform.

### Known limitations

- Windows only. No macOS/Linux support (the entire feature set is built
  on the Windows registry, `reg.exe`, and `powershell.exe`).
- Store/UWP apps (`Get-AppxPackage`) are not listed or uninstallable —
  only classic Win32 registry-based installs.
- Leftover scanning is heuristic (name/publisher matching), not a full
  before/after filesystem snapshot.
- The unsigned installer will trigger a Windows SmartScreen warning on
  first run.
