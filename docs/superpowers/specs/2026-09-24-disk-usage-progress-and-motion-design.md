# Disk Usage progress, text containment and motion polish -- design

Date: 2026-09-24. Folded into v2.8.0 (no version change here).

Four parts: (1) the Disk Map's "Read the whole drive" card has text that is not
contained; (2) the folder-by-folder scan gets real, streamed progress; (3) a
round of motion polish; (4) docs. This document records every judgment call,
because nobody was available to ask.

## What already exists (read from the code, not assumed)

Several items in the original brief are already shipped, and two of the
brief's instructions conflict with this repo. Recording it so nothing is done
twice or done wrongly:

| Brief item | State in the repo | Decision |
|---|---|---|
| `<MotionConfig reducedMotion="user">` | Already wraps the app in `main.jsx` | Keep. Render tests wrap new components themselves. |
| Sliding nav indicator via `layoutId` | Already in `NavRail.jsx` (`layoutId="nav-active"`, spring) | Keep; add hover/tap scale to the nav buttons only. |
| Page transitions, ~0.3s, `[0.22,1,0.36,1]` | Already in `App.jsx`, 300 ms, `cubic-bezier(0.22, 1, 0.36, 1)`, implemented with Web Animations | **Do not switch to `AnimatePresence mode="wait"`.** Screens stay mounted once visited (`Screen.jsx`) so Disk Map's scan and Deep Clean's results survive a tab switch. `AnimatePresence` keyed on the screen would unmount them, destroying that state, and `mode="wait"` would also delay every switch by a full exit animation. The existing comment in `App.jsx` documents this. Same timing and easing, so the visible behaviour matches the brief. |
| Card hover lift | `.lift` class exists (StatCard uses it) | Reuse; apply to the new progress card only where it is a card (it is not: a progress card that lifts on hover while working reads wrong). No new lift usage is added. |
| Animated number counter | `hooks/useCountUp.js` + `lib/countUp.js` already exist: counts from the displayed value (so it counts down too), cancels and restarts cleanly, lands exactly on the target (`countUpValue` returns the exact end at progress 1), jumps straight to the target under reduced motion | Reuse via a small `AnimatedNumber` component. The brief's `setInterval` snippet is not implemented. The hook had no test of its own, so one is added (lands exactly, counts down, reduced motion). |
| Confetti | -- | **User decision: none.** No `canvas-confetti`. Completion is a self-drawing checkmark. |
| New motion library | -- | None. framer-motion `^13.2` is already a dependency. |

Genuinely new: the text-containment fix, streamed scan progress, the
progress card, `AnimatedNumber`, the self-drawing checkmark, spring toggles,
nav hover/tap scale, and the button press treatment.

## Part 1 -- text containment on the drive-root card

The card is the block in `DiskMap.jsx` rendered when
`!loading && !error && !tree && isDriveRoot(currentPath)` (heading "Read the
whole drive", two paragraphs, "Fast scan (admin)" and "Walk folders instead").
Extracted to an exported `DriveRootPrompt` component so a render test can
assert on it without scanning anything.

Changes, in the project's Tailwind + CSS-variable idiom (no raw hex):

- Card: `glass-panel`, `mx-auto w-full max-w-[720px]`, `p-8` (32px),
  `leading-[1.6]`, `[overflow-wrap:anywhere]` so an unbreakable token (a long
  path in the translated copy) wraps inside the card instead of overflowing.
- Title: `text-[18px] font-semibold mb-4`.
- Paragraphs: `text-[14px] text-[color:var(--text-secondary)] mb-3
  last:mb-0`. The old `max-w-[62ch]` on paragraphs is dropped because the card's
  own max width now sets the measure.
- Button row: `flex flex-wrap gap-3 mt-6`.
- The muted second paragraph keeps `--text-secondary` per the brief (it was
  `--text-muted`, a lower-contrast colour for the same body text).

Widths. The app's minimum window is 900x560 with a 72px nav rail and `px-12`
(48px) page padding on each side, so the content column is at least
900 - 72 - 96 = 732px, which is at or above the card's 720px cap: at the
minimum window the card fits without shrinking. At 1280 and 1920 the column is
wider than 720px and the card is centred by `mx-auto` at exactly 720px. Below
732px (a user-resized window is not possible under the min, but a display
scaled to 125-150% shrinks CSS pixels) `w-full` lets it shrink and the wrapping
rules keep text inside it. Verified by a render test asserting the classes,
and by the arithmetic above; the orchestrator does the live visual check.

## Part 2 -- progress for the folder-by-folder scan

### The principle (user decision, unchanged)

A percent is shown only when it is a real number. Disk Map deliberately has no
fake percentage (see `LoadingState`'s comment and `lib/unscannedRemainder.js`).
Nothing here invents or smooths a number.

- **Whole-drive folder walk of the system drive (C:)**: `percent =
  bytesProcessed / bytesInUse`, both real. `bytesInUse = totalBytes - freeBytes`
  from `services/diskSpace.js` (`getSystemDriveSpace`, which reports C: only).
  Floored to an integer and **capped at 99** until the scan actually completes,
  because the two figures measure different things (a file's logical size vs
  the volume's allocated bytes: sparse and compressed files, NTFS metadata,
  hard links, and folders the process cannot read all make the ratio approach
  but not reliably reach 100). The cap is what keeps the bar from claiming
  "done" before the scan says so. It is not a smoothing of the value: below 99
  the number is the raw ratio.
- **Whole-drive scan of any other drive letter**: no in-use figure is
  available (`getSystemDriveSpace` is C:-only), so `percent` is `null`.
- **Single folder**: no known total, so `percent` is `null`: indeterminate
  moving bar plus the live counters.
- **`percent: null` in the event whenever unknown.** The UI treats `null` as
  "render no number, render an indeterminate bar".

### Fast scan (admin) -- what it can and cannot report

Investigated `services/mftScan.js`, `lib/elevated.js`, `lib/ntfs/mftWorker.js`.
The fast scan runs the MFT reader in an **elevated child process** started with
`Start-Process -Verb RunAs -Wait`. An elevated process is at a higher integrity
level than the backend, so its stdout cannot be piped back; the only channel is
a JSON file the child writes once, at the very end. There is no progress
channel, and adding one (a periodically rewritten progress file the backend
polls) would change the elevated worker, which is out of scope for a UI polish
change and is not something to ship untested against a real UAC prompt.

So the fast path **cannot report progress**. It shows an indeterminate bar and
elapsed time, and **no percent, no counters**. The card says so in plain words
("Windows reports no progress while it reads the drive index") so the missing
percentage is explained rather than mysterious. No number is faked.

### Streaming and the tree handoff

The existing `GET /api/disk-scan?path=` returns the whole tree as one JSON
response. It stays, unchanged (existing callers and tests).

New in the same router (`routes/diskScan.js`):

- `GET /api/disk-scan/stream?path=...` -- SSE (`text/event-stream`, same
  headers and `sendEvent` shape as Deep Clean's `/scan/stream`). GET because
  this app's SSE reader is fetch-based and the routes accept GET only, same as
  Deep Clean. Events (event name equals the payload's `type`):
  - `progress`: `{type:'progress', files, bytes, percent}`, sent every 200 ms
    while scanning (an interval, not per file: a 3M-file walk would otherwise
    produce millions of events). `percent` per the rules above.
  - `complete`: `{type:'complete', totalFiles, totalBytes, truncated,
    resultId}` -- the tree is **not** in this message.
  - `error`: `{type:'error', message}` for an unreadable path or a scan that
    hit the time limit with nothing to show (same two messages as `GET /`).
- `GET /api/disk-scan/result/:id` -- the finished tree as ordinary JSON,
  identical in shape to `GET /`'s body (`{...tree, truncated}`).

**Why a separate result fetch.** A drive with 3 million files produces a tree
that is tens of MB. Riding it in one SSE message would (a) make the client's
line-buffered reader (`streamSSE` in `api.js` concatenates chunks into one
string and scans it for newlines repeatedly) quadratic on one enormous line,
(b) block the event loop serialising it before the `complete` event could even
be sent, and (c) lose the only useful property of the stream, timely events,
behind one giant write. Stream-then-fetch keeps SSE for what it is good at
(small, frequent events) and reuses the plain JSON path that already handles
the large payload today. A POST-a-job-then-poll design was rejected: it needs
job ids and a polling loop on the client to get information SSE already pushes,
and the abort story is worse (closing the stream is the abort).

**Result store.** `lib/scanResults.js`: an in-memory Map, id from
`crypto.randomUUID()`, at most 2 entries (oldest evicted first), 2-minute TTL,
checked lazily on read and on insert (no timers, so nothing keeps the process
alive and tests need no fake timers). Not deleted on read, so a client retry of
the result fetch works; the TTL and cap bound memory. Local-only backend, one
user, so no per-client scoping.

**Abort.** `req.on('close')` aborts the scan's `AbortController` and clears the
interval, exactly as `GET /` does; an aborted scan stores nothing. The 30 s
`SCAN_TIMEOUT_MS` deadline is shared (the constant moves so both routes use
one) and yields `truncated: true` with the partial tree, as today.

**Counting.** `scanDirectory(dirPath, maxDepth, signal, exclusions, onFile)`
gains an optional fifth argument, called once per non-directory entry actually
stat'ed with its byte size. Excluded entries and unreadable directories are not
counted (they are not "scanned"). The walk visits files below the depth cap too
(depth only bounds the returned tree), so the counters are honest about work
done, not about what the tree shows. `onFile` is optional so every existing
caller and test is untouched.

**Percent helper.** `lib/scanPercent.js`: `scanPercent(bytes, inUseBytes)`
returns `null` unless `inUseBytes` is a positive finite number, else
`Math.min(99, Math.floor(bytes / inUseBytes * 100))`. Pure and unit-tested.
The route asks `getSystemDriveSpace()` once, only for a drive-root path on C:,
and a failure or null result just yields `percent: null`.

### Frontend

- `lib/api.js`: `fetchDiskScan(path, signal, { onProgress } = {})`. With no
  `onProgress` it is byte-for-byte today's behaviour (so the API tests and
  every test that mocks `fetchDiskScan` are unaffected). With one, it reads the
  SSE stream via the existing `streamSSE`, forwards `progress` and `complete`
  payloads to `onProgress`, throws the `error` event's message, then fetches
  `/disk-scan/result/:id` and returns the tree.
- `components/DiskScanProgress.jsx` (new). Props: `status`
  (`'idle' | 'scanning' | 'complete' | 'error'`), plus per-state data.
  - `scanning`: glass-panel card; label "Scanning <path>"; the existing two
    breathing rings + spinner tile (the v2.7 ring pulse must keep working);
    a percent readout **only when `percent` is a finite number**; a track with
    a `motion.div` fill (cyan gradient, glow) whose `width` animates to
    `percent` when real, or a sliding indeterminate segment when `percent` is
    `null`; a shimmer sweep over the fill; counters "N files scanned · X
    processed" (via `AnimatedNumber`, only when `files` is provided); for the
    fast scan (`mode="index"`), instead of counters, an elapsed-time readout
    and the "no progress is reported" note. `role="progressbar"` with
    `aria-valuenow` only when the percent is real (omitted when indeterminate,
    which is what the ARIA pattern for indeterminate means).
  - `complete`: a self-drawing checkmark (`motion.path`, `pathLength` 0 to 1),
    message, optional counts, "Scan again" button.
  - `error`: message (selectable, like `ScanFailure` today) and "Retry".
  - `idle`: renders nothing; the existing drive-root card is the idle state
    and is not duplicated inside this component. `status="idle"` exists so a
    parent can mount it unconditionally.
  - `LoadingState` and `ScanFailure` in `DiskMap.jsx` become thin wrappers
    over it, so their existing exports and tests keep working (the ring test is
    retained as-is; the "path" text test is loosened to match the new label).
- `components/AnimatedNumber.jsx`: `useCountUp` + a `format` prop; duration
  250 ms for the live counters (the default 600 ms lags a 5 Hz counter).
- DiskMap integration: `scanProgress` state fed by `fetchDiskScan`'s
  `onProgress` (reset when a new scan starts); the fast scan shows the
  indeterminate card while `fastScanning`; a compact "complete" strip shown
  above results after a scan whose completion is known, with "Scan again";
  errors render through the same card with "Retry". The Web Worker aggregates
  (`useDiskMapAggregates`) are untouched: progress is state on the scanning
  branch where `tree` is still null, so no aggregate recompute is triggered.

### i18n

All new strings live under `diskMap.scanProgress` (plus `diskMap.driveRootPrompt`
is unchanged) in all 40 languages, in one commit with the component, key parity
enforced by `catalog.test.js`, plus a Greek `DiskScanProgress.language.render.test.jsx`.
Strings are kept few and structurally simple (functions take already-formatted
numbers) to keep translation risk low. Low-confidence languages are reported at
the end.

## Part 3 -- motion

All honour `prefers-reduced-motion`: framer-motion via the existing
`MotionConfig` (tests supply their own), CSS via the existing global block
plus one added rule below.

- **Buttons**: `.btn-primary`, `.btn-ghost`, `.btn-danger` (the three named
  classes every button already uses; not hand-edited call sites) get
  `hover: scale(1.02)` (primary keeps its lift as `translateY(-2px)`) and
  `active: scale(0.98)`, with a spring-shaped cubic-bezier overshoot easing on
  transform. The spec asked for framer's spring; a CSS transition on the
  shared classes gives the same feel for hundreds of call sites without
  wrapping every `<button>` in `motion.button`, which the brief itself said to
  prefer against. Under reduced motion, transforms on these are neutralised
  (a new rule beside the existing `.lift` one).
- **Nav items**: `motion.button` with `whileHover={{scale:1.06}}`,
  `whileTap={{scale:0.94}}`, spring. The layoutId indicator is untouched.
- **Toggle switches**: one shared `components/Toggle.jsx` (the pill switch in
  `SettingsPage` and the hand-rolled twin in `AutomationSettings`), thumb on a
  framer spring. `role="switch"`, `aria-checked`, and the accessible name are
  preserved exactly. `StartupItems`'s switch is a tick, not a pill, and is left
  alone.
- **Progress shimmer + glow**: in `DiskScanProgress`.
- **Checkmark**: in `DiskScanProgress` complete state.
- **Counters**: `AnimatedNumber` in the scan counters.
- **Not done, by decision**: `AnimatePresence` page transitions (see table),
  card-hover-lift on new surfaces, confetti.

Existing motion (row sweep, ring pulse, `log-line-in`, toasts, `.lift`) is not
modified. Shared components are checked against render tests that assert on
classes before being changed.

## Part 4 -- docs

CHANGELOG `v2.8.0` gains an Added entry (real scan progress with a genuine
percent for whole-drive scans on C:, live counters, completion animation, nav
and toggle motion) and a Fixed entry (Disk Usage card text containment); its
one-line summary is updated to stay true. README Features gains a scan-progress
and motion entry and stale counts are corrected. No version numbers, tags,
pushes, images or GIFs.

## Testing strategy

TDD per task; every regression test is proven load-bearing by reverting the
production change and confirming the test fails.

- Backend: `scanPercent` (null/cap/floor), `scanResults` (TTL, cap, eviction),
  `scanDirectory` `onFile` counting (files only, bytes, exclusions skipped),
  `/stream` route (event sequence, percent null for a folder, real percent for
  `C:\` with a mocked disk-space, complete carries no tree, result fetch
  returns the tree, unknown id 404, abort stores nothing, missing path 400).
- Frontend: `fetchDiskScan` streaming (progress forwarded, complete then
  result fetch, error event throws, no-`onProgress` path unchanged),
  `useCountUp` (exact landing, down-count, reduced motion),
  `AnimatedNumber`, `DiskScanProgress` (each state, percent only when real,
  `aria-valuenow` only when real, indeterminate, elapsed, Retry/Scan again
  callbacks, checkmark path), containment classes on `DriveRootPrompt`,
  Greek render test, `Toggle` (role/name/checked/onChange preserved).

## Cannot verify without the running app

Actual paint of the shimmer/glow/spring feel, the card's layout at 900x560 /
1280 / 1920 in a real window, the elevated fast-scan path, real C:\ percent
behaviour on a multi-hundred-GB drive (whether the ratio sits below the cap
throughout, or pins at 99 for the tail). The orchestrator's live check covers
these.
