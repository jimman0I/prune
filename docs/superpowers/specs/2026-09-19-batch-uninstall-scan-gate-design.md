# Batch uninstall scan gate: design

## The bug, confirmed by live reproduction

`BatchUninstallModal.jsx`'s `runBatch` scans a program for leftovers the instant its spawned uninstaller *process* exits, not once the uninstall has actually finished. Confirmed today with a real Riot Client / VALORANT uninstall: `RiotClientServices.exe --uninstall-product=valorant --uninstall-patchline=live` returns almost immediately, but the real 32GB removal either needs a separate confirmation dialog or happens in a decoupled long-lived process Prune never tracks. The batch flow declared "Uninstalled 1 of 1" and ran its leftover scan immediately — finding and cleaning small artifacts (an AppData cache folder, a registry key) while `C:\Riot Games\VALORANT\live` (with `VALORANT.exe` still present) was never touched. No process was left running and the folder was byte-for-byte unchanged: the uninstall never actually happened, and Prune declared success too early.

This is the exact race `backend/src/services/uninstall.js`'s own doc comment already names: *"The exit code is surfaced but never used to gate whether the leftover scan runs afterward... uninstallers routinely report success when they weren't, and vice versa."*

`UninstallModal.jsx` (the single-uninstall flow) already defends against this with an explicit `readyToScan` step: after the uninstaller process exits, it shows a screen with a real "Scan" button and does **not** scan until the user clicks it. `BatchUninstallModal.jsx` has no equivalent — its state machine is `confirm -> running -> review -> done`, and `runBatch` scans each program the moment its own `streamUninstall`/`removeStoreApp` call resolves, for every program in the batch.

Ground truth this design must respect: `RiotClientServices.exe` returns near-instantly with no reliable exit-code signal. This cannot be solved by waiting a bit longer or inspecting the exit code more carefully — some real uninstallers do genuine background work after their own process exits, on a timescale (minutes, for a 32GB game) no fixed grace period can safely cover.

## The design question

Batch uninstall runs N programs in sequence (Windows Installer's machine-wide mutex forbids parallel MSI uninstalls). Should each program in the batch get its own individual "ready to scan" confirmation — mirroring the single-uninstall flow exactly, meaning N clicks for an N-program batch — or should the whole batch pause once, at the end, before scanning any of them?

### Why not N per-program gates

Batch uninstall's entire reason to exist is *avoiding* per-program babysitting: the confirm screen already says "Each program's own uninstaller runs in turn... Prune scans for what they leave behind and shows you everything before removing any of it" as a single, one-shot promise. Requiring a manual click after every single program's uninstaller exits — the exact mechanical shape of the single-uninstall flow's `readyToScan` step, replayed N times — would reintroduce the babysitting the batch feature exists to remove. For a 10-program batch, that is 10 blocking clicks the user cannot get ahead of, each one gating on a program whose async completion state is exactly as unknowable as the last one's. It technically closes the honesty gap but at a UX cost disproportionate to what batch uninstall is for.

### Why not silently keep scanning immediately (status quo)

Already ruled out: it is the confirmed bug. Removing it without any replacement would still let the current run's own dishonest "Uninstalled 1 of 1" + immediate clean-artifact-only scan repeat on the very next Riot Client (or any other async-uninstaller) batch.

### Why not a grace period

A short fixed delay ("wait 3-5 seconds after exit, then scan") is explicitly ruled out by the evidence: VALORANT's real removal takes on the order of minutes for 32GB, not seconds. A grace period long enough to matter for that case would make every ordinary batch (msiexec-style uninstalls that really are done when the process exits) feel sluggish for no benefit, and a grace period short enough to feel responsive does nothing for the actual case that broke today. This is cosmetic, not a fix.

## Decision: one combined confirmation, after all N uninstalls, before any scan

`BatchUninstallModal.jsx` gets a new `readyToScan` phase between `running` and `review`. Once every program's uninstaller has been spawned and its process has exited (loop over `ordered` completes, exactly as it does today), the batch pauses on a single screen: *"N uninstallers finished running. Some — game launchers especially — keep removing files in the background after their own window closes. Give it a moment if you're not sure, then click Scan to check for anything left behind."* One click resumes the batch and scans every eligible program in the original per-program order, then proceeds to the existing `review` step unchanged.

This is one click for the whole batch, not N — batch uninstall's "less babysitting" purpose is preserved. It is a real, explicit human confirmation, not a timer — no claim of completion is made before the person looking at their own machine says it's fine to check. And it is honest by construction: the "Uninstalled N of M" claim on the eventual review screen is unchanged (uninstaller processes really did exit — that claim was never false), but the leftover *scan* — which is what actually gets acted on, since ticked items get moved to Quarantine/Recycle Bin/deleted — no longer starts before a human has had the chance to notice a program is still visibly working.

The `readyToScan` screen's own copy is the second layer of defense the task's own framing invited: rather than silently trusting that a click means "definitely done," it says plainly that some uninstallers keep working in the background, so a person who clicks Scan immediately for a batch that includes something like Riot Client is making an informed choice, not being told the job is provably finished. This mirrors `UninstallModal.jsx`'s own `readyToScan.body` copy ("If X's own uninstaller is still finishing up, let it close first"), scaled to a whole batch.

**Skipped entirely** (goes straight from the uninstall loop to `review`, exactly as today, no new click) when there is nothing to gate:
- `scanLeftoversAfterUninstall` is off in Settings — no scan will ever run, so there is nothing to confirm readiness for.
- Every program that succeeded is a Store app, or none succeeded at all — the existing per-program rule (`program.source !== 'store' && scanAfter`) already means zero scans would run in either case.

### The freshness trade-off, named explicitly

`runBatch`'s own existing code comment explains why it scans a program immediately after that program's own uninstall, rather than batching every scan to the very end: *"the program's own files are freshest now, and a later uninstaller could remove a shared folder this one still had."* Deferring every scan until after all N uninstalls have run necessarily weakens this: by the time program A is scanned, program B and C's uninstallers have already run too, and in the rare case where a later program's uninstaller genuinely deletes a folder an earlier program's scan would have found, that folder is now gone before anyone looked for it.

This is a real, accepted trade-off, not an oversight. Two things bound its actual cost:
1. **Scan order is unchanged.** Programs are still scanned in the same per-program order (`ordered`, then filtered to whoever actually succeeded), so `mergeLeftovers`' own de-duplication and per-item program attribution behave exactly as before — only the wall-clock delay between "this program's own uninstall" and "this program's own scan" grows, not the relative sequencing between programs.
2. **The failure mode is silent omission, not a false claim.** If a shared folder is removed by a later uninstaller before an earlier program's scan runs, the result is that folder is *correctly* absent (it no longer exists) — a slightly less thorough cleanup, never a claim that something was cleaned when it wasn't. That is a strictly less severe failure than the bug this change fixes, which was declaring a full uninstall+cleanup success while 32GB sat completely untouched.

Given the choice between a narrow, already-rare freshness optimization and a confirmed, reproduced honesty bug, correctness wins. The trade-off is judged acceptable and is documented here and in the new code's own comments, not silently absorbed.

## What does not change

- `UninstallModal.jsx` (single-uninstall flow) — already correct, untouched.
- The uninstall loop itself (`ordered`, per-program sequential execution, Store-app branch, failure handling, `appendHistoryEntry`) — unchanged.
- `mergeLeftovers`, `LeftoverReview`, the `review`/`removing`/`done` phases and their existing copy — unchanged; they still receive the same shape of merged scan result they always did, just produced one step later in the flow.
- The `scanCount === 0` messaging on the `review` phase (`noScanSettingsOff` / `noScanStore`) — unchanged, reached via the same shortcut path as today when nothing is eligible to scan.

## New UI copy (English; translated into all 40 catalog languages per `catalog.test.js`'s completeness check)

```
batchUninstallModal.readyToScan.body: (n) =>
  `${n} uninstaller${n === 1 ? '' : 's'} finished running. Some — game launchers
  especially — keep removing files in the background after their own window
  closes. Give it a moment if you're not sure, then click Scan to check for
  anything left behind.`
batchUninstallModal.readyToScan.scanButton: 'Scan for leftovers'
batchUninstallModal.scanningLine: 'Scanning for leftovers…'
```

(Scan-failure error text reuses the existing shared `uninstallModal.scanFailed` key, exactly as `UninstallModal.jsx` already does — no new key needed for that path.)

## Testing

- `BatchUninstallModal.render.test.jsx`: new coverage for
  - the batch lands on a `readyToScan` step (a "Scan for leftovers" button, no scan calls yet) once every uninstaller has exited, instead of scanning immediately;
  - `scanForLeftovers` is not called until that button is clicked, then is called once per eligible (non-Store, succeeded) program, in the original order;
  - closing from `readyToScan` calls `onFinished` then `onClose` without ever scanning;
  - a batch with `scanLeftoversAfterUninstall` off skips `readyToScan` entirely and lands directly on `review` with `scanCount === 0`, unchanged from today;
  - a batch where every program is a Store app (or every uninstall fails) also skips `readyToScan` and lands directly on `review` with `scanCount === 0`;
  - a scan failure from the gate returns to `readyToScan` (not `confirm` or `running`) with the error shown, mirroring `UninstallModal.jsx`'s own `readyToScan` failure-recovery behavior.
- `catalog.test.js` (pre-existing, unmodified): enforces that the three new keys exist, correctly typed and non-blank, in all 40 languages.

## Out of scope

- No release, no `CHANGELOG.md`/version bump.
- No change to the single-uninstall flow.
- No attempt to detect real uninstall completion more precisely (polling for a game folder to shrink, watching for a related process, etc.) — that is a different, much larger feature; this fix is about not making a false claim before a human has looked, not about automating the detection problem away.
