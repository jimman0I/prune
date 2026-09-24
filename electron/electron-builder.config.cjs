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
  /* Both entry points, and preload.cjs is easy to forget here.
   *
   * This array is an allowlist: anything not named is left out of the
   * asar. main.cjs points BrowserWindow at preload.cjs, so omitting it
   * produces a build that runs, looks correct in dark mode, and silently
   * drops the one thing the preload does -- repainting the window's own
   * buttons for the light theme. It would have worked in dev, where the
   * file is loaded straight off disk, and failed only once packaged. */
  //
  // updater.cjs is the same trap a third time: main.cjs requires it, so a
  // build without it would run in dev and fail to start once packaged.
  // electron-updater itself needs no entry -- electron-builder packs
  // `dependencies` from package.json on its own.
  //
  // windowState.cjs is the same trap again: main.cjs requires it to
  // restore and persist window bounds, so a build without it would run
  // fine in dev (loaded straight off disk) and throw the moment
  // createWindow() runs in a packaged app.
  //
  // zoom.cjs is the same trap a fifth time: main.cjs requires it for the
  // text-zoom keys, and installerLanguages.test.cjs fails if it is missing.
  files: ['main.cjs', 'preload.cjs', 'updater.cjs', 'windowState.cjs', 'zoom.cjs'],
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
    { from: 'build/icon.png', to: 'icon.png' },
    // The CLI sqlite.vacuum actions shell out to -- see
    // backend/src/lib/cleanerActions/sqliteVacuum.js. A real binary asset
    // shipped the same way icon.png already is, not a build-time-only
    // file: main.cjs points UNREVO_SQLITE3_PATH at this exact spot in a
    // packaged app.
    { from: 'build/sqlite3.exe', to: 'sqlite3.exe' },
    /* The licence itself, shipped with the app rather than left in the
     * repository.
     *
     * MIT asks for the copyright notice to be included "in all copies or
     * substantial portions of the Software", and an installer is a copy.
     * Someone who downloads the .exe and never sees the repository would
     * otherwise have no statement of what they are permitted to do with
     * it, which is the situation the licence exists to end.
     *
     * At the root of resources/ rather than beside the backend, because
     * it covers the whole application and not one part of it. */
    { from: '../LICENSE', to: 'LICENSE' }
  ],
  // Both an NSIS installer (.exe) and a portable build (.zip) -- Phase 5's
  // explicit requirement. electron-builder does not auto-detect this
  // .cjs file; it must always be invoked with `-c electron-builder.config.cjs`
  // (see scripts/build-installer.mjs), or it silently builds with defaults
  // and produces an app with no backend inside it.
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }, { target: 'zip', arch: ['x64'] }],
    icon: 'build/icon.ico',
    /* Skip code signing, keep resource editing.
     *
     * Prune ships unsigned by design (no certificate), so nothing is
     * signed. What IS done is stamping Prune.exe's own resources: its icon
     * and its version block. Without that, Explorer showed the Electron
     * icon for Prune.exe and its Properties said FileDescription
     * "Electron", CompanyName "GitHub, Inc.", version 44.0.0 -- the
     * Electron binary's own identity, which is what Task Manager and the
     * "Open with" list showed too.
     *
     * History, because the option this replaces was load-bearing.
     * electron-builder 24 stamped resources with rcedit, which it only got
     * by downloading winCodeSign, a bundle whose archive contains macOS
     * symlinks that 7-Zip on Windows can only recreate with
     * SeCreateSymbolicLinkPrivilege. Without Developer Mode or an elevated
     * prompt the build failed 4/4 retries with "Cannot create symbolic
     * link: A required privilege is not held by the client" (2026-09-01),
     * so this was `signAndEditExecutable: false`, which skipped signing
     * AND resource editing and left the Electron identity in place.
     *
     * electron-builder 26 (upgraded 2026-09-11) edits resources with
     * resedit, which is JavaScript, and `signExecutable: false` skips only
     * the signing (winPackager.signIf). Verified on 2026-09-11 with a
     * build, an install and a launch: the version block reads Prune, the
     * exe carries build/icon.ico, it is still NotSigned, and the
     * winCodeSign cache was not touched.
     *
     * The version block is built from productName (FileDescription,
     * ProductName), author (CompanyName) and the version -- the `author`
     * field is the one described at the top of this file, which is why
     * this was changed on its own and verified by installing the result,
     * not just building it. LegalCopyright is electron-builder's default,
     * "Copyright (c) <year> <author>". */
    signExecutable: false
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    installerIcon: 'build/icon.ico',
    uninstallerIcon: 'build/icon.ico',
    /* No spaces in the installer's name.
     *
     * The default is "Prune Setup 2.5.0.exe", and GitHub renames a release
     * asset's spaces to dots -- which the README has always had to explain,
     * and which breaks the updater outright: latest.yml names the file the
     * build produced, the release holds a file with a different name, and
     * the download 404s. Hyphens survive the upload unchanged. */
    artifactName: 'Prune-Setup-${version}.${ext}',
    /* The installer in 40 languages, opened in Windows' own.
     *
     * Each language needs three things, and any one missing stops the
     * build: installer strings in electron-builder, a language file in
     * NSIS, and a Windows language id. Eight of electron-builder's
     * translations fail one of them and are left out -- Persian, Slovene,
     * Scottish Gaelic and Norwegian Nynorsk because electron-builder and
     * NSIS name them differently ("Farsi", "Slovenian", "ScotsGaelic",
     * "NorwegianNynorsk"); Azerbaijani, Bengali and Marathi because NSIS
     * has no file; Esperanto because Windows has no language id. Hindi is
     * a ninth: NSIS 3.0.4.1's own Hindi.nsh has an unterminated string on
     * line 128, found by compiling a test installer once per language --
     * the only one of 41 that failed.
     *
     * The codes are real Windows locales -- el_GR, he_IL -- and not the
     * ones electron-builder's own toLangWithRegion guesses (el_EL, he_HE).
     * The guesses have no language id: the first build with them handed
     * NSIS "undefined" and stopped on warning 7025 while building the
     * uninstaller. The price is that electron-builder matches its own nine
     * messages ("close Prune first" and the like) by the guessed code, so
     * for the twelve languages whose code had to change -- Norwegian's
     * included, now nb_NO -- those nine stay in English, as they always
     * were for Thai. Every page of the installer, the Updates page among
     * them, is in all 40.
     *
     * The selector opens preselected to the Windows display language, so
     * most people press OK; it is there for the ones who want another.
     * The Updates page's words are in build/installer.nsh, and
     * electron/installerLanguages.test.cjs fails if a language here has
     * no words there, or no language id. */
    multiLanguageInstaller: true,
    displayLanguageSelector: true,
    /* NSIS warnings are not build errors here, for one known reason.
     *
     * Eleven of these languages -- Afrikaans, Catalan, Welsh, Greek,
     * Estonian, Icelandic, Lithuanian, Malay, Pashto, Romanian, Serbian --
     * ship NSIS language files without the five MULTIUSER_TEXT_* strings
     * (measured against English.nsh: those five and nothing else). They
     * are the "Choose Users" page's, which asks whether to install for one
     * user or everyone, and this installer never shows it: Prune installs
     * per user without asking. NSIS uses the English text and warns, and
     * electron-builder makes every warning fatal by default -- so without
     * this the choice was Greek and ten others, or a build.
     *
     * The cost is that a new, real warning would no longer stop the build.
     * The mistakes this installer can actually make -- a language without
     * the Updates page's words, a code with no Windows language id -- are
     * caught by electron/installerLanguages.test.cjs instead, before
     * anything is built. */
    warningsAsErrors: false,
    installerLanguages: [
      'en_US', 'af_ZA', 'ar_SA', 'ca_ES', 'cs_CZ', 'cy_GB', 'da_DK', 'de_DE',
      'el_GR', 'es_ES', 'et_EE', 'fi_FI', 'fr_FR', 'he_IL', 'hu_HU', 'id_ID',
      'is_IS', 'it_IT', 'ja_JP', 'ko_KR', 'lt_LT', 'ms_MY', 'nb_NO', 'nl_NL',
      'pl_PL', 'ps_AF', 'pt_BR', 'pt_PT', 'ro_RO', 'ru_RU', 'sk_SK', 'sq_AL',
      'sr_SP', 'sv_SE', 'th_TH', 'tr_TR', 'uk_UA', 'vi_VN', 'zh_CN', 'zh_TW'
    ],
    // The "Check for updates" page, and what it writes.
    include: 'build/installer.nsh'
  },
  /* Where the updater looks: the GitHub release. This makes the build
   * write latest.yml (the version, file name and SHA-512 electron-updater
   * checks a download against) into dist/, and app-update.yml into the
   * app, which is how the installed copy knows where to ask. Nothing is
   * published by the build itself -- build-installer.mjs passes
   * `--publish never`, and the release is drafted by CI. */
  publish: [{ provider: 'github', owner: 'jimman0I', repo: 'prune', releaseType: 'release' }]
};
