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
- **Startup** — the Run keys and Startup folders Windows reads at
  sign-in, with a switch that writes the same record Task Manager does,
  plus scheduled tasks, automatic services and the startup tasks Store
  apps register. Those last three are read-only and say where to change
  them, since none of them is switched through the sign-in record.
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

## Installing

Download `Prune.Setup.<version>.exe` from the
[latest release](https://github.com/jimman0I/prune/releases/latest) and run
it. The `-win.zip` beside it is the same application without an installer:
unzip it anywhere and run `Prune.exe`.

### Windows will warn you, and here is why

Prune is **not code-signed**, so the first time you run the installer
Windows shows:

> **Windows protected your PC**
> Microsoft Defender SmartScreen prevented an unrecognised app from
> starting.

Click **More info**, then **Run anyway**.

This warning is about the absence of a certificate, not about anything
found in the file. SmartScreen flags every unsigned installer it has not
seen before, and unlike a reputation warning it does not go away as more
people download it — an unsigned binary stays unrecognised. A code-signing
certificate is a paid, identity-verified purchase, and Prune does not have
one.

You do not have to take that on trust. Every release lists the SHA-256 of
both files, and you can check the one you downloaded matches before you
run it:

```powershell
Get-FileHash .\Prune.Setup.*.exe -Algorithm SHA256
```

Compare the result with `SHA256SUMS.txt` on the release page. Two things
about that file look like mismatches and are not:

- `Get-FileHash` prints the digest in **uppercase** and the file lists it
  in lowercase. Same hash — compare them case-insensitively.
- The file names the installer `Prune Setup <version>.exe`, with spaces,
  because that is what the build produced. GitHub replaces spaces with
  dots in release assets, so the file you downloaded is
  `Prune.Setup.<version>.exe`. Same file — the hash is what identifies it.

Be clear about what that does and does not prove: it confirms the file
reached you byte-for-byte as it was built, so a corrupted or altered
download is caught. It does **not** prove who built it — only a signature
does that, and there isn't one.

If you would rather not run an unsigned binary, the alternative is to
build it yourself from source: see [Building an installer](#building-an-installer)
below. The result is the same application.

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
  (obsidian ground, cyan accent, glass panels), in dark and light. Both
  palettes are defined as CSS custom properties in `src/index.css` and
  every text tier in each is measured against the surfaces it sits on.
- `electron/` — the desktop shell. Quarantine data and settings live under
  `app.getPath('userData')`, never inside the install directory, so an
  app upgrade never touches or deletes them.

## Known limitations

- Windows only.
- Store/UWP apps are listed, but cannot be removed from inside Prune:
  that is `Remove-AppxPackage`, not an uninstaller, so those rows open
  Windows' own Installed Apps page instead of pretending to handle it.
- Leftover scanning is heuristic (name/publisher matching), not a full
  before/after filesystem snapshot.
- The installer is unsigned, so Windows SmartScreen warns on first run and
  keeps warning — see [Installing](#installing) for what the warning means
  and how to verify the download instead.

See [CHANGELOG.md](CHANGELOG.md) for release notes.
