# System Health score: design

> **Update 2026-09-25: the score is now drive-only.** Prune is a storage app, so the Dashboard panel is titled "Drive health" and scores the drive alone: life remaining (or its status tone when no percent exists), capped at 40 -- the red band -- when the drive reports media or uncorrected errors. Free space and broken apps were dropped from the score (they have their own cards, and a healthy SSD on a full disk read as unhealthy), the breakdown line was removed, and so was the live CPU/memory monitor beside it. The weights, the storage and apps components and the composite maths below describe the original design and no longer apply; the "null until loaded" guarantee still does.

## Why

`docs/superpowers/specs/2026-08-29-unrevo-uninstaller-design.md` explicitly deferred a "Dashboard/health-score overview" as a future phase. No design or engine work exists for it yet. This closes that gap: a single at-a-glance "how healthy is this PC" number, replacing the Dashboard's current pure-drive-wear ring with a composite score.

## Scope

In scope: a 0-100 composite score computed entirely from data the Dashboard already fetches on load (drive health/SMART, free disk space, broken/orphaned app count, hardware error counts) -- no new backend work, no new scan, nothing that requires an explicit user action beyond opening the app.

Out of scope, deliberately: junk-file size (only exists after an explicit ~30s Deep Clean scan the app never runs automatically -- including it would mean either running that scan silently on Dashboard load, which breaks this app's established no-auto-scan convention, or shipping a score that's incomplete until the user visits a different screen first). Startup-item impact scoring (a real 2.7 feature idea, no engine exists for it at all yet -- a separate future addition). Historical tracking of the score over time (the "dashboard summary over time" half of the other picked 2.7 idea) -- this spec is the score itself, not a history of it.

## The formula

100 points total, four components:

- **Drive health -- 40 pts.** When `lifeRemainingPercent` is available (the common case for NVMe drives, readable without elevation via the SMART log page -- see `backend/src/services/diskHealth.js`'s `getNvmeSmart()`): `40 * (lifeRemainingPercent / 100)`. When it isn't (SATA/spinning disks, or an NVMe drive whose SMART log genuinely can't be read even after the elevated "Read Wear" unlock), fall back to Windows' own `HealthStatus`-derived tone, same `driveVerdict()` classification the current UI already computes: `success` → 40, `warning` → 20, `danger` → 0, `muted` (genuinely unknown) → 30. An unknown is not a known problem and must not score as one.

- **Free disk space -- 25 pts.** From `diskSpace.freeBytes / diskSpace.totalBytes`. Full 25 points at 20% free or above, scaling linearly down to 0 at 2% free or below (roughly matching Windows' own low-disk-space warning thresholds): `25 * clamp((freePercent - 2) / 18, 0, 1)`.

- **Broken/orphaned apps -- 20 pts.** `max(0, 20 - 5 * brokenCount)` -- the same `brokenCount` the Installed Apps card already computes (`programs.filter(p => p.health?.orphaned).length`). Zero broken apps scores full; 4 or more scores 0.

- **Hardware errors -- 15 pts.** Full 15 unless the drive reports any of: `smart.mediaErrors > 0`, `readErrorsUncorrected > 0`, or `writeErrorsUncorrected > 0`, in which case 0. Binary, not scaled -- a single uncorrected error or a single bad media block is already a real, actionable signal (this app's own `SmartAttributes` component already highlights either as `danger`-toned for exactly this reason), not something to average away.

## Partial data

Any component whose underlying data hasn't loaded yet (or is inapplicable) is excluded from both the numerator and the denominator, not defaulted to 0 or 100 -- the score is computed "out of" whatever's currently known (e.g. out of 75 if only drive/apps/errors are loaded and storage hasn't answered yet), then scaled back to a 0-100 display value. This mirrors `selectionTotal.js`'s own "unmeasured is not measured-and-empty" rule. If literally nothing has loaded yet, the ring shows nothing (its existing `percent == null` fallback), never a fabricated number.

## Implementation

**New file:** `frontend/src/lib/healthScore.js` -- a pure function:

```
computeHealthScore({ driveVerdict, primaryDisk, diskSpace, brokenCount })
  -> { score: number | null, breakdown: { drive: number|null, storage: number|null, apps: number|null, errors: number|null } }
```

Each `breakdown` entry is that component's own 0-100 normalized value (not its weighted points), so the UI's compact summary line ("Drive 92 · Storage 78 · Apps 100 · Errors 100") reads as comparable percentages across all four, while the weighting only matters for combining them into `score`.

**Dashboard.jsx changes:**
1. Card title: "Drive Health" -> "System Health".
2. `HealthGauge` is fed `computeHealthScore(...)`'s `score` instead of `verdict.percent`.
3. A new compact breakdown line directly under the title, using the four `breakdown` values, rendered only for components that aren't `null`.
4. Everything currently below that in the card (disk model/media/bus line, the lifeRemaining/temp/poweredOn line or the `HealthStatus` fallback line, the "Read Wear" button, `SmartAttributes`, the uncorrected-errors warning) is unchanged in content, moved under a new small "Drive detail" sub-heading so it reads as still specifically about the disk, distinct from the composite score above it.

No backend changes. No new settings. No new i18n namespace beyond the new card title, breakdown labels, and sub-heading strings (added to the existing `dashboard.*` catalog namespace, all 40 languages, same commit as the feature, per this project's standing i18n discipline).

## Testing

- `frontend/src/lib/healthScore.test.js`: each component's scaling/threshold math in isolation (drive with a real percent, drive falling back to each tone, storage above/at/below the 20%/2% thresholds, 0 through 4+ broken apps, zero vs. any nonzero error count), plus the partial-data rescaling case (one or more components `null`) and the all-`null` case (`score: null`).
- `Dashboard.render.test.jsx`: new describe block asserting the ring displays the composite score (not raw drive-wear %) against a fixture with known component values, and that the breakdown line renders those same values.
- i18n: new catalog keys added to all 40 languages in the same commit, per standing practice.
