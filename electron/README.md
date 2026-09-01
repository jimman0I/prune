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
   tooling nobody needs at runtime. `build/` is gitignored and rebuilt
   from scratch every run — never edit anything inside it directly.
4. **`electron-builder -c electron-builder.config.cjs`** — packages
   `main.cjs`, the frontend build, and the production-only backend into
   a Windows NSIS installer (`.exe`) and a portable build (`.zip`), both
   written to `dist/` (also gitignored).

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
- **`signAndEditExecutable: false`** is set in the `win` config.
  electron-builder normally downloads `winCodeSign` (a macOS code-signing
  tool bundle) for any Windows build, purely to get `rcedit` for stamping
  the `.exe`'s icon/version resources — even with no signing config
  anywhere. `winCodeSign`'s archive contains real macOS symlinks that
  7-Zip on Windows can only recreate with `SeCreateSymbolicLinkPrivilege`
  (Developer Mode or an elevated prompt); without it the build fails with
  `Cannot create symbolic link: A required privilege is not held by the
  client.` This app ships unsigned by design (no cert) and has no custom
  icon yet, so `signAndEditExecutable: false` skips that whole path.

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
