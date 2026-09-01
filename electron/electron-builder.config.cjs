module.exports = {
  appId: 'com.jimman0i.prune',
  productName: 'Prune',
  directories: { output: 'dist' },
  files: ['main.cjs'],
  extraResources: [
    { from: '../backend/src', to: 'backend/src' },
    // Production-only install, built by scripts/build-installer.mjs into
    // build/backend-prod/ -- NOT the shared ../backend/node_modules dev
    // install, which also carries vitest and its whole dependency tree.
    // Copying that wholesale would ship real test tooling inside every
    // installer for no reason; this points at a throwaway directory the
    // build script populates fresh via `npm ci --omit=dev` each run.
    { from: 'build/backend-prod/node_modules', to: 'backend/node_modules' },
    { from: '../backend/package.json', to: 'backend/package.json' },
    { from: '../frontend/dist', to: 'frontend-dist' },
    // Shipped as a real runtime resource (not just a build-time asset)
    // so main.cjs can set it as the BrowserWindow icon and trayManager.js
    // can set it as the tray icon -- `files: ['main.cjs']` above means
    // nothing under build/ reaches the packaged app otherwise.
    { from: 'build/icon.png', to: 'icon.png' }
  ],
  // Both an NSIS installer (.exe) and a portable build (.zip) -- Phase 5's
  // explicit requirement. electron-builder does not auto-detect this
  // .cjs file; it must always be invoked with `-c electron-builder.config.cjs`
  // (see scripts/build-installer.mjs), or it silently builds with defaults
  // and produces an app with no backend inside it.
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }, { target: 'zip', arch: ['x64'] }],
    icon: 'build/icon.ico',
    // Real bug, found running this live (2026-09-01): electron-builder
    // downloads winCodeSign (a macOS code-signing tool bundle) for ANY
    // win build by default, purely to get rcedit -- the tool it uses to
    // stamp the .exe's icon/version resources -- even with
    // CSC_IDENTITY_AUTO_DISCOVERY=false and no signing config anywhere.
    // winCodeSign's archive contains real macOS symlinks that 7-Zip on
    // Windows can only recreate with SeCreateSymbolicLinkPrivilege
    // (Developer Mode or an elevated prompt); without it the build fails
    // 4/4 retries with "Cannot create symbolic link: A required
    // privilege is not held by the client." signAndEditExecutable:false
    // skips resource-editing entirely (this app ships unsigned by design,
    // no cert). A real app icon was added later (2026-09-01) -- NSIS's
    // own installer/uninstaller/shortcut icons are set via nsis.*Icon
    // below and electron-builder's own icon pipeline for those doesn't
    // need rcedit; the running Prune.exe's OWN embedded resource icon
    // still falls back to the default Electron icon with signing
    // disabled (confirmed: main.cjs sets a real BrowserWindow/Tray icon
    // at runtime instead, which covers the window, taskbar, and tray --
    // the surfaces actually seen day to day; only the raw .exe file icon
    // in Explorer stays default).
    signAndEditExecutable: false
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    installerIcon: 'build/icon.ico',
    uninstallerIcon: 'build/icon.ico'
  }
};
