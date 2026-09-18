# Game/launcher rule install cross-check: design

## Why

Real bug, reported directly: a game-specific Deep Clean rule (confirmed: League of Legends) can show up as present with real cleanable bytes on a machine where that game was **never installed**. Root-caused this session: `cleaners.json`'s 8 game/launcher rules (`steam_cache`, `steam_shader_cache`, `steam_depot_cache`, `steam_logs`, `epic_games_cache`, `epic_crash_reports`, `riot_client_logs`, `league_of_legends_logs`) are pure folder-exists checks, with no cross-check against whether the program is actually installed. Real, if circumstantial, evidence found on this session's own dev machine: `%LOCALAPPDATA%\Riot Games\` contains a folder literally named `Install League of Legends eune` alongside real per-game folders for genuinely-installed titles -- consistent with the launcher proactively scaffolding per-game folders that a bare `existsSync()` can't tell apart from a completed install.

## The matching problem, grounded in real registry data

Checked this machine's real Uninstall registry entries directly:

| DisplayName | InstallLocation |
|---|---|
| League of Legends | `C:/Riot Games/League of Legends` |
| Riot Client | `C:/Riot Games/Riot Client` |
| Epic Games Launcher | `C:\Program Files\Epic Games\` |
| **Steam** | **(empty)** |

Steam's own real registry entry has no `InstallLocation` at all on real hardware -- so matching by install-path prefix can't work universally. `name` is the one field every real entry reliably carries, so that's the match key: `requiresProgram: "<exact display name>"`, matched case-insensitively against `programs.js`'s existing `listInstalledPrograms()` output (the same registry enumeration already powering Applications' 212 real entries -- no new PowerShell query needed).

## Scope

In scope: exactly the 8 existing game/launcher rules gain a `requiresProgram` field. Out of scope: the other ~70 rules (browsers, OS utilities) -- they've never shown this problem and BleachBit's own equivalent rules don't cross-check installs either; adding the extra registry round-trip cost there would be unjustified.

## Gate behavior

When a rule has `requiresProgram` and that name isn't found (case-insensitive) in the real installed-programs list, the rule scans as `present: false` -- a hard gate, hidden from the tree exactly like any other rule for software that isn't on the machine. No new UI state, no "leftover-only" distinction: a genuine orphaned log folder from a since-uninstalled game simply stops surfacing via this rule, the same way any other orphaned folder Deep Clean doesn't otherwise catch behaves today. This is a deliberate simplicity choice, not an oversight -- consistent with how every other rule in the app already communicates "not applicable here."

## Implementation

**`cleaners.json`**: add `"requiresProgram": "League of Legends"` (etc.) to the 8 rules, exact real display names as confirmed above (`"Steam"`, `"Epic Games Launcher"`, `"Riot Client"`, `"League of Legends"` -- Teamfight Tactics/VALORANT have no cleaner rules of their own today, so only these 4 program names are needed for the 8 existing rules).

**`backend/src/routes/deepClean.js`**: each scan entry point (`/scan`, `/scan/stream`) fetches `listInstalledPrograms()` once per request, builds a lowercased `Set` of real names, and adds it to the `guards` object already built from `cleanGuardsFrom(settings)` -- the exact existing mechanism `excludeFolders`/`cookieKeepList` already flow through. One PowerShell call per scan request, not one per rule.

**`backend/src/lib/cleanerRules.js`**: `rulePathsExist(rule, guards)` and `scanRule(rule, guards)` gain a check: if `rule.requiresProgram` is set and `guards.installedProgramNames` doesn't have it (lowercased), return `present: false` / `sizeBytes: 0` immediately, without touching the filesystem at all -- cheaper than the existing folder-walk, not just more correct.

**`/execute`**: no change needed. A rule the UI never rendered as selectable (because it scanned `present: false`) can't have been ticked in the first place; the existing "delete against a path that turns out not to exist is a safe no-op" behavior already covers any stale-selection edge case without new code.

## Testing

- `cleanerRules.test.js`: a rule with `requiresProgram` scans `present: false`/`sizeBytes: 0` when the name isn't in `guards.installedProgramNames`, regardless of whether its target folder actually exists on disk (the core regression this fixes -- a real fixture folder present on disk must NOT make the rule present when the program name is absent from guards). Case-insensitive matching. A rule without `requiresProgram` is completely unaffected (every existing test for the other ~70 rules keeps passing unchanged).
- `deepClean.test.js` (route): `/scan` and `/scan/stream` call `listInstalledPrograms()` once per request and thread its result into guards; mocked, not a real PowerShell call in tests.
- Manual verification: on this real dev machine (League genuinely installed), confirm `league_of_legends_logs` still reports its real size after the change -- proving the gate doesn't false-negative on a real, legitimate install just because it's now checking name matching.
