# Disk Usage progress, containment and motion -- implementation plan

Spec: `docs/superpowers/specs/2026-09-24-disk-usage-progress-and-motion-design.md`.
Execute with superpowers:subagent-driven-development: fresh implementer per
task, TDD, spec-compliance review, then code-quality review, fix loops. Every
regression test must be proven load-bearing (revert the production change,
confirm the test fails, restore).

Rules for every task: work on `master`; stage only your own files by name (never
`git add -A`, `git stash`, `git checkout --`, `git reset`; another agent edits
`backend/src/data/cleaners.json`, `backend/src/lib/cleanerRules.js`,
`cleanerActions/winreg.js` and related tests in the same tree); no AI
attribution in commit messages; do not push, tag, or touch version numbers; use
Write/Edit (not bash heredocs) for files containing backslashes.

## Task 1 -- Backend: counting, percent, result store, stream routes

Files: `backend/src/services/diskScan.js`, `backend/src/lib/scanPercent.js`,
`backend/src/lib/scanResults.js`, `backend/src/routes/diskScan.js`, tests beside
each (`diskScan.test.js` in services extended; new `scanPercent.test.js`,
`scanResults.test.js`, `routes/diskScan.stream.test.js`).

1. `scanPercent(bytes, inUseBytes)`: null unless inUse positive finite; else
   `min(99, floor(bytes/inUse*100))`. Tests: null for null/0/NaN/negative, 0 at 0
   bytes, floors, caps at 99 when bytes >= inUse, never returns 100.
2. `scanResults`: `putScanResult(tree)` returns id; `getScanResult(id)` returns
   tree or undefined; cap 2 (oldest evicted), 2-minute TTL, injectable clock
   (`now` param) so no fake timers.
3. `scanDirectory(..., exclusions, onFile)`: `onFile(size)` per non-directory
   entry stat'ed; not for excluded or unreadable entries. Existing 4-arg calls
   unchanged.
4. Routes: move `SCAN_TIMEOUT_MS` to be shared; add `GET /stream` and
   `GET /result/:id` per the spec; keep `GET /` as is. Percent only for a drive
   root on C: via `getSystemDriveSpace()` (failure -> null).
5. Route tests via `startTestServer` (see existing `diskScan.test.js`); mock
   `services/diskScan.js`, `services/settings.js`, `services/diskSpace.js`.
   Read the SSE body from a raw fetch and parse events.

Commit: `feat(diskScan): stream real scan progress over SSE`.

## Task 2 -- Frontend: api streaming + count-up test + AnimatedNumber

Files: `frontend/src/lib/api.js` (`fetchDiskScan` gains `{ onProgress }`),
`frontend/src/lib/api.diskScan.test.js` (extend), `frontend/src/hooks/
useCountUp.test.jsx` (new), `frontend/src/components/AnimatedNumber.jsx` + test.

`useCountUp` tests: lands exactly on the target (no off-by-epsilon), counts down
from a higher displayed value, jumps straight to the target under
`prefers-reduced-motion`, restart mid-flight goes from the current value.
Use fake `requestAnimationFrame`/`performance.now`.

Commits: `feat(api): stream disk-scan progress`, `feat(ui): AnimatedNumber`.

## Task 3 -- Frontend: DiskScanProgress, i18n, DiskMap integration, containment

Files: `frontend/src/components/DiskScanProgress.jsx` (+ render test + Greek
language test), `frontend/src/components/DiskMap.jsx`, `frontend/src/index.css`
(keyframes for shimmer / indeterminate), `frontend/src/i18n/catalog.js`,
existing DiskMap tests adjusted only where the label text changed.

Catalog: new keys under `diskMap.scanProgress`, all 40 languages, single
read-splice-write, committed immediately (with the component, so parity holds).
DriveRootPrompt extracted and exported with the containment classes from the
spec.

Commits: `feat(diskMap): real scan progress card`, `fix(diskMap): contain the
drive-root card's text`.

## Task 4 -- Motion polish

Files: `frontend/src/index.css` (button press/hover, reduced-motion rule),
`frontend/src/components/NavRail.jsx` (whileHover/whileTap),
`frontend/src/components/Toggle.jsx` (new), `SettingsPage.jsx`,
`AutomationSettings.jsx` (use the shared Toggle), tests: `Toggle.render.test.jsx`
plus the existing SettingsPage/AutomationSettings/NavRail render tests must stay
green (role="switch" and names unchanged).

Commits: `feat(ui): spring toggle switches`, `feat(ui): press and hover motion
for buttons and nav`.

## Task 5 -- Docs

CHANGELOG v2.8.0 additions, README features and stale counts. Commit:
`docs: scan progress and motion polish in 2.8.0`.

## Final

Full suites one at a time: backend `npx vitest run` (3 known admin failures),
frontend `npx vitest run` (fully green), electron `node --test "*.test.cjs"`.
