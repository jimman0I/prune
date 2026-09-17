# BleachBit-Parity Cleaning Engine — Phase B: `json` Action

## Context

Phase A (merged, `docs/superpowers/plans/2026-09-14-bleachbit-parity-phase-a.md`) built the action-type foundation and two action types: `sqlite.vacuum` and `winreg`. Deferred to their own future phases: `json`, `cookie`, and per-app bespoke SQL. This spec covers `json` — the third-largest real BleachBit action type (51 of 1274 real actions in the grepped corpus, behind `delete` and `sqlite.vacuum`).

## What a real `json` action actually is

Every one of the 51 real `command="json"` actions in BleachBit's installed cleaner corpus (`%LOCALAPPDATA%\BleachBit\share\cleaners\*.xml`) has the identical shape:

```xml
<action command="json" search="file" path="$$profile$$/Preferences" address="dns_prefetching/host_referral_list"/>
```

`path` names a JSON file (always a browser's `Preferences` or `Local State` file in the real corpus — Chromium-family browsers store their settings as one big JSON object). `address` is a `/`-separated path into that object (`dns_prefetching/host_referral_list` means `obj.dns_prefetching.host_referral_list`; a bare `account_info` means the top-level key `account_info`). The action deletes exactly that key from the object and rewrites the file. There is no `value=` attribute anywhere in the real corpus — this is always whole-key deletion, never "set this key to something else."

Real examples grounding this: `account_info`, `google_services`, `sync` (top-level Chrome sync/account state), `dns_prefetching/host_referral_list` / `dns_prefetching/startup_list` (DNS prefetch history), `net/http_server_properties/servers` (per-server connection cache), `zerosuggest/cachedresults` (omnibox suggestion cache), `profile/content_settings/exceptions` (per-site permission overrides).

## The one real design decision this forces

`sqlite.vacuum` (Phase A) deliberately has no quarantine/undo path, and that's correct for it: VACUUM reclaims free pages without deleting any application data — there's nothing to restore because nothing was lost.

A `json` action is different in kind: deleting `account_info` or `sync` from a live Preferences file is real data loss — it can sign someone out, drop saved sync state, or clear settings someone cares about, the same category of consequence the existing `risky` rule-authoring flag already exists to warn about at the UI layer (see `cleanWarning.js`). Prune's own standing promise, stated in Deep Clean's own subtitle copy, is "Nothing is deleted outright — everything Clean takes goes to Quarantine first, where you can put it back." A `json` action that rewrites a file in place with no backup would be the one action type in this engine that quietly breaks that promise — and it would be breaking it specifically on the category of data (sync/account state) most likely to actually matter to someone.

**Decision: `json` actions back up the original file into quarantine before writing the modified version.** Not a move (unlike `delete`'s own files, which do disappear from their original location) — the file must keep existing, functional, at its original path with the key removed. So the action:
1. Reads and parses the file.
2. Copies the ORIGINAL, unmodified bytes into a quarantine batch (same `quarantineRoot()` used everywhere else in this app), recording the copy in a manifest the same shape `quarantineAndDelete`'s own manifest already uses.
3. Deletes the key at `address` from the parsed object.
4. Writes the modified object back to the original path.

This is deliberately NOT wired through the existing `quarantineAndDelete()` function — that function's whole contract is "move this file out of its original location." A `json` action needs "copy the original out, then overwrite the original in place," which is a different operation. A new, small, single-purpose function is more honest here than forcing an existing function to grow a second, incompatible mode.

`autoQuarantine: false` (Settings' "move to Recycle Bin instead of Prune's own quarantine" toggle) still applies here the same way it does to `delete`: when off, the ORIGINAL (unmodified) file goes to the Recycle Bin instead of Prune's quarantine, before the modified version is written to the original path. Either way, something recoverable exists before the file is touched.

## Scope for this phase

**In scope:**
- `backend/src/lib/cleanerActions/json.js`: `scan(action, guards)` / `execute(action, guards)`, matching the interface shape every other action type in `cleanerActions/` already uses.
- `address` resolution: a `/`-separated path, delegating to (or building) a small, dependency-free key-path resolver — Node has no built-in "delete a nested key by path string" helper, and this codebase doesn't currently depend on lodash or similar. A resolver this simple (split on `/`, walk down, `delete` the last segment off its parent) does not need a library.
- Wiring `json` into `cleanerRules.js`'s `scanRule`/`executeRule` dispatcher (the 5th action type there — `shell`, `delete`, `sqlite.vacuum`, `winreg`, now `json`).
- The quarantine-the-original-before-writing mechanism described above.
- Guards: `excludeFolders`/`excludeExtensions`/`skipRecentHours` apply to the one named file, same as `sqlite.vacuum`. `autoQuarantine` applies (see above) — this is the one new action type where it's NOT exempt, unlike `sqlite.vacuum`.

**Explicitly out of scope:**
- New `cleaners.json` rules that actually use the `json` action type (same "engine capability, not content" boundary Phase A drew for `sqlite.vacuum`/`winreg` — no rule in the current 75/76-rule file uses either of those yet either).
- `cookie` and the per-app bespoke SQL action types (`chrome.history`, `mozilla.url.history`, etc.) — still their own future phases.
- A generic/reusable "deep object key deletion" utility library — the resolver built here is scoped to exactly what `address` needs (delete one key by slash-path), not a general-purpose object-manipulation module.

## Frontend

No structural change needed, matching Phase A's own finding for `sqlite.vacuum`/`winreg`: `executeLogLine` already has a "verb per action type" shape (`Delete`/`Recycle`/`Compact`/`Clear`). A `json` action's result should read as an edit, not a deletion of the whole thing — reusing `Compact`'s own "fileCount stays irrelevant, freedBytes reflects a real size delta" shape is closer than `Delete`'s, but the verb itself should say something like `Trim` or `Clean` (exact wording decided during implementation, not blocking this design) rather than reusing `Compact`, since compacting a database and removing one key from a JSON file are different enough operations that the same word would misdescribe one of them.

## Testing

Same real-tool, no-mocking-the-mechanism-under-test convention every other action type in this phase already established: a real temp JSON file, a real nested key, a real deletion, a real re-read confirming the key is gone and the rest of the file is untouched. The quarantine-the-original step gets a real test proving the ORIGINAL (pre-edit) bytes are recoverable from the quarantine batch afterward — the same kind of proof Phase A's `winreg` tests already gave for the registry-key case (".reg backup exists in the batch").
