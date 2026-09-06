# Prune

A local, offline uninstaller and cleanup utility for Windows.

Prune runs a program's own registered uninstaller, then goes further than
Windows' own "Apps & features": it scans for what that uninstaller leaves
behind — stray files, registry keys, scheduled tasks — and gives you a
safe, reversible way to remove them. Nothing is deleted outright by
default; it's quarantined first, so a bad match is always recoverable.

## Features

- **Applications** — every installed program from the real Windows
  registry (all three Uninstall hives), plus the Microsoft Store apps and
  browser extensions no uninstall list mentions. Real icons, measured
  sizes, versions and install dates where the registry recorded none, and
  a warning before uninstalling something that is running. Runs each
  program's own uninstall command, streaming live progress, one at a time
  or as a batch.
- **Leftover scan** — after an uninstall, finds files, registry keys, and
  scheduled tasks the program left behind. Forced removal for entries
  whose own uninstaller is already gone.
- **Quarantine** — removed files and registry keys are backed up before
  deletion, browsable and restorable from the Quarantine screen; nothing
  is gone for good until you say so twice. Optional limits on how long and
  how much to keep.
- **Disk Map** — an interactive treemap of what's actually using your disk
  space, from a full-drive scan that reads the NTFS MFT directly. Largest
  files, a folder table, and a breakdown by file type beside the map.
- **Deep Clean** — 74 rules across 29 categories, scanned a rule at a time
  so the tree fills in as it goes. A rule that cannot be measured says
  whether the software is missing or the read needs admin, rather than
  reporting 0 B.
- **Startup** — everything Windows launches at sign-in, whether it is
  actually enabled, and a switch that writes the same record Task Manager
  does.
- **Duplicates** — duplicate files under a folder you choose, found by
  size, then a 64 KB sample, then a full hash, so almost nothing is read
  completely.
- **Settings** — folders and file types to leave alone, guards on what a
  clean may touch, quarantine limits, an optional schedule, and a real
  Sandbox Test that proves the cleanup engine works against a throwaway
  directory before you trust it on real files.
- **Dashboard** — real drive health from the disk's own SMART data (not
  free space dressed up as health), live CPU, memory and disk activity,
  installed app count, and a log of what past uninstalls actually freed.

## Requirements

- Windows 10 or 11.
- Node.js 18+ (development only — the packaged app bundles its own
  runtime via Electron).

## Development

```bash
# Backend (Express, port 3101)
cd backend
npm install
npm run dev

# Frontend (Vite, port 5174) — in a second terminal
cd frontend
npm install
npm run dev

# Electron shell — in a third terminal, once both of the above are running
cd electron
npm install
npm start
```

Run tests:

```bash
cd backend && npm test      # vitest
cd frontend && npx vitest run
```

## Building an installer

```bash
cd electron
npm run dist
```

Produces an NSIS installer (`.exe`) and a portable `.zip` in
`electron/dist/`. See [electron/README.md](electron/README.md) for how the
build pipeline works and what it does differently from a plain
`electron-builder` call.

## Architecture

- `backend/` — Express (ESM), runs in-process inside Electron's main
  process when packaged, or standalone via `node src/index.js` in
  development. Zero native (compiled) dependencies: the registry reader
  and the PowerShell COM interop used for Recycle Bin sizing both shell
  out to `reg.exe`/`powershell.exe` — binaries every Windows machine
  already has, nothing to bundle or rebuild per platform.
- `frontend/` — React + Vite + Tailwind, the Aurora Deck design system
  (navy, coral accent, glass panels).
- `electron/` — the desktop shell. Quarantine data and settings live under
  `app.getPath('userData')`, never inside the install directory, so an
  app upgrade never touches or deletes them.

## Known limitations

- Windows only.
- Store/UWP apps aren't listed or uninstallable — only classic Win32
  registry-based installs.
- Leftover scanning is heuristic (name/publisher matching), not a full
  before/after filesystem snapshot.
- The installer is unsigned, so Windows SmartScreen will warn on first
  run.

See [CHANGELOG.md](CHANGELOG.md) for release notes.
