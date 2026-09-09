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

## Once, when the repository first goes public

These cannot be done on a private repository and are easy to miss at the
moment they become possible.

- **Enable private vulnerability reporting.** Settings › Code security.
  [SECURITY.md](SECURITY.md) tells people to report through it, and that
  link is dead until it is switched on. The API returns 404 for a private
  repository, so this genuinely cannot be done in advance.
- **Submit the installer to Microsoft for analysis** at
  <https://www.microsoft.com/en-us/wdsi/filesubmission>, as a software
  developer requesting a review. Prune is unsigned, deletes files in
  bulk, writes to the registry and spawns PowerShell — the exact
  behavioural profile heuristic antivirus flags. SmartScreen's warning is
  documented and expected; Defender quarantining the installer is a
  louder failure and worth pre-empting rather than discovering through a
  bug report.
- **Check that the repository has a license.** Without one, default
  copyright applies and nobody may legally use or redistribute the
  binaries being published.
- **Re-read the README's screenshots for anything personal.** They are
  captures of a real machine, which is what makes them worth having and
  also what makes them worth checking. `docs/screenshots/startup-dark.png`
  contains the Windows username in six launch paths; the Applications and
  Deep Clean shots list what is installed. None of that matters in a
  private repository and all of it becomes public at the same moment the
  repository does.
- **Swap the static badges for live ones.** The README's badges are
  hand-written `img.shields.io/badge/…` because the dynamic
  `img.shields.io/github/…` forms cannot read a private repository — they
  render the literal text "repo not found", which is worse than no badge.
  Once public, the version, license and release badges can come from the
  repository itself and stop needing to be updated by hand.

## What is deliberately not part of this

- **Code signing.** Prune ships unsigned by choice. The README explains
  what that costs the user and how to verify a download instead.
- **An update check.** Nothing Prune does leaves the machine; there is no
  version ping and no auto-updater. New versions are found the way the
  first one was.
