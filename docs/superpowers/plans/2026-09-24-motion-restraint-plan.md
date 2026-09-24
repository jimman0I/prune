# Motion restraint -- plan

Spec: `docs/superpowers/specs/2026-09-24-motion-restraint-design.md`.
TDD; every important test proven load-bearing by revert-and-confirm-fails.

1. Backend Stop: `start` event with `scanId`, `runningScans` map,
   `POST /stop/:id`, "stopped" error wording. Tests in
   `routes/diskScan.stream.test.js`. Commit `feat(diskScan): POST /stop/:id ...`.
2. Frontend Stop + one-indicator card: `stopDiskScan`, `start` forwarded,
   `onStop` in DiskScanProgress/LoadingState/DiskMap, rings/spinner only when
   the bar is indeterminate, reuse `deepClean.stop`. Tests: api, component,
   DiskMap integration, Greek.
3. CSS/nav: retarget button rules, drop nav hover scale, rewrite stale
   comment, add aurora pause rule; `motionRestraint.test.js`.
4. `useScreenFade` (160 ms opacity) and `useWindowActivity`, wired in
   `App.jsx`, with tests.
5. CHANGELOG bullets. Full frontend suite x3, backend, electron.
