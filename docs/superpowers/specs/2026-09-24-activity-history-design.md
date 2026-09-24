# Activity history: design

## Why

Dashboard's "Recent Activity" lists the last five uninstalls and nothing else. A Deep Clean, a scheduled run, or emptying Quarantine leaves no trace, so there is no answer to "what has Prune done for me?". Scheduled cleaning (`scheduleRunner.js`) already exists but keeps only its single latest result in `settings.automation.lastResult`.

User picked, out of the 2.7 suggestions, "scheduled/automatic cleaning with a dashboard summary over time". The scheduling half is built; this spec is the summary-over-time half. (Startup impact scoring, the other pick, is a separate spec.)

Decided with the user: the summary shows **space freed over time**, and it **splits "cleaned" from "actually freed"**, because most of what Prune removes goes to Quarantine (still on disk, recoverable) and a single "freed" number would overstate reclaimed space.

## Scope

1. A single append-only activity log recording every clean, leftover removal, uninstall and Quarantine purge.
2. A Dashboard summary (30-day totals, 12-week chart) plus the existing Recent Activity panel widened to all activity types.
3. The existing *Keep uninstall history* toggle governs the whole log.

Out of scope: reversing entries when a Quarantine batch is restored (see Accounting), exporting the log, per-rule breakdowns, a full history screen.

## Data model

New file `activity.jsonl` next to `uninstall-history.jsonl` (`%LOCALAPPDATA%\Prune`), one JSON object per line, path overridable via `UNREVO_ACTIVITY_FILE` (same convention as `UNREVO_HISTORY_FILE`, so tests never touch the real file).

```
{ type, timestamp, cleanedBytes, freedBytes, ...detail }
```

| type | detail | written by |
| --- | --- | --- |
| `clean` | `source: 'manual' \| 'scheduled'`, `rules: <count>` | Deep Clean execute, scheduled clean |
| `leftovers` | `programName` | `/quarantine/remove` (leftover removal after an uninstall) |
| `uninstall` | `programName`, `publisher`, `sizeBytes` | unchanged call site of `appendHistoryEntry` |
| `purge` | `reason: 'manual' \| 'expired' \| 'oversize'`, `batches: <count>` | Quarantine delete / empty / limit enforcement |

`cleanedBytes` and `freedBytes` are non-negative integers, always present on `clean`, `leftovers` and `purge`. `uninstall` entries carry `sizeBytes` instead and **contribute to neither total**: the figure is the vendor's reported size, and an uninstaller's exit is not proof it finished (the batch-uninstall scan-gate fix, 2026-09-19, exists because of exactly that). It is shown in the list, never summed.

**Legacy data.** Existing `uninstall-history.jsonl` lines are read as `{type:'uninstall', ...}` alongside `activity.jsonl` and merged by timestamp. Nothing is rewritten or migrated. New uninstalls are written to `activity.jsonl` only; `appendHistoryEntry` keeps its signature and now delegates.

## Accounting: cleaned vs freed

- **cleaned** = bytes that left their original location because Prune moved or removed them.
- **freed** = bytes genuinely gone from the disk.

Per Deep Clean rule, from the flags `executeRule` already returns:

| Rule outcome | cleaned | freed |
| --- | --- | --- |
| went to Quarantine (`quarantineBatch`) | `freedBytes` | 0 |
| went to Recycle Bin (`recycled`) | `freedBytes` | 0 |
| in-place compaction (`vacuumed`) | `freedBytes` | `freedBytes` |
| permanent delete (none of the above) | `freedBytes` | `freedBytes` |

A rule that mixes destinations is classified by OR-ing flags exactly as `executeRule` already does, so a rule with both a quarantined and a vacuumed action counts as quarantined (freed 0). This under-counts freed, never over-counts, and is stated in the code comment rather than hidden.

Leftover removal splits by the chosen `leftoverDestination`: `quarantine` and `recycle` are cleaned only; `permanent` is both.

Space becomes **freed** at the moment of purge: `deletePermanently` and `emptyQuarantine` record `freedBytes` = the size of what they removed; `enforceQuarantineLimits` records the same per batch it drops, with `reason` `expired` or `oversize`. A purge entry has `cleanedBytes: 0`, since that space was already counted as cleaned when it went in.

**Restoring** a Quarantine batch does not write a reversing entry. Restore is rare, and a reversal would make the chart go down retroactively; the totals describe what Prune did, and the restore is already visible in the Quarantine screen. Stated as a known simplification.

Recording lives **inside `quarantine.js`** (`deletePermanently`, `emptyQuarantine`, `enforceQuarantineLimits`), not the routes, because the retention purge also runs at backend start and on every batch creation, and no route sees those.

## Recording rules

- **Best-effort.** A failed log write is swallowed, never fails a clean, uninstall or purge, matching how `appendHistoryEntry` is already called (`.catch(() => {})`).
- **Off means off.** When `keepUninstallHistory === false` nothing is written for any type. Same check the uninstall route already does, moved into the shared writer.
- **Zero-byte results are not logged** for `clean`/`leftovers`/`purge` (a scan that found nothing, an empty-quarantine click on an empty quarantine), so the list is not padded with "0 B" rows. A scheduled run that cleaned nothing is already reported by `settings.automation.lastResult`.
- A clean stopped part-way records what was actually removed up to that point, not the previewed total.

## Backend

- `backend/src/services/activity.js`: `appendActivity(entry)`, `readActivity()` (merges legacy lines, tolerates a corrupt line by skipping it, not by failing the read), `summarize(entries, now)`.
- `summarize` returns `{ last30Days: { cleanedBytes, freedBytes }, weeks: [{ weekStart, cleanedBytes, freedBytes }] × 12, recent: [...20 newest] }`. Weeks start Monday, local time, oldest first, **always 12 entries** (zero-filled) so the chart layout does not depend on data. Takes `now` as a parameter for tests.
- `GET /api/activity` returns `summarize(await readActivity(), Date.now())`. The existing `GET /api/uninstall-history` stays, unchanged, until nothing calls it.
- `uninstallHistory.js`'s route keeps working and delegates to `appendActivity`.

## Frontend

`Dashboard.jsx`:
- New **Activity summary** block above Recent Activity: two figures, *Cleaned* and *Freed* (last 30 days), each with a one-line explanation of what it counts, and a 12-week bar chart with both series. Built per the project's `dataviz`/design conventions, both themes, no fabricated data.
- **Empty state:** with no entries, the block reads as an honest "Nothing recorded yet" with the sentence describing what will appear, not a flat chart of zeros.
- Recent Activity widens from uninstalls to all four types; each row shows a short label (*Deep Clean*, *Scheduled clean*, *Leftovers removed*, *Quarantine emptied*, *Uninstalled X*), relative time, and the bytes: cleaned/freed for the three measured types, the reported size for uninstalls (labelled as reported).
- Settings → Uninstall: the toggle's label changes from *Keep uninstall history* to *Keep activity history*, description updated. The settings **key stays `keepUninstallHistory`** (no migration, existing files keep their choice). All 40 languages updated in the same commit; every new Dashboard string too.

## Error handling

- `readActivity` never throws on a missing file (returns `[]`) or a corrupt line (skipped).
- `GET /api/activity` failing leaves the rest of the Dashboard rendering; the summary block shows its own inline error state.

## Testing

- `activity.test.js` (real temp file via `UNREVO_ACTIVITY_FILE`): append/read round trip; corrupt line skipped; legacy `uninstall-history.jsonl` lines merged and ordered; `keepUninstallHistory:false` writes nothing; zero-byte entries skipped.
- `summarize`: Monday week boundaries, exactly 12 zero-filled weeks, entries on the boundary instant, 30-day window edge (day 30 in, day 31 out), `uninstall` entries excluded from totals but present in `recent`.
- Accounting table: one test per row using real `executeRule` result shapes (a quarantined result, a recycled result, a vacuumed result, a permanent delete), plus the mixed-flag case.
- `quarantine.test.js`: `deletePermanently`, `emptyQuarantine`, and `enforceQuarantineLimits` each write exactly one purge entry with the right `freedBytes` and `reason`, and a failing log write does not fail the purge.
- Route test for `GET /api/activity`.
- `Dashboard.render.test.jsx`: empty state; populated summary renders both totals; each of the four row types renders; uninstall rows show the reported size without contributing to the totals. `Dashboard.language.render.test.jsx` Greek pass for every new string.
- Existing tests that assert on the uninstall-only Recent Activity list are updated, not deleted.

## Manual verification

Against the real dev backend with `UNREVO_ACTIVITY_FILE` pointed at a scratch file (not the real one): run a real Deep Clean on a small rule and confirm a `clean` entry with the right split; empty Quarantine and confirm the `purge` entry's `freedBytes` equals what was held; confirm the Dashboard chart, the 30-day figures, and the empty state before any entry exists. Check the summary in both themes and at a narrow width.
