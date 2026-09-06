module.exports = {
  appId: 'com.jimman0i.prune',
  productName: 'Prune',
  // Publisher comes from package.json's `author`. Without it,
  // electron-builder writes none, and Prune listed ITSELF as "Unknown
  // Publisher" in its own Applications tab -- alongside Windows' own Apps
  // & features and any other uninstaller. A poor look for a tool whose
  // job is showing you that column. The build had been printing "author
  // is missed in the package.json" on every run since the project
  // started and nothing was reading it.
  //
  // THE VALUE MATTERS, and not for any reason that is visible from here.
  // `author: "jimman0I"` builds an installer that dies on launch with an
  // access violation (exit -1073741819) before it writes a single file --
  // reproducible, and not a build error: the build succeeds and produces
  // a normal-sized exe. `author: "Prune"` builds one that installs at
  // exit 0 and writes Publisher correctly. Both were verified by
  // installing them back to back from the same directory.
  //
  // So do not change this string without installing the result. The root
  // cause is somewhere inside electron-builder's NSIS generation and was
  // not worth chasing past a working configuration, but a Publisher that
  // reads slightly oddly is a much smaller problem than an installer
  // nobody can run.
  //
  // InstallLocation is still empty, which electron-builder's NSIS target
  // does not write and there is no flag for. It only costs Prune's own
  // "Folder" button for its own row, so it is recorded rather than
  // worked around with a custom NSIS include.
  directories: { output: 'dist' },
  files: ['main.cjs'],
  extraResources: [
    // NOTE the source: this copies from ../backend/src DIRECTLY, not from
    // the build/backend-prod/ staging directory build-installer.mjs
    // populates -- that one exists only to produce a dev-free
    // node_modules. Anything meant to be kept out of the shipped backend
    // has to be excluded HERE; filtering it during the staging copy looks
    // right and does nothing (confirmed by inspecting the built app).
    //
    // Test files and fakeVolume.js (a synthetic NTFS volume builder that
    // exists purely so the MFT parser can be tested without an elevated
    // process) are test tooling, and 27 of them were shipping inside
    // every installer. The default is to take the whole tree, so nothing
    // else was ever going to stop them.
    //
    // testSupport/ is excluded by directory rather than by filename,
    // because that is what it is: a directory whose whole contents are
    // test-only. The `*.test.js` pattern catches files that say so in
    // their name and nothing else -- routeServer.js does not, and shipped
    // in the 2.0.0 build until this line was added. A filter that only
    // matches a naming convention keeps missing anything that does not
    // follow it, so new test-only tooling belongs in here.
    {
      from: '../backend/src',
      to: 'backend/src',
      filter: ['**/*', '!**/*.test.js', '!**/fakeVolume.js', '!testSupport/**']
    },
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
