# electron/

The desktop shell. `main.cjs` starts the Express backend in-process (a
dynamic `import()`, not a spawned child — same pattern as Re:Route's own
`electron/main.cjs`), waits for it to answer `/api/health`, then opens the
window.

## Building the installer

```bash
npm run dist
```

This runs `scripts/build-installer.mjs`, not `electron-builder` directly.
Four steps, in order:

1. **`vite build`** in `../frontend` — produces `frontend/dist`, shipped
   as an `extraResources` entry. Skipping this step ships whatever was
   last built, silently stale.
2. **Copies `../backend/src`, `package.json`, and `package-lock.json`**
   into a fresh `build/backend-prod/` directory.
3. **`npm ci --omit=dev`** inside `build/backend-prod/` — a clean,
   production-only install. The backend's shared dev `node_modules`
   (used for `npm test`) also carries `vitest` and its whole dependency
   tree; shipping that wholesale would bloat every installer with test
   tooling nobody needs at runtime. `build/backend-prod/` is gitignored
   and rebuilt from scratch every run — never edit anything inside it
   directly. The rest of `build/` is committed source: the icons and
   `installer.nsh`, electron-builder's default resources folder.
4. **`electron-builder -c electron-builder.config.cjs --publish never`** —
   packages `main.cjs`, `preload.cjs`, `updater.cjs`, the frontend build
   and the production-only backend into a Windows NSIS installer (`.exe`,
   with its `.blockmap`) and a portable build (`.zip`), plus `latest.yml`
   for the updater, all written to `dist/` (also gitignored). Then
   `SHA256SUMS.txt` for the installer and the zip.

`electron-builder.config.cjs`'s `extraResources` points at
`build/backend-prod/node_modules`, not `../backend/node_modules` — that's
what makes step 3 matter; skipping straight to `electron-builder` without
running the script would either fail (no `build/backend-prod/` yet) or
ship a stale one.

### Two real electron-builder gotchas, both already handled

- **`-c` must be explicit.** electron-builder does not auto-detect a
  `.cjs` config file and says nothing when it fails to find one — it just
  builds with defaults, producing an app with no backend inside it.
  `build-installer.mjs` always passes `-c electron-builder.config.cjs`.
- **`signExecutable: false`** is set in the `win` config: nothing is
  code-signed (this app ships unsigned by design, no cert), but
  `Prune.exe` still gets its own icon and version block, so Explorer,
  Task Manager and its Properties say Prune rather than Electron / GitHub,
  Inc. Under electron-builder 24 that editing needed `rcedit`, fetched
  inside `winCodeSign`, whose archive contains macOS symlinks that 7-Zip
  can only recreate with `SeCreateSymbolicLinkPrivilege` — so the config
  used `signAndEditExecutable: false` and gave up the icon and metadata.
  electron-builder 26 edits resources with `resedit` (JavaScript, no
  download), and `signExecutable: false` skips only the signing. The
  version block is built from `productName`, `author` and the version —
  see the warning about `author` at the top of the config before changing
  either.

## Updates

`updater.cjs` is the part of the in-app updater Prune owns. The
downloading, the SHA-512 check against the release's `latest.yml` and the
silent install are `electron-updater`'s; what this file adds is consent. It
turns off electron-updater's two defaults — download as soon as a check
finds something, install whatever was downloaded when the app quits — and
refuses any version other than the one the side-bar button showed.
`main.cjs` registers its three IPC handlers once, and `preload.cjs` exposes
them to the window as `window.pruneWindow.updates`. Its tests are `npm
test` here, on Node's own test runner, so no new dependency.

`publish` in the config names the GitHub release, which is what makes the
build write `latest.yml` into `dist/` and `app-update.yml` into the app.
`build-installer.mjs` passes `--publish never`, so the build itself never
uploads anything: CI drafts the release. The installer is named
`Prune-Setup-<version>.exe` because `latest.yml` names the exact file, and
GitHub would turn spaces into dots.

## The installer

40 languages, opening in Windows' display language (`installerLanguages`
and `displayLanguageSelector` in the config), and an "Updates" page from
`build/installer.nsh` that asks whether to check for updates, on a fresh
install only. `installerLanguages.test.cjs` fails if a language the
installer offers has no words for that page, which NSIS itself would only
warn about.

## Where user data lives

`quarantineRoot()` and `settingsPath()` in `main.cjs` both resolve to
`app.getPath('userData')` when packaged (`%APPDATA%\Prune` —
`productName: "Prune"` in `package.json` is what makes that folder name
`Prune`, not `prune-desktop`), passed to the backend as
`UNREVO_QUARANTINE_ROOT`/`UNREVO_SETTINGS_PATH`. Never inside the install
directory, so an app upgrade never touches or deletes them. In
development (`app.isPackaged` false) both return `null` and the backend
falls back to its own dev defaults.

## Running the packaged build without a full install

`dist/win-unpacked/Prune.exe` is the exact same files an NSIS install
produces, just not wrapped in the installer or registered in "Apps &
features" — useful for a quick verification pass without touching the
system.
