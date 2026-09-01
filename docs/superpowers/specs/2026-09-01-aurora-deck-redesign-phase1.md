# unrevo — Aurora Deck redesign, Phase 1

## What this is

A full visual redesign of unrevo's existing Phase A app: replaces the current
"Prune" obsidian+cyan design system with a new one ("Aurora Deck": deep navy,
coral accent, glassmorphism, serif display type), and adds a Dashboard landing
screen in front of the existing Applications list.

This is Phase 1 of a much larger brief the user provided (Dashboard + redesign
now; a Disk Map/treemap with a native NTFS MFT reader, a Smart Cleanup junk
scanner, a redesigned Quarantine/Settings, and general polish are Phases 2-4).
Phases 2-4 are explicitly **not** in this spec — each gets its own
brainstorm → spec → plan cycle once Phase 1 has actually shipped and been
verified, per the user's own phasing and their explicit choice to scope this
cycle to Phase 1 only.

## Scope

**In scope (Phase 1):**
- Full design-token swap: every existing Prune-derived token in
  `frontend/src/index.css` (`--bg-obsidian`, `--accent-cyan`, etc.) replaced
  with Aurora Deck's tokens.
- Two new fonts (IBM Plex Serif for display headings, JetBrains Mono for
  technical/mono text already partially in use) added alongside the existing
  Geist stack, which stays as the body/UI sans — see "Typography" below for
  why Inter isn't added as a third near-identical sans.
- Glassmorphism applied to every panel/card/modal that currently uses a flat
  `--bg-zinc`/`--bg-zinc-hi` surface.
- App list rows redesigned from the current dense data-table shape into
  glass "app cards" with icon, name/publisher, metadata row, size badge
  (color-coded by size band), and a hover-revealed action menu.
- A new Dashboard screen: health score gauge, three quick-stat cards (total
  storage, installed app count, junk files — see "Dashboard data" below for
  what's real vs. honestly-deferred), a Quick Actions row, and a Recent
  Activity list backed by a real (new) uninstall-history log.
- A minimal navigation shell: the app currently has exactly one screen
  (Applications). This adds a second (Dashboard) and the thin nav control to
  switch between them.

**Explicitly out of scope for Phase 1** (the user's own Phase 2-4, deferred
to their own future spec/plan cycles):
- Disk Map / treemap visualization, and the native NTFS MFT reader it would
  need for WizTree-speed scanning.
- Smart Cleanup (browser cache / temp / thumbnail / Recycle Bin / old-Windows
  scanning and cleaning).
- Quarantine screen redesign (it already exists and already uses the real
  `batchDir` field correctly — Phase 1 only re-skins its existing card list
  with the new tokens, no new quarantine functionality).
- Settings screen (doesn't exist yet at all; not part of this spec).
- SQLite, worker threads, Framer Motion, Radix UI, TypeScript, or any other
  new dependency the original brief mentions for later phases. Phase 1 stays
  on this project's existing stack (React + Vite + Tailwind + plain CSS
  tokens, PowerShell-shell-out backend, no new runtime dependencies beyond
  the two Google Fonts).

## Design system: Aurora Deck

### Tokens

Replacing `frontend/src/index.css`'s existing `:root` block wholesale
(current Prune tokens — `--bg-obsidian`, `--bg-zinc`, `--accent-cyan`,
etc. — are removed, not kept alongside the new ones, since nothing should
reference both systems at once):

```css
:root {
  /* Surfaces */
  --bg-navy: #041638;        /* main app background */
  --bg-panel: #181715;       /* elevated panel base, pre-glass */
  --glass-bg: rgba(4, 22, 56, 0.6);
  --glass-border: rgba(255, 255, 255, 0.08);

  /* Text */
  --text-primary: #faf9f5;
  --text-secondary: #a09d96;

  /* Functional accent — coral, primary actions ONLY (Uninstall, Delete,
     Clean, primary CTAs). Never used for a data-viz color. */
  --accent-coral: #f98074;       /* dark mode */
  --accent-coral-light: #b6322d; /* light mode value, unused until this app
                                     grows a light theme — kept named and
                                     ready rather than invented later */

  /* Ambient / data-viz accents — decorative and size-band coloring only,
     never an interactive element's color */
  --accent-purple: #8b5cf6;
  --accent-blue: #3b82f6;
  --accent-cyan: #06b6d4;

  --success: #5db872;
  --danger: #ec5162;
  --warning: #f59e0b; /* unchanged from Phase A — the brief doesn't
                          respecify a warning color, and this one already
                          reads correctly against the new navy background */
}
```

`--danger` replaces Phase A's `#ef4444` — close enough in hue that nothing
about the leftover-scan warning banner or the danger buttons needs a second
look, but using the brief's own `#ec5162` keeps the whole palette one
consistent source rather than half-Aurora-Deck, half-leftover-Prune.

### Typography

- **Display headings** (Dashboard's "Installed Applications" title, the
  Dashboard's own page title, the health-score number): **IBM Plex Serif**,
  weight 400, `letter-spacing: -0.01em`. New Google Fonts `@import`.
- **Body/UI text**: stays on the existing **Geist** stack already loaded in
  `index.css`. The brief asks for "Inter" — Geist and Inter are both
  humanist-geometric UI sans faces built for near-identical purposes (dense
  UI text, tabular data), and this project already has Geist wired in,
  tested, and matched to every existing component. Adding Inter as a second,
  visually-near-identical sans alongside it would be exactly the kind of
  "two similar-but-not-identical sans-serifs" pairing this project's own
  design conventions warn against — Geist fills the Inter role here.
- **Mono** (file paths, sizes, versions, technical text): **JetBrains Mono**,
  13px — already referenced in Phase A's own CLAUDE.md-adjacent design spec
  as the intended mono face (Phase A shipped with `.font-mono` pointing at
  the system mono stack as a placeholder); this phase actually loads the
  real font.
- Type scale, matching the brief's own hierarchy: Display 36px (Dashboard
  title, IBM Plex Serif), Title 18px (card/section headings, Geist 500),
  Body 14px (Geist 400), Label 12px uppercase (Geist 500) — applied via
  existing Tailwind arbitrary-value classes, the same pattern Phase A's
  components already use throughout (e.g. `text-[13.5px] font-medium`).

### Glassmorphism

One shared class, matching the brief's own CSS exactly:

```css
.glass-panel {
  background: var(--glass-bg);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid var(--glass-border);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}
```

Replaces Phase A's `.glass-strong` (used today only by `UninstallModal` and
the Quarantine modal in `App.jsx`) and extends to every surface that's
currently flat: the app-shell background, app-list card rows, filter-pill
bar, the Dashboard's own stat cards.

### Spacing, radius, buttons

- Section padding 32px internal / 96px between major sections (Dashboard's
  own vertical rhythm; the Applications screen keeps its existing tighter
  internal spacing, since it's a dense data list, not a landing page).
- Card radius 16px (panels), 12px (buttons) — replacing Phase A's existing
  `rounded-xl`/`rounded-lg` Tailwind classes with the same pixel values,
  effectively unchanged in practice.
- Primary CTAs (Uninstall, the Dashboard's "Smart Scan" button) get
  `border-radius: 9999px` (full pill) — a new shape Phase A's buttons don't
  currently use (they're `rounded-lg`/`rounded-xl`); `.btn-primary` and
  `.btn-danger` in `index.css` both move to pill radius, `.btn-ghost` stays
  at 12px since it's a secondary/tertiary action, not a CTA.

## Architecture: navigation shell

`App.jsx` currently renders the Applications screen directly with no
routing at all. This phase adds:

```jsx
const [screen, setScreen] = useState('dashboard'); // 'dashboard' | 'applications'
```

A new `frontend/src/components/NavRail.jsx` — a slim glass-panel vertical
rail (left edge, full height, ~72px wide) with two icon buttons (Dashboard,
Applications), coral-highlighted active state, `aria-current="page"` on the
active one. No router library — two screens don't need one, and Phase 2/3's
future screens (Disk Map, Cleanup, Settings) will extend this same rail
rather than justifying pulling in React Router now. `App.jsx` conditionally
renders `<Dashboard />` or the existing Applications content based on
`screen`, wrapped by the rail.

The existing modals (`UninstallModal`, the Quarantine modal) are unaffected
— they're screen-agnostic overlays. Uninstall only ever opens from
Applications' own rows, unchanged. The "Quarantine" button that opens the
quarantine modal stays exactly where it already is today, top-right of the
Applications screen's own header — it's conceptually tied to uninstalls
(reviewing what an uninstall left in escrow), that screen already works and
is tested, and there's no real benefit to relocating it this phase.

## Dashboard

### File: `frontend/src/components/Dashboard.jsx` (new)

### Health score

A real, computed number — not the brief's illustrative "92%". Backend gets
one new tiny endpoint:

**`backend/src/services/diskSpace.js`** (new):
```js
import { runPowerShellJson } from './powershell.js';

/** Free/total bytes for the system drive (C:) — same PowerShell-shell-out
 * chokepoint every other backend service already uses, not a new pattern.
 * Get-PSDrive's Free/Used are already in bytes, no unit conversion needed. */
export async function getSystemDriveSpace() {
  const script = `
    $d = Get-PSDrive -Name C -ErrorAction Stop
    [PSCustomObject]@{ freeBytes = $d.Free; totalBytes = ($d.Free + $d.Used) } | ConvertTo-Json -Compress
  `;
  const raw = await runPowerShellJson(script);
  if (!raw || raw.totalBytes === 0) return null; // caller shows an honest "unavailable" state, not 0%/NaN
  return { freeBytes: raw.freeBytes, totalBytes: raw.totalBytes };
}
```

**`backend/src/routes/diskSpace.js`** (new) → `GET /api/disk-space` → `{ freeBytes, totalBytes }`.

**`frontend/src/lib/api.js`** gets `fetchDiskSpace()` following the exact
`fetch → check res.ok → return data` pattern every other function in that
file already uses.

`Dashboard.jsx` computes `healthScore = Math.round(freeBytes / totalBytes * 100)`
client-side from that response. If the endpoint fails or returns null, the
gauge shows "—" with a muted "Couldn't read disk space" caption instead of a
fabricated or zeroed number — matching this project's established
`ProgramList.jsx`-style honest-error-state convention (`Couldn't load
programs: {error}`).

Gauge itself: an SVG circular progress ring (`<circle>` with
`stroke-dasharray`/`stroke-dashoffset`, computed from `healthScore` — no
charting library, this is one ring), coral stroke, the percentage in IBM
Plex Serif 36px centered inside it.

### Quick stats (3-column glass card grid)

- **Total Storage**: from the same `fetchDiskSpace()` call — "X GB Used / Y
  GB Total" with a slim progress bar (coral fill).
- **Installed Apps**: `programs.length` — already fetched in `App.jsx` for
  the Applications screen's own header line; `Dashboard.jsx` receives it as
  a prop rather than re-fetching (App.jsx already lifted `fetchPrograms()`
  up in Phase 1's earlier round, this reuses that same state).
- **Junk Files**: static glass card reading "Run Smart Cleanup to find out"
  with a disabled-looking (not clickable — no destination exists yet) muted
  button, per the user's own explicit call not to fabricate a GB number
  before the scanner that would produce one exists.

### Quick Actions row

Three buttons: "Smart Scan" (coral pill, disabled + tooltip "Coming in a
future update" — Smart Cleanup doesn't exist yet), "Disk Analyzer" (glass
pill, same disabled treatment — Phase 2), "Batch Uninstall" (glass pill,
disabled — no batch-select UI exists on the Applications screen yet, out of
this phase's scope). Shown as real, visible, on-brand buttons rather than
hidden entirely, so the Dashboard reads as "more is coming", not broken —
but honestly disabled rather than wired to nothing.

### Recent Activity

Needs a real uninstall-history log, which doesn't exist yet — new scope,
confirmed in-phase.

**Backend**: `backend/src/services/uninstallHistory.js` (new) — a flat
JSON-lines file at `path.join(dataDir(), 'uninstall-history.jsonl')` (same
`dataDir()` helper `quarantine.js` already uses for its own quarantine
root), one `{ programName, publisher, sizeBytes, timestamp }` line appended
per completed uninstall. `appendHistoryEntry(entry)` and
`getRecentHistory(limit = 5)` (reads the file, returns the last N entries
newest-first — a flat-file tail read is entirely adequate at this scale,
no database needed for 5 rows).

**Wiring**: `UninstallModal.jsx`'s `handleConfirm` (currently a stubbed
`// Placeholder for the actual removal logic`) is out of THIS phase's scope
to fully implement (that's real removal-execution work, not a Dashboard
concern) — but the append call belongs at the point an uninstall is known
to have actually completed. Given `handleConfirm` is still a placeholder,
Phase 1 wires the history append into the ONE place that currently
represents "an uninstall genuinely finished": right after
`streamUninstall` resolves successfully in `UninstallModal.jsx`'s
`startUninstall`, before moving to the `scanning` step. This means Recent
Activity reflects real completed native-uninstaller runs, not aspirational
"removal fully done" state — an honest scope boundary given `handleConfirm`
itself isn't real yet.

**`backend/src/routes/uninstallHistory.js`** (new) → `GET
/api/uninstall-history` → `{ entries: [...] }`.

**Frontend**: `Dashboard.jsx` fetches on mount, renders a `.glass-panel`
list, each row: program name, relative timestamp ("2 hours ago" — a small
`formatRelativeTime()` helper, new, in `frontend/src/lib/`), size freed.
Empty state: "No uninstalls yet." Collapsible via a simple `useState`
toggle (the brief's own spec), not a new dependency.

## Applications screen: card redesign

`ProgramList.jsx`'s existing row (`grid grid-cols-[48px_1fr_140px_140px_120px_140px]`)
keeps its column structure — that's still correct and still matches real
data — but every row becomes a `.glass-panel` card instead of a plain
`hover:border`/`hover:bg` div, with:

- The existing icon badge, unchanged in structure, re-skinned: gradient
  background derived from `program.color` (already supported) blended
  toward `--accent-purple`/`--accent-blue` rather than the old cyan.
- Size badge gets the brief's exact color bands — `<100MB` cyan tint,
  `100MB-1GB` blue tint, `1-5GB` amber tint, `>5GB` coral tint — a small
  pure `sizeBadgeTone(bytes)` helper, new, colocated in `ProgramList.jsx`
  next to its existing `formatBytes`.
- Hover: card lifts (`hover:-translate-y-0.5`), coral edge glow
  (`hover:shadow-[-4px_0_20px_rgba(249,128,116,0.3)]`), matching the
  brief's exact values. The Uninstall button's existing hover-reveal
  (`opacity-0 group-hover:opacity-100`) is unchanged — it already does what
  the brief asks for.
- The brief's "three-dot expandable action menu" (Uninstall / Analyze
  Leftovers / Open File Location / View in Disk Map) is **not** built this
  phase: "Analyze Leftovers" only makes sense once leftover-scanning is
  triggerable independent of a full uninstall (not true today — it's only
  ever a step inside the uninstall flow), "Open File Location" needs a new
  backend capability (reveal `installLocation` in Explorer) genuinely
  out of scope here, and "View in Disk Map" points at Phase 2's screen,
  which doesn't exist. The single always-there "Uninstall" button (already
  built, just re-skinned) stays as the row's one action for Phase 1.

## What's explicitly deferred, restated

Every backend item under the brief's own "BACKEND IMPROVEMENTS" section
past disk-space and uninstall-history — the NTFS MFT reader, worker
threads, SQLite, the full multi-stage uninstall engine, Smart Cleanup's
category scanners — is Phase 2/3 scope, not touched here. Phase 1 adds
exactly two small, real backend services (`diskSpace.js`,
`uninstallHistory.js`), both following this codebase's existing
PowerShell-shell-out / flat-file conventions, no new runtime dependencies.

## Testing

- `backend/src/services/diskSpace.js`: unit test mocking
  `runPowerShellJson` (matches every other backend service's own test
  convention in this codebase), covering the real-data case and the
  null-on-failure case.
- `backend/src/services/uninstallHistory.js`: unit test against a real
  temp file (append, then read back, confirm newest-first ordering and the
  5-entry limit) — real file I/O, not a mock, matching this codebase's
  established "real I/O over mocks where the bug lives in real I/O
  behavior" convention (a JSONL append/tail-read's correctness IS about
  real file behavior).
- `frontend/src/lib/api.js`'s new `fetchDiskSpace`/`fetchUninstallHistory`:
  Vitest with a mocked global `fetch`, matching `api.quarantine.test.js`'s
  already-established real pattern for this exact file (not the earlier,
  wrong Jest-based attempt).
- `ProgramList.jsx`'s new `sizeBadgeTone(bytes)`: pure function, easy unit
  test, one assertion per band boundary.
- No new component-level React tests — this codebase has none today outside
  the pure-function pattern above, and Phase 1 doesn't change that.
