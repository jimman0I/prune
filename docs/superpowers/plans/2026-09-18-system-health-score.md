# System Health Score Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Dashboard's pure-drive-wear ring with a composite 0-100 "System Health" score computed from data the Dashboard already has on load (drive health, free disk space, broken/orphaned apps, hardware errors) -- no new backend work, no new scan.

**Architecture:** A new pure function `computeHealthScore()` in `frontend/src/lib/healthScore.js` takes the same values `Dashboard.jsx` already computes (`driveVerdict`, `primaryDisk`, `diskSpace`, `brokenCount`) and returns `{ score, breakdown }`. `Dashboard.jsx`'s existing "Drive Health" card is retitled "System Health", its ring is fed the composite score instead of raw drive-wear %, and a new breakdown line plus a "Drive detail" sub-heading are added around the card's existing content, which is otherwise unchanged.

**Tech Stack:** React frontend, Vitest + Testing Library, this project's existing i18n catalog system.

---

### Task 1: `computeHealthScore()`

**Files:**
- Create: `frontend/src/lib/healthScore.js`
- Test: `frontend/src/lib/healthScore.test.js`

**A real design gap to build in correctly from the start, not discover later**: `brokenCount` is a plain number, always available synchronously from the `programs` prop (Dashboard.jsx computes it via `useMemo` over `programs || []`, defaulting to 0 if `programs` is empty) -- it is never "still loading" the way `diskSpace`/`primaryDisk` genuinely are (both arrive from async queries that are `null` until they resolve). If the apps component were allowed to make the score visible on its own, the very first render (before any real disk data has arrived) would show a fabricated "100% healthy" using only the apps component's default full score -- exactly the kind of invented number this app's own `HealthGauge` (a real percent or nothing, never a placeholder) and `driveVerdict()` (an honest "unknown" over a guess) already refuse to show elsewhere. So: **the composite score itself is `null` (nothing rendered) until BOTH `breakdown.drive` and `breakdown.storage` are non-null** -- those are the only two components with genuine async loading uncertainty. Apps and errors are folded in once available, but never make a score appear before the two real reads have answered.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/lib/healthScore.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { computeHealthScore } from './healthScore.js';

const HEALTHY_DRIVE_VERDICT = { percent: 90, statusLabel: null, tone: 'success' };
const DISK_SPACE_25_PERCENT_FREE = { freeBytes: 250, totalBytes: 1000 }; // 25% free
const CLEAN_DISK = { readErrorsUncorrected: 0, writeErrorsUncorrected: 0, smart: { mediaErrors: 0 } };

describe('computeHealthScore -- drive component', () => {
  it('uses the real life-remaining percent directly when one exists', () => {
    const { breakdown } = computeHealthScore({
      driveVerdict: { percent: 77, statusLabel: null, tone: 'success' },
      primaryDisk: CLEAN_DISK, diskSpace: DISK_SPACE_25_PERCENT_FREE, brokenCount: 0
    });
    expect(breakdown.drive).toBe(77);
  });

  it('falls back to a tone-based value when no percent exists: success', () => {
    const { breakdown } = computeHealthScore({
      driveVerdict: { percent: null, statusLabel: 'Healthy', tone: 'success' },
      primaryDisk: CLEAN_DISK, diskSpace: DISK_SPACE_25_PERCENT_FREE, brokenCount: 0
    });
    expect(breakdown.drive).toBe(100);
  });

  it('falls back to a tone-based value when no percent exists: warning', () => {
    const { breakdown } = computeHealthScore({
      driveVerdict: { percent: null, statusLabel: 'Warning', tone: 'warning' },
      primaryDisk: CLEAN_DISK, diskSpace: DISK_SPACE_25_PERCENT_FREE, brokenCount: 0
    });
    expect(breakdown.drive).toBe(50);
  });

  it('falls back to a tone-based value when no percent exists: danger', () => {
    const { breakdown } = computeHealthScore({
      driveVerdict: { percent: null, statusLabel: 'Unhealthy', tone: 'danger' },
      primaryDisk: CLEAN_DISK, diskSpace: DISK_SPACE_25_PERCENT_FREE, brokenCount: 0
    });
    expect(breakdown.drive).toBe(0);
  });

  it('a genuinely unknown drive verdict (a real answer, not a loading state) scores as neutral, not failing', () => {
    const { breakdown } = computeHealthScore({
      driveVerdict: { percent: null, statusLabel: 'Unknown', tone: 'muted' },
      primaryDisk: CLEAN_DISK, diskSpace: DISK_SPACE_25_PERCENT_FREE, brokenCount: 0
    });
    expect(breakdown.drive).toBe(75);
  });

  it('is null when drive data has not loaded yet at all', () => {
    const { breakdown, score } = computeHealthScore({
      driveVerdict: null, primaryDisk: null, diskSpace: DISK_SPACE_25_PERCENT_FREE, brokenCount: 0
    });
    expect(breakdown.drive).toBeNull();
    // The whole score stays hidden until drive AND storage have both
    // answered -- see this task's own top-of-file note for why.
    expect(score).toBeNull();
  });
});

describe('computeHealthScore -- storage component', () => {
  it('scores full at 20% free or above', () => {
    const { breakdown } = computeHealthScore({
      driveVerdict: HEALTHY_DRIVE_VERDICT, primaryDisk: CLEAN_DISK,
      diskSpace: { freeBytes: 200, totalBytes: 1000 }, brokenCount: 0 // 20% free
    });
    expect(breakdown.storage).toBe(100);
  });

  it('scores 0 at 2% free or below', () => {
    const { breakdown } = computeHealthScore({
      driveVerdict: HEALTHY_DRIVE_VERDICT, primaryDisk: CLEAN_DISK,
      diskSpace: { freeBytes: 20, totalBytes: 1000 }, brokenCount: 0 // 2% free
    });
    expect(breakdown.storage).toBe(0);
  });

  it('scales linearly between the two thresholds', () => {
    const { breakdown } = computeHealthScore({
      driveVerdict: HEALTHY_DRIVE_VERDICT, primaryDisk: CLEAN_DISK,
      diskSpace: { freeBytes: 110, totalBytes: 1000 }, brokenCount: 0 // 11% free, halfway between 2 and 20
    });
    expect(breakdown.storage).toBe(50);
  });

  it('is null when disk space has not loaded yet, and so is the whole score', () => {
    const { breakdown, score } = computeHealthScore({
      driveVerdict: HEALTHY_DRIVE_VERDICT, primaryDisk: CLEAN_DISK, diskSpace: null, brokenCount: 0
    });
    expect(breakdown.storage).toBeNull();
    expect(score).toBeNull();
  });
});

describe('computeHealthScore -- apps component', () => {
  it('scores full with zero broken apps', () => {
    const { breakdown } = computeHealthScore({
      driveVerdict: HEALTHY_DRIVE_VERDICT, primaryDisk: CLEAN_DISK, diskSpace: DISK_SPACE_25_PERCENT_FREE, brokenCount: 0
    });
    expect(breakdown.apps).toBe(100);
  });

  it('deducts per broken app', () => {
    const { breakdown } = computeHealthScore({
      driveVerdict: HEALTHY_DRIVE_VERDICT, primaryDisk: CLEAN_DISK, diskSpace: DISK_SPACE_25_PERCENT_FREE, brokenCount: 2
    });
    expect(breakdown.apps).toBe(50);
  });

  it('floors at 0 rather than going negative', () => {
    const { breakdown } = computeHealthScore({
      driveVerdict: HEALTHY_DRIVE_VERDICT, primaryDisk: CLEAN_DISK, diskSpace: DISK_SPACE_25_PERCENT_FREE, brokenCount: 10
    });
    expect(breakdown.apps).toBe(0);
  });
});

describe('computeHealthScore -- errors component', () => {
  it('scores full with no reported errors', () => {
    const { breakdown } = computeHealthScore({
      driveVerdict: HEALTHY_DRIVE_VERDICT, primaryDisk: CLEAN_DISK, diskSpace: DISK_SPACE_25_PERCENT_FREE, brokenCount: 0
    });
    expect(breakdown.errors).toBe(100);
  });

  it('scores 0 for any media error, regardless of count', () => {
    const { breakdown } = computeHealthScore({
      driveVerdict: HEALTHY_DRIVE_VERDICT,
      primaryDisk: { ...CLEAN_DISK, smart: { mediaErrors: 1 } },
      diskSpace: DISK_SPACE_25_PERCENT_FREE, brokenCount: 0
    });
    expect(breakdown.errors).toBe(0);
  });

  it('scores 0 for an uncorrected read error', () => {
    const { breakdown } = computeHealthScore({
      driveVerdict: HEALTHY_DRIVE_VERDICT,
      primaryDisk: { ...CLEAN_DISK, readErrorsUncorrected: 1 },
      diskSpace: DISK_SPACE_25_PERCENT_FREE, brokenCount: 0
    });
    expect(breakdown.errors).toBe(0);
  });

  it('scores 0 for an uncorrected write error', () => {
    const { breakdown } = computeHealthScore({
      driveVerdict: HEALTHY_DRIVE_VERDICT,
      primaryDisk: { ...CLEAN_DISK, writeErrorsUncorrected: 1 },
      diskSpace: DISK_SPACE_25_PERCENT_FREE, brokenCount: 0
    });
    expect(breakdown.errors).toBe(0);
  });

  it('is null when there is no disk at all', () => {
    const { breakdown } = computeHealthScore({
      driveVerdict: null, primaryDisk: null, diskSpace: DISK_SPACE_25_PERCENT_FREE, brokenCount: 0
    });
    expect(breakdown.errors).toBeNull();
  });
});

describe('computeHealthScore -- the composite score', () => {
  it('weights drive 40, storage 25, apps 20, errors 15 when everything is known and perfect', () => {
    const { score } = computeHealthScore({
      driveVerdict: { percent: 100, statusLabel: null, tone: 'success' },
      primaryDisk: CLEAN_DISK, diskSpace: { freeBytes: 500, totalBytes: 1000 }, brokenCount: 0
    });
    expect(score).toBe(100);
  });

  it('a real mixed case computes the documented weighted average', () => {
    // drive 50 (warning tone) * 40 + storage 100 * 25 + apps 75 (1 broken app) * 20 + errors 100 * 15
    // = 2000 + 2500 + 1500 + 1500 = 7500 / 100 = 75
    const { score } = computeHealthScore({
      driveVerdict: { percent: null, statusLabel: 'Warning', tone: 'warning' },
      primaryDisk: CLEAN_DISK, diskSpace: { freeBytes: 500, totalBytes: 1000 }, brokenCount: 1
    });
    expect(score).toBe(75);
  });

  it('rescales the denominator when errors is unavailable but drive and storage are known', () => {
    // This can't actually happen with a real primaryDisk (drive requires
    // primaryDisk, and primaryDisk implies errors is computable too), but
    // the function must not divide by a weight that was never included.
    // drive 100*40 + storage 100*25 + apps 100*20 = 8500 / 85 = 100
    const { score } = computeHealthScore({
      driveVerdict: { percent: 100, statusLabel: null, tone: 'success' },
      primaryDisk: null, diskSpace: { freeBytes: 500, totalBytes: 1000 }, brokenCount: 0
    });
    // drive itself requires primaryDisk truthiness in real Dashboard usage
    // (see Task 3), but this function only sees what it's handed -- prove
    // it doesn't crash or divide by zero on an inconsistent input, and
    // that a null errors component is excluded from both sides of the
    // average rather than silently scored as 0.
    expect(score).toBe(100);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && npx vitest run src/lib/healthScore.test.js`
Expected: FAIL — `Cannot find module './healthScore.js'`.

- [ ] **Step 3: Write `computeHealthScore`**

Create `frontend/src/lib/healthScore.js`:

```js
/** How much of the composite score each signal is worth. Drive wear
 * matters most (real data-loss risk); free space and broken apps are
 * real but recoverable annoyances; hardware errors are rare but serious
 * when present. See docs/superpowers/specs/2026-09-18-system-health-
 * score-design.md for the full reasoning behind these weights. */
const WEIGHTS = { drive: 40, storage: 25, apps: 20, errors: 15 };

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

/** The drive's own life-remaining percent when one exists (the common
 * case for NVMe, readable without elevation -- see
 * backend/src/services/diskHealth.js's getNvmeSmart()). Otherwise a
 * tone-based fallback matching Dashboard.jsx's own driveVerdict()
 * classification. `muted` -- a REAL answer that genuinely doesn't know,
 * not a loading state -- scores neutral rather than failing: an unknown
 * is not a known problem. Null only when there is no verdict at all
 * (nothing has loaded yet); see this file's caller for how that's kept
 * distinct from a real "unknown" answer. */
function driveComponent(driveVerdict) {
  if (!driveVerdict) return null;
  if (driveVerdict.percent != null) return driveVerdict.percent;
  const toneScore = { success: 100, warning: 50, danger: 0, muted: 75 };
  return toneScore[driveVerdict.tone] ?? null;
}

/** Full credit at 20% free or above, scaling linearly down to 0 at 2%
 * free or below -- roughly Windows' own low-disk-space warning range. */
function storageComponent(diskSpace) {
  if (!diskSpace || typeof diskSpace.freeBytes !== 'number' || typeof diskSpace.totalBytes !== 'number' || diskSpace.totalBytes <= 0) {
    return null;
  }
  const freePercent = (diskSpace.freeBytes / diskSpace.totalBytes) * 100;
  return clamp01((freePercent - 2) / 18) * 100;
}

/** brokenCount is always a real number (Dashboard.jsx computes it
 * synchronously from the programs prop, defaulting to 0), never a
 * loading state -- so this never returns null. -25 per broken app,
 * floored at 0. */
function appsComponent(brokenCount) {
  const count = typeof brokenCount === 'number' ? brokenCount : 0;
  return Math.max(0, 100 - 25 * count);
}

/** Binary, not scaled: a single uncorrected error or bad media block is
 * already a real, actionable signal (the same reasoning Dashboard.jsx's
 * own SmartAttributes component already applies by highlighting either
 * red on sight), not something to average away. Null when there's no
 * disk to report on at all. */
function errorsComponent(primaryDisk) {
  if (!primaryDisk) return null;
  const mediaErrors = primaryDisk.smart?.mediaErrors ?? 0;
  const readErrors = primaryDisk.readErrorsUncorrected ?? 0;
  const writeErrors = primaryDisk.writeErrorsUncorrected ?? 0;
  return (mediaErrors > 0 || readErrors > 0 || writeErrors > 0) ? 0 : 100;
}

/** The Dashboard's composite "how healthy is this PC" score: 0-100,
 * combining drive health, free disk space, broken/orphaned apps and
 * hardware errors. Each `breakdown` entry is that component's own 0-100
 * normalized value (not its weighted points), so the UI can show
 * "Drive 92 · Storage 78 · Apps 100 · Errors 100" as comparable
 * percentages; the weights only apply when combining them into `score`.
 *
 * `score` is null until BOTH `breakdown.drive` and `breakdown.storage`
 * are known -- those are the only two components with genuine async
 * loading uncertainty (apps and errors either come from data that's
 * already loaded by the time this runs, or are excluded the same way).
 * Without this gate, the very first render (before any real disk data
 * has arrived) would show a fabricated "100% healthy" from the apps
 * component's own always-available default -- exactly the invented
 * number this app's HealthGauge and driveVerdict() already refuse to
 * show elsewhere. */
export function computeHealthScore({ driveVerdict, primaryDisk, diskSpace, brokenCount }) {
  const breakdown = {
    drive: driveComponent(driveVerdict),
    storage: storageComponent(diskSpace),
    apps: appsComponent(brokenCount),
    errors: errorsComponent(primaryDisk)
  };

  if (breakdown.drive == null || breakdown.storage == null) {
    return { score: null, breakdown };
  }

  let weightedSum = 0;
  let totalWeight = 0;
  for (const key of Object.keys(WEIGHTS)) {
    const value = breakdown[key];
    if (value == null) continue;
    weightedSum += value * WEIGHTS[key];
    totalWeight += WEIGHTS[key];
  }

  const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : null;
  return { score, breakdown };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/healthScore.test.js`
Expected: PASS, 19/19.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/healthScore.js frontend/src/lib/healthScore.test.js
git commit -m "feat(dashboard): add computeHealthScore, the System Health composite"
```

Note: do NOT add a `Co-Authored-By: Claude` line — this project's convention is no AI attribution in commits.

---

### Task 2: i18n keys, all 40 languages

Ordered before the Dashboard wiring (Task 3) so every commit stays green — the same reason Cookies to Preserve's plan put its i18n task before its consuming component.

**Files:**
- Modify: `frontend/src/i18n/catalog.js`

- [ ] **Step 1: Add the English keys**

In `frontend/src/i18n/catalog.js`, find the `en` language block's `dashboard.driveHealth` object (around line 212) and add a new sibling key `systemHealth` immediately before it, inside the same `dashboard` object:

```js
      systemHealth: {
        title: 'System Health',
        breakdownLine: (drive, storage, apps, errors) => `Drive ${drive} · Storage ${storage} · Apps ${apps} · Errors ${errors}`,
        driveDetailHeading: 'Drive detail'
      },
```

Each of `drive`/`storage`/`apps`/`errors` is a pre-formatted string (e.g. `'92'` or `'—'` for an excluded component) computed in `Dashboard.jsx`, not a raw number the catalog function formats itself -- this keeps the translated sentence a single natural phrase per language (word order and the `·` separator convention are not universal) rather than four separately-interpolated fragments, matching how this catalog's other multi-value sentences (e.g. `dashboard.driveHealth.uncorrectedErrors`) are already built.

- [ ] **Step 2: Run the catalog completeness test to see which languages are missing the new key**

Run: `cd frontend && npx vitest run src/i18n/catalog.test.js`
Expected: FAIL — every one of the other 39 language codes listed as missing `dashboard.systemHealth.*`.

- [ ] **Step 3: Add the same 3 keys to every other language block**

For each of the other 39 languages in `frontend/src/i18n/catalog.js`, find that language's own `dashboard.driveHealth` object and add a `systemHealth` sibling immediately before it, with the same 3 keys (`title`, `driveDetailHeading` as plain strings; `breakdownLine` as a function with the same 4-parameter shape as English), translated naturally into that language, matching the tone that language's own `dashboard.driveHealth`/`dashboard.smart` keys already use. Flag any language translated with lower confidence in the commit message (this project's standing lower-confidence list: Afrikaans, Welsh, Icelandic, Pashto, Albanian, Serbian) and double-check any place a language's own grammar needs singular/plural agreement inside `breakdownLine` (it doesn't take a count directly, but check anyway if a language's word for "Drive"/"Storage"/etc. would naturally change form next to a number).

- [ ] **Step 4: Run the catalog completeness test again**

Run: `cd frontend && npx vitest run src/i18n/catalog.test.js`
Expected: PASS — every language has the key, matching English's shape, no blanks.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/i18n/catalog.js
git commit -m "feat(dashboard): add systemHealth strings, all 40 languages"
```

Note: do NOT add a `Co-Authored-By: Claude` line.

---

### Task 3: Wire the score into Dashboard.jsx

**Files:**
- Modify: `frontend/src/components/Dashboard.jsx`
- Modify: `frontend/src/components/Dashboard.render.test.jsx`

**Files reviewed for exact insertion points:**
- `Dashboard.jsx`'s Drive Health card starts at `<div className="glass-panel flex items-center gap-6 p-8 flex-1 min-w-0">` (line 274) and its title is `<div className="text-[18px] font-medium text-[color:var(--text-primary)] mb-1">{t('dashboard.driveHealth.title')}</div>` (line 277).
- `verdict` is computed at line 258 (`const verdict = driveVerdict(primaryDisk, t('dashboard.driveHealth.unknownStatus'));`) and fed to `HealthGauge` at line 275 (`<HealthGauge percent={verdict.percent} statusLabel={verdict.statusLabel} tone={verdict.tone} />`).
- `brokenCount` is already computed at lines 201-204.

- [ ] **Step 1: Write the failing test**

In `frontend/src/components/Dashboard.render.test.jsx`, add this describe block (the existing `fetchDiskSpace`/`fetchDiskHealth` mocks and `render()` helper are already set up at the top of the file — reuse them):

```jsx
describe('the System Health score', () => {
  it('shows the composite score, not the raw drive-wear percent, and a breakdown line', async () => {
    fetchDiskHealth.mockResolvedValue({
      disks: [{
        deviceId: '0', model: 'Test NVMe', mediaType: 'SSD', healthStatus: 'Healthy',
        lifeRemainingPercent: 100, readErrorsUncorrected: 0, writeErrorsUncorrected: 0,
        smart: { mediaErrors: 0 }
      }]
    });
    fetchDiskSpace.mockResolvedValue({ freeBytes: 500 * GB, totalBytes: 1000 * GB }); // 50% free, full storage credit
    render();

    // drive 100*40 + storage 100*25 + apps 100*20 + errors 100*15 = 100
    expect(await screen.findByText('System Health')).toBeTruthy();
    expect(await screen.findByText('100%')).toBeTruthy();
    expect(await screen.findByText(/Drive 100.*Storage 100.*Apps 100.*Errors 100/)).toBeTruthy();
  });

  it('reflects a broken app in both the score and the breakdown line', async () => {
    fetchDiskHealth.mockResolvedValue({
      disks: [{
        deviceId: '0', model: 'Test NVMe', mediaType: 'SSD', healthStatus: 'Healthy',
        lifeRemainingPercent: 100, readErrorsUncorrected: 0, writeErrorsUncorrected: 0,
        smart: { mediaErrors: 0 }
      }]
    });
    fetchDiskSpace.mockResolvedValue({ freeBytes: 500 * GB, totalBytes: 1000 * GB });
    const programs = [{ health: { orphaned: true } }];
    renderScreen(<Dashboard programs={programs} totalSize={0} onNavigate={() => {}} />);

    // drive 100*40 + storage 100*25 + apps 75*20 + errors 100*15 = 9500/100 = 95
    expect(await screen.findByText('95%')).toBeTruthy();
    expect(await screen.findByText(/Apps 75/)).toBeTruthy();
  });

  it('shows the drive detail sub-heading above the existing drive-specific content', async () => {
    render();
    expect(await screen.findByText('Drive detail')).toBeTruthy();
    // The existing drive-specific content is still there, unchanged.
    expect(await screen.findByText(/Test NVMe/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx vitest run src/components/Dashboard.render.test.jsx`
Expected: FAIL — "System Health" / "Drive detail" text not found, and the ring still shows the raw drive-wear percent rather than the composite score.

- [ ] **Step 3: Wire it in**

In `frontend/src/components/Dashboard.jsx`:

Add the import alongside the other lib imports at the top:

```js
import { computeHealthScore } from '../lib/healthScore.js';
```

Replace the `verdict` line (line 258) and the card's opening title with the following. First, right after the existing `const verdict = driveVerdict(primaryDisk, t('dashboard.driveHealth.unknownStatus'));` line, add:

```js
  // driveVerdict is only meaningful once primaryDisk has actually
  // answered -- passing it through while primaryDisk is still null would
  // score the drive component as a real "unknown" (75) rather than
  // correctly excluding it as "not loaded yet", which is what lets the
  // very first render show a fabricated high score. See healthScore.js's
  // own doc comment for the full reasoning.
  const { score: healthScore, breakdown } = computeHealthScore({
    driveVerdict: primaryDisk ? verdict : null,
    primaryDisk,
    diskSpace,
    brokenCount
  });
  const formatComponent = (value) => (value == null ? '—' : String(value));
```

Then change the `<HealthGauge .../>` line (line 275) from:

```jsx
        <HealthGauge percent={verdict.percent} statusLabel={verdict.statusLabel} tone={verdict.tone} />
```

to:

```jsx
        <HealthGauge percent={healthScore} statusLabel={verdict.statusLabel} tone={verdict.tone} />
```

Then change the card's title block (line 277) from:

```jsx
          <div className="text-[18px] font-medium text-[color:var(--text-primary)] mb-1">{t('dashboard.driveHealth.title')}</div>
```

to:

```jsx
          <div className="text-[18px] font-medium text-[color:var(--text-primary)] mb-1">{t('dashboard.systemHealth.title')}</div>
          {healthScore != null && (
            <div className="text-[12px] font-mono text-[color:var(--text-secondary)] mb-2">
              {t('dashboard.systemHealth.breakdownLine', formatComponent(breakdown.drive), formatComponent(breakdown.storage), formatComponent(breakdown.apps), formatComponent(breakdown.errors))}
            </div>
          )}
```

Finally, add the "Drive detail" sub-heading immediately before the disk model/media/bus line (the `<div className="text-[13px] text-[color:var(--text-primary)] truncate">` line that currently starts right after the `{primaryDisk && (` conditional, around line 291). Change:

```jsx
          {primaryDisk && (
            <>
              {/* model/mediaType/busType are Windows' own strings, same as
                  healthStatus below -- left untranslated. */}
              <div className="text-[13px] text-[color:var(--text-primary)] truncate">
```

to:

```jsx
          {primaryDisk && (
            <>
              <div className="text-[10.5px] font-mono uppercase tracking-[0.14em] text-[color:var(--text-muted)] mb-2">
                {t('dashboard.systemHealth.driveDetailHeading')}
              </div>
              {/* model/mediaType/busType are Windows' own strings, same as
                  healthStatus below -- left untranslated. */}
              <div className="text-[13px] text-[color:var(--text-primary)] truncate">
```

Nothing else in the card changes — the disk model line, the lifeRemaining/temp/poweredOn line, the `HealthStatus` fallback line, the "Read Wear" button, `SmartAttributes`, and the uncorrected-errors warning are all untouched, just now visually grouped under the new sub-heading.

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && npx vitest run src/components/Dashboard.render.test.jsx`
Expected: PASS, all tests in this file including the 3 new ones.

- [ ] **Step 5: Run the full frontend suite**

Run: `cd frontend && npx vitest run`
Expected: PASS, no regressions anywhere else.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/Dashboard.jsx frontend/src/components/Dashboard.render.test.jsx
git commit -m "feat(dashboard): wire the System Health composite score into the ring"
```

Note: do NOT add a `Co-Authored-By: Claude` line.

---

### Task 4: Full-suite and manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full backend suite**

Run: `cd backend && npx vitest run`
Expected: PASS, no regressions (this feature makes zero backend changes; the 3 pre-existing elevation-gated `pendingReboot`/`quarantine` registry-write failures are expected and unrelated).

- [ ] **Step 2: Run the full frontend suite**

Run: `cd frontend && npx vitest run`
Expected: PASS, no regressions.

- [ ] **Step 3: Check `Dashboard.language.render.test.jsx`**

This file already exists and renders the Dashboard under a non-English language (see the file for which one). Run it specifically:

Run: `cd frontend && npx vitest run src/components/Dashboard.language.render.test.jsx`
Expected: PASS. If it fails because it asserts on the OLD "Drive Health" title text in that language, update that one assertion to the new `dashboard.systemHealth.title` translation for that language (added in Task 2) — this is the only expected follow-up edit this task might require, and only if that file happens to assert on the literal title text.

- [ ] **Step 4: Manual verification in the running app**

Start the app (`preview_start` with the `prune-frontend` launch config; if the real installed Prune.exe is currently running and holding port 3101, ask the user before touching it, following the exact same procedure used for the Cookies to Preserve feature's own manual verification: ask, close it with permission, run a throwaway `node backend/src/index.js` dev backend to verify against, then kill it and relaunch the user's real app afterward). Open the Dashboard, confirm: the card now says "System Health", the ring shows a composite number, the breakdown line shows four real component values, "Drive detail" appears above the existing model/SMART content, and nothing about the existing drive-detail content (the "Read Wear" button, SMART attributes grid, uncorrected-errors warning) changed in behavior.

- [ ] **Step 5: Update the memory file**

If a persistent memory file for this project exists (`prune-project.md`), add a short entry noting the System Health score shipped, closing the "Dashboard/health-score overview" item deferred since the original uninstaller design doc — and that both features from the original "both" request (Cookies to Preserve, System Health score) are now done.
