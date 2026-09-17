# Releasing

The build itself is documented in [electron/README.md](electron/README.md).
This is the checklist around it — the steps that are easy to forget
because they happen once per release rather than once per build.

## Before the build

1. **Bump the version** in `electron/package.json` -- the installer
   filename and the release tag both come from it, and it's what
   electron-updater bakes into the installed .exe's own resource. **Also
   bump `backend/package.json` to the same version** -- that is the
   SEPARATE file the app's own Settings screen and its update-checker
   actually read (`backend/src/services/updateCheck.js`'s `appVersion()`).
   The two silently drifted on v2.6.0: only `electron/package.json` was
   bumped, so the installed .exe was genuinely 2.6.0 but Settings kept
   showing 2.5.1 and the update-checker kept nagging forever, unable to
   ever resolve (electron-updater correctly refused to "update" to a
   version already installed). `backend/src/services/updateCheck.test.js`
   now asserts the two files match, but bump both by hand regardless --
   don't rely on the test alone to catch a mistake before it ships.
2. **Write the CHANGELOG entry.** The release notes are assembled from
   it, so anything not in the changelog is not in the notes.
3. **Run both suites.** One at a time — see
   [CONTRIBUTING.md](CONTRIBUTING.md) for why.
4. **`npm audit --omit=dev`, in `backend/` and `frontend/`.** Production
   dependencies only; a dev-only advisory does not ship. This is not
   theatre — express pins a `qs` range that had two open advisories in
   it as recently as 2.2.0, and reaching the fix needed an explicit
   `overrides` entry rather than `npm audit fix`.

## The build

GitHub Actions builds the release, not this machine. Pushing a version
tag runs [.github/workflows/build.yml](.github/workflows/build.yml): both
suites on a Windows runner, the same `npm run dist` a local build uses, a
re-check of `SHA256SUMS.txt` against the files it names, an attestation
for the installer, the zip and `latest.yml`, and a **draft** release with
all five files attached: the installer and its `.blockmap`, the zip,
`SHA256SUMS.txt`, and `latest.yml`, which is what the in-app updater
reads.

```bash
git tag -a v<version> -m "Prune <version>"
git push origin v<version>
```

The point of building there is the attestation. Prune ships unsigned,
and a checksum only proves a download arrived intact — not who built it
or from what. An attestation is a signed record that this workflow, in
this repository, produced that exact file from a named commit, and anyone
can check it without trusting the person who uploaded it.

A local build still works, and is still the way to try one before
tagging:

```bash
cd electron
npm run dist
```

It produces the same three files in `electron/dist/`, which is cleared
first so it holds only what this build made. Nothing built locally has an
attestation, so a local build should not be what ships.

## Publishing

1. **Wait for the run to go green.** The draft appears under Releases
   only if the tests, the build and the checksum re-check all passed.
2. **Replace the draft's notes** with the CHANGELOG entry, then publish.
   The draft carries a placeholder so an unedited one is obvious.
3. **Check the release has all five files**: `Prune-Setup-<version>.exe`,
   its `.blockmap`, `Prune-<version>-win.zip`, `SHA256SUMS.txt` and
   `latest.yml`. `latest.yml` is not decoration: it is what every installed
   copy's update button reads, and without it no one on 2.5.0 or later is
   offered this release. It names the installer by its exact file name, so
   the name must reach the release unchanged — which is why it has no
   spaces for GitHub to turn into dots.
4. **Verify what was published**, from a fresh download rather than the
   run's own copy:

   ```bash
   gh release download v<version> --repo jimman0I/prune --dir verify
   gh attestation verify "verify/Prune-Setup-<version>.exe" --repo jimman0I/prune
   gh attestation verify "verify/Prune-<version>-win.zip" --repo jimman0I/prune
   gh attestation verify "verify/latest.yml" --repo jimman0I/prune
   ```

   All three should report a verified attestation from `build.yml`. If any
   does not, the file on the release is not the one the workflow built —
   take the release down before anyone downloads it, and before any
   installed copy offers it.

## Weeks before going public, not at the moment of it

- **Submit the installer to Microsoft for analysis** at
  <https://www.microsoft.com/en-us/wdsi/filesubmission>, as a software
  developer requesting a review. Prune is unsigned, deletes files in
  bulk, writes to the registry and spawns PowerShell — the exact
  behavioural profile heuristic antivirus flags. SmartScreen's warning is
  documented and expected; Defender quarantining the installer is a
  louder failure.

  **Do this first, and wait for the verdict before publishing.** The form
  takes a file, not a repository, so nothing about it requires the source
  to be public — and the turnaround is days. Submitting at the same moment
  the repository opens means the earliest downloads are exactly the ones
  that get quarantined, which is the worst possible first impression and
  entirely avoidable. An earlier draft of this file listed it under the
  section below; that was wrong.

## Once, when the repository first goes public

These genuinely cannot be done on a private repository, and are easy to
miss at the moment they become possible.

- ~~**Enable private vulnerability reporting.**~~ Done, the moment the
  repository went public. [SECURITY.md](SECURITY.md) sends people through
  it, so that link was dead until this was switched on.
- **Check that the repository has a license.** Without one, default
  copyright applies and nobody may legally use or redistribute the
  binaries being published.
- **Re-read the README's screenshots for anything personal**, on every
  release that adds one. They are captures of a real machine, which is
  what makes them worth having and what makes them worth checking.

  Checked for 2.2.1 and left as they are.
  `docs/screenshots/startup-dark.png` shows the Windows username in six
  launch paths — but every commit in this repository is authored by
  `jimmanol05@gmail.com`, so the git history already exposes that name far
  more thoroughly than one screenshot does. Redacting the image while the
  log says the same thing would be theatre. Worth re-checking for anything
  that is NOT already in the log: tokens, licence keys, private paths,
  someone else's name.
- ~~**Swap the static badges for live ones.**~~ Done. The release and
  licence badges read from the repository, and the hand-typed test-count
  badge became a live build badge once GitHub Actions existed: it goes red
  when either suite or the build fails on `master`, instead of quoting a
  number someone had to remember to change. The platform and telemetry
  badges stay static — they are claims rather than metrics.

## What is deliberately not part of this

- **Code signing.** Prune ships unsigned by choice. The README explains
  what that costs the user and how to verify a download instead.
- **Updates without consent.** Since 2.5.0 Prune installs its own
  updates, but only from the side-bar button or with **Install updates
  automatically** turned on, and only with the update check on — all three
  off by default. What follows for releases: the tag must be a plain
  `vX.Y.Z` (anything else reads as "not a release Prune could read"); a
  draft or pre-release is never offered; and a published release reaches
  every installed copy with the check on within a day. There is no staged
  rollout and no way to take one back from people who already installed
  it, which is why step 4 of Publishing is verification, not a formality.
