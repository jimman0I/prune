# Releasing

The build itself is documented in [electron/README.md](electron/README.md).
This is the checklist around it — the steps that are easy to forget
because they happen once per release rather than once per build.

## Before the build

1. **Bump the version** in `electron/package.json`. That is the one the
   installer filename, the release tag and the app's own Settings screen
   all come from.
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

```bash
cd electron
npm run dist
```

Produces the installer, the portable zip, and `SHA256SUMS.txt` in
`electron/dist/`, which is cleared first so it holds only what this build
made.

**Verify the checksums independently** rather than trusting the file that
was just written beside them:

```powershell
Get-FileHash ".\electron\dist\Prune Setup <version>.exe" -Algorithm SHA256
```

## Publishing

1. **Tag it**, annotated, matching the version: `git tag -a v<version>`.
2. **Create the release** with all three files — installer, zip, and
   `SHA256SUMS.txt`.
3. **Check the asset names.** GitHub replaces spaces with dots, so
   `Prune Setup 2.2.0.exe` becomes `Prune.Setup.2.2.0.exe` while the
   checksum file still names it with spaces. That is expected, and the
   README says so, but confirm the hashes still match what was uploaded.

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
  licence badges now read from the repository, so neither needs updating
  by hand again. The platform, test-count and telemetry badges stay
  static: there is no CI to report a test count and the other two are
  claims rather than metrics. **The test-count badge is therefore the one
  thing in the README that can silently go stale — update it when the
  number moves.**

## What is deliberately not part of this

- **Code signing.** Prune ships unsigned by choice. The README explains
  what that costs the user and how to verify a download instead.
- **An update check.** Nothing Prune does leaves the machine; there is no
  version ping and no auto-updater. New versions are found the way the
  first one was.
