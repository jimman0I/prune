# Motion restraint, Stop button and a quieter scan card -- design

Date: 2026-09-24. Folded into v2.8.0 (no version change). Follows an
/apple-design review of the UI. References are the Apple HIG pages in
`~/.claude/skills/apple-design/references/hig/`.

Six items, in the order the review ranked them.

## 1. Stop button on the folder walk

> "When it's feasible, let people halt processing. If people can interrupt a
> process without causing negative side effects, include a Cancel button."
> (progress-indicators.md)

Deep Clean and Duplicates can be stopped; the Disk Map walk (30 s hard limit,
SSE stream) could not.

**What Stop means.** The walker already answers an abort with the partial
tree it has (`truncated: true`), so the right Stop is *ask the server to
abort, then show that partial result* with the existing "Scan stopped early"
wording. Cancel-and-return-to-idle (dropping the connection) was the
rejected fallback: it would discard exactly the partial result the user has
already waited for, and the abort machinery is already there.

Mechanics, all on the existing SSE stream:

- The stream's first event is `start` `{ scanId, remainingMs }`. `scanId` is a
  `randomUUID()` held in a module-level `runningScans` map until the stream's
  `finally` removes it, so a finished scan can no longer be stopped.
- `POST /api/disk-scan/stop/:id` looks the id up (404 if unknown or already
  finished) and aborts that scan's `AbortController`, marking it
  `stoppedByUser`. The stream carries on to its normal `complete` event
  (`truncated: true`, real `totalFiles`/`totalBytes`, a `resultId`); the client
  fetches the partial tree as usual. POST, not GET: it changes state.
- If the stop lands before any result exists (the root itself unread) the
  `error` message says it was *stopped*, not that it "took too long".
- Frontend: `stopDiskScan(scanId)` (POST, never throws; resolves false for a
  scan that already ended). `fetchDiskScan` forwards the `start` event;
  DiskMap keeps `scanId` in its progress state and passes `onStop` only once
  the id exists. The button reuses `deepClean.stop` ("Stop"), so no new
  string. It disables itself after one press.
- **The fast scan (admin) gets no Stop.** It runs in an elevated child
  (`Start-Process -Verb RunAs -Wait`) whose only channel back is one file at
  the end; the backend cannot signal it and there is nothing partial to keep.
  A Stop that did nothing would be worse than none. `mode="index"` never
  renders it, even if `onStop` is passed (tested).

## 2. No hover scale or bounce on buttons and nav

> "In apps, generally avoid adding motion to UI interactions that occur
> frequently." (motion.md)
>
> "Tightening animation springs to reduce bounce effects" (accessibility.md)
>
> "Always include a press state for a custom button." (buttons.md)

The previous round put `scale(1.02)` hover, a `translateY(-2px)` primary lift
and a `cubic-bezier(0.34, 1.56, 0.64, 1)` overshoot on every button, plus a
1.06 hover scale on nav items. Buttons are the most frequent interaction there
is. Now:

- `.btn-primary/.btn-ghost/.btn-danger`: press state kept (`:active
  scale(0.98)`), transform transition `120ms var(--ease-out-expo)` (no
  overshoot; the app's own "a tool that deletes things should not bounce"
  curve). Ghost and danger hover is colour only. Primary keeps a 1px lift, no
  scale. `:not(:disabled)` gating and the reduced-motion rule are kept (the
  rule is retargeted to the selectors that still transform).
- Nav buttons: hover scale removed; tap scale kept at 0.96 with a 120 ms
  non-spring transition; the `layoutId` sliding indicator, which is
  purposeful motion, is untouched.
- Guarded by `motionRestraint.test.js`, which reads the stylesheet/source
  (jsdom cannot evaluate hover transforms): no overshoot curve anywhere, the
  press states, no hover scale, primary lift only.

## 3. One indicator on the scan card

> "Add motion purposefully, supporting the experience without overshadowing
> it." (motion.md) and "Avoid labeling a spinning progress indicator."
> (progress-indicators.md)

With a real percent (whole-drive walk of C:) the card shows the bar and the
counters only: no pulse rings, no spinner. Rings and spinner stay only where
the bar is indeterminate (a folder walk with no percent, and the fast scan),
where they are the only sign of life. The honesty rules (percent only when
finite; time-left wording) are unchanged. Tests pin both modes.

## 4. Tab-switch fade

Was 300 ms fade plus a 12px slide on every screen change. Now 160 ms,
opacity only (`SCREEN_FADE_MS`), extracted to `hooks/useScreenFade.js` so it
can be tested. Still Web Animations on the container (screens stay mounted,
so not `AnimatePresence`), still cancelled on the next switch, still skipped
under `prefers-reduced-motion`.

## 5. Aurora pauses when the window is not in use

`hooks/useWindowActivity.js` sets `data-window-inactive` on `<html>` when the
window blurs or the document is hidden (re-reading `document.hidden` and
`document.hasFocus()` on every event so the sources cannot disagree), and
removes it on focus, visibility, or unmount. `index.css` sets
`animation-play-state: paused` on `body::before` and `body::after` under it.
Paused, not removed, so it resumes in place.

**The saving is not measured.** Two full-viewport fixed layers animating on
34 s / 47 s loops are *probably* worth stopping when nobody is looking, but
no profile was taken. It is a judgment call: it costs a few lines, has no
visible downside, and is purely UI (no setting). If a profile later shows no
difference it can be deleted.

## 6. Stale comment

The `index.css` Motion header claimed "There is no animation library here";
false since framer-motion is used for the nav indicator, toggles, toasts and
the scan card. Rewritten: CSS for transform/opacity feedback, framer-motion
only for what CSS cannot do well (layout indicator, springs, `pathLength`).

## Not verified without the running app

The feel of the 120 ms press and 160 ms fade; the real Electron window's
blur/focus/minimise events reaching the hook (jsdom only simulates them);
whether Stop on a real `C:\` walk returns the partial tree promptly (the mock
walker aborts instantly; the real one checks the signal between entries and
inside fs calls, measured at ~2 ms after abort in the earlier probe).
