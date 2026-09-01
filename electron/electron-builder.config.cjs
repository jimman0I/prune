module.exports = {
  appId: 'com.jimman0i.unrevo',
  productName: 'unrevo',
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
    { from: '../frontend/dist', to: 'frontend-dist' }
  ],
  // Both an NSIS installer (.exe) and a portable build (.zip) -- Phase 5's
  // explicit requirement. electron-builder does not auto-detect this
  // .cjs file; it must always be invoked with `-c electron-builder.config.cjs`
  // (see scripts/build-installer.mjs), or it silently builds with defaults
  // and produces an app with no backend inside it.
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }, { target: 'zip', arch: ['x64'] }],
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
    // skips resource-editing entirely, so nothing needs winCodeSign at
    // all -- this app ships unsigned by design (no cert) and has no
    // custom icon yet, so there is nothing that flag would have done.
    signAndEditExecutable: false
  },
  nsis: { oneClick: false, allowToChangeInstallationDirectory: true }
};
