# Prune 4.0 Phase 2a: The program list, read-only

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Applications screen of Prune 4.0 shows exactly the rows 3.2's Applications screen shows (registry programs from all three Uninstall hives, Microsoft Store apps, Chocolatey packages, browser extensions, "Not registered" folders, Windows features and updates, the other-accounts button) with every per-row fact 3.x computes (size, version, install date, 32/64-bit, website, icon, signature, health, New badge, Running badge, Monitored badge, hidden), drawn like 3.x (heading with counts and total, tool buttons, search, filter tabs with counts, a sortable table, selection boxes, footer, loading, error and empty states), filled in as the slow lookups finish so the list never waits. Nothing is uninstalled, removed or written.

**Architecture:** All Windows logic goes in `prune-core::programs` (one module per 3.x service, calling Win32/WinRT/WMI through the `windows` crate instead of PowerShell, each module testable on its own and compared with what 3.x returned for the same registry on this PC). `programs::view` holds every rule of the table (filter, search, hide, sort, New, batch eligibility, counts, size text, tile) as pure functions. `programs::loader` runs the lookups on worker threads and sends each answer as a `Stage`; `Table` merges whatever has arrived, so the order cannot matter. `prune-app::applications` is the screen: state and messages (`mod.rs`), the grid and row windowing (`grid.rs`), widgets, the view, and fixtures for rendering. Phase 1's `App` gets one new message, one new field and a few hooks; everything else is untouched.

**Tech Stack:** Rust 1.96, iced 0.14.0 (tiny-skia only), windows 0.62.2 (new features listed in Task 2), serde_json, Node 24 for the plural tool. No new crate dependencies; the Windows Imaging Component, `WinVerifyTrust`, WinRT `PackageManager`, WMI and Task Scheduler's COM interface are already in Windows.

**Spec:** `docs/superpowers/specs/2026-11-20-prune-4-native-rust-design.md`. Roadmap: `docs/superpowers/plans/2026-11-20-prune-4-roadmap.md`. Phase 1: `docs/superpowers/plans/2026-11-20-prune-4-phase-1-foundation.md`.

**State of this plan:** every Rust file below was written and run in a scratch copy of the workspace before this plan was written. `cargo test -p prune-core -p prune-app` passed there, apart from two Phase 1 unit tests that read files the scratch copy did not have (`rail::tests::icons_match_navrail_jsx`, `titlebar::tests::logo_asset_is_3x_logo`); the live comparisons against 3.x matched row for row on this PC (numbers in Task 25). The iced view code compiled and rendered; where an iced 0.14 signature turns out different in the real tree, the tests, not the snippet, are the contract.

## 3.x sources read

Backend: `services/programs.js`, `programsRegFallback.js`, `programHealth.js`, `uninstallerPath.js`, `iconSource.js`, `iconExtract.js`, `programIcons.js`, `findMainExecutable.js`, `genericIcon.js`, `iconTypeFallback.js`, `fileTypeIcons.js`, `msiProductIcon.js`, `packageIcons.js`, `programSizes.js`, `installSize.js`, `steamApps.js`, `epicApps.js`, `gogApps.js`, `launcherMatch.js`, `programVersions.js`, `versionText.js`, `installDates.js`, `programSignatures.js`, `storeApps.js`, `runningPrograms.js`, `chocolateyApps.js`, `browserExtensions.js`, `firefoxExtensions.js`, `unregisteredFolders.js`, `leftoverProtection.js`, `leftoverRemoval.js` (`permanentDeletionRefusal`), `leftoverMatch.js` (`productTokens`), `pathGuard.js`, `crashArtifacts.js`, `windowsComponents.js` (listing half), `otherAccounts.js` (listing half), `installTraces.js`, `leftoverWalk.js`, `powershell.js`; `lib/folderSizeStore.js`, `lib/snapshotStore.js`, `lib/staleWhileRevalidate.js`, `lib/memoizeAsync.js`; `services/settings.js` (`hiddenPrograms`, `normalizeHiddenPrograms`); `routes/programs.js` (every endpoint).

Frontend: `components/ProgramList.jsx` (all 1,258 lines) and its eight render tests (`ProgramList.render`, `.appleDesign`, `.stage2`, `.sources`, `.signatures`, `.extensions`, `.hidden`, `.language`, `.properties`), `components/ApplicationsTools.jsx`, `components/TableSkeleton.jsx`, `App.jsx` (the Applications screen and its heading), `hooks/usePrograms.js`, `lib/sortPrograms.js`, `recentPrograms.js`, `batchSelection.js`, `sizeBadgeTone.js`, `formatBytes.js`, `iconTileLetter.js`, `programTileColor.js`, `fileTypeColors.js`, `hiddenPrograms.js`, `applicationsSummary.js`, `mergeSizes.js`, `mergeVersions.js`, `mergeInstallDates.js`, `installTraces.js`, `index.css` (`.glass-panel`, `.btn-ghost`, `.btn-remove`, tokens). The i18n source is `frontend/src/i18n/catalog.js` and `extras/*`, through the Phase 1 `.ftl` files.

Measured on the real 3.x, in a browser at a 1264 px window, with 3.x's frontend and backend running against this PC's registry (the backend was started with `UNREVO_SETTINGS_PATH` pointing at a scratch folder, so it wrote nothing into `%APPDATA%\Prune`): panel 1096 px wide at x=120; header 33 px; rows 51.5 px with a Folder button, 44.3 px without; Name 320 px and Company 224 px in the narrow grid; search 448 x 37.5 px; heading text 30 px; 235 programs for "235 installed applications" (132 registry, 85 Store, 18 Chocolatey).

## Global Constraints

- **No new features: parity with 3.2.** The screen is checked against 3.x with rendered PNGs (Task 24) and the owner's screenshots. Where 3.x has a bug and the fix is obvious it is fixed and listed under "Deliberate differences" below; everything else is matched.
- **i18n.** Every key the screen uses has no `needs-review` entry left (Task 17 clears the five that were open: `app.applicationsSummary`, `applications.empty.hiddenCount`, `applications.footer.newInDays`, `applications.footer.selected`, `applications.footer.uninstallCount`), and `tests/applications_keys.rs` reads the view's own source to prove every key exists in all 40 languages.
- **The plural ruling (decided here).** A count goes to a message as a **number** (`prune_core::i18n::count(n)` is `FluentValue::from(n as f64)`), because only a number can pick `[one]`, `[few]` or `[many]`. There is no second "display" argument and no custom `NUMBER` formatter: 3.x prints counts as plain digits (`${count}` gives "1234"), and Fluent prints a number the same way, so nothing changes on screen. Sizes, dates and names are strings (already formatted by the `sizeUnits` setting or by Windows' own date format), passed under their own argument names and never used to select a form. If a later phase wants locale digit grouping it is one `bundle.set_formatter` call, and no message changes.
- **Settings and data files stay in 3.x's formats and locations.** `folder-sizes.json` is read and written in 3.x's exact shape and place (Task 3). `hiddenPrograms` is read from `settings.json` through the Phase 1 `Settings::rest`; 2a never writes it. `install-traces\` is read only. 3.x's other caches (`icons-programs.json`, `icons-packages.json`, `store-apps.json`) are **not** read or written by 4.0: in-process extraction is faster than reading them (Task 25 has the numbers), so they would only add a format to keep, and 3.2 recreates them itself on rollback.
- **Performance targets must still hold.** No work before the first frame: `Applications::new` reads one settings key and the date; the load starts the first time the screen is opened. No timer at idle: the app has no subscription at rest (`tests/applications.rs` asserts `subscription().units() == 0` with the screen open and loaded), and the one poll (which programs are running, 3.x: every 15 s) is a chain of one-shot tasks that exists only while the Applications screen is shown. Memory: icons are 64 x 64 RGBA (16 KB each, about 3 MB for 200 rows), and only the rows near the viewport are built.
- **Read-only.** Destructive actions are out of scope. The tool buttons, every Uninstall/Remove/Turn off button, the batch bar's Uninstall button and "Manage" are drawn and inert (`Msg::Noop`, `Msg::Inert`) until 2b and 2c. The only live row action is "Folder", which opens Explorer on an existing folder.
- No AI attribution in commits. Never write the names of competing uninstaller or cleaner products anywhere. No emoji in the UI (icons are line SVGs). No hover-only tooltips: 3.x shows no hover text on this screen and neither does 4.0 (a disabled checkbox's reason is kept in the row's data for screen readers, as in 3.x, and iced has none yet).
- Work on master; never push. Windows only. Dependencies unchanged (`cargo deny check licenses` stays green).
- **Fidelity gaps already known**, and which 2a touches: letter-spacing on the 11 px uppercase mono badges and column headers (touched: every badge and header; gap remains); backdrop blur of `.glass-panel` (touched: the table panel is the translucent glass colour over the aurora with no blur); press scale on buttons (touched: not implemented); chip fade (not touched); opaque rail glass (not touched). Two new gaps 2a adds: text is cut with an estimated width plus an ellipsis, not measured (`widgets::fit`), and the loading skeleton is static where 3.x's breathes (an animation would redraw the whole window at the display's rate).

### Deliberate differences from 3.x (all logged, all obvious fixes or API consequences)

1. **`EstimatedSize` of 0x80000000 or more** (PowerShell reads it as a negative number, 3.x showed "-1 KB") is treated as not recorded and gets a measured size like any other blank.
2. **A registry string with an embedded NUL** (Roblox's `DisplayName` is `"Roblox Player for <user>\0 "`) reads, in Windows' own API, as the text before the NUL; 3.x kept the tail, invisible on screen.
3. **Install dates are written as given.** 3.x runs `new Date('2026-08-19').toLocaleDateString()`, which parses as UTC midnight and so prints the previous day anywhere west of UTC. 4.0 formats the date it holds with `GetDateFormatEx(DATE_SHORTDATE)`, in the person's own regional format.
4. **Protected Store apps at narrow widths:** in 3.x the "In Windows" button wraps to two lines inside the 164 px action cell and makes its row 68 px tall. 4.0 keeps one line and the 51.5 px row.
5. **Signatures do not check revocation or fetch anything** (`WTD_REVOKE_NONE`, `WTD_CACHE_ONLY_URL_RETRIEVAL`): checking would send a request to a certificate authority for every program, and the only outbound traffic Prune makes is the update check and download. 3.x's answers and signers matched on all 104 files on this PC regardless (Task 14).
6. **Plural forms follow CLDR where 3.x's hand-written rule differs** (19 messages in French, Portuguese, Brazilian Portuguese, Romanian and Czech, printed by the tool in Task 17 and listed in that commit): 3.x says "0 applications" in French where CLDR treats 0 as singular, and drops Romanian's "de" for 2 to 19 where CLDR's "few" form has none.
7. **The Unused filter and badge are not built.** 3.x's backend never sets `program.unused`, so its chip is never offered and its badge never shown; the catalog keys stay for later.
8. **The Other accounts list is empty in 2a.** 3.x keeps the last scan in memory only (`lastScan`), so a fresh launch has none; reading other accounts' hives needs administrator rights and is a button (2c). The button itself is drawn when other accounts exist, inert.
9. **`reg.exe` fallback dropped.** It existed because a PowerShell `Get-ItemProperty` pipeline could fail silently; there is no pipeline here. An empty read is retried once after 400 ms (the recorded first-boot antivirus contention), and only then does the screen say "Couldn't find any installed programs", with Retry.

### What each PowerShell call became

| 3.x | 4.0 |
|---|---|
| `Get-ItemProperty` over three Uninstall hives | `RegOpenKeyExW`, `RegEnumKeyExW`, `RegQueryValueExW` (`winreg.rs`); `REG_EXPAND_SZ` expanded with `ExpandEnvironmentStringsW`, as PowerShell does |
| `reg.exe` text fallback | dropped (difference 9) |
| per-key last-write time via P/Invoke `RegQueryInfoKey` | `RegQueryInfoKeyW`, then `FileTimeToSystemTime` and `SystemTimeToTzSpecificLocalTime` (the zone's rules for that date, DST included, as .NET's `FromFileTime`) |
| folder sizes: `readdir` plus `stat` per file | `FindFirstFileExW` with `FindExInfoBasic` and `FIND_FIRST_EX_LARGE_FETCH`: the size comes with the name; junctions and symlinks recognised by the reparse tag in `dwReserved0`; four folders at a time |
| icon extraction: PowerShell plus inline C# `PrivateExtractIcons` and `System.Drawing` | `PrivateExtractIconsW` (64 x 64) then `GetIconInfo` and `GetDIBits`, mask used for icons without alpha |
| file-type icons: `SHGetFileInfo` in PowerShell | `SHGetFileInfoW` with `SHGFI_USEFILEATTRIBUTES` |
| Store and extension icon files read as data URIs | Windows Imaging Component (`CreateDecoderFromFilename`, Fant scaler, `WICConvertBitmapSource` to straight RGBA); SVG kept as SVG for iced's renderer |
| MSI `ProductIcon` via `Get-ItemProperty` | `RegQueryValueExW` on `HKLM\SOFTWARE\Classes\Installer\Products\<packed code>` |
| `Get-Item ... .VersionInfo` | `GetFileVersionInfoSizeW`, `GetFileVersionInfoW`, `VerQueryValueW` (translations tried in .NET's order) |
| `Get-AuthenticodeSignature` | `WinVerifyTrust` (`WINTRUST_ACTION_GENERIC_VERIFY_V2`) on the file, then on the catalog found with `CryptCATAdminCalcHashFromFileHandle` and `CryptCATAdminEnumCatalogFromHash`; signer from `WTHelperGetProvCertFromChain` and `CertGetNameStringW` (CN, else O) |
| `Get-AppxPackage` (and a size walk) | WinRT `PackageManager::FindPackagesByUserSecurityId("")`, `Package::IsFramework`, `SignatureKind`, `InstalledPath`, `Id`; manifest `DisplayName` read from `AppxManifest.xml`; sizes through the same folder walker |
| `Get-AppxPackage ... NonRemovable` | **the one PowerShell call left**: `Windows.ApplicationModel.Package` and `PackageManager` have no such property (checked in the windows-0.62.2 metadata), so a single `Get-AppxPackage` listing only `PackageFullName` and `NonRemovable` is merged in when it answers; until then an app reads as not removable |
| `Get-Process` | `CreateToolhelp32Snapshot`, `Process32FirstW/NextW`, `OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION)`, `QueryFullProcessImageNameW` |
| `Get-CimInstance Win32_OptionalFeature`, `Get-HotFix` | WMI in process: `IWbemLocator::ConnectServer("ROOT\CIMV2")`, `IWbemServices::ExecQuery` (same classes, same filter) |
| `Get-CimInstance Win32_Service`, `Win32_SystemDriver` | the `ImagePath` of every key under `HKLM\SYSTEM\CurrentControlSet\Services` (services and drivers both keep it there; `\??\` stripped) |
| `Get-ScheduledTask` | Task Scheduler COM: `ITaskService::Connect`, `GetFolder`, `GetTasks(TASK_ENUM_HIDDEN)`, `IExecAction::Path`, recursing into folders |
| `Run` values, `Installer\Folders` | direct registry reads |
| GOG `Get-ItemProperty` | direct registry read of `HKLM\SOFTWARE\[WOW6432Node\]GOG.com\Games\*` |
| `ProfileList` and the current user's SID | registry read, and `OpenProcessToken` + `GetTokenInformation(TokenUser)` + `ConvertSidToStringSidW` |
| localised sorting `localeCompare` | `CompareStringEx` (`LINGUISTIC_IGNORECASE | LINGUISTIC_IGNOREDIACRITIC` for `sensitivity: 'base'`, `SORT_DIGITSASNUMBERS` for `numeric: true`) |
| `toLocaleDateString()` | `GetDateFormatEx` (difference 3) |

## Review Focus

1. **Sizes and the shared cache.** `folder-sizes.json` is read and written in 3.x's shape; a 3.2 file loads, a 4.0 file loads in 3.2 (Task 3's tests write both ways). A day-old figure is shown at once and measured again after the answer is out; a figure past thirty days is not shown. The shared-folder rule (several programs falling back to one launcher folder: none is measured) and nested exclusions (Steam leaves its games out) are Task 4's tests.
2. **The list never waits.** `Table::lists()` is derived from whatever has arrived, so the order cannot matter (Task 16 reverses a stage list and compares). Only the registry read can fail the screen.
3. **Rows the screen must keep out of "All".** Extensions, Not registered, Windows features and updates and other accounts are lists of their own and are not in the count or the total (Task 15's chip test; the heading says 235, not 235 + 33 + 5 + 19).
4. **Nothing runs before it is asked for.** `Applications::new` starts nothing; the first `Navigate(Applications)` starts the load; leaving the screen ends the 15 s chain at its next tick.
5. **Selection is a statement about what is on screen.** A tick that is filtered, searched or hidden away leaves the selection; Select all never takes an ineligible or hidden row (Task 24's tests are 3.x's own).
6. **iced API drift.** The view code is the part most likely to need a signature fixed against the real tree. Fix the call, not the behaviour; the state tests and the PNGs are the check.

## How the live checks work

Several tests compare the native result with what 3.x's own backend returned for the same registry. They read the folder named by `PRUNE_3X_DIR` and skip silently when it is not set, so CI is unaffected. Capture the folder once per session (the data changes when programs update: a Spotify update between a capture and a run once showed as a version difference, and a fresh capture cleared it):

```powershell
# native/perf/capture-3x.ps1: run from the repo root. Starts 3.x's backend on port 3199 against a scratch
# settings folder, saves what every Applications endpoint returned, and stops ONLY the process it started.
param([string]$Out = "$env:TEMP\prune-3x")
New-Item -ItemType Directory -Force $Out | Out-Null
$env:UNREVO_SETTINGS_PATH = "$Out\settings.json"
$env:UNREVO_BACKEND_PORT = '3199'
$proc = Start-Process node -ArgumentList 'src/index.js' -WorkingDirectory "$PWD\backend" -PassThru -WindowStyle Hidden
try {
  Start-Sleep 6
  $base = 'http://127.0.0.1:3199/api/programs'
  foreach ($e in 'programs=', 'sizes=sizes', 'versions=versions', 'install-dates=install-dates', 'store=store', 'extensions=extensions',
                 'chocolatey=chocolatey', 'unregistered=unregistered', 'signatures=signatures', 'windows-features=windows-features',
                 'windows-updates=windows-updates', 'other-accounts=other-accounts', 'icons=icons', 'package-icons=package-icons', 'running=running') {
    $name, $path = $e -split '=', 2
    $sw = [Diagnostics.Stopwatch]::StartNew()
    Invoke-WebRequest "$base/$path" -OutFile "$Out\$name.json" -TimeoutSec 120
    '{0,-18} {1,6:n1} s' -f $name, $sw.Elapsed.TotalSeconds
  }
} finally { Stop-Process -Id $proc.Id -Force }
```

(Never `taskkill /IM node.exe`: other tools on the machine run on node.) Each live test then runs with `PRUNE_3X_DIR=<folder>`; `programs_registry_live` also wants `PRUNE_3X_PROGRAMS=<folder>\programs.json`.

---

### Task 1: The row model and the path rules

**Files:**
- Create: `native/crates/prune-core/src/programs/mod.rs` (grows by one line per task; this task's content is below), `native/crates/prune-core/src/programs/model.rs`, `native/crates/prune-core/src/programs/paths.rs`
- Modify: `native/crates/prune-core/src/lib.rs`
- Test: `native/crates/prune-core/tests/programs_model.rs`

**Interfaces:**
- Produces: `Program` (every field 3.x's row has: `id, name, publisher, version, install_date, install_date_approximate, size_bytes, size_measured, uninstall_string, install_location, registry_key, display_icon, architecture, website, health, source, version_from_binary, signature, package_full_name, package_name, non_removable, browser, extension_id, enabled, chocolatey_id, owner, feature_protected`), `Source` (`Registry, Store, Chocolatey, Extension, Unregistered, Feature, Update, OtherUser`), `Hive`, `Arch`, `Health`, `Signature`/`SigStatus`, `RawEntry`, `normalize_program`, `parse_registry_date`, `dedupe_ids`, `architecture_from`, `first_http_url`, `registry_key_path`; `parse_uninstaller_path`, `mentions_msiexec`, `parse_icon_source`, `icon_source_for`, `icon_source_from_uninstaller`, `assess_health`, `size_source_for`, `is_inside`, `is_strictly_inside`, `norm_path`, `product_code_from`, `pack_product_code`.
- The rules are 3.x's, with their recorded bug fixes: Squirrel installers write minutes where the month belongs (`20252515`), so a date not on the calendar is no date; the registry subkey name is not unique across hives (7-Zip), so later collisions get `#2`; a per-user entry has no architecture, and a wrong "64-bit" is worse than a blank; `winget uninstall` is not a path (it once badged every winget package Broken); `MsiExec` always exists, so only a missing install folder can orphan an MSI entry.

- [ ] **Step 1: Write the tests.**

**Create `native/crates/prune-core/tests/programs_model.rs`:**

```rust
//! The row model and the path rules, ported from 3.x's programs.test.js,
//! uninstallerPath.test.js, iconSource.test.js, programHealth.test.js and
//! installSize.test.js.

use prune_core::programs::model::*;
use prune_core::programs::paths::*;

fn raw(id: &str, name: &str) -> RawEntry {
    RawEntry {
        id: id.into(),
        display_name: name.into(),
        hive: Some(Hive::LocalMachine),
        subkey_path: format!(r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{id}"),
        ..RawEntry::default()
    }
}

fn program(uninstall: Option<&str>, location: Option<&str>) -> Program {
    Program {
        id: "p".into(),
        name: "P".into(),
        uninstall_string: uninstall.map(Into::into),
        install_location: location.map(Into::into),
        ..Program::default()
    }
}

#[test]
fn registry_dates_are_calendar_dates_or_nothing() {
    assert_eq!(parse_registry_date("20260819").as_deref(), Some("2026-08-19"));
    assert_eq!(parse_registry_date("20240229").as_deref(), Some("2024-02-29"));
    // Squirrel writes the minutes where the month belongs.
    assert_eq!(parse_registry_date("20252515"), None);
    assert_eq!(parse_registry_date("20260231"), None);
    assert_eq!(parse_registry_date("19700101"), None);
    assert_eq!(parse_registry_date("2026-08-19"), None);
    assert_eq!(parse_registry_date(""), None);
}

#[test]
fn normalize_fills_the_rules_3x_applies() {
    let mut r = raw("App", "App");
    r.estimated_size_kb = Some(10);
    r.url_info_about = Some("not a url".into());
    r.help_link = Some("  https://example.com/help ".into());
    let p = normalize_program(&r);
    assert_eq!(p.publisher, "Unknown Publisher");
    assert_eq!(p.version, "");
    assert_eq!(p.size_bytes, Some(10 * 1024));
    assert_eq!(p.website.as_deref(), Some("https://example.com/help"));
    assert_eq!(p.architecture, Some(Arch::Bits64));
    assert_eq!(p.registry_key.as_deref(), Some(r"HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\App"));
}

#[test]
fn architecture_comes_from_where_the_entry_lives() {
    assert_eq!(architecture_from(Some(Hive::LocalMachine), true), Some(Arch::Bits32));
    assert_eq!(architecture_from(Some(Hive::LocalMachine), false), Some(Arch::Bits64));
    // A per-user entry carries none: blank rather than a confident guess.
    assert_eq!(architecture_from(Some(Hive::CurrentUser), false), None);
}

#[test]
fn a_size_windows_would_read_as_negative_is_not_a_size() {
    let mut r = raw("A", "A");
    r.estimated_size_kb = Some(0xFFFF_FFFF);
    assert_eq!(normalize_program(&r).size_bytes, None);
    r.estimated_size_kb = Some(0);
    assert_eq!(normalize_program(&r).size_bytes, Some(0));
}

#[test]
fn only_http_addresses_become_a_website() {
    assert_eq!(first_http_url(&[Some("ftp://x"), Some("HTTP://a.b")]).as_deref(), Some("HTTP://a.b"));
    assert_eq!(first_http_url(&[Some("https://"), None]), None);
    assert_eq!(first_http_url(&[None, Some("")]), None);
}

#[test]
fn duplicate_ids_get_a_suffix_and_the_first_keeps_its_own() {
    // 7-Zip registers "7-Zip" in both the 64-bit and the WOW6432Node hive.
    let mut list: Vec<Program> = ["7-Zip", "x", "7-Zip", "7-Zip"].iter().map(|id| Program { id: (*id).into(), ..Program::default() }).collect();
    dedupe_ids(&mut list);
    assert_eq!(list.iter().map(|p| p.id.as_str()).collect::<Vec<_>>(), ["7-Zip", "x", "7-Zip#2", "7-Zip#3"]);
    // Running it again on a unique list is a no-op.
    let before = list.clone();
    dedupe_ids(&mut list);
    assert_eq!(list, before);
}

#[test]
fn uninstaller_paths_like_3x() {
    let exe = |s: &str| parse_uninstaller_path(s).executable;
    assert_eq!(exe(r#""C:\Program Files\App\uninstall.exe" /S"#).as_deref(), Some(r"C:\Program Files\App\uninstall.exe"));
    assert_eq!(exe(r"C:\Apps\thing\uninst.exe /quiet").as_deref(), Some(r"C:\Apps\thing\uninst.exe"));
    assert_eq!(exe(r"C:\Program Files\App\uninstall.exe /S").as_deref(), Some(r"C:\Program Files\App\uninstall.exe"));
    assert_eq!(exe(""), None);
    assert_eq!(exe("   "), None);
    assert!(exe("rundll32.exe advpack.dll,LaunchINFSection thing.inf").unwrap().to_lowercase().contains("rundll32.exe"));
    for msi in ["MsiExec.exe /X{1234-5678}", "msiexec /x {1234-5678}", r#""C:\Windows\System32\msiexec.exe" /I{ABC}"#] {
        assert!(parse_uninstaller_path(msi).is_msi, "{msi}");
    }
    assert!(!parse_uninstaller_path(r#""C:\Games\uninstall.exe" /S"#).is_msi);
    assert!(!parse_uninstaller_path(r"C:\msiexecutor\u.exe").is_msi);
}

#[test]
fn display_icon_splits_file_and_index_only_at_the_end() {
    let src = |s: &str| parse_icon_source(s).map(|i| (i.path, i.index));
    assert_eq!(src(r"C:\Program Files\7-Zip\7zFM.exe"), Some((r"C:\Program Files\7-Zip\7zFM.exe".into(), 0)));
    assert_eq!(src(r"C:\P\uninstall.exe,0"), Some((r"C:\P\uninstall.exe".into(), 0)));
    assert_eq!(src(r#""C:\P\a.ico""#), Some((r"C:\P\a.ico".into(), 0)));
    assert_eq!(src(r"C:\P\x.dll, -102"), Some((r"C:\P\x.dll".into(), -102)));
    // A comma inside a path is not an index.
    assert_eq!(src(r"C:\Program Files\Foo, Inc\app.exe"), Some((r"C:\Program Files\Foo, Inc\app.exe".into(), 0)));
    assert_eq!(src(""), None);
}

#[test]
fn the_uninstaller_is_an_icon_source_only_when_it_is_a_real_file() {
    let from = |s: &str| icon_source_from_uninstaller(&program(Some(s), None)).map(|i| i.path);
    assert_eq!(from(r#""C:\A\unins.exe" /S"#).as_deref(), Some(r"C:\A\unins.exe"));
    assert_eq!(from("MsiExec.exe /X{AAAA}"), None);
    assert_eq!(from("winget uninstall"), None);
}

#[test]
fn health_needs_positive_evidence() {
    let exists_none = |_: &str| false;
    let exists_all = |_: &str| true;
    // A gone uninstaller.
    let h = assess_health(&program(Some(r#""C:\A\u.exe""#), None), &exists_none);
    assert!(h.orphaned);
    assert_eq!(h.uninstaller_missing, Some(true));
    // No command at all.
    assert!(assess_health(&program(None, None), &exists_all).orphaned);
    // A PATH-resolved command (winget) is not a path: left alone.
    let h = assess_health(&program(Some("winget uninstall"), None), &exists_none);
    assert!(!h.orphaned);
    assert_eq!(h.uninstaller_missing, None);
    // MSI: msiexec always exists, so only a missing install folder counts.
    let h = assess_health(&program(Some("MsiExec.exe /X{A}"), Some(r"C:\Gone\")), &exists_none);
    assert!(h.orphaned);
    assert!(h.reason.unwrap().contains(r"C:\Gone"));
    assert!(!assess_health(&program(Some("MsiExec.exe /X{A}"), None), &exists_none).orphaned);
}

#[test]
fn a_size_folder_is_one_programs_own_or_nothing() {
    let src = |u: Option<&str>, l: Option<&str>| size_source_for(&program(u, l));
    assert_eq!(src(None, Some(r"C:\Program Files\App\")).as_deref(), Some(r"C:\Program Files\App"));
    assert_eq!(src(None, Some(r"C:\Program Files")), None);
    assert_eq!(src(None, Some(r"C:\Windows\System32")), None);
    assert_eq!(src(None, Some(r"C:\ProgramData\X")), None);
    assert_eq!(src(None, Some(r"C:\Program Files\Common Files\X")), None);
    // The uninstaller's folder stands in when there is no InstallLocation...
    assert_eq!(src(Some(r#""C:\Program Files\EqualizerAPO\Uninstall.exe""#), None).as_deref(), Some(r"C:\Program Files\EqualizerAPO"));
    // ...but never msiexec's, a PATH command's, or a drive root's.
    assert_eq!(src(Some("MsiExec.exe /X{A}"), None), None);
    assert_eq!(src(Some("winget uninstall"), None), None);
    assert_eq!(src(Some(r"C:\u.exe"), None), None);
}

#[test]
fn nested_folders_compare_across_slash_styles() {
    assert!(is_strictly_inside("C:/Program Files (x86)/Ubisoft/games/R6", r"C:\Program Files (x86)\Ubisoft"));
    assert!(!is_strictly_inside(r"C:\AppData", r"C:\App"));
    assert!(!is_strictly_inside(r"C:\App\", r"C:\app"));
}

#[test]
fn msi_product_codes() {
    assert_eq!(product_code_from("MsiExec.exe /X{0a1b2c3d-0000-1111-2222-333344445555}").as_deref(), Some("{0A1B2C3D-0000-1111-2222-333344445555}"));
    assert_eq!(product_code_from(r#""C:\a\setup.exe" /X{0a1b2c3d-0000-1111-2222-333344445555}"#), None);
    assert_eq!(product_code_from("msiexec /i nothing"), None);
    // Windows Installer's packed key: groups 1-3 reversed whole, 4-5 in pairs.
    assert_eq!(pack_product_code("{12345678-9ABC-DEF0-1234-56789ABCDEF0}").as_deref(), Some("87654321CBA90FED21436587A9CBED0F"));
    assert_eq!(pack_product_code("{nope}"), None);
}
```


- [ ] **Step 2:** `cd native && cargo test -p prune-core --test programs_model`. Expected: FAIL (the `programs` module does not exist).
- [ ] **Step 3: Implement.**

**Create `native/crates/prune-core/src/programs/model.rs`:**

```rust
//! One row of the Applications list, and the rules that shape the raw
//! registry data into it (`backend/src/services/programs.js`).

use std::collections::HashMap;

/// Where a row came from. A registry program has no `source` in 3.x.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
pub enum Source {
    #[default]
    Registry,
    Store,
    Chocolatey,
    Extension,
    Unregistered,
    Feature,
    Update,
    OtherUser,
}

/// Which registry hive an Uninstall entry was read from.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Hive {
    LocalMachine,
    CurrentUser,
}

/// The Type column. Written only where Windows records it structurally.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Arch {
    Bits32,
    Bits64,
}

impl Arch {
    pub fn label(self) -> &'static str {
        match self {
            Arch::Bits32 => "32-bit",
            Arch::Bits64 => "64-bit",
        }
    }
}

/// Whether a registry entry can still uninstall itself
/// (`programHealth.js`). `orphaned` needs positive evidence.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Health {
    pub orphaned: bool,
    pub uninstaller_missing: Option<bool>,
    pub install_location_missing: Option<bool>,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SigStatus {
    Valid,
    Unsigned,
    /// Signed, but the file changed after signing or the signer is not trusted.
    Broken,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Signature {
    pub status: SigStatus,
    pub signer: Option<String>,
}

/// A row. Field names follow 3.x's program object; sizes are bytes.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Program {
    pub id: String,
    pub name: String,
    pub publisher: String,
    pub version: String,
    /// `YYYY-MM-DD`.
    pub install_date: Option<String>,
    /// The date was inferred (key write time, folder creation time).
    pub install_date_approximate: bool,
    pub size_bytes: Option<u64>,
    pub size_measured: bool,
    pub uninstall_string: Option<String>,
    pub install_location: Option<String>,
    /// `HKLM:\...` / `HKCU:\...`, the form Quarantine understands.
    pub registry_key: Option<String>,
    pub display_icon: Option<String>,
    pub architecture: Option<Arch>,
    pub website: Option<String>,
    pub health: Option<Health>,
    pub source: Source,
    pub version_from_binary: bool,
    pub signature: Option<Signature>,
    // Store
    pub package_full_name: Option<String>,
    pub package_name: Option<String>,
    /// `None` until Windows has said; read as "not removable".
    pub non_removable: Option<bool>,
    // Extension
    pub browser: Option<String>,
    pub extension_id: Option<String>,
    pub enabled: Option<bool>,
    // Chocolatey
    pub chocolatey_id: Option<String>,
    // Other accounts
    pub owner: Option<String>,
    // Windows features
    pub feature_protected: bool,
}

impl Program {
    /// No valid signature on the program's own files: none at all, or one
    /// that no longer matches. Programs not checked are not counted.
    pub fn is_unsigned(&self) -> bool {
        matches!(self.signature.as_ref().map(|s| s.status), Some(SigStatus::Unsigned | SigStatus::Broken))
    }

    pub fn is_orphaned(&self) -> bool {
        self.health.as_ref().is_some_and(|h| h.orphaned)
    }
}

/// What an Uninstall key holds, before any rule is applied.
#[derive(Debug, Clone, Default)]
pub struct RawEntry {
    /// The subkey's own name (`PSChildName`).
    pub id: String,
    pub hive: Option<Hive>,
    /// Read from `WOW6432Node`.
    pub wow: bool,
    /// The key under the hive: `SOFTWARE\...\Uninstall\<id>`.
    pub subkey_path: String,
    pub display_name: String,
    pub publisher: Option<String>,
    pub display_version: Option<String>,
    pub install_date: Option<String>,
    /// `EstimatedSize` as the DWORD Windows holds (KB).
    pub estimated_size_kb: Option<u32>,
    pub uninstall_string: Option<String>,
    pub install_location: Option<String>,
    pub display_icon: Option<String>,
    pub url_info_about: Option<String>,
    pub help_link: Option<String>,
}

fn non_empty(value: &Option<String>) -> Option<String> {
    value.as_ref().filter(|v| !v.is_empty()).cloned()
}

/// The raw-registry-shape-to-row mapping (`normalizeProgram`).
pub fn normalize_program(raw: &RawEntry) -> Program {
    Program {
        id: raw.id.clone(),
        name: raw.display_name.clone(),
        publisher: non_empty(&raw.publisher).unwrap_or_else(|| "Unknown Publisher".to_owned()),
        version: non_empty(&raw.display_version).unwrap_or_default(),
        install_date: raw.install_date.as_deref().and_then(parse_registry_date),
        // EstimatedSize is KB in the registry; the app works in bytes. A
        // value PowerShell reads as a negative Int32 (>= 0x8000_0000) is not
        // a size: 3.x showed "-1 KB", here it is simply not recorded.
        size_bytes: raw.estimated_size_kb.filter(|kb| *kb < 0x8000_0000).map(|kb| u64::from(kb) * 1024),
        uninstall_string: non_empty(&raw.uninstall_string),
        install_location: non_empty(&raw.install_location),
        registry_key: raw.hive.map(|h| registry_key_path(h, &raw.subkey_path)),
        display_icon: non_empty(&raw.display_icon),
        architecture: architecture_from(raw.hive, raw.wow),
        website: first_http_url(&[raw.url_info_about.as_deref(), raw.help_link.as_deref()]),
        ..Program::default()
    }
}

/// `HKLM:\SOFTWARE\...` for the hive and key (`toPowerShellRegistryPath`).
pub fn registry_key_path(hive: Hive, subkey_path: &str) -> String {
    let prefix = match hive {
        Hive::LocalMachine => "HKLM:",
        Hive::CurrentUser => "HKCU:",
    };
    format!("{prefix}\\{subkey_path}")
}

/// 32- or 64-bit from WHERE the entry lives. A per-user entry carries no
/// architecture and gives `None`: a wrong "64-bit" is worse than a blank.
pub fn architecture_from(hive: Option<Hive>, wow: bool) -> Option<Arch> {
    match hive {
        Some(Hive::LocalMachine) => Some(if wow { Arch::Bits32 } else { Arch::Bits64 }),
        _ => None,
    }
}

/// The first value that is an `http(s)://` address (`firstHttpUrl`). Both
/// fields are third-party text and plenty of them are not URLs.
pub fn first_http_url(candidates: &[Option<&str>]) -> Option<String> {
    candidates.iter().flatten().map(|c| c.trim()).find_map(|c| {
        let lower = c.to_ascii_lowercase();
        let rest = lower.strip_prefix("https://").or_else(|| lower.strip_prefix("http://"))?;
        rest.chars().next().filter(|ch| !ch.is_whitespace()).map(|_| c.to_owned())
    })
}

fn days_in_month(year: u32, month: u32) -> u32 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        _ if year % 4 == 0 && (year % 100 != 0 || year % 400 == 0) => 29,
        _ => 28,
    }
}

/// Registry `InstallDate` is `YYYYMMDD` or absent. Returns `YYYY-MM-DD`, or
/// `None` for anything that is not a calendar date from 1980 on. Squirrel
/// installers write minutes where the month belongs ("20252515"), which 3.x
/// once showed as "Invalid Date": a date that is not on the calendar is no
/// date (`parseRegistryDate`).
pub fn parse_registry_date(raw: &str) -> Option<String> {
    if raw.len() != 8 || !raw.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    let year = raw[0..4].parse::<u32>().ok()?;
    let month = raw[4..6].parse::<u32>().ok()?;
    let day = raw[6..8].parse::<u32>().ok()?;
    if year < 1980 || !(1..=12).contains(&month) || day < 1 || day > days_in_month(year, month) {
        return None;
    }
    Some(format!("{}-{}-{}", &raw[0..4], &raw[4..6], &raw[6..8]))
}

/// Registry subkey names are not unique across the three hives (7-Zip uses
/// the literal "7-Zip" in both the 64-bit and the WOW6432Node hive).
/// Order-stable: the first keeps its id, later collisions get `#2`, `#3`.
pub fn dedupe_ids(programs: &mut [Program]) {
    let mut seen: HashMap<String, u32> = HashMap::new();
    for program in programs {
        let count = seen.entry(program.id.clone()).or_insert(0);
        *count += 1;
        if *count > 1 {
            program.id = format!("{}#{}", program.id, count);
        }
    }
}
```


**Create `native/crates/prune-core/src/programs/paths.rs`:**

```rust
//! Reading paths out of the command lines installers write into the
//! registry, and the health check built on them (`uninstallerPath.js`,
//! `iconSource.js`, `programHealth.js`, the folder rules of `installSize.js`).
//! Pure string work: nothing here touches the disk except through the
//! `exists` argument.

use super::model::{Health, Program};

/// The executable of an `UninstallString`, and whether it is an MSI entry.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Uninstaller {
    pub executable: Option<String>,
    pub is_msi: bool,
}

fn is_word(c: char) -> bool {
    c.is_ascii_alphanumeric() || c == '_'
}

/// `(^|[\\/])msiexec(\.exe)?\b`, case-insensitive, anywhere in `text`.
/// The boundary keeps a program merely named "msiexecutor" from matching.
pub fn mentions_msiexec(text: &str) -> bool {
    let lower = text.to_lowercase();
    let mut from = 0;
    while let Some(at) = lower[from..].find("msiexec") {
        let start = from + at;
        let end = start + "msiexec".len();
        let before_ok = start == 0 || matches!(lower[..start].chars().next_back(), Some('\\' | '/'));
        let after_ok = !lower[end..].chars().next().is_some_and(is_word);
        if before_ok && after_ok {
            return true;
        }
        from = end;
    }
    false
}

/// Pulls the executable out of an `UninstallString`. Quoted, or unquoted
/// and cut at the first ` /` or ` -` token (Windows itself tries ever longer
/// prefixes; a space before a switch is the better signal than any space).
pub fn parse_uninstaller_path(uninstall_string: &str) -> Uninstaller {
    let trimmed = uninstall_string.trim();
    if trimmed.is_empty() {
        return Uninstaller { executable: None, is_msi: false };
    }
    let executable = if let Some(rest) = trimmed.strip_prefix('"') {
        rest.split('"').next().unwrap_or("").to_owned()
    } else {
        let chars: Vec<(usize, char)> = trimmed.char_indices().collect();
        let cut = chars
            .windows(2)
            .find(|w| w[0].1.is_whitespace() && matches!(w[1].1, '/' | '-'))
            .map(|w| w[0].0);
        cut.map_or(trimmed, |i| &trimmed[..i]).to_owned()
    };
    let executable = executable.trim().to_owned();
    let is_msi = mentions_msiexec(&executable);
    Uninstaller { executable: (!executable.is_empty()).then_some(executable), is_msi }
}

/// `C:\x` or `\\server\share`: a path to look for, not a command Windows
/// resolves through PATH (`winget uninstall`, `rundll32.exe ...`).
pub fn is_absolute_path(executable: &str) -> bool {
    let b = executable.as_bytes();
    (b.len() >= 3 && b[0].is_ascii_alphabetic() && b[1] == b':' && (b[2] == b'\\' || b[2] == b'/'))
        || executable.starts_with("\\\\")
}

/// Lowercase, one separator style, no trailing separator.
pub fn norm_path(path: &str) -> String {
    path.replace('/', "\\").trim_end_matches('\\').to_lowercase()
}

/// `child` is `parent` or inside it. The separator in the comparison is the
/// point: "C:\App" must not swallow "C:\AppData".
pub fn is_inside(child: &str, parent: &str) -> bool {
    let (c, p) = (norm_path(child), norm_path(parent));
    c == p || c.starts_with(&format!("{p}\\"))
}

pub fn is_strictly_inside(child: &str, parent: &str) -> bool {
    norm_path(child) != norm_path(parent) && is_inside(child, parent)
}

/// A DisplayIcon value: the file and which icon in it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IconSource {
    pub path: String,
    pub index: i32,
}

/// Splits a `DisplayIcon` into file and index. The index is only a comma
/// plus digits at the very END: a comma is legal inside a Windows path.
pub fn parse_icon_source(display_icon: &str) -> Option<IconSource> {
    let mut value = display_icon.trim();
    if value.is_empty() {
        return None;
    }
    let mut index = 0;
    if let Some(comma) = value.rfind(',') {
        let tail = value[comma + 1..].trim();
        let digits = tail.strip_prefix('-').unwrap_or(tail);
        if !digits.is_empty() && digits.bytes().all(|b| b.is_ascii_digit()) {
            index = tail.parse().unwrap_or(0);
            value = &value[..comma];
        }
    }
    let path = value.trim().trim_matches('"').trim();
    (!path.is_empty()).then(|| IconSource { path: path.to_owned(), index })
}

/// What the vendor registered. Always the first choice.
pub fn icon_source_for(program: &Program) -> Option<IconSource> {
    program.display_icon.as_deref().and_then(parse_icon_source)
}

/// The uninstaller as an icon source: LAST resort. Refuses msiexec (every
/// MSI program would get the same Installer glyph) and PATH-resolved commands.
pub fn icon_source_from_uninstaller(program: &Program) -> Option<IconSource> {
    let u = parse_uninstaller_path(program.uninstall_string.as_deref()?);
    let executable = u.executable?;
    (!u.is_msi && is_absolute_path(&executable)).then_some(IconSource { path: executable, index: 0 })
}

/// An InstallLocation: quotes, a trailing separator or "" all mean the same
/// directory for existence purposes.
fn clean_location(raw: Option<&str>) -> Option<String> {
    let cleaned = raw?.trim().trim_matches('"').trim_end_matches(['\\', '/']).to_owned();
    (!cleaned.is_empty()).then_some(cleaned)
}

/// Whether an entry can still uninstall itself (`assessProgramHealth`).
/// Conservative: `orphaned` only on positive evidence that something is
/// gone. Where the question has no honest answer the field is `None`.
pub fn assess_health(program: &Program, exists: &dyn Fn(&str) -> bool) -> Health {
    let u = parse_uninstaller_path(program.uninstall_string.as_deref().unwrap_or(""));
    let checkable = u.executable.as_deref().filter(|e| !u.is_msi && is_absolute_path(e));
    let uninstaller_missing = checkable.map(|e| !exists(e));
    let location = clean_location(program.install_location.as_deref());
    let install_location_missing = location.as_deref().map(|l| !exists(l));
    let orphan = |reason: String| Health { orphaned: true, uninstaller_missing, install_location_missing, reason: Some(reason) };

    let Some(executable) = &u.executable else {
        return orphan("No uninstall command is registered for this program.".to_owned());
    };
    if uninstaller_missing == Some(true) {
        return orphan(format!("Its uninstaller is missing ({executable})."));
    }
    if u.is_msi && install_location_missing == Some(true) {
        return orphan(format!("Its install folder is missing ({}).", location.unwrap_or_default()));
    }
    Health { orphaned: false, uninstaller_missing, install_location_missing, reason: None }
}

/// Folders that are never one program's install directory.
fn is_shared_folder(clean: &str) -> bool {
    let n = norm_path(clean);
    let rest = n.get(1..).filter(|r| r.starts_with(':')).map(|r| &r[1..]);
    let Some(rest) = rest else { return false };
    let under = |name: &str| rest == format!("\\{name}") || rest.starts_with(&format!("\\{name}\\"));
    under("windows")
        || under("program files\\common files")
        || under("program files (x86)\\common files")
        || under("programdata")
}

/// A folder deep enough to be one program's own: "C:" or "C:\Program Files"
/// is a container.
fn is_safe_folder(folder: &str) -> bool {
    let clean = folder.trim_end_matches(['\\', '/']);
    if is_shared_folder(clean) {
        return false;
    }
    clean.split(['\\', '/']).filter(|s| !s.is_empty()).count() >= 3
}

/// The folder to measure for a program, or `None` when there is no safe one:
/// InstallLocation, else the folder its uninstaller lives in (`sizeSourceFor`).
pub fn size_source_for(program: &Program) -> Option<String> {
    let location = program.install_location.as_deref().map(str::trim).unwrap_or("");
    if !location.is_empty() {
        return is_safe_folder(location).then(|| location.trim_end_matches(['\\', '/']).to_owned());
    }
    let u = parse_uninstaller_path(program.uninstall_string.as_deref()?);
    let executable = u.executable?;
    if u.is_msi || !is_absolute_path(&executable) || executable.starts_with("\\\\") {
        return None;
    }
    let folder = executable.rsplit_once(['\\', '/']).map(|(dir, _)| dir.to_owned())?;
    is_safe_folder(&folder).then_some(folder)
}

/// The MSI product code in an msiexec uninstall string, upper-cased.
pub fn product_code_from(uninstall_string: &str) -> Option<String> {
    if !mentions_msiexec(uninstall_string) {
        return None;
    }
    let bytes = uninstall_string.as_bytes();
    let shape = [8, 4, 4, 4, 12];
    for start in (0..bytes.len()).filter(|&i| bytes[i] == b'{') {
        let mut at = start + 1;
        let mut ok = true;
        for (n, len) in shape.iter().enumerate() {
            if n > 0 {
                if bytes.get(at) != Some(&b'-') {
                    ok = false;
                    break;
                }
                at += 1;
            }
            if !(at + len <= bytes.len() && bytes[at..at + len].iter().all(u8::is_ascii_hexdigit)) {
                ok = false;
                break;
            }
            at += len;
        }
        if ok && bytes.get(at) == Some(&b'}') {
            return Some(uninstall_string[start..=at].to_ascii_uppercase());
        }
    }
    None
}

/// A product code in the form Windows Installer keys its registry by: the
/// first three groups reversed whole, the last two reversed in pairs.
/// `None` unless it is exactly a product code: the result is pasted into a
/// registry path.
pub fn pack_product_code(code: &str) -> Option<String> {
    let t = code.trim();
    let inner = t.strip_prefix('{')?.strip_suffix('}')?;
    let groups: Vec<&str> = inner.split('-').collect();
    let shape = [8, 4, 4, 4, 12];
    if groups.len() != 5 || groups.iter().zip(shape).any(|(g, n)| g.len() != n || !g.bytes().all(|b| b.is_ascii_hexdigit())) {
        return None;
    }
    let up: Vec<String> = groups.iter().map(|g| g.to_ascii_uppercase()).collect();
    let rev = |s: &str| s.chars().rev().collect::<String>();
    let swap = |s: &str| s.as_bytes().chunks(2).map(|p| format!("{}{}", p[1] as char, p[0] as char)).collect::<String>();
    Some(format!("{}{}{}{}{}", rev(&up[0]), rev(&up[1]), rev(&up[2]), swap(&up[3]), swap(&up[4])))
}
```


`native/crates/prune-core/src/programs/mod.rs` starts as:

```rust
//! The Applications list.

pub mod model;
pub mod paths;
```

and `lib.rs` gains `pub mod programs;` (the full diff is in Task 2, which adds the rest of `lib.rs`).

- [ ] **Step 4:** `cargo test -p prune-core --test programs_model`. Expected: 13 passed.
- [ ] **Step 5: Commit** `feat(native): the Applications row model and the path rules ported from 3.x`

### Task 2: The registry list

**Files:**
- Create: `native/crates/prune-core/src/winreg.rs`, `native/crates/prune-core/src/programs/registry.rs`, `native/perf/capture-3x.ps1` (the script above)
- Modify: `native/crates/prune-core/Cargo.toml`, `native/crates/prune-core/src/lib.rs`, `native/crates/prune-core/src/programs/mod.rs`
- Test: `native/crates/prune-core/tests/programs_registry_live.rs`

**Interfaces:**
- Produces: `winreg::{Root, Key, Value, expand_env}` (a read-only registry wrapper that answers `None` or an empty list on any failure: a refused key is an ordinary outcome), `registry::{UNINSTALL_LOCATIONS, is_listed, read_raw_entries, programs_from, list_installed_programs}`.
- The three hives are read in 3.x's order (HKLM 64-bit, HKLM `WOW6432Node`, HKCU), through the 64-bit view, which is how 3.x's 64-bit PowerShell reads `WOW6432Node` as a real key. `DisplayName` must be non-empty and `SystemComponent` not truthy (a DWORD that is not zero, or a non-empty string: PowerShell's truthiness). Health is assessed for every row (two existence checks each).

- [ ] **Step 1:** Run `powershell -File native\perf\capture-3x.ps1 -Out $env:TEMP\prune-3x` (the script is in "How the live checks work") and keep the folder: later tasks compare against it.
- [ ] **Step 2: Write the test.**

**Create `native/crates/prune-core/tests/programs_registry_live.rs`:**

```rust
//! The registry read, against this PC and against what 3.x's `/api/programs`
//! returned for the same registry. Windows only; the 3.x comparison runs
//! when `PRUNE_3X_PROGRAMS` names a saved copy of that response.

#![cfg(windows)]

use std::collections::BTreeMap;

use prune_core::programs::registry::list_installed_programs;
use serde_json::Value;

#[test]
fn a_real_windows_install_lists_programs() {
    let programs = list_installed_programs();
    assert!(programs.len() > 5, "only {} programs", programs.len());
    assert!(programs.iter().all(|p| !p.name.is_empty() && !p.id.is_empty()));
    let mut ids: Vec<&str> = programs.iter().map(|p| p.id.as_str()).collect();
    ids.sort_unstable();
    ids.dedup();
    assert_eq!(ids.len(), programs.len(), "ids are not unique");
}

#[test]
fn matches_3x_row_for_row() {
    let Some(path) = std::env::var_os("PRUNE_3X_PROGRAMS") else { return };
    let theirs: Value = serde_json::from_slice(&std::fs::read(path).unwrap()).unwrap();
    let theirs: BTreeMap<String, &Value> =
        theirs["programs"].as_array().unwrap().iter().map(|p| (p["id"].as_str().unwrap().to_owned(), p)).collect();
    let ours = list_installed_programs();

    let our_ids: Vec<&str> = ours.iter().map(|p| p.id.as_str()).collect();
    let their_ids: Vec<&str> = theirs.keys().map(String::as_str).collect();
    let mut a = our_ids.clone();
    a.sort_unstable();
    assert_eq!(a, their_ids, "the same rows");

    // A REG_SZ holding text after an embedded NUL (Roblox's DisplayName does)
    // reads, in Windows' own API, as the text before it; 3.x kept the tail.
    let c = |v: Option<&str>| v.map(|s| s.split('\0').next().unwrap_or("").to_owned());
    for p in &ours {
        let t = theirs[&p.id];
        assert_eq!(Some(p.name.clone()), c(t["name"].as_str()), "{}", p.id);
        assert_eq!(Some(p.publisher.clone()), c(t["publisher"].as_str()), "{}", p.id);
        assert_eq!(Some(p.version.clone()), c(t["version"].as_str()), "{}", p.id);
        assert_eq!(p.install_date.as_deref(), t["installDate"].as_str(), "{}", p.id);
        assert_eq!(p.size_bytes, t["sizeBytes"].as_u64(), "{}", p.id);
        assert_eq!(p.uninstall_string.as_deref(), t["uninstallString"].as_str(), "{}", p.id);
        assert_eq!(p.install_location.as_deref(), t["installLocation"].as_str(), "{}", p.id);
        assert_eq!(p.registry_key.as_deref(), t["registryKey"].as_str(), "{}", p.id);
        assert_eq!(p.display_icon.as_deref(), t["displayIcon"].as_str(), "{}", p.id);
        assert_eq!(p.architecture.map(|a| a.label()), t["architecture"].as_str(), "{}", p.id);
        assert_eq!(p.website.as_deref(), t["website"].as_str(), "{}", p.id);
        assert_eq!(p.is_orphaned(), t["health"]["orphaned"].as_bool().unwrap(), "{}", p.id);
    }
}
```


- [ ] **Step 3:** `cargo test -p prune-core --test programs_registry_live`. Expected: FAIL (no `registry` module).
- [ ] **Step 4: Implement.**

**Create `native/crates/prune-core/src/winreg.rs`:**

```rust
//! A small read-only wrapper over the registry calls the Applications list
//! needs. Every function answers `None` or an empty list on failure: a key
//! that is missing or refused is an ordinary outcome here, never an error.

#![cfg(windows)]

use windows::Win32::Foundation::{ERROR_MORE_DATA, ERROR_NO_MORE_ITEMS, FILETIME};
use windows::Win32::System::Environment::ExpandEnvironmentStringsW;
use windows::Win32::System::Registry::{
    HKEY, HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, HKEY_USERS, KEY_READ, KEY_WOW64_64KEY, REG_DWORD, REG_EXPAND_SZ,
    REG_QWORD, REG_SZ, REG_VALUE_TYPE, RegCloseKey, RegEnumKeyExW, RegEnumValueW, RegOpenKeyExW, RegQueryInfoKeyW,
    RegQueryValueExW,
};
use windows::core::{HSTRING, PWSTR};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Root {
    LocalMachine,
    CurrentUser,
    Users,
}

/// A registry value as PowerShell's `Get-ItemProperty` would hand it over:
/// `REG_EXPAND_SZ` already expanded.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Value {
    Str(String),
    Dword(u32),
    Qword(u64),
    Other,
}

pub struct Key(HKEY);

impl Drop for Key {
    fn drop(&mut self) {
        // SAFETY: the handle was opened by `open` and is closed once.
        unsafe {
            let _ = RegCloseKey(self.0);
        }
    }
}

fn utf16_to_string(buf: &[u16]) -> String {
    let end = buf.iter().position(|c| *c == 0).unwrap_or(buf.len());
    String::from_utf16_lossy(&buf[..end])
}

/// `%NAME%` references expanded; the text itself when it cannot be.
pub fn expand_env(text: &str) -> String {
    let wide = HSTRING::from(text);
    // SAFETY: `wide` is a valid NUL-terminated string for both calls.
    unsafe {
        let needed = ExpandEnvironmentStringsW(&wide, None);
        if needed == 0 {
            return text.to_owned();
        }
        let mut out = vec![0u16; needed as usize];
        let written = ExpandEnvironmentStringsW(&wide, Some(&mut out));
        if written == 0 { text.to_owned() } else { utf16_to_string(&out) }
    }
}

impl Key {
    /// Opens `path` under `root` for reading, in the 64-bit view (a
    /// `WOW6432Node` key is a real key in that view, which is how 3.x's
    /// 64-bit PowerShell reads it).
    pub fn open(root: Root, path: &str) -> Option<Key> {
        let base = match root {
            Root::LocalMachine => HKEY_LOCAL_MACHINE,
            Root::CurrentUser => HKEY_CURRENT_USER,
            Root::Users => HKEY_USERS,
        };
        let mut handle = HKEY::default();
        // SAFETY: `handle` outlives the call; the path is a valid wide string.
        let status = unsafe { RegOpenKeyExW(base, &HSTRING::from(path), None, KEY_READ | KEY_WOW64_64KEY, &mut handle) };
        status.is_ok().then_some(Key(handle))
    }

    pub fn open_sub(&self, path: &str) -> Option<Key> {
        let mut handle = HKEY::default();
        // SAFETY: as in `open`.
        let status = unsafe { RegOpenKeyExW(self.0, &HSTRING::from(path), None, KEY_READ | KEY_WOW64_64KEY, &mut handle) };
        status.is_ok().then_some(Key(handle))
    }

    /// Subkey names, in the order Windows enumerates them (sorted, case-insensitive).
    pub fn subkey_names(&self) -> Vec<String> {
        let mut names = Vec::new();
        for index in 0.. {
            let mut buf = [0u16; 256];
            let mut len = buf.len() as u32;
            // SAFETY: `buf` and `len` describe the same writable buffer.
            let status = unsafe {
                RegEnumKeyExW(self.0, index, Some(PWSTR(buf.as_mut_ptr())), &mut len, None, None, None, None)
            };
            if status == ERROR_NO_MORE_ITEMS || status.is_err() && status != ERROR_MORE_DATA {
                break;
            }
            if status.is_ok() {
                names.push(String::from_utf16_lossy(&buf[..len as usize]));
            }
        }
        names
    }

    pub fn value_names(&self) -> Vec<String> {
        let mut names = Vec::new();
        for index in 0.. {
            let mut buf = vec![0u16; 16384];
            let mut len = buf.len() as u32;
            // SAFETY: as in `subkey_names`.
            let status = unsafe {
                RegEnumValueW(self.0, index, Some(PWSTR(buf.as_mut_ptr())), &mut len, None, None, None, None)
            };
            if status == ERROR_NO_MORE_ITEMS {
                break;
            }
            if status.is_ok() {
                names.push(String::from_utf16_lossy(&buf[..len as usize]));
            } else if status != ERROR_MORE_DATA {
                break;
            }
        }
        names
    }

    pub fn value(&self, name: &str) -> Option<Value> {
        let wide = HSTRING::from(name);
        let mut kind = REG_VALUE_TYPE(0);
        let mut len = 0u32;
        // SAFETY: the first call only asks for the size and type.
        let status = unsafe { RegQueryValueExW(self.0, &wide, None, Some(&mut kind), None, Some(&mut len)) };
        if status.is_err() && status != ERROR_MORE_DATA {
            return None;
        }
        let mut data = vec![0u8; len as usize + 2];
        let mut len = len;
        // SAFETY: `data` holds at least `len` bytes.
        let status = unsafe { RegQueryValueExW(self.0, &wide, None, Some(&mut kind), Some(data.as_mut_ptr()), Some(&mut len)) };
        if status.is_err() {
            return None;
        }
        data.truncate(len as usize);
        Some(match kind {
            k if k == REG_SZ || k == REG_EXPAND_SZ => {
                let wide: Vec<u16> = data.chunks_exact(2).map(|b| u16::from_le_bytes([b[0], b[1]])).collect();
                let text = utf16_to_string(&wide);
                Value::Str(if k == REG_EXPAND_SZ { expand_env(&text) } else { text })
            }
            k if k == REG_DWORD && data.len() >= 4 => Value::Dword(u32::from_le_bytes(data[..4].try_into().ok()?)),
            k if k == REG_QWORD && data.len() >= 8 => Value::Qword(u64::from_le_bytes(data[..8].try_into().ok()?)),
            _ => Value::Other,
        })
    }

    /// A string value, or `None` when it is absent or not a string.
    pub fn string(&self, name: &str) -> Option<String> {
        match self.value(name)? {
            Value::Str(s) => Some(s),
            _ => None,
        }
    }

    pub fn dword(&self, name: &str) -> Option<u32> {
        match self.value(name)? {
            Value::Dword(d) => Some(d),
            _ => None,
        }
    }

    /// The key's last write time as a FILETIME tick count (100 ns since 1601).
    pub fn last_write(&self) -> Option<u64> {
        let mut ft = FILETIME::default();
        // SAFETY: only the last-write out parameter is requested.
        let status = unsafe {
            RegQueryInfoKeyW(self.0, None, None, None, None, None, None, None, None, None, None, Some(&mut ft))
        };
        status.is_ok().then(|| (u64::from(ft.dwHighDateTime) << 32) | u64::from(ft.dwLowDateTime))
    }
}
```


**Create `native/crates/prune-core/src/programs/registry.rs`:**

```rust
//! The program list itself: the three Uninstall hives Windows actually uses
//! (`listInstalledPrograms` in `services/programs.js`), read with the
//! registry API instead of a PowerShell `Get-ItemProperty` pipeline.

use super::model::{Hive, Program, RawEntry, dedupe_ids, normalize_program};
use super::paths::assess_health;

/// Where the three hives keep their Uninstall keys, in 3.x's order: HKLM
/// 64-bit (machine-wide), HKLM WOW6432Node (32-bit apps on 64-bit Windows),
/// HKCU (per-user installs).
pub const UNINSTALL_LOCATIONS: [(Hive, bool, &str); 3] = [
    (Hive::LocalMachine, false, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
    (Hive::LocalMachine, true, r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"),
    (Hive::CurrentUser, false, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
];

/// `Where-Object { $_.DisplayName -and -not $_.SystemComponent }`: a name,
/// and no truthy SystemComponent. PowerShell's truthiness: a DWORD is true
/// when not zero, a string when not empty.
pub fn is_listed(display_name: Option<&str>, system_component_truthy: bool) -> bool {
    display_name.is_some_and(|n| !n.is_empty()) && !system_component_truthy
}

#[cfg(windows)]
mod win {
    use super::*;
    use crate::winreg::{Key, Root, Value};

    fn root_of(hive: Hive) -> Root {
        match hive {
            Hive::LocalMachine => Root::LocalMachine,
            Hive::CurrentUser => Root::CurrentUser,
        }
    }

    /// Every Uninstall key that names a program, in registry order.
    pub fn read_raw_entries() -> Vec<RawEntry> {
        let mut entries = Vec::new();
        for (hive, wow, path) in UNINSTALL_LOCATIONS {
            let Some(parent) = Key::open(root_of(hive), path) else { continue };
            for id in parent.subkey_names() {
                let Some(key) = parent.open_sub(&id) else { continue };
                let name = key.string("DisplayName");
                let system = match key.value("SystemComponent") {
                    Some(Value::Dword(d)) => d != 0,
                    Some(Value::Qword(q)) => q != 0,
                    Some(Value::Str(s)) => !s.is_empty(),
                    _ => false,
                };
                if !is_listed(name.as_deref(), system) {
                    continue;
                }
                entries.push(RawEntry {
                    subkey_path: format!(r"{path}\{id}"),
                    id,
                    hive: Some(hive),
                    wow,
                    display_name: name.unwrap_or_default(),
                    publisher: key.string("Publisher"),
                    display_version: key.string("DisplayVersion"),
                    install_date: key.string("InstallDate"),
                    estimated_size_kb: key.dword("EstimatedSize"),
                    uninstall_string: key.string("UninstallString"),
                    install_location: key.string("InstallLocation"),
                    display_icon: key.string("DisplayIcon"),
                    url_info_about: key.string("URLInfoAbout"),
                    help_link: key.string("HelpLink"),
                });
            }
        }
        entries
    }
}

#[cfg(windows)]
pub use win::read_raw_entries;

#[cfg(not(windows))]
pub fn read_raw_entries() -> Vec<RawEntry> {
    Vec::new()
}

/// Turns raw entries into rows: normalized, ids made unique, health
/// assessed (a couple of existence checks per program, cheap enough for
/// every list).
pub fn programs_from(entries: &[RawEntry], exists: &dyn Fn(&str) -> bool) -> Vec<Program> {
    let mut programs: Vec<Program> = entries.iter().map(normalize_program).collect();
    dedupe_ids(&mut programs);
    for program in &mut programs {
        program.health = Some(assess_health(program, exists));
    }
    programs
}

/// The installed programs. An empty answer on a real machine almost never
/// means "nothing installed" (a registry read contended by antivirus at
/// first boot is the recorded cause), so it is tried once more after a
/// moment before the screen is allowed to say "Couldn't find any installed
/// programs". 3.x's last resort, a `reg.exe` text parse, existed because a
/// PowerShell pipeline could fail silently; there is no pipeline here.
pub fn list_installed_programs() -> Vec<Program> {
    let exists = |path: &str| std::path::Path::new(path).exists();
    let mut entries = read_raw_entries();
    if entries.is_empty() {
        std::thread::sleep(std::time::Duration::from_millis(400));
        entries = read_raw_entries();
    }
    programs_from(&entries, &exists)
}
```


**Modify `native/crates/prune-core/Cargo.toml`** (a unified diff against today's file; apply with the Edit tool, since some working copies are CRLF):

```diff
--- a/native/crates/prune-core/Cargo.toml
+++ b/native/crates/prune-core/Cargo.toml
@@ -13,3 +13,40 @@
 
 [dev-dependencies]
 fluent-syntax.workspace = true
+
+[target.'cfg(windows)'.dependencies]
+windows = { workspace = true, features = [
+    "Win32_Foundation",
+    "Win32_System_Registry",
+    "Win32_System_Environment",
+    "Win32_Storage_FileSystem",
+    "Win32_System_Time",
+    "Win32_System_WinRT",
+    "ApplicationModel",
+    "Management_Deployment",
+    "Foundation",
+    "Foundation_Collections",
+    "System",
+    "Win32_System_Threading",
+    "Win32_System_Diagnostics_ToolHelp",
+    "Win32_System_Com",
+    "Win32_System_TaskScheduler",
+    "Win32_System_Variant",
+    "Win32_System_Ole",
+    "Win32_System_Wmi",
+    "Win32_System_Rpc",
+    "Win32_Graphics_Gdi",
+    "Win32_UI_WindowsAndMessaging",
+    "Win32_UI_Shell",
+    "Win32_Security_WinTrust",
+    "Win32_Security_Cryptography",
+    "Win32_Security_Cryptography_Catalog",
+    "Win32_Security_Cryptography_Sip",
+    "Win32_Graphics_Imaging",
+    "Win32_Security",
+    "Win32_Security_Authorization",
+    "Win32_Globalization",
+] }
+
+[target.'cfg(windows)'.dev-dependencies]
+png.workspace = true
```


The feature list is the whole phase's (each later task needs the features below it): add it all now so the later tasks do not touch `Cargo.toml` again. `lib.rs` becomes:

**Modify `native/crates/prune-core/src/lib.rs`** (a unified diff against today's file; apply with the Edit tool, since some working copies are CRLF):

```diff
--- a/native/crates/prune-core/src/lib.rs
+++ b/native/crates/prune-core/src/lib.rs
@@ -1,4 +1,7 @@
 //! Prune core: the engine shared by the app and the command-line tool.
 
 pub mod i18n;
+pub mod programs;
 pub mod settings;
+#[cfg(windows)]
+pub(crate) mod winreg;
```


and `programs/mod.rs` gains `pub mod registry;`.

- [ ] **Step 5:** `PRUNE_3X_PROGRAMS=<folder>\programs.json cargo test -p prune-core --test programs_registry_live`. Expected: 2 passed, and every one of the 132 registry rows equal to 3.x's (name, publisher, version, date, size, uninstall string, location, key, icon, architecture, website, orphaned) on this PC.
- [ ] **Step 6: Commit** `feat(native): the program list from the three Uninstall hives, through the registry API`

### Task 3: The folder walker and `folder-sizes.json`

**Files:**
- Create: `native/crates/prune-core/src/programs/walk.rs`, `native/crates/prune-core/src/programs/folder_sizes.rs`
- Modify: `native/crates/prune-core/src/programs/mod.rs`
- Test: `native/crates/prune-core/tests/programs_sizes_store.rs`

**Interfaces:**
- Produces: `walk::{Entry, read_dir, measure_folder, measure_directory, holds_executable, measure_many}` and `folder_sizes::{FolderSizeStore, Remembered, exclusion_key, default_path, FRESH_MS, USABLE_MS}`.
- `measure_folder` is `installSize.js`'s walk (every file under a folder, leaving out nested folders that are other rows: Ubisoft Connect once counted a 54 GB game that has its own row, and the column added up to more than the drive holds); `measure_directory` is `leftoverWalk.js`'s bounded one (200,000 entries or 8 s); `holds_executable` is `unregisteredFolders.js`'s (4,000 entries). All of them skip symlinks and junctions and count nothing from a directory they cannot open. `measure_many` runs four at a time.
- `FolderSizeStore` is `folderSizeStore.js` in the same file with the same shape: `{"version":1,"entries":{"<normalised folder>":{"bytes":n,"at":ms,"ex":"<exclusions>"}}}`. A size is fresh for 24 hours, usable for 30 days, never remembered when zero, and measured with different exclusions is a different number. The file is written beside the target and renamed, so a crash leaves the old file.

- [ ] **Step 1: Write the tests** (they create real folder trees and a real junction under the temp folder).

**Create `native/crates/prune-core/tests/programs_sizes_store.rs`:**

```rust
//! The folder walker and `folder-sizes.json`, ported from 3.x's
//! installSize.test.js and folderSizeStore.test.js.

#![cfg(windows)]

use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Duration;

use prune_core::programs::folder_sizes::{FRESH_MS, FolderSizeStore, USABLE_MS, exclusion_key};
use prune_core::programs::walk::{holds_executable, measure_directory, measure_folder};
use serde_json::json;

fn scratch(name: &str) -> PathBuf {
    static N: AtomicUsize = AtomicUsize::new(0);
    let dir = std::env::temp_dir().join(format!("prune-walk-{}-{name}-{}", std::process::id(), N.fetch_add(1, Ordering::Relaxed)));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

fn file(path: PathBuf, bytes: usize) {
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, vec![7u8; bytes]).unwrap();
}

#[test]
fn a_folder_is_the_sum_of_its_files_at_any_depth() {
    let root = scratch("sum");
    file(root.join("a.bin"), 100);
    file(root.join("sub/b.bin"), 250);
    file(root.join("sub/deeper/c.bin"), 50);
    assert_eq!(measure_folder(root.to_str().unwrap(), &[]), 400);
    assert_eq!(measure_folder(r"C:\definitely\not\here", &[]), 0);
}

#[test]
fn a_nested_programs_folder_is_left_out_of_the_outer_one() {
    // Ubisoft Connect with a game installed inside it.
    let root = scratch("nested");
    file(root.join("launcher.bin"), 10);
    file(root.join("games/r6/data.bin"), 1000);
    let game = root.join("games").join("r6");
    assert_eq!(measure_folder(root.to_str().unwrap(), &[game.to_string_lossy().replace('\\', "/")]), 10);
}

#[test]
fn junctions_are_not_followed() {
    let root = scratch("junction");
    let target = scratch("junction-target");
    file(target.join("big.bin"), 5000);
    file(root.join("own.bin"), 1);
    let status = std::process::Command::new("cmd").args(["/C", "mklink", "/J"]).arg(root.join("link")).arg(&target).output().unwrap();
    assert!(status.status.success(), "mklink failed");
    assert_eq!(measure_folder(root.to_str().unwrap(), &[]), 1);
}

#[test]
fn a_bounded_measure_stops_at_its_entry_budget() {
    let root = scratch("budget");
    for i in 0..20 {
        file(root.join(format!("f{i}.bin")), 1);
    }
    assert_eq!(measure_directory(root.to_str().unwrap(), 1000, Duration::from_secs(5)), 20);
    assert!(measure_directory(root.to_str().unwrap(), 5, Duration::from_secs(5)) <= 20);
}

#[test]
fn a_folder_holds_an_executable_only_if_one_is_in_it() {
    let data = scratch("data");
    file(data.join("a.txt"), 1);
    file(data.join("deep/b.dat"), 1);
    assert!(!holds_executable(data.to_str().unwrap(), 4000));
    let app = scratch("app");
    file(app.join("bin/tool.EXE"), 1);
    assert!(holds_executable(app.to_str().unwrap(), 4000));
}

fn day() -> u64 {
    FRESH_MS
}

#[test]
fn reads_and_writes_the_shape_3x_uses() {
    let dir = scratch("store");
    let path = dir.join("folder-sizes.json");
    // Exactly what 3.x writes.
    fs::write(&path, json!({"version":1,"entries":{r"c:\program files\app":{"bytes":500,"at":0,"ex":""}}}).to_string()).unwrap();
    let mut store = FolderSizeStore::load_with_clock(Some(path.clone()), || 10 * FRESH_MS);
    // Written with another case and a forward slash: the same folder.
    let got = store.lookup("C:/Program Files/App/", "").unwrap();
    assert_eq!(got.bytes, 500);
    assert!(!got.fresh, "ten days old is usable but stale");
    // A different set of exclusions is a different number.
    assert!(store.lookup(r"C:\Program Files\App", "x").is_none());

    store.set(r"C:\Program Files\Other", &exclusion_key(r"C:\Program Files\Other\Sub\"), 900);
    store.save();
    let saved: serde_json::Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
    assert_eq!(saved["version"], 1);
    assert_eq!(saved["entries"][r"c:\program files\other"]["bytes"], 900);
    assert_eq!(saved["entries"][r"c:\program files\other"]["ex"], r"c:\program files\other\sub");
    assert_eq!(saved["entries"][r"c:\program files\app"]["bytes"], 500);
    assert!(fs::read_dir(&dir).unwrap().all(|e| !e.unwrap().file_name().to_string_lossy().ends_with(".tmp")));
}

#[test]
fn old_entries_are_not_shown_or_carried_forward() {
    let dir = scratch("old");
    let path = dir.join("folder-sizes.json");
    fs::write(&path, json!({"version":1,"entries":{r"c:\old":{"bytes":5,"at":0,"ex":""}}}).to_string()).unwrap();
    let mut store = FolderSizeStore::load_with_clock(Some(path.clone()), || USABLE_MS + day());
    assert!(store.lookup(r"C:\Old", "").is_none());
    store.set(r"C:\New", "", 7);
    store.save();
    let saved: serde_json::Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
    assert!(saved["entries"].get(r"c:\old").is_none());
    assert_eq!(saved["entries"][r"c:\new"]["bytes"], 7);
}

#[test]
fn a_corrupt_or_foreign_file_is_an_empty_store_and_zero_is_not_remembered() {
    let dir = scratch("bad");
    let path = dir.join("folder-sizes.json");
    fs::write(&path, "{not json").unwrap();
    let mut store = FolderSizeStore::load(Some(path.clone()));
    assert!(store.lookup(r"C:\x\y\z", "").is_none());
    store.set(r"C:\x\y\z", "", 0);
    store.save();
    assert_eq!(fs::read_to_string(&path).unwrap(), "{not json", "nothing worth writing, nothing written");
    fs::write(&path, json!({"version":2,"entries":{r"c:\x":{"bytes":1,"at":0,"ex":""}}}).to_string()).unwrap();
    assert!(FolderSizeStore::load_with_clock(Some(path), || 1).lookup(r"C:\x", "").is_none());
}
```


- [ ] **Step 2:** `cargo test -p prune-core --test programs_sizes_store`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement.**

**Create `native/crates/prune-core/src/programs/walk.rs`:**

```rust
//! Walking install folders (`measureFolder` in `installSize.js`,
//! `measureDirectory` in `leftoverWalk.js`, `holdsExecutable` in
//! `unregisteredFolders.js`).
//!
//! 3.x does a `readdir` and then a `stat` per file. `FindFirstFileExW` hands
//! back each entry's size with the name, so one pass over a directory is one
//! system call per few hundred entries: this is where most of the speed-up
//! for sizes comes from.

use std::path::Path;
use std::time::{Duration, Instant};

use windows::Win32::Foundation::{ERROR_NO_MORE_FILES, HANDLE};
use windows::Win32::Storage::FileSystem::{
    FILE_ATTRIBUTE_DIRECTORY, FILE_ATTRIBUTE_REPARSE_POINT, FIND_FIRST_EX_LARGE_FETCH, FindClose, FindExInfoBasic,
    FindExSearchNameMatch, FindFirstFileExW, FindNextFileW, WIN32_FIND_DATAW,
};
use windows::core::HSTRING;

use super::paths::is_inside;

/// `IO_REPARSE_TAG_SYMLINK` and `IO_REPARSE_TAG_MOUNT_POINT` (junctions).
/// Node reports both as links, not as files or directories, so 3.x never
/// follows them; other reparse points (OneDrive placeholders) are ordinary.
const TAG_SYMLINK: u32 = 0xA000_000C;
const TAG_MOUNT_POINT: u32 = 0xA000_0003;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Entry {
    pub name: String,
    pub is_dir: bool,
    /// A symlink or junction: neither followed nor counted.
    pub is_link: bool,
    pub size: u64,
}

/// `\\?\` form, so a path past 260 characters still opens (Node does the
/// same on Windows).
fn extended(dir: &Path) -> String {
    let text = dir.to_string_lossy().replace('/', "\\");
    if text.starts_with(r"\\?\") {
        text
    } else if let Some(unc) = text.strip_prefix(r"\\") {
        format!(r"\\?\UNC\{unc}")
    } else {
        format!(r"\\?\{text}")
    }
}

/// The entries of one directory, or `None` when it cannot be opened
/// (missing or refused: neither is worth failing a measure over).
pub fn read_dir(dir: &Path) -> Option<Vec<Entry>> {
    let pattern = HSTRING::from(format!(r"{}\*", extended(dir).trim_end_matches('\\')));
    let mut data = WIN32_FIND_DATAW::default();
    // SAFETY: `data` is a valid WIN32_FIND_DATAW for the call, and the handle is closed below.
    let handle: HANDLE = unsafe {
        FindFirstFileExW(
            &pattern,
            FindExInfoBasic,
            (&raw mut data).cast(),
            FindExSearchNameMatch,
            None,
            FIND_FIRST_EX_LARGE_FETCH,
        )
    }
    .ok()?;
    let mut entries = Vec::new();
    loop {
        let end = data.cFileName.iter().position(|c| *c == 0).unwrap_or(data.cFileName.len());
        let name = String::from_utf16_lossy(&data.cFileName[..end]);
        if name != "." && name != ".." {
            let attrs = data.dwFileAttributes;
            let link = attrs & FILE_ATTRIBUTE_REPARSE_POINT.0 != 0
                && matches!(data.dwReserved0, TAG_SYMLINK | TAG_MOUNT_POINT);
            entries.push(Entry {
                name,
                is_dir: attrs & FILE_ATTRIBUTE_DIRECTORY.0 != 0 && !link,
                is_link: link,
                size: (u64::from(data.nFileSizeHigh) << 32) | u64::from(data.nFileSizeLow),
            });
        }
        // SAFETY: as above.
        match unsafe { FindNextFileW(handle, &mut data) } {
            Ok(()) => {}
            Err(e) if e.code() == ERROR_NO_MORE_FILES.to_hresult() => break,
            Err(_) => break,
        }
    }
    // SAFETY: the handle came from FindFirstFileExW.
    unsafe {
        let _ = FindClose(handle);
    }
    Some(entries)
}

/// Total bytes of every file under `folder`, leaving out any directory in
/// `exclude`. Exclusions exist because install folders nest: Ubisoft
/// Connect's folder held a 54 GB game that has its own row, and counting it
/// twice made the column add up to more than the drive holds. Unreadable
/// directories contribute nothing.
pub fn measure_folder(folder: &str, exclude: &[String]) -> u64 {
    let mut total = 0;
    let mut stack = vec![folder.to_owned()];
    while let Some(current) = stack.pop() {
        if exclude.iter().any(|e| is_inside(&current, e)) {
            continue;
        }
        let Some(entries) = read_dir(Path::new(&current)) else { continue };
        for entry in entries {
            if entry.is_dir {
                stack.push(format!(r"{}\{}", current.trim_end_matches('\\'), entry.name));
            } else if !entry.is_link {
                total += entry.size;
            }
        }
    }
    total
}

/// Bytes under a path for the size shown next to a leftover or a "Not
/// registered" folder: bounded by entries and by time, stopping with what
/// it has counted (`measureDirectory`). Links are not followed.
pub fn measure_directory(path: &str, max_entries: usize, budget: Duration) -> u64 {
    let started = Instant::now();
    let (mut total, mut seen) = (0u64, 0usize);
    let mut stack = vec![path.to_owned()];
    while let Some(current) = stack.pop() {
        if seen >= max_entries || started.elapsed() > budget {
            break;
        }
        let Some(entries) = read_dir(Path::new(&current)) else { continue };
        for entry in entries {
            if entry.is_dir {
                stack.push(format!(r"{}\{}", current.trim_end_matches('\\'), entry.name));
            } else if !entry.is_link {
                total += entry.size;
                seen += 1;
            }
        }
    }
    total
}

/// Whether a folder holds an executable anywhere, looking at no more than
/// `budget` entries: a folder of data files is not a program.
pub fn holds_executable(dir: &str, budget: usize) -> bool {
    let mut queue = std::collections::VecDeque::from([dir.to_owned()]);
    let mut seen = 0;
    while let Some(current) = queue.pop_front() {
        if seen >= budget {
            break;
        }
        let Some(entries) = read_dir(Path::new(&current)) else { continue };
        for entry in entries {
            seen += 1;
            let lower = entry.name.to_lowercase();
            if !entry.is_dir && !entry.is_link && [".exe", ".com", ".bat", ".cmd"].iter().any(|e| lower.ends_with(e)) {
                return true;
            }
            if entry.is_dir {
                queue.push_back(format!(r"{}\{}", current.trim_end_matches('\\'), entry.name));
            }
        }
    }
    false
}

/// Measures several folders on four threads: they are independent, and the
/// walk is bound by metadata reads, so this is a clear win over 3.x's one at
/// a time. Each job is a folder and the nested folders to leave out; the
/// answers come back in the same order.
pub fn measure_many(jobs: &[(String, Vec<String>)]) -> Vec<u64> {
    use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
    let next = AtomicUsize::new(0);
    let results: Vec<AtomicU64> = jobs.iter().map(|_| AtomicU64::new(0)).collect();
    std::thread::scope(|scope| {
        for _ in 0..jobs.len().clamp(1, 4) {
            scope.spawn(|| {
                while let Some(i) = Some(next.fetch_add(1, Ordering::Relaxed)).filter(|i| *i < jobs.len()) {
                    results[i].store(measure_folder(&jobs[i].0, &jobs[i].1), Ordering::Relaxed);
                }
            });
        }
    });
    results.iter().map(|r| r.load(Ordering::Relaxed)).collect()
}
```


**Create `native/crates/prune-core/src/programs/folder_sizes.rs`:**

```rust
//! `folder-sizes.json`, the measured install-folder sizes 3.x keeps beside
//! `settings.json` (`services/folderSizeStore.js`). Same file, same shape:
//! `{"version":1,"entries":{"<folder>":{"bytes":n,"at":ms,"ex":"<exclusions>"}}}`,
//! so a profile moves between 3.2 and 4.0 without either re-measuring.

use std::path::{Path, PathBuf};

use serde_json::{Map, Value, json};

use super::paths::norm_path;

/// A measured size counts as fresh for a day. Past that it is still shown
/// and measured again once the app has settled; past thirty days it is too
/// old to show and the folder is measured on the spot.
pub const FRESH_MS: u64 = 24 * 60 * 60 * 1000;
pub const USABLE_MS: u64 = 30 * FRESH_MS;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Remembered {
    pub bytes: u64,
    /// `false`: usable but due to be measured again.
    pub fresh: bool,
}

#[derive(Debug, Clone)]
struct Entry {
    bytes: u64,
    at: u64,
    ex: String,
}

pub struct FolderSizeStore {
    path: Option<PathBuf>,
    entries: Vec<(String, Entry)>,
    dirty: bool,
    now: fn() -> u64,
}

fn system_now() -> u64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_or(0, |d| d.as_millis() as u64)
}

/// A folder as it is written into the "what was left out" part of an entry.
pub fn exclusion_key(folder: &str) -> String {
    norm_path(folder)
}

/// The file beside settings.json (3.x: only when the app knows where that is).
pub fn default_path(settings_path: &Path) -> PathBuf {
    settings_path.parent().map_or_else(|| PathBuf::from("folder-sizes.json"), |d| d.join("folder-sizes.json"))
}

impl FolderSizeStore {
    /// Reads the file. A missing, unreadable or corrupt file is an empty
    /// store: the folders are simply measured again.
    pub fn load(path: Option<PathBuf>) -> Self {
        Self::load_with_clock(path, system_now)
    }

    pub fn load_with_clock(path: Option<PathBuf>, now: fn() -> u64) -> Self {
        let mut entries = Vec::new();
        let parsed = path.as_ref().and_then(|p| std::fs::read(p).ok()).and_then(|b| serde_json::from_slice::<Value>(&b).ok());
        if let Some(map) = parsed.as_ref().filter(|v| v["version"] == 1).and_then(|v| v["entries"].as_object()) {
            for (key, value) in map {
                let (bytes, at, ex) = (value["bytes"].as_f64(), value["at"].as_f64(), value["ex"].as_str());
                if let (Some(bytes), Some(at), Some(ex)) = (bytes, at, ex) {
                    entries.push((key.clone(), Entry { bytes: bytes as u64, at: at as u64, ex: ex.to_owned() }));
                }
            }
        }
        FolderSizeStore { path, entries, dirty: false, now }
    }

    /// A kept size, or `None` when there is none, it is too old, or it was
    /// measured with a different set of exclusions.
    pub fn lookup(&self, folder: &str, exclusions: &str) -> Option<Remembered> {
        let key = norm_path(folder);
        let entry = &self.entries.iter().find(|(k, _)| *k == key)?.1;
        if entry.ex != exclusions {
            return None;
        }
        let age = (self.now)().checked_sub(entry.at)?;
        (age < USABLE_MS).then_some(Remembered { bytes: entry.bytes, fresh: age < FRESH_MS })
    }

    /// A zero is not worth remembering (the folder is gone or empty).
    pub fn set(&mut self, folder: &str, exclusions: &str, bytes: u64) {
        if self.path.is_none() || bytes == 0 {
            return;
        }
        let key = norm_path(folder);
        let entry = Entry { bytes, at: (self.now)(), ex: exclusions.to_owned() };
        match self.entries.iter_mut().find(|(k, _)| *k == key) {
            Some(slot) => slot.1 = entry,
            None => self.entries.push((key, entry)),
        }
        self.dirty = true;
    }

    /// Saves atomically: written beside the target, then renamed. Entries too
    /// old to ever be shown are not carried forward. Best effort, like 3.x.
    pub fn save(&mut self) {
        let Some(path) = self.path.clone().filter(|_| self.dirty) else { return };
        self.dirty = false;
        let now = (self.now)();
        let mut live = Map::new();
        for (key, e) in &self.entries {
            if now.saturating_sub(e.at) < USABLE_MS {
                live.insert(key.clone(), json!({ "bytes": e.bytes, "at": e.at, "ex": e.ex }));
            }
        }
        let mut tmp = path.as_os_str().to_owned();
        tmp.push(format!(".{}.tmp", std::process::id()));
        let tmp = PathBuf::from(tmp);
        let write = || -> std::io::Result<()> {
            if let Some(dir) = path.parent().filter(|d| !d.as_os_str().is_empty()) {
                std::fs::create_dir_all(dir)?;
            }
            std::fs::write(&tmp, json!({ "version": 1, "entries": live }).to_string())?;
            std::fs::rename(&tmp, &path)
        };
        if write().is_err() {
            let _ = std::fs::remove_file(&tmp);
        }
    }
}
```


`programs/mod.rs` gains `#[cfg(windows)] pub mod walk;` and `pub mod folder_sizes;`.

- [ ] **Step 4:** Expected: 8 passed.
- [ ] **Step 5: Commit** `feat(native): fast folder measuring and folder-sizes.json in 3.x's own shape`

### Task 4: Launcher records and sizes for programs with none

**Files:**
- Create: `native/crates/prune-core/src/programs/launchers.rs`, `native/crates/prune-core/src/programs/sizes.rs`
- Modify: `native/crates/prune-core/src/programs/mod.rs`
- Test: `native/crates/prune-core/tests/programs_launchers.rs`

**Interfaces:**
- Produces: `launchers::{parse_steam_app_id, parse_app_manifest, parse_library_paths, read_steam_apps, steam_root_from, parse_epic_manifest, read_epic_apps, normalize_gog_game, read_gog_apps, match_launcher_app, LauncherApp, SteamApp}`; `sizes::{plan_sizes, resolve_sizes, refresh_stale, FolderJob, Plan, SizeOutcome}`.
- 3.x lists no Epic or GOG rows of their own (Epic Store titles often register nothing), so none are added; their records only size and version the rows that exist. Order of trust: Steam's manifest (`SizeOnDisk`; 0 means queued, not a size), Epic's `InstallSize`, the InstallLocation measured, then the uninstaller's folder, but only when no other program falls back to the same folder (a shared folder is a launcher's). A launcher naming the game's own folder bypasses that refusal. `plan_sizes` decides all of it without touching the disk, which is what the tests exercise.

- [ ] **Step 1: Write the tests.**

**Create `native/crates/prune-core/tests/programs_launchers.rs`:**

```rust
//! Launcher records and the size plan, ported from 3.x's steamApps.test.js,
//! epicApps.test.js, gogApps.test.js, launcherMatch.test.js and
//! programSizes.test.js / programSizes.shared.test.js.

use std::collections::HashMap;

use prune_core::programs::launchers::*;
use prune_core::programs::model::Program;
use prune_core::programs::sizes::plan_sizes;

fn program(id: &str, name: &str, uninstall: Option<&str>, location: Option<&str>) -> Program {
    Program {
        id: id.into(),
        name: name.into(),
        uninstall_string: uninstall.map(Into::into),
        install_location: location.map(Into::into),
        ..Program::default()
    }
}

const ACF: &str = r#""AppState"
{
	"appid"		"230410"
	"name"		"Warframe"
	"installdir"		"Warframe"
	"SizeOnDisk"		"51300000000"
}"#;

#[test]
fn steam_ids_manifests_and_libraries() {
    assert_eq!(parse_steam_app_id(r#""C:\Steam\steam.exe" steam://uninstall/230410"#).as_deref(), Some("230410"));
    assert_eq!(parse_steam_app_id("C:\\x\\u.exe /S"), None);
    let m = parse_app_manifest(ACF).unwrap();
    assert_eq!((m.appid.as_str(), m.name.as_deref(), m.size_bytes), ("230410", Some("Warframe"), Some(51_300_000_000)));
    // Queued or downloading: 0 is not a size.
    assert_eq!(parse_app_manifest(&ACF.replace("51300000000", "0")).unwrap().size_bytes, None);
    assert!(parse_app_manifest("nothing").is_none());
    let vdf = "\"libraryfolders\"\n{\n\t\"0\"\n\t{\n\t\t\"path\"\t\t\"C:\\\\Program Files (x86)\\\\Steam\"\n\t}\n\t\"1\"\n\t{\n\t\t\"path\"\t\t\"D:\\\\Games\\\\SteamLibrary\"\n\t}\n}";
    assert_eq!(parse_library_paths(vdf), [r"C:\Program Files (x86)\Steam", r"D:\Games\SteamLibrary"]);
}

#[test]
fn steam_is_found_from_its_own_entry() {
    let steam = program("Steam", "Steam", Some(r#""C:\Games\Steam\uninstall.exe""#), None);
    assert_eq!(steam_root_from(&[steam]).as_deref(), Some(r"C:\Games\Steam"));
    let located = program("Steam", "steam", None, Some(r"D:\Steam\"));
    assert_eq!(steam_root_from(&[located]).as_deref(), Some(r"D:\Steam"));
    assert_eq!(steam_root_from(&[program("a", "Other", None, None)]), None);
}

#[test]
fn epic_manifests_normalize_slashes_and_skip_unfinished_installs() {
    let item = r#"{"AppName":"Fortnite","DisplayName":"Fortnite","InstallLocation":"C:/Epic Games/Fortnite/","InstallSize":123}"#;
    let app = parse_epic_manifest(item).unwrap();
    assert_eq!((app.install_location.as_str(), app.size_bytes), (r"C:\Epic Games\Fortnite", Some(123)));
    assert!(parse_epic_manifest(r#"{"InstallLocation":"C:/x","bIsIncompleteInstall":true}"#).is_none());
    assert!(parse_epic_manifest("{half written").is_none());
    assert!(parse_epic_manifest(r#"{"AppName":"x"}"#).is_none());
}

#[test]
fn gog_keeps_the_version_and_the_folder() {
    let raw = GogRaw { game_name: "Witcher 3".into(), path: "C:/GOG/Witcher 3/".into(), working_dir: String::new(), ver: " 4.04 ".into() };
    let app = normalize_gog_game(&raw).unwrap();
    assert_eq!((app.install_location.as_str(), app.version.as_deref()), (r"C:\GOG\Witcher 3", Some("4.04")));
    assert!(normalize_gog_game(&GogRaw::default()).is_none());
}

#[test]
fn a_launcher_record_matches_by_folder_then_by_exact_name() {
    let apps = vec![
        LauncherApp { name: None, display_name: Some("Fortnite Festival Companion".into()), install_location: r"C:\E\FFC".into(), size_bytes: Some(1), version: None },
        LauncherApp { name: None, display_name: Some("The Witcher 3: Wild Hunt".into()), install_location: r"C:\GOG\W3".into(), size_bytes: None, version: None },
    ];
    let by_folder = program("a", "Whatever", None, Some("c:/gog/w3/"));
    assert_eq!(match_launcher_app(&by_folder, &apps).unwrap().install_location, r"C:\GOG\W3");
    let by_name = program("b", "The Witcher 3 Wild Hunt", None, None);
    assert!(match_launcher_app(&by_name, &apps).is_some());
    // A prefix is never a hit.
    assert!(match_launcher_app(&program("c", "Fortnite", None, None), &apps).is_none());
}

#[test]
fn sizes_come_from_the_most_trusted_source_and_never_from_a_shared_folder() {
    let steam_game = program("sg", "A Game", Some("\"C:\\Steam\\steam.exe\" steam://uninstall/10"), None);
    let steam_entry = program("steam", "Steam", Some(r#""C:\Games\Steam\uninstall.exe""#), None);
    // Two programs fall back to the same launcher folder: neither is measured.
    let shared_a = program("ua", "Ubi A", Some(r#""C:\Ubisoft\Launcher\uninstall.exe""#), None);
    let shared_b = program("ub", "Ubi B", Some(r#""C:\Ubisoft\Launcher\uninstall.exe""#), None);
    // One program, one folder: measured.
    let alone = program("al", "Alone", Some(r#""C:\Program Files\Alone\unins.exe""#), None);
    let located = program("lo", "Located", None, Some(r"C:\Program Files\Located"));
    let declared = Program { size_bytes: Some(5), ..program("de", "Declared", None, Some(r"C:\Program Files\Declared")) };

    let steam: HashMap<String, SteamApp> =
        HashMap::from([("10".into(), SteamApp { size_bytes: Some(777), name: None, path: Some(r"C:\Games\Steam\steamapps\common\AGame".into()) })]);
    let plan = plan_sizes(&[steam_game, steam_entry, shared_a, shared_b, alone, located, declared], &steam, &[]);

    assert_eq!(plan.direct.get("sg"), Some(&777));
    let assigned: HashMap<&str, &str> = plan.assign.iter().map(|(i, f)| (i.as_str(), f.as_str())).collect();
    assert_eq!(assigned.get("al"), Some(&r"C:\Program Files\Alone"));
    assert_eq!(assigned.get("lo"), Some(&r"C:\Program Files\Located"));
    assert!(!assigned.contains_key("ua") && !assigned.contains_key("ub"), "a shared folder is a launcher's, not theirs");
    assert!(!assigned.contains_key("de"), "a declared size is never replaced");
    // Steam's own entry is measured but leaves every game's folder out.
    assert_eq!(assigned.get("steam"), Some(&r"C:\Games\Steam"));
    let job = plan.jobs.iter().find(|j| j.folder == r"C:\Games\Steam").unwrap();
    assert_eq!(job.nested, [r"C:\Games\Steam\steamapps\common\AGame"]);
    assert_eq!(job.exclusions, r"c:\games\steam\steamapps\common\agame");
}

#[test]
fn a_launcher_folder_is_the_games_own_even_when_the_uninstaller_is_shared() {
    let ubi = LauncherApp { name: Some("Rainbow".into()), display_name: Some("Rainbow".into()), install_location: r"C:\GOG\Games\Rainbow".into(), size_bytes: None, version: None };
    let a = program("ra", "Rainbow", Some(r#""C:\Ubisoft\Launcher\uninstall.exe""#), None);
    let b = program("rb", "Other", Some(r#""C:\Ubisoft\Launcher\uninstall.exe""#), None);
    let plan = plan_sizes(&[a, b], &HashMap::new(), &[ubi]);
    assert_eq!(plan.assign, [("ra".to_owned(), r"C:\GOG\Games\Rainbow".to_owned())]);
}
```


- [ ] **Step 2:** `cargo test -p prune-core --test programs_launchers`. Expected: FAIL.
- [ ] **Step 3: Implement.**

**Create `native/crates/prune-core/src/programs/launchers.rs`:**

```rust
//! What the game launchers know about their own installs: Steam's app
//! manifests, Epic's `.item` files and GOG's registry keys
//! (`steamApps.js`, `epicApps.js`, `gogApps.js`, `launcherMatch.js`). Used
//! for sizes and versions of the programs whose registry entry has none.
//! These launchers add no rows of their own to the list in 3.x either.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use super::model::Program;
use super::paths::{norm_path, parse_uninstaller_path};

/* ------------------------------------------------------------------ Steam */

/// The Steam app id in a game's uninstall command. Every Steam game
/// registers the identical `steam://uninstall/<id>` command, so the id is
/// the only thing telling one entry from another.
pub fn parse_steam_app_id(uninstall_string: &str) -> Option<String> {
    let lower = uninstall_string.to_lowercase();
    let at = lower.find("steam://uninstall/")? + "steam://uninstall/".len();
    let digits: String = lower[at..].chars().take_while(char::is_ascii_digit).collect();
    (!digits.is_empty()).then_some(digits)
}

/// `"key" "value"` out of Valve's KeyValues text. Not a full VDF parser:
/// these files are flat enough that matching the key directly is harder to
/// break than a parser on an unexpected nesting.
fn read_key(text: &str, key: &str) -> Option<String> {
    let lower = text.to_lowercase();
    let needle = format!("\"{}\"", key.to_lowercase());
    let mut from = 0;
    while let Some(at) = lower[from..].find(&needle) {
        let after = from + at + needle.len();
        let rest = text[after..].trim_start();
        if let Some(rest) = rest.strip_prefix('"') {
            return rest.split('"').next().map(str::to_owned);
        }
        from = after;
    }
    None
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SteamManifest {
    pub appid: String,
    pub name: Option<String>,
    pub installdir: Option<String>,
    /// Steam's own accounting; a game queued or downloading reports 0, which
    /// is not a size worth putting in place of a blank.
    pub size_bytes: Option<u64>,
}

pub fn parse_app_manifest(text: &str) -> Option<SteamManifest> {
    if !text.contains("\"AppState\"") {
        return None;
    }
    let appid = read_key(text, "appid").filter(|a| !a.is_empty())?;
    let size = read_key(text, "SizeOnDisk").and_then(|s| s.parse::<u64>().ok()).filter(|s| *s > 0);
    Some(SteamManifest { appid, name: read_key(text, "name"), installdir: read_key(text, "installdir"), size_bytes: size })
}

/// Every library path in `libraryfolders.vdf` (libraries are routinely on
/// other drives). The format escapes backslashes.
pub fn parse_library_paths(text: &str) -> Vec<String> {
    let mut paths = Vec::new();
    let lower = text.to_lowercase();
    let mut from = 0;
    while let Some(at) = lower[from..].find("\"path\"") {
        let after = from + at + "\"path\"".len();
        if let Some(rest) = text[after..].trim_start().strip_prefix('"') {
            if let Some(value) = rest.split('"').next().filter(|v| !v.is_empty()) {
                paths.push(value.replace("\\\\", "\\"));
            }
        }
        from = after;
    }
    paths
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SteamApp {
    pub size_bytes: Option<u64>,
    pub name: Option<String>,
    /// Where the game lives, so Steam's own entry can leave it out instead
    /// of counting every game as part of Steam.
    pub path: Option<String>,
}

/// Every installed Steam app, by app id. Located from Steam's own uninstall
/// entry rather than a hardcoded Program Files path: people move it.
pub fn read_steam_apps(steam_root: Option<&str>) -> HashMap<String, SteamApp> {
    let mut apps = HashMap::new();
    let Some(root) = steam_root else { return apps };
    let mut libraries = vec![root.to_owned()];
    if let Ok(vdf) = std::fs::read_to_string(Path::new(root).join("steamapps").join("libraryfolders.vdf")) {
        let parsed = parse_library_paths(&vdf);
        if !parsed.is_empty() {
            libraries = parsed;
        }
    }
    for library in libraries {
        let steamapps = Path::new(&library).join("steamapps");
        let Ok(entries) = std::fs::read_dir(&steamapps) else { continue };
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_lowercase();
            if !(name.starts_with("appmanifest_") && name.ends_with(".acf")) {
                continue;
            }
            let Some(manifest) = std::fs::read_to_string(entry.path()).ok().and_then(|t| parse_app_manifest(&t)) else { continue };
            let path = manifest.installdir.as_ref().map(|d| steamapps.join("common").join(d).to_string_lossy().into_owned());
            apps.insert(manifest.appid, SteamApp { size_bytes: manifest.size_bytes, name: manifest.name, path });
        }
    }
    apps
}

/// Steam's install folder, taken from its own uninstall entry.
pub fn steam_root_from(programs: &[Program]) -> Option<String> {
    let steam = programs.iter().find(|p| p.name.eq_ignore_ascii_case("steam"))?;
    if let Some(location) = steam.install_location.as_deref().filter(|l| !l.is_empty()) {
        return Some(location.trim_end_matches(['\\', '/']).to_owned());
    }
    let exe = parse_uninstaller_path(steam.uninstall_string.as_deref()?).executable?;
    PathBuf::from(exe).parent().map(|p| p.to_string_lossy().into_owned())
}

/* ------------------------------------------------------------- Epic, GOG */

/// One launcher-recorded game: Epic gives a size outright, GOG a folder
/// (and the only version any launcher records).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LauncherApp {
    pub name: Option<String>,
    pub display_name: Option<String>,
    pub install_location: String,
    pub size_bytes: Option<u64>,
    pub version: Option<String>,
}

fn clean_location(path: &str) -> String {
    path.replace('/', "\\").trim_end_matches('\\').to_owned()
}

/// One Epic `.item` manifest. Epic writes InstallLocation with forward
/// slashes, normalized here so it matches the one Windows records. An
/// interrupted install reports the size it was aiming for, so it is skipped.
pub fn parse_epic_manifest(text: &str) -> Option<LauncherApp> {
    let raw: serde_json::Value = serde_json::from_str(text).ok()?;
    if raw["bIsIncompleteInstall"].as_bool() == Some(true) {
        return None;
    }
    let location = raw["InstallLocation"].as_str().filter(|l| !l.is_empty())?;
    let size = raw["InstallSize"].as_f64().filter(|s| s.is_finite() && *s > 0.0).map(|s| s as u64);
    let app_name = raw["AppName"].as_str().filter(|s| !s.is_empty()).map(str::to_owned);
    let display = raw["DisplayName"].as_str().filter(|s| !s.is_empty()).map(str::to_owned).or_else(|| app_name.clone());
    Some(LauncherApp { name: app_name, display_name: display, install_location: clean_location(location), size_bytes: size, version: None })
}

pub fn epic_manifest_dir() -> PathBuf {
    let program_data = std::env::var("ProgramData").unwrap_or_else(|_| r"C:\ProgramData".to_owned());
    Path::new(&program_data).join("Epic").join("EpicGamesLauncher").join("Data").join("Manifests")
}

/// Every game the Epic launcher has installed; empty when it is not there.
pub fn read_epic_apps() -> Vec<LauncherApp> {
    let Ok(entries) = std::fs::read_dir(epic_manifest_dir()) else { return Vec::new() };
    entries
        .flatten()
        .filter(|e| e.file_name().to_string_lossy().to_lowercase().ends_with(".item"))
        .filter_map(|e| std::fs::read_to_string(e.path()).ok().and_then(|t| parse_epic_manifest(&t)))
        .collect()
}

/// A GOG registry row: `path` or `workingDir` is the game's folder.
#[derive(Debug, Clone, Default)]
pub struct GogRaw {
    pub game_name: String,
    pub path: String,
    pub working_dir: String,
    pub ver: String,
}

pub fn normalize_gog_game(raw: &GogRaw) -> Option<LauncherApp> {
    let folder = if raw.path.trim().is_empty() { raw.working_dir.trim() } else { raw.path.trim() };
    if folder.is_empty() {
        return None;
    }
    Some(LauncherApp {
        name: (!raw.game_name.is_empty()).then(|| raw.game_name.clone()),
        display_name: None,
        install_location: clean_location(folder),
        size_bytes: None,
        version: Some(raw.ver.trim().to_owned()).filter(|v| !v.is_empty()),
    })
}

/// Every GOG game on this machine, from the registry: the keys exist for
/// Galaxy and for GOG's offline installers, which Galaxy's database does not
/// cover. Both hives, because 32-bit builds land in WOW6432Node.
#[cfg(windows)]
pub fn read_gog_apps() -> Vec<LauncherApp> {
    use crate::winreg::{Key, Root, Value};
    let as_text = |v: Option<Value>| match v {
        Some(Value::Str(s)) => s,
        Some(Value::Dword(d)) => d.to_string(),
        _ => String::new(),
    };
    let mut apps = Vec::new();
    for path in [r"SOFTWARE\WOW6432Node\GOG.com\Games", r"SOFTWARE\GOG.com\Games"] {
        let Some(parent) = Key::open(Root::LocalMachine, path) else { continue };
        for id in parent.subkey_names() {
            let Some(key) = parent.open_sub(&id) else { continue };
            let raw = GogRaw {
                game_name: as_text(key.value("gameName")),
                path: as_text(key.value("path")),
                working_dir: as_text(key.value("workingDir")),
                ver: as_text(key.value("ver")),
            };
            if raw.game_name.is_empty() && raw.path.is_empty() {
                continue;
            }
            apps.extend(normalize_gog_game(&raw));
        }
    }
    apps
}

#[cfg(not(windows))]
pub fn read_gog_apps() -> Vec<LauncherApp> {
    Vec::new()
}

fn normalize_name(value: &str) -> String {
    value.to_lowercase().chars().filter(|c| c.is_ascii_alphanumeric()).collect()
}

/// The launcher's record for an installed program: by location first (two
/// records naming one folder are one installation), then by an EXACT
/// normalized name. A wrong match puts one game's size on another's row, so
/// "Fortnite" must not match "Fortnite Festival Companion".
pub fn match_launcher_app<'a>(program: &Program, apps: &'a [LauncherApp]) -> Option<&'a LauncherApp> {
    if let Some(location) = program.install_location.as_deref().map(norm_path).filter(|l| !l.is_empty()) {
        if let Some(found) = apps.iter().find(|a| norm_path(&a.install_location) == location) {
            return Some(found);
        }
    }
    let name = normalize_name(&program.name);
    if name.is_empty() {
        return None;
    }
    apps.iter().find(|a| {
        let app_name = normalize_name(a.display_name.as_deref().or(a.name.as_deref()).unwrap_or(""));
        !app_name.is_empty() && app_name == name
    })
}
```


**Create `native/crates/prune-core/src/programs/sizes.rs`:**

```rust
//! Real sizes for the programs whose registry entry has no EstimatedSize
//! (`services/programSizes.js`): 43 of 132 on the machine this was written
//! on. Three sources, most trusted first: Steam's or Epic's own record of
//! the game, then the program's InstallLocation measured on disk, then the
//! folder its uninstaller lives in, but only when no other program shares
//! that folder.

use std::collections::HashMap;

use super::folder_sizes::{FolderSizeStore, exclusion_key};
use super::launchers::{
    LauncherApp, SteamApp, match_launcher_app, parse_steam_app_id, read_epic_apps, read_gog_apps, read_steam_apps,
    steam_root_from,
};
use super::model::Program;
use super::paths::{is_strictly_inside, size_source_for};

/// A folder to measure, and which nested folders belong to other rows.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FolderJob {
    pub folder: String,
    pub nested: Vec<String>,
    /// Which folders are left out is part of what was measured.
    pub exclusions: String,
}

/// What to do for each program, decided without touching the disk.
#[derive(Debug, Default)]
pub struct Plan {
    /// Sizes a launcher stated outright.
    pub direct: HashMap<String, u64>,
    /// `(program id, folder)`: the program takes the folder's measured size.
    pub assign: Vec<(String, String)>,
    pub jobs: Vec<FolderJob>,
}

pub fn plan_sizes(programs: &[Program], steam: &HashMap<String, SteamApp>, launchers: &[LauncherApp]) -> Plan {
    // How many programs would fall back to each folder. A folder several
    // entries share is a launcher's directory, and measuring it hands every
    // one of them the same wrong number. A Steam app is sized from its
    // manifest, so it must not count toward the folder's share.
    let mut fallback_users: HashMap<String, usize> = HashMap::new();
    for program in programs.iter().filter(|p| p.install_location.is_none()) {
        if program.uninstall_string.as_deref().and_then(parse_steam_app_id).is_some() {
            continue;
        }
        if let Some(folder) = size_source_for(program) {
            *fallback_users.entry(folder).or_default() += 1;
        }
    }

    // Every folder that belongs to something, so a measure can leave out the
    // ones that are not its own (Steam's own entry must not count every game).
    let mut all_folders: Vec<String> = programs.iter().filter_map(size_source_for).collect();
    all_folders.extend(steam.values().filter_map(|a| a.path.clone()));
    all_folders.extend(launchers.iter().map(|a| a.install_location.clone()).filter(|l| !l.is_empty()));

    let mut plan = Plan::default();
    for program in programs {
        if program.size_bytes.is_some() {
            continue;
        }
        if let Some(app_id) = program.uninstall_string.as_deref().and_then(parse_steam_app_id) {
            // Steam knows exactly, and the folder route would be wrong anyway.
            if let Some(size) = steam.get(&app_id).and_then(|a| a.size_bytes) {
                plan.direct.insert(program.id.clone(), size);
            }
            continue;
        }
        let launcher = match_launcher_app(program, launchers);
        if let Some(size) = launcher.and_then(|l| l.size_bytes) {
            plan.direct.insert(program.id.clone(), size);
            continue;
        }
        let Some(folder) = launcher.map(|l| l.install_location.clone()).or_else(|| size_source_for(program)) else {
            continue;
        };
        // The shared-folder refusal applies only to a folder guessed from the
        // uninstaller: a launcher naming the game's own directory is a record.
        if launcher.is_none() && program.install_location.is_none() && fallback_users.get(&folder).copied().unwrap_or(0) > 1 {
            continue;
        }
        if !plan.jobs.iter().any(|j| j.folder == folder) {
            let nested: Vec<String> = all_folders.iter().filter(|o| **o != folder && is_strictly_inside(o, &folder)).cloned().collect();
            let mut keys: Vec<String> = nested.iter().map(|n| exclusion_key(n)).collect();
            keys.sort();
            plan.jobs.push(FolderJob { folder: folder.clone(), nested, exclusions: keys.join("|") });
        }
        plan.assign.push((program.id.clone(), folder));
    }
    plan
}

#[derive(Debug, Default)]
pub struct SizeOutcome {
    pub sizes: HashMap<String, u64>,
    /// Folders shown from a size more than a day old, to measure again once
    /// the window has settled (`refreshStaleSizes`).
    pub stale: Vec<FolderJob>,
}

fn measure_all(jobs: &[FolderJob]) -> Vec<u64> {
    #[cfg(windows)]
    return super::walk::measure_many(&jobs.iter().map(|j| (j.folder.clone(), j.nested.clone())).collect::<Vec<_>>());
    #[cfg(not(windows))]
    vec![0; jobs.len()]
}

/// `{ programId: bytes }` for the programs the registry gave no size.
pub fn resolve_sizes(programs: &[Program], store: &mut FolderSizeStore) -> SizeOutcome {
    let steam = read_steam_apps(steam_root_from(programs).as_deref());
    let mut launchers = read_epic_apps();
    launchers.extend(read_gog_apps());
    let plan = plan_sizes(programs, &steam, &launchers);

    let mut outcome = SizeOutcome { sizes: plan.direct.clone(), stale: Vec::new() };
    let mut known: HashMap<String, u64> = HashMap::new();
    let mut to_measure = Vec::new();
    for job in &plan.jobs {
        match store.lookup(&job.folder, &job.exclusions) {
            Some(kept) => {
                known.insert(job.folder.clone(), kept.bytes);
                if !kept.fresh {
                    outcome.stale.push(job.clone());
                }
            }
            None => to_measure.push(job.clone()),
        }
    }
    for (job, bytes) in to_measure.iter().zip(measure_all(&to_measure)) {
        store.set(&job.folder, &job.exclusions, bytes);
        known.insert(job.folder.clone(), bytes);
    }
    store.save();

    for (id, folder) in &plan.assign {
        // Zero means the folder is gone or empty, which would read as "this
        // program is free"; it usually means the entry is stale.
        if let Some(bytes) = known.get(folder).copied().filter(|b| *b > 0) {
            outcome.sizes.insert(id.clone(), bytes);
        }
    }
    outcome
}

/// Measures again the folders shown from an out-of-date size, and keeps the
/// new figures for the next launch. Returns how many were refreshed.
pub fn refresh_stale(jobs: &[FolderJob], store: &mut FolderSizeStore) -> usize {
    for (job, bytes) in jobs.iter().zip(measure_all(jobs)) {
        store.set(&job.folder, &job.exclusions, bytes);
    }
    store.save();
    jobs.len()
}
```


`programs/mod.rs` gains `pub mod launchers;` and `pub mod sizes;`.

- [ ] **Step 4:** Expected: 7 passed.
- [ ] **Step 5: Commit** `feat(native): launcher records and measured sizes for programs the registry gives none`

### Task 5: Versions read off the program's binary

**Files:**
- Create: `native/crates/prune-core/src/programs/versions.rs`
- Modify: `native/crates/prune-core/src/programs/mod.rs`
- Test: `native/crates/prune-core/tests/programs_versions.rs`

**Interfaces:**
- Produces: `normalize_file_version`, `find_main_executable` (a name match wins, else the largest plausible executable; never an uninstaller, setup or updater stub; at most 4 deep and 120 folders, because `C:\Program Files\Epic Games` holds every game), `version_source_for`, `read_version_strings`, `resolve_versions`.
- The ladder differs from the icons' on purpose: an uninstaller carries its own version (Ubisoft's anti-cheat once got its uninstaller's 5.0.2.0, a Windows shim database Windows' own build number), so the uninstaller is never a source. A GOG record's version beats reading a binary. The bar is high: a version that is a linker default (`1.0.0.0`), a commit hash or prose is a blank, because a blank says "not recorded" and `1.0.0.0` on a game nowhere near 1.0 is a false claim.

- [ ] **Step 1: Write the tests.**

**Create `native/crates/prune-core/tests/programs_versions.rs`:**

```rust
//! Versions and the main-executable search, ported from 3.x's
//! versionText.test.js, findMainExecutable.test.js and programVersions.test.js.

#![cfg(windows)]

use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};

use prune_core::programs::model::Program;
use prune_core::programs::versions::*;

fn v(raw: &str) -> Option<String> {
    normalize_file_version(raw)
}

#[test]
fn real_versions_pass_through() {
    for ok in ["2.8.0.42", "16.17.810.4348", "138.0.0", "2026.08.19.11.06", "1.19.0-6+20260826.181057"] {
        assert_eq!(v(ok).as_deref(), Some(ok));
    }
}

#[test]
fn punctuation_is_repaired_and_never_the_numbers() {
    assert_eq!(v("0, 734, 0, 7340917").as_deref(), Some("0.734.0.7340917"));
    assert_eq!(v("1,2,3,4").as_deref(), Some("1.2.3.4"));
    assert_eq!(v("  3.4.1  ").as_deref(), Some("3.4.1"));
    assert_eq!(v("v3.4.1").as_deref(), Some("3.4.1"));
    assert_eq!(v("Version 3.4.1").as_deref(), Some("3.4.1"));
}

#[test]
fn what_is_not_a_version_is_a_blank() {
    // The linker's default, a commit hash, prose, and a lone dash.
    for bad in ["", "   ", "1.0.0.0", "0.0.0.0", "1, 0, 0, 0", "6a95c09f1c731857808b405d", "deadbeefcafe1234", "Copyright Contoso", "-"] {
        assert_eq!(v(bad), None, "{bad:?}");
    }
    assert_eq!(v("4.1.2 (build 9931, compiled 2026-01-04 by the release runner)"), None);
}

fn scratch() -> PathBuf {
    static N: AtomicUsize = AtomicUsize::new(0);
    let dir = std::env::temp_dir().join(format!("prune-exe-{}-{}", std::process::id(), N.fetch_add(1, Ordering::Relaxed)));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

fn exe(path: PathBuf, bytes: usize) -> String {
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(&path, vec![0u8; bytes]).unwrap();
    path.to_string_lossy().replace('/', "\\")
}

#[test]
fn the_executable_named_after_the_program_wins_at_any_depth() {
    let dir = scratch();
    exe(dir.join("other.exe"), 5000);
    let wanted = exe(dir.join("Launcher/Portal/Binaries/Win64/EpicGamesLauncher.exe"), 10);
    assert_eq!(find_main_executable(dir.to_str().unwrap(), "Epic Games Launcher"), Some(wanted));
    let versioned = scratch();
    let discord = exe(versioned.join("app-1.0.9255/Discord.exe"), 10);
    assert_eq!(find_main_executable(versioned.to_str().unwrap(), "Discord"), Some(discord));
    let punctuated = scratch();
    let cpuz = exe(punctuated.join("CPU-Z 2.20.exe"), 10);
    assert_eq!(find_main_executable(punctuated.to_str().unwrap(), "cpu z 2.20"), Some(cpuz));
}

#[test]
fn without_a_name_match_the_largest_real_executable_wins_never_a_stub() {
    let dir = scratch();
    exe(dir.join("unins000.exe"), 9000);
    exe(dir.join("Update.exe"), 9000);
    exe(dir.join("setup.exe"), 9000);
    exe(dir.join("small.exe"), 10);
    let big = exe(dir.join("sub/real.exe"), 500);
    assert_eq!(find_main_executable(dir.to_str().unwrap(), "Unrelated"), Some(big));
    // ...but an uninstaller-looking name IS the answer when it is the program's name.
    let wanted = exe(dir.join("Update.exe"), 9000);
    assert_eq!(find_main_executable(dir.to_str().unwrap(), "Update"), Some(wanted));
}

#[test]
fn nothing_to_find_is_none() {
    let dir = scratch();
    fs::write(dir.join("readme.txt"), "x").unwrap();
    assert_eq!(find_main_executable(dir.to_str().unwrap(), "Thing"), None);
    assert_eq!(find_main_executable(r"C:\no\such\folder", "Thing"), None);
    assert_eq!(find_main_executable("", "Thing"), None);
}

#[test]
fn it_gives_up_on_an_unbounded_tree() {
    let dir = scratch();
    for i in 0..300 {
        fs::create_dir_all(dir.join(format!("d{i}/inner"))).unwrap();
    }
    let started = std::time::Instant::now();
    assert_eq!(find_main_executable(dir.to_str().unwrap(), "x"), None);
    assert!(started.elapsed().as_secs() < 2);
}

#[test]
fn a_real_binarys_version_resource_is_read() {
    let system = std::env::var("SystemRoot").unwrap_or_else(|_| r"C:\Windows".into());
    let (file, product) = read_version_strings(&format!(r"{system}\System32\notepad.exe")).expect("notepad has a version resource");
    assert!(normalize_file_version(&file).is_some() || normalize_file_version(&product).is_some(), "{file} / {product}");
    assert!(read_version_strings(r"C:\no\such.exe").is_none());
}

#[test]
fn an_uninstaller_never_supplies_a_programs_version() {
    let p = Program {
        id: "x".into(),
        name: "Canon".into(),
        display_icon: Some(r"C:\CanonIJ Uninstaller Information\DELDRV64.exe".into()),
        ..Program::default()
    };
    assert_eq!(version_source_for(&p, None), None);
    let own = Program { display_icon: Some(r"C:\Riot\RiotClient.exe,0".into()), ..p };
    assert_eq!(version_source_for(&own, None).as_deref(), Some(r"C:\Riot\RiotClient.exe"));
}
```


- [ ] **Step 2:** `cargo test -p prune-core --test programs_versions`. Expected: FAIL.
- [ ] **Step 3: Implement.**

**Create `native/crates/prune-core/src/programs/versions.rs`:**

```rust
//! Versions for the programs whose registry entry has no DisplayVersion
//! (`services/programVersions.js`, `versionText.js`, `findMainExecutable.js`).
//! 15 of 132 entries here have none, and they are not a random 15: they are
//! overwhelmingly games and clients a launcher installed.

use std::collections::HashMap;
use std::path::Path;

use super::launchers::{LauncherApp, SteamApp, match_launcher_app, parse_steam_app_id, read_gog_apps, read_steam_apps, steam_root_from};
use super::model::Program;
use super::paths::icon_source_for;

/// Longer than any real version, short enough to exclude prose.
const MAX_LENGTH: usize = 32;
const PLACEHOLDERS: [&str; 6] = ["1.0.0.0", "0.0.0.0", "1.0.0", "0.0.0", "0", ""];

/// Cleans up an executable's reported version, or `None` when it is not
/// reporting one. Only called for programs with no DisplayVersion, so
/// everything here is a fallback and the bar is high: a blank says "not
/// recorded", which is true; `1.0.0.0` on a game nowhere near 1.0 is a
/// false claim.
pub fn normalize_file_version(raw: &str) -> Option<String> {
    let mut value = raw.trim().to_owned();
    // "0, 734, 0, 7340917": the numbers are right and only the punctuation is wrong.
    let parts: Vec<&str> = value.split(',').map(str::trim).collect();
    if parts.len() > 1 && parts.iter().all(|p| !p.is_empty() && p.bytes().all(|b| b.is_ascii_digit())) {
        value = parts.join(".");
    }
    if value.len() > 1 && value.as_bytes()[0].eq_ignore_ascii_case(&b'v') && value.as_bytes()[1].is_ascii_digit() {
        value.remove(0);
    }
    if value.to_lowercase().starts_with("version") && value[7..].starts_with(char::is_whitespace) {
        value = value[7..].trim_start().to_owned();
    }
    let value = value.trim().to_owned();
    if value.is_empty() || value.chars().count() > MAX_LENGTH {
        return None;
    }
    // A field holding nothing but hex is a commit hash.
    let is_hash = value.len() >= 12 && value.bytes().all(|b| b.is_ascii_hexdigit());
    if is_hash || PLACEHOLDERS.contains(&value.as_str()) || !value.starts_with(|c: char| c.is_ascii_digit()) {
        return None;
    }
    Some(value)
}

/// Executables that are in nearly every install directory and never carry
/// the application's own icon or version.
const NOT_THE_APP: [&str; 16] = [
    "unins", "uninstall", "setup", "install", "update", "upgrade", "crashpad", "crashreporter", "vcredist", "dxsetup",
    "dotnet", "vc_redist", "helper", "node", "python", "7z",
];

fn normalize_name(value: &str) -> String {
    let lower = value.to_lowercase();
    lower.strip_suffix(".exe").unwrap_or(&lower).chars().filter(char::is_ascii_alphanumeric).collect()
}

/// How far down an install directory to look, and how many directories to
/// open in total. Both bounds are load-bearing: `C:\Program Files\Epic Games`
/// is an InstallLocation and also holds every game installed through it.
const MAX_DEPTH: usize = 4;
const MAX_DIRECTORIES: usize = 120;

/// The executable an install directory is built around, so its icon, version
/// or signature can stand for the program. An exact name match is the answer;
/// otherwise the largest plausible executable (never an uninstaller, setup or
/// updater stub).
#[cfg(windows)]
pub fn find_main_executable(install_location: &str, program_name: &str) -> Option<String> {
    use super::walk::read_dir;
    use std::collections::VecDeque;
    if install_location.trim().is_empty() {
        return None;
    }
    let target = normalize_name(program_name);
    let mut queue = VecDeque::from([(install_location.trim_end_matches(['\\', '/']).to_owned(), 0usize)]);
    let mut visited = 0;
    let mut best: Option<(String, u64)> = None;
    while let Some((dir, depth)) = queue.pop_front() {
        if visited >= MAX_DIRECTORIES {
            break;
        }
        visited += 1;
        let Some(entries) = read_dir(Path::new(&dir)) else { continue };
        for entry in entries {
            let full = format!(r"{dir}\{}", entry.name);
            if entry.is_dir {
                if depth < MAX_DEPTH {
                    queue.push_back((full, depth + 1));
                }
                continue;
            }
            let lower = entry.name.to_lowercase();
            if entry.is_link || !lower.ends_with(".exe") {
                continue;
            }
            if !target.is_empty() && normalize_name(&entry.name) == target {
                return Some(full);
            }
            if NOT_THE_APP.iter().any(|p| lower.starts_with(p)) {
                continue;
            }
            if best.as_ref().is_none_or(|(_, size)| entry.size > *size) {
                best = Some((full, entry.size));
            }
        }
    }
    best.map(|(path, _)| path)
}

#[cfg(not(windows))]
pub fn find_main_executable(_: &str, _: &str) -> Option<String> {
    None
}

/// An installer or uninstaller carries its own version, not the
/// application's: reading one handed Ubisoft's anti-cheat its uninstaller's
/// 5.0.2.0 and a Windows shim database Windows' own build number. `inst`
/// rather than `install` so oalinst.exe and sdbinst.exe are caught too.
fn is_application_binary(path: &str) -> bool {
    let lower = path.to_lowercase();
    (lower.ends_with(".exe") || lower.ends_with(".dll"))
        && !["inst", "setup", "deldrv"].iter().any(|bad| lower.contains(bad))
}

/// The file to read a version out of: the vendor's DisplayIcon when it names
/// the application, then the real binary in the install folder. Never the
/// uninstaller.
pub fn version_source_for(program: &Program, folder: Option<&str>) -> Option<String> {
    if let Some(declared) = icon_source_for(program).filter(|d| is_application_binary(&d.path)) {
        return Some(declared.path);
    }
    let executable = find_main_executable(folder?, &program.name)?;
    is_application_binary(&executable).then_some(executable)
}

/// `(FileVersion, ProductVersion)` from a file's version resource, the same
/// place Windows' Properties dialog reads. Both are returned and the caller
/// decides: where they differ one is often empty.
#[cfg(windows)]
pub fn read_version_strings(path: &str) -> Option<(String, String)> {
    use std::ffi::c_void;
    use windows::Win32::Storage::FileSystem::{GetFileVersionInfoSizeW, GetFileVersionInfoW, VerQueryValueW};
    use windows::core::HSTRING;

    let wide = HSTRING::from(path);
    // SAFETY: every pointer handed to the calls below lives for the call, and
    // `block` is sized by GetFileVersionInfoSizeW before it is filled.
    unsafe {
        let size = GetFileVersionInfoSizeW(&wide, None);
        if size == 0 {
            return None;
        }
        let mut block = vec![0u8; size as usize];
        GetFileVersionInfoW(&wide, None, size, block.as_mut_ptr().cast()).ok()?;
        let query = |sub: &str| -> Option<String> {
            let mut ptr: *mut c_void = std::ptr::null_mut();
            let mut len = 0u32;
            let ok = VerQueryValueW(block.as_ptr().cast(), &HSTRING::from(sub), &mut ptr, &mut len);
            if !ok.as_bool() || ptr.is_null() || len == 0 {
                return None;
            }
            let units = std::slice::from_raw_parts(ptr as *const u16, len as usize);
            let end = units.iter().position(|c| *c == 0).unwrap_or(units.len());
            Some(String::from_utf16_lossy(&units[..end]))
        };
        // The file's own translations first, then the ones .NET's FileVersionInfo falls back to.
        let mut languages: Vec<String> = Vec::new();
        let mut ptr: *mut c_void = std::ptr::null_mut();
        let mut len = 0u32;
        if VerQueryValueW(block.as_ptr().cast(), &HSTRING::from(r"\VarFileInfo\Translation"), &mut ptr, &mut len).as_bool()
            && !ptr.is_null()
        {
            let pairs = std::slice::from_raw_parts(ptr as *const u16, len as usize / 2);
            languages.extend(pairs.chunks_exact(2).map(|p| format!("{:04x}{:04x}", p[0], p[1])));
        }
        languages.extend(["040904b0", "040904e4", "04090000"].map(String::from));
        for lang in languages {
            let file = query(&format!(r"\StringFileInfo\{lang}\FileVersion"));
            let product = query(&format!(r"\StringFileInfo\{lang}\ProductVersion"));
            if file.is_some() || product.is_some() {
                return Some((file.unwrap_or_default(), product.unwrap_or_default()));
            }
        }
        None
    }
}

#[cfg(not(windows))]
pub fn read_version_strings(_: &str) -> Option<(String, String)> {
    None
}

/// Versions for the programs with none, as `{ id: version }`. A launcher's
/// own record (GOG writes one) beats reading a binary: it is what the
/// launcher shows and what the person will compare against.
pub fn resolve_versions(programs: &[Program]) -> HashMap<String, String> {
    let wanted: Vec<&Program> = programs.iter().filter(|p| p.version.is_empty()).collect();
    if wanted.is_empty() {
        return HashMap::new();
    }
    let steam: HashMap<String, SteamApp> = read_steam_apps(steam_root_from(programs).as_deref());
    let gog: Vec<LauncherApp> = read_gog_apps();
    let mut versions = HashMap::new();
    let mut sources: Vec<(String, String)> = Vec::new();
    for program in wanted {
        if let Some(declared) = match_launcher_app(program, &gog).and_then(|l| l.version.as_deref()).and_then(normalize_file_version) {
            versions.insert(program.id.clone(), declared);
            continue;
        }
        // Steam titles record no InstallLocation: the folder comes from Steam's manifest.
        let steam_path = program.uninstall_string.as_deref().and_then(parse_steam_app_id).and_then(|id| steam.get(&id)).and_then(|a| a.path.clone());
        let folder = program.install_location.clone().or(steam_path);
        if let Some(path) = version_source_for(program, folder.as_deref()) {
            sources.push((program.id.clone(), path));
        }
    }
    let mut by_path: HashMap<String, Option<String>> = HashMap::new();
    for (id, path) in sources {
        let version = by_path
            .entry(path.clone())
            .or_insert_with(|| {
                read_version_strings(&path).and_then(|(file, product)| normalize_file_version(&file).or_else(|| normalize_file_version(&product)))
            })
            .clone();
        if let Some(version) = version {
            versions.insert(id, version);
        }
    }
    versions
}
```


`programs/mod.rs` gains `pub mod versions;`.

- [ ] **Step 4:** Expected: 9 passed.
- [ ] **Step 5: Commit** `feat(native): versions for programs whose registry entry has none`

### Task 6: Install dates

**Files:**
- Create: `native/crates/prune-core/src/programs/dates.rs`
- Modify: `native/crates/prune-core/src/programs/mod.rs`
- Test: `native/crates/prune-core/tests/programs_dates.rs`

**Interfaces:**
- Produces: `normalize_key_date`, `filetime_to_local_date`, `system_time_to_ticks`, `resolve_install_dates`.
- For the 72 of 132 entries here with no `InstallDate`, the date is the uninstall key's last-write time (confirmed against a reference column in 3.x: Steam, Ubisoft Connect and two games matched exactly). It is an approximation and the row says so (a muted date). 1601, 1899 and 1970 are what a key with nothing in it reads as, so anything before 1990 is no date.

- [ ] **Step 1: Write the tests.**

**Create `native/crates/prune-core/tests/programs_dates.rs`:**

```rust
//! Key-write-time install dates, ported from 3.x's installDates.test.js and
//! checked against what 3.x's `/api/programs/install-dates` returned.

use prune_core::programs::dates::*;
use prune_core::programs::model::Program;

#[test]
fn only_plausible_calendar_dates_survive() {
    assert_eq!(normalize_key_date("2026-08-19").as_deref(), Some("2026-08-19"));
    assert_eq!(normalize_key_date("2026-08-19T10:00:00").as_deref(), Some("2026-08-19"));
    assert_eq!(normalize_key_date("2026-08-19 10:00").as_deref(), Some("2026-08-19"));
    // 1601 is a FILETIME with nothing in it; 1899 and 1970 are other APIs' zero.
    for bad in ["1601-01-01", "1899-12-30", "1970-01-01", "1989-12-31", "yesterday", "2026-8-19", "2026-08-19x", ""] {
        assert_eq!(normalize_key_date(bad), None, "{bad:?}");
    }
}

#[test]
fn a_filetime_is_a_local_date() {
    // 2026-08-19 12:00 UTC is the 19th everywhere from UTC-12 to UTC+11.
    let ticks = 116_444_736_000_000_000u64 + 1_787_140_800 * 10_000_000;
    assert_eq!(filetime_to_local_date(ticks).as_deref(), Some("2026-08-19"));
    assert_eq!(filetime_to_local_date(0), None);
}

#[test]
fn system_time_converts_to_the_same_ticks() {
    let t = std::time::UNIX_EPOCH + std::time::Duration::from_secs(1_787_140_800);
    assert_eq!(system_time_to_ticks(t), Some(116_444_736_000_000_000 + 1_787_140_800 * 10_000_000));
}

#[cfg(windows)]
#[test]
fn matches_3x_for_every_program_it_filled() {
    let Some(path) = std::env::var_os("PRUNE_3X_DIR").map(std::path::PathBuf::from) else { return };
    let read = |f: &str| -> serde_json::Value { serde_json::from_slice(&std::fs::read(path.join(f)).unwrap()).unwrap() };
    let programs: Vec<Program> = prune_core::programs::registry::list_installed_programs();
    let ours = resolve_install_dates(&programs);
    let theirs = read("install-dates.json");
    let theirs = theirs["installDates"].as_object().unwrap();
    assert_eq!(ours.len(), theirs.len(), "the same programs get a date");
    for (id, date) in theirs {
        assert_eq!(ours.get(id).map(String::as_str), date.as_str(), "{id}");
    }
}
```


- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3: Implement.**

**Create `native/crates/prune-core/src/programs/dates.rs`:**

```rust
//! Install dates for the programs whose registry entry never declared one
//! (`services/installDates.js`): 72 of 132 here, so the column read as mostly
//! empty. Taken from the uninstall key's own last-write time, which Windows
//! records for every key. It is an approximation, and the row says so (a
//! muted date): an update that rewrites DisplayVersion rewrites the key too.

use std::collections::HashMap;

use super::model::Program;

/// Ticks of 100 ns between 1601-01-01 (FILETIME) and 1970-01-01.
const EPOCH_DIFF_TICKS: u64 = 116_444_736_000_000_000;

/// Earliest date an entry could plausibly describe. A key with no
/// meaningful write time reads back as 1601, and various APIs substitute
/// 1899 or 1970. None of those is an install.
const EARLIEST: &str = "1990-01-01";

/// `YYYY-MM-DD` out of whatever date text arrived, or `None` (`normalizeKeyDate`).
pub fn normalize_key_date(value: &str) -> Option<String> {
    let value = value.trim();
    let date = value.get(..10)?;
    let b = date.as_bytes();
    let shaped = b.iter().enumerate().all(|(i, c)| if i == 4 || i == 7 { *c == b'-' } else { c.is_ascii_digit() });
    let boundary_ok = value.len() == 10 || matches!(value.as_bytes()[10], b'T' | b' ');
    (shaped && boundary_ok && date >= EARLIEST).then(|| date.to_owned())
}

/// A FILETIME as the local calendar date, the way .NET's
/// `DateTime.FromFileTime(...).ToString('yyyy-MM-dd')` writes it: through
/// the time zone's rules for that date, DST included.
#[cfg(windows)]
pub fn filetime_to_local_date(ticks: u64) -> Option<String> {
    use windows::Win32::Foundation::{FILETIME, SYSTEMTIME};
    use windows::Win32::System::Time::{FileTimeToSystemTime, SystemTimeToTzSpecificLocalTime};
    let ft = FILETIME { dwLowDateTime: ticks as u32, dwHighDateTime: (ticks >> 32) as u32 };
    let mut utc = SYSTEMTIME::default();
    let mut local = SYSTEMTIME::default();
    // SAFETY: both out parameters are valid SYSTEMTIMEs.
    unsafe {
        FileTimeToSystemTime(&ft, &mut utc).ok()?;
        SystemTimeToTzSpecificLocalTime(None, &utc, &mut local).ok()?;
    }
    normalize_key_date(&format!("{:04}-{:02}-{:02}", local.wYear, local.wMonth, local.wDay))
}

#[cfg(not(windows))]
pub fn filetime_to_local_date(_: u64) -> Option<String> {
    None
}

/// A `SystemTime` (a folder's creation time) as a FILETIME tick count.
pub fn system_time_to_ticks(time: std::time::SystemTime) -> Option<u64> {
    let since_unix = time.duration_since(std::time::UNIX_EPOCH).ok()?;
    Some(EPOCH_DIFF_TICKS + (since_unix.as_nanos() / 100) as u64)
}

/// The key's last-write time for a `HKLM:\...` / `HKCU:\...` path.
#[cfg(windows)]
fn key_date(registry_key: &str) -> Option<String> {
    use crate::winreg::{Key, Root};
    let (root, rest) = if let Some(r) = registry_key.strip_prefix(r"HKLM:\") {
        (Root::LocalMachine, r)
    } else {
        (Root::CurrentUser, registry_key.strip_prefix(r"HKCU:\")?)
    };
    filetime_to_local_date(Key::open(root, rest)?.last_write()?)
}

#[cfg(not(windows))]
fn key_date(_: &str) -> Option<String> {
    None
}

/// `{ programId: date }` for the programs with no declared InstallDate.
pub fn resolve_install_dates(programs: &[Program]) -> HashMap<String, String> {
    programs
        .iter()
        .filter(|p| p.install_date.is_none())
        .filter_map(|p| Some((p.id.clone(), key_date(p.registry_key.as_deref()?)?)))
        .collect()
}
```


`programs/mod.rs` gains `pub mod dates;`.

- [ ] **Step 4:** `PRUNE_3X_DIR=<folder> cargo test -p prune-core --test programs_dates`. Expected: 4 passed, all 72 dates equal to 3.x's.
- [ ] **Step 5: Commit** `feat(native): install dates from the uninstall key's last write time`

### Task 7: Microsoft Store apps

**Files:**
- Create: `native/crates/prune-core/src/programs/store.rs`
- Modify: `native/crates/prune-core/src/programs/mod.rs`
- Test: `native/crates/prune-core/tests/programs_store.rs`

**Interfaces:**
- Produces: `friendly_store_name`, `publisher_from_dn`, `manifest_display_name`, `architecture_of`, `RawPackage`, `normalize_store_app`, `read_packages`, `measure_packages`, `list_store_apps`, `read_non_removable`, `parse_non_removable`.
- Ids are `store:<PackageFullName>` (never colliding with a registry key name; two versions are two installs). Frameworks and system packages are left out. The name is the manifest's `DisplayName` unless it is an `ms-resource:` reference, then the package identity split on capitals. Install date is the package folder's creation time, taken from the link itself with `symlink_metadata` (a package that is a junction reports the junction's date, as PowerShell's `Get-Item` does; `metadata` followed the link and was 17 days off for one package). The nonRemovable flag is the one thing with no API (see the table above); Task 16 merges it in when it arrives.

- [ ] **Step 1: Write the tests.**

**Create `native/crates/prune-core/tests/programs_store.rs`:**

```rust
//! Store apps, ported from 3.x's storeApps.test.js, and checked against what
//! 3.x's `/api/programs/store` returned on the same machine.

use prune_core::programs::model::{Arch, Source};
use prune_core::programs::store::*;

#[test]
fn a_real_display_name_wins_and_a_resource_reference_falls_back_to_the_identity() {
    assert_eq!(friendly_store_name("Paint", "Microsoft.Paint").as_deref(), Some("Paint"));
    assert_eq!(friendly_store_name("ms-resource:AppName", "Microsoft.XboxGameOverlay").as_deref(), Some("Xbox Game Overlay"));
    // A capital only starts a new word after a lowercase letter or digit.
    assert_eq!(friendly_store_name("", "Vendor.TCUI").as_deref(), Some("TCUI"));
    assert_eq!(friendly_store_name("", "Vendor.App2Go").as_deref(), Some("App2 Go"));
    assert_eq!(friendly_store_name("", ""), None);
}

#[test]
fn only_the_common_name_of_a_publisher_is_shown() {
    assert_eq!(publisher_from_dn("CN=Realtek Semiconductor Corp, O=Realtek, L=Hsinchu, C=TW").as_deref(), Some("Realtek Semiconductor Corp"));
    assert_eq!(publisher_from_dn(r#"CN="Acme, Inc.", O=Acme"#).as_deref(), Some("Acme, Inc."));
    assert_eq!(publisher_from_dn("Plain Name").as_deref(), Some("Plain Name"));
    assert_eq!(publisher_from_dn("  "), None);
}

#[test]
fn the_manifest_display_name_is_read_and_cleaned() {
    let xml = "<Package><Identity Name=\"x\"/><Properties>\r\n<DisplayName>Calc &amp; \nMore</DisplayName></Properties></Package>";
    assert_eq!(manifest_display_name(xml), "Calc &   More".replace("   ", "  "));
    assert_eq!(manifest_display_name("<Package/>"), "");
}

#[test]
fn a_package_becomes_a_row_like_a_program() {
    let raw = RawPackage {
        name: "Microsoft.Paint".into(),
        package_full_name: "Microsoft.Paint_11.0_x64__8wekyb3d8bbwe".into(),
        publisher: "CN=Microsoft Corporation, O=Microsoft".into(),
        version: "11.0.0.0".into(),
        install_location: r"C:\Program Files\WindowsApps\Paint".into(),
        display_name: "ms-resource:AppName".into(),
        architecture: "X64".into(),
        size_bytes: Some(0),
        install_date: Some("2026-09-24".into()),
    };
    let p = normalize_store_app(&raw).unwrap();
    assert_eq!(p.id, "store:Microsoft.Paint_11.0_x64__8wekyb3d8bbwe");
    assert_eq!((p.name.as_str(), p.publisher.as_str(), p.source), ("Paint", "Microsoft Corporation", Source::Store));
    assert_eq!(p.architecture, Some(Arch::Bits64));
    assert_eq!(p.size_bytes, None, "zero would read as free");
    assert!(p.install_date_approximate);
    assert_eq!(p.package_name.as_deref(), Some("Microsoft.Paint"));
    assert!(normalize_store_app(&RawPackage::default()).is_none());
    assert_eq!(architecture_of("Neutral"), None);
}

#[test]
fn the_non_removable_answer_parses_one_package_or_many() {
    let many = parse_non_removable(r#"[{"n":"A_1","r":true},{"n":"B_1","r":false},{"x":1}]"#);
    assert_eq!((many["A_1"], many["B_1"], many.len()), (true, false, 2));
    assert_eq!(parse_non_removable(r#"{"n":"A_1","r":true}"#)["A_1"], true);
    assert!(parse_non_removable("not json").is_empty());
}

#[cfg(windows)]
#[test]
fn lists_the_same_store_apps_as_3x() {
    let Some(dir) = std::env::var_os("PRUNE_3X_DIR").map(std::path::PathBuf::from) else { return };
    let theirs: serde_json::Value = serde_json::from_slice(&std::fs::read(dir.join("store.json")).unwrap()).unwrap();
    let theirs = theirs["apps"].as_array().unwrap();
    let ours = list_store_apps();
    let ids = |v: Vec<&str>| {
        let mut v = v;
        v.sort_unstable();
        v.iter().map(|s| (*s).to_owned()).collect::<Vec<_>>()
    };
    let our_ids = ids(ours.iter().map(|p| p.id.as_str()).collect());
    let their_ids = ids(theirs.iter().map(|p| p["id"].as_str().unwrap()).collect());
    let missing: Vec<_> = their_ids.iter().filter(|i| !our_ids.contains(i)).collect();
    let extra: Vec<_> = our_ids.iter().filter(|i| !their_ids.contains(i)).collect();
    assert!(missing.is_empty() && extra.is_empty(), "missing {missing:?}, extra {extra:?}");
    for p in &ours {
        let t = theirs.iter().find(|t| t["id"] == p.id.as_str()).unwrap();
        assert_eq!(p.name, t["name"].as_str().unwrap(), "{}", p.id);
        assert_eq!(p.publisher, t["publisher"].as_str().unwrap(), "{}", p.id);
        assert_eq!(p.version, t["version"].as_str().unwrap(), "{}", p.id);
        assert_eq!(p.install_location.as_deref(), t["installLocation"].as_str(), "{}", p.id);
        assert_eq!(p.architecture.map(|a| a.label()), t["architecture"].as_str(), "{}", p.id);
        assert_eq!(p.install_date.as_deref(), t["installDate"].as_str(), "{}", p.id);
    }
}
```


- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3: Implement.**

**Create `native/crates/prune-core/src/programs/store.rs`:**

```rust
//! Microsoft Store apps, which the uninstall registry does not list at all
//! (`services/storeApps.js`): 85 of them on the machine this was written on,
//! 6 GB, invisible to every registry-only uninstaller.
//!
//! The list comes from WinRT's `PackageManager` instead of a `Get-AppxPackage`
//! PowerShell process. One thing has no API: whether Windows lets a package
//! be removed (`NonRemovable`) is not on `Windows.ApplicationModel.Package` or
//! `PackageManager`, so that single flag is read with one PowerShell call that
//! lists nothing else and is merged in when it arrives.

use std::collections::HashMap;

use super::model::{Arch, Program, Source};

/// A readable name for a Store package. The manifest's DisplayName is right
/// when it is a real name; it is often a resource reference
/// (`ms-resource:AppName`) that would need the package's resource map, so the
/// package identity is used instead ("XboxGameOverlay" becomes "Xbox Game
/// Overlay"; a capital only starts a word after a lowercase letter or digit).
pub fn friendly_store_name(display_name: &str, package_name: &str) -> Option<String> {
    let declared = display_name.trim();
    if !declared.is_empty() && !declared.to_lowercase().starts_with("ms-resource:") {
        return Some(declared.to_owned());
    }
    let last = package_name.trim().rsplit('.').next().filter(|l| !l.is_empty())?;
    let mut out = String::with_capacity(last.len() + 4);
    let mut prev: Option<char> = None;
    for ch in last.chars() {
        if ch.is_ascii_uppercase() && prev.is_some_and(|p| p.is_ascii_lowercase() || p.is_ascii_digit()) {
            out.push(' ');
        }
        out.push(ch);
        prev = Some(ch);
    }
    let out = out.trim().to_owned();
    (!out.is_empty()).then_some(out)
}

/// The company out of a certificate subject: only the CN is a name a person
/// would recognise ("CN=Realtek Semiconductor Corp, O=Realtek, L=Hsinchu").
pub fn publisher_from_dn(publisher: &str) -> Option<String> {
    let value = publisher.trim();
    if value.is_empty() {
        return None;
    }
    let lower = value.to_lowercase();
    if let Some(at) = lower.find("cn=") {
        let rest = &value[at + 3..];
        let name = if let Some(quoted) = rest.strip_prefix('"') {
            quoted.split('"').next().unwrap_or("")
        } else {
            rest.split(',').next().unwrap_or("")
        };
        return Some(name.trim().to_owned()).filter(|n| !n.is_empty());
    }
    Some(value.to_owned())
}

/// The manifest's `<Properties><DisplayName>`, control characters (one
/// package has a newline in it) turned into spaces.
pub fn manifest_display_name(xml: &str) -> String {
    let lower = xml.to_lowercase();
    let Some(props) = lower.find("<properties>") else { return String::new() };
    let Some(open) = lower[props..].find("<displayname>") else { return String::new() };
    let start = props + open + "<displayname>".len();
    let Some(len) = lower[start..].find("</displayname>") else { return String::new() };
    let text = xml[start..start + len]
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&apos;", "'");
    text.chars().map(|c| if (c as u32) < 0x20 { ' ' } else { c }).collect::<String>().trim().to_owned()
}

/// The architecture in the registry rows' words, so the Type column reads
/// the same whichever list a row came from. `Neutral` genuinely has none.
pub fn architecture_of(processor: &str) -> Option<Arch> {
    match processor.to_lowercase().as_str() {
        "x64" | "arm64" => Some(Arch::Bits64),
        "x86" | "arm" => Some(Arch::Bits32),
        _ => None,
    }
}

/// What one package gives, before it is a row.
#[derive(Debug, Clone, Default)]
pub struct RawPackage {
    pub name: String,
    pub package_full_name: String,
    pub publisher: String,
    pub version: String,
    pub install_location: String,
    pub display_name: String,
    pub architecture: String,
    pub size_bytes: Option<u64>,
    pub install_date: Option<String>,
}

pub fn normalize_store_app(raw: &RawPackage) -> Option<Program> {
    if raw.package_full_name.is_empty() {
        return None;
    }
    let name = friendly_store_name(&raw.display_name, &raw.name)?;
    Some(Program {
        // Prefixed so a package can never collide with a registry key name,
        // and keyed on the full name: two versions are two installs.
        id: format!("store:{}", raw.package_full_name),
        name,
        publisher: publisher_from_dn(&raw.publisher).unwrap_or_else(|| "Unknown Publisher".to_owned()),
        version: raw.version.clone(),
        install_location: Some(raw.install_location.clone()).filter(|l| !l.is_empty()),
        // Zero would read as "this app is free"; a folder that could not be
        // opened has no known size.
        size_bytes: raw.size_bytes.filter(|s| *s > 0),
        architecture: architecture_of(&raw.architecture),
        install_date_approximate: raw.install_date.is_some(),
        install_date: raw.install_date.clone(),
        package_full_name: Some(raw.package_full_name.clone()),
        package_name: Some(raw.name.clone()).filter(|n| !n.is_empty()),
        source: Source::Store,
        ..Program::default()
    })
}

/// Every Store app installed for this user, unmeasured. Frameworks and
/// system packages are left out in the query: a framework is a shared runtime
/// nobody installed on purpose, and the system packages are Windows itself.
#[cfg(windows)]
pub fn read_packages() -> Vec<RawPackage> {
    use windows::ApplicationModel::PackageSignatureKind;
    use windows::Management::Deployment::PackageManager;
    use windows::Win32::System::WinRT::{RO_INIT_MULTITHREADED, RoInitialize};
    use windows::core::HSTRING;

    // SAFETY: initializes WinRT for this thread; a repeat call is harmless.
    unsafe {
        let _ = RoInitialize(RO_INIT_MULTITHREADED);
    }
    let Ok(manager) = PackageManager::new() else { return Vec::new() };
    // The empty user id means the current user, which needs no elevation.
    let Ok(packages) = manager.FindPackagesByUserSecurityId(&HSTRING::new()) else { return Vec::new() };
    let mut found = Vec::new();
    for package in packages {
        let read = || -> windows::core::Result<Option<RawPackage>> {
            if package.IsFramework()? || package.SignatureKind()? == PackageSignatureKind::System {
                return Ok(None);
            }
            let location = package.InstalledPath()?.to_string();
            if location.is_empty() {
                return Ok(None);
            }
            let id = package.Id()?;
            let v = id.Version()?;
            let manifest = std::fs::read_to_string(std::path::Path::new(&location).join("AppxManifest.xml")).unwrap_or_default();
            let created = std::fs::symlink_metadata(&location).and_then(|m| m.created()).ok();
            Ok(Some(RawPackage {
                name: id.Name()?.to_string(),
                package_full_name: id.FullName()?.to_string(),
                publisher: id.Publisher()?.to_string(),
                version: format!("{}.{}.{}.{}", v.Major, v.Minor, v.Build, v.Revision),
                display_name: manifest_display_name(&manifest),
                architecture: match id.Architecture()?.0 {
                    9 => "X64",
                    12 => "Arm64",
                    0 => "X86",
                    5 => "Arm",
                    _ => "Neutral",
                }
                .to_owned(),
                install_date: created.and_then(super::dates::system_time_to_ticks).and_then(super::dates::filetime_to_local_date),
                install_location: location,
                size_bytes: None,
            }))
        };
        if let Ok(Some(raw)) = read() {
            found.push(raw);
        }
    }
    found
}

#[cfg(not(windows))]
pub fn read_packages() -> Vec<RawPackage> {
    Vec::new()
}

/// Measures every package folder. WindowsApps is ACL-restricted but
/// readable unelevated on the dev machine; where it is not, the app reports
/// no size rather than zero.
pub fn measure_packages(packages: &mut [RawPackage]) {
    #[cfg(windows)]
    {
        let jobs: Vec<(String, Vec<String>)> = packages.iter().map(|p| (p.install_location.clone(), Vec::new())).collect();
        for (package, bytes) in packages.iter_mut().zip(super::walk::measure_many(&jobs)) {
            package.size_bytes = Some(bytes).filter(|b| *b > 0);
        }
    }
    #[cfg(not(windows))]
    let _ = packages;
}

/// The Store rows, measured. Empty when WinRT cannot answer, which on a
/// machine with the Appx stack disabled is not worth breaking the list over.
pub fn list_store_apps() -> Vec<Program> {
    let mut packages = read_packages();
    measure_packages(&mut packages);
    packages.iter().filter_map(normalize_store_app).collect()
}

/// `{ packageFullName: nonRemovable }`, from the one PowerShell call this
/// module makes. Empty when it fails: an unknown flag reads as "not removable".
pub fn read_non_removable() -> HashMap<String, bool> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let script = "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; \
                      ConvertTo-Json -Compress -InputObject @(Get-AppxPackage | ForEach-Object { [PSCustomObject]@{ n = [string]$_.PackageFullName; r = [bool]$_.NonRemovable } })";
        let output = std::process::Command::new("powershell.exe")
            .args(["-NoProfile", "-NonInteractive", "-Command", script])
            .env_remove("PSModulePath")
            .creation_flags(CREATE_NO_WINDOW)
            .output();
        let Some(output) = output.ok().filter(|o| o.status.success()) else { return HashMap::new() };
        return parse_non_removable(&String::from_utf8_lossy(&output.stdout));
    }
    #[cfg(not(windows))]
    HashMap::new()
}

/// The answer of [`read_non_removable`]'s script.
pub fn parse_non_removable(json: &str) -> HashMap<String, bool> {
    let Ok(value) = serde_json::from_str::<serde_json::Value>(json.trim()) else { return HashMap::new() };
    let list = match value {
        serde_json::Value::Array(a) => a,
        other => vec![other],
    };
    list.iter().filter_map(|row| Some((row["n"].as_str()?.to_owned(), row["r"].as_bool()?))).collect()
}
```


`programs/mod.rs` gains `pub mod store;`.

- [ ] **Step 4:** `PRUNE_3X_DIR=<folder> cargo test -p prune-core --test programs_store`. Expected: 6 passed; all 85 Store apps present with 3.x's name, publisher, version, location, architecture and date.
- [ ] **Step 5: Commit** `feat(native): Store apps through WinRT's PackageManager`

### Task 8: Chocolatey packages and browser extensions

**Files:**
- Create: `native/crates/prune-core/src/programs/chocolatey.rs`, `native/crates/prune-core/src/programs/extensions.rs`
- Modify: `native/crates/prune-core/src/programs/mod.rs`
- Test: `native/crates/prune-core/tests/programs_sources.rs`

**Interfaces:**
- Produces: `chocolatey::{chocolatey_root, parse_nuspec, parse_registry_snapshot, canonical_key_path, read_packages, chocolatey_rows, managed_programs, Package, Nuspec}`; `extensions::{resolve_extension_name, newest_version_dir, parse_profiles_ini, normalize_firefox_addon, list_browser_extensions}`.
- Plain file reads, no `choco` process. A package with a real installer already has an Add/Remove row: it is only tagged (`chocolatey_id`, found by the `.registry` snapshot's key). Only packages with no entry become rows. Extensions: Brave, Chrome, Edge, Vivaldi, Opera (Chromium: `Default` and `Profile N`, newest version folder, `__MSG_x__` names resolved through `_locales`, every version folder counted in the size) and the Gecko browsers (never run against a real profile in 3.x either, so it fails closed). Largest first.

- [ ] **Step 1: Write the tests.**

**Create `native/crates/prune-core/tests/programs_sources.rs`:**

```rust
//! Chocolatey and browser extensions, ported from 3.x's chocolateyApps.test.js,
//! browserExtensions.test.js and firefoxExtensions.test.js, and checked
//! against what 3.x returned on the same machine.

use std::path::{Path, PathBuf};

use prune_core::programs::chocolatey::*;
use prune_core::programs::extensions::*;
use prune_core::programs::model::Program;
use serde_json::json;

const NUSPEC: &str = "<?xml version=\"1.0\"?><package><metadata><id>python314</id><version>3.14.0</version>\
<title>Python 3.14</title><authors>Python Software Foundation &amp; friends</authors><summary><![CDATA[A <b>language</b>]]></summary></metadata></package>";

#[test]
fn a_nuspec_gives_the_fields_the_list_uses() {
    let n = parse_nuspec(NUSPEC).unwrap();
    assert_eq!((n.id.as_str(), n.version.as_str(), n.title.as_str()), ("python314", "3.14.0", "Python 3.14"));
    assert_eq!(n.authors, "Python Software Foundation & friends");
    assert_eq!(n.summary, "A <b>language</b>");
    assert!(parse_nuspec("<package/>").is_none());
    assert!(parse_nuspec("<metadata><version>1</version></metadata>").is_none());
}

#[test]
fn registry_snapshots_and_key_spellings() {
    let keys = parse_registry_snapshot("<k><KeyPath>HKEY_LOCAL_MACHINE\\SOFTWARE\\X</KeyPath></k><KeyPath>HKLM:\\Y</KeyPath>");
    assert_eq!(keys, [r"HKEY_LOCAL_MACHINE\SOFTWARE\X", r"HKLM:\Y"]);
    assert_eq!(canonical_key_path(r"HKEY_LOCAL_MACHINE\SOFTWARE\X"), canonical_key_path("hklm:/software//x/"));
    assert_eq!(canonical_key_path(r"HKCU:\a"), r"HKCU\A");
}

fn package(id: &str, keys: &[&str]) -> Package {
    Package {
        meta: Nuspec { id: id.into(), version: "1.0".into(), title: String::new(), authors: "me".into(), summary: String::new() },
        folder: format!(r"C:\ProgramData\chocolatey\lib\{id}"),
        size_bytes: 42,
        registry_keys: keys.iter().map(|k| (*k).to_owned()).collect(),
    }
}

#[test]
fn only_packages_without_an_add_remove_entry_get_rows_and_the_rest_are_tagged() {
    let packages = [package("oscdimg", &[]), package("python314", &[r"HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{GUID}"])];
    let rows = chocolatey_rows(&packages);
    assert_eq!(rows.len(), 1);
    assert_eq!((rows[0].id.as_str(), rows[0].name.as_str(), rows[0].chocolatey_id.as_deref()), ("chocolatey:oscdimg", "oscdimg", Some("oscdimg")));

    let installed = Program {
        id: "{GUID}".into(),
        registry_key: Some(r"HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{GUID}".into()),
        ..Program::default()
    };
    let other = Program { id: "x".into(), registry_key: Some(r"HKLM:\other".into()), ..Program::default() };
    let managed = managed_programs(&packages, &[installed, other]);
    assert_eq!(managed.len(), 1);
    assert_eq!(managed["{GUID}"], "python314");
}

#[test]
fn extension_names_resolve_through_the_locale_messages() {
    let messages = json!({"extName": {"message": " uBlock Origin "}});
    assert_eq!(resolve_extension_name("__MSG_extName__", Some(&messages)).as_deref(), Some("uBlock Origin"));
    assert_eq!(resolve_extension_name("__MSG_EXTNAME__", Some(&messages)).as_deref(), Some("uBlock Origin"));
    assert_eq!(resolve_extension_name("__MSG_missing__", Some(&messages)), None);
    assert_eq!(resolve_extension_name("__MSG_x__", None), None);
    assert_eq!(resolve_extension_name(" Plain ", None).as_deref(), Some("Plain"));
    assert_eq!(resolve_extension_name("  ", None), None);
}

#[test]
fn the_newest_version_folder_is_compared_numerically() {
    let v = |names: &[&str]| newest_version_dir(&names.iter().map(|s| (*s).to_owned()).collect::<Vec<_>>());
    assert_eq!(v(&["1.0.9_0", "1.0.10_0", "1.0.2_0"]).as_deref(), Some("1.0.10_0"));
    assert_eq!(v(&[]), None);
}

#[test]
fn profiles_ini_relative_and_absolute() {
    let ini = "[Profile0]\nName=default\nIsRelative=1\nPath=Profiles/abc.default\n\n[Profile1]\nIsRelative=0\nPath=D:/Moved/profile\n\n[General]\nStartWithLastProfile=1";
    let base = Path::new(r"C:\Users\u\AppData\Roaming\Mozilla\Firefox");
    assert_eq!(parse_profiles_ini(ini, base), [base.join(r"Profiles\abc.default"), PathBuf::from(r"D:\Moved\profile")]);
}

#[test]
fn only_user_installed_extensions_with_the_fields_a_row_needs() {
    let ok = json!({"id":"a@b","location":"app-profile","type":"extension","defaultLocale":{"name":"Add-on"},"version":"2","active":true});
    let (id, name, version, path, enabled) = normalize_firefox_addon(&ok).unwrap();
    assert_eq!((id.as_str(), name.as_str(), version.as_str(), path, enabled), ("a@b", "Add-on", "2", None, true));
    assert!(normalize_firefox_addon(&json!({"id":"a","location":"app-builtin","defaultLocale":{"name":"x"}})).is_none());
    assert!(normalize_firefox_addon(&json!({"id":"a","location":"app-profile","type":"theme","defaultLocale":{"name":"x"}})).is_none());
    assert!(normalize_firefox_addon(&json!({"id":"a","location":"app-profile"})).is_none());
    assert!(!normalize_firefox_addon(&json!({"id":"a","location":"app-profile","defaultLocale":{"name":"x"},"userDisabled":true})).unwrap().4);
}

#[cfg(windows)]
#[test]
fn matches_3x_on_this_machine() {
    let Some(dir) = std::env::var_os("PRUNE_3X_DIR").map(PathBuf::from) else { return };
    let read = |f: &str| -> serde_json::Value { serde_json::from_slice(&std::fs::read(dir.join(f)).unwrap()).unwrap() };

    let packages = read_packages(&chocolatey_root());
    let rows = chocolatey_rows(&packages);
    let theirs = read("chocolatey.json");
    let mut ours: Vec<&str> = rows.iter().map(|r| r.id.as_str()).collect();
    let mut want: Vec<&str> = theirs["apps"].as_array().unwrap().iter().map(|r| r["id"].as_str().unwrap()).collect();
    ours.sort_unstable();
    want.sort_unstable();
    assert_eq!(ours, want, "the same package-only rows");
    let managed = managed_programs(&packages, &prune_core::programs::registry::list_installed_programs());
    assert_eq!(managed.len(), theirs["managed"].as_object().unwrap().len());

    let extensions = list_browser_extensions();
    let theirs = read("extensions.json");
    let want = theirs["extensions"].as_array().unwrap();
    assert_eq!(extensions.len(), want.len());
    for t in want {
        let e = extensions.iter().find(|e| e.id == t["id"].as_str().unwrap()).unwrap_or_else(|| panic!("{} missing", t["id"]));
        assert_eq!(e.name, t["name"].as_str().unwrap());
        assert_eq!(e.version, t["version"].as_str().unwrap());
        assert_eq!(e.browser.as_deref(), t["browser"].as_str());
        assert_eq!(e.install_location.as_deref(), t["installLocation"].as_str());
    }
    let sizes: Vec<_> = extensions.iter().map(|e| e.size_bytes.unwrap_or(0)).collect();
    assert!(sizes.windows(2).all(|w| w[0] >= w[1]), "largest first");
}
```


- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3: Implement.**

**Create `native/crates/prune-core/src/programs/chocolatey.rs`:**

```rust
//! Chocolatey packages, read straight from Chocolatey's own folder
//! (`services/chocolateyApps.js`).
//!
//! A package that ran a real installer leaves a normal Add/Remove entry the
//! list already shows, and Chocolatey records which one in
//! `.chocolatey\<id>.<version>\.registry`: those entries are only tagged as
//! Chocolatey's. Every other package (metapackages, extensions, shims,
//! portable tools) has no entry at all and becomes a row of its own. Plain
//! file reads, no `choco` process: listing must work without starting it.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use super::model::{Program, Source};

pub fn chocolatey_root() -> PathBuf {
    if let Some(root) = std::env::var_os("ChocolateyInstall").filter(|r| !r.is_empty()) {
        return PathBuf::from(root);
    }
    Path::new(&std::env::var("ProgramData").unwrap_or_else(|_| r"C:\ProgramData".to_owned())).join("chocolatey")
}

fn decode(text: &str) -> String {
    let mut out = text.to_owned();
    while let Some(start) = out.find("<![CDATA[") {
        let Some(len) = out[start..].find("]]>") else { break };
        let inner = out[start + 9..start + len].to_owned();
        out.replace_range(start..start + len + 3, &inner);
    }
    out.replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"").replace("&apos;", "'").replace("&amp;", "&").trim().to_owned()
}

fn tag(xml: &str, name: &str) -> String {
    let lower = xml.to_lowercase();
    let (open, close) = (format!("<{name}>"), format!("</{name}>"));
    let Some(start) = lower.find(&open) else { return String::new() };
    let start = start + open.len();
    lower[start..].find(&close).map(|len| decode(&xml[start..start + len])).unwrap_or_default()
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Nuspec {
    pub id: String,
    pub version: String,
    pub title: String,
    pub authors: String,
    pub summary: String,
}

/// The fields of a `.nuspec` the list uses, or `None` when it is not one.
pub fn parse_nuspec(xml: &str) -> Option<Nuspec> {
    if !xml.to_lowercase().contains("<metadata>") {
        return None;
    }
    let id = tag(xml, "id");
    (!id.is_empty()).then(|| Nuspec { id, version: tag(xml, "version"), title: tag(xml, "title"), authors: tag(xml, "authors"), summary: tag(xml, "summary") })
}

/// The uninstall-key paths in a `.registry` snapshot.
pub fn parse_registry_snapshot(xml: &str) -> Vec<String> {
    let lower = xml.to_lowercase();
    let mut keys = Vec::new();
    let mut from = 0;
    while let Some(at) = lower[from..].find("<keypath>") {
        let start = from + at + "<keypath>".len();
        let Some(len) = lower[start..].find("</keypath>") else { break };
        let key = decode(&xml[start..start + len]);
        if !key.is_empty() {
            keys.push(key);
        }
        from = start + len;
    }
    keys
}

/// A registry key path in one comparable spelling: `HKLM`/`HKEY_LOCAL_MACHINE`,
/// with or without a colon, any slash, any case (`canonicalKeyPath`).
pub fn canonical_key_path(path: &str) -> String {
    let collapsed: String = {
        let mut out = String::new();
        let mut last_sep = false;
        for c in path.trim().chars() {
            let sep = c == '\\' || c == '/';
            if sep && last_sep {
                continue;
            }
            out.push(if sep { '\\' } else { c });
            last_sep = sep;
        }
        out.trim_end_matches('\\').to_owned()
    };
    let upper = collapsed.to_uppercase();
    for (long, short) in [("HKEY_LOCAL_MACHINE", "HKLM"), ("HKEY_CURRENT_USER", "HKCU"), ("HKEY_CLASSES_ROOT", "HKCR"), ("HKEY_USERS", "HKU"), ("HKEY_CURRENT_CONFIG", "HKCC")] {
        if let Some(rest) = upper.strip_prefix(long) {
            return format!("{short}{}", rest.trim_start_matches(':'));
        }
    }
    for short in ["HKLM", "HKCU", "HKCR", "HKU", "HKCC"] {
        if let Some(rest) = upper.strip_prefix(short) {
            return format!("{short}{}", rest.trim_start_matches(':'));
        }
    }
    upper
}

#[derive(Debug, Clone, Default)]
pub struct Package {
    pub meta: Nuspec,
    pub folder: String,
    pub size_bytes: u64,
    pub registry_keys: Vec<String>,
}

/// Every installed package. Empty when Chocolatey is not there.
pub fn read_packages(root: &Path) -> Vec<Package> {
    let Ok(dirs) = std::fs::read_dir(root.join("lib")) else { return Vec::new() };
    let mut packages = Vec::new();
    for dir in dirs.flatten().filter(|d| d.file_type().is_ok_and(|t| t.is_dir())) {
        let folder = dir.path();
        let nuspec = std::fs::read_dir(&folder).ok().and_then(|entries| {
            entries.flatten().find(|e| e.file_name().to_string_lossy().to_lowercase().ends_with(".nuspec"))
        });
        let Some(meta) = nuspec.and_then(|f| std::fs::read_to_string(f.path()).ok()).and_then(|t| parse_nuspec(&t)) else { continue };
        let registry_keys = std::fs::read_to_string(root.join(".chocolatey").join(format!("{}.{}", meta.id, meta.version)).join(".registry"))
            .map(|t| parse_registry_snapshot(&t))
            .unwrap_or_default();
        let folder_text = folder.to_string_lossy().into_owned();
        #[cfg(windows)]
        let size_bytes = super::walk::measure_directory(&folder_text, 200_000, std::time::Duration::from_secs(8));
        #[cfg(not(windows))]
        let size_bytes = 0;
        packages.push(Package { meta, folder: folder_text, size_bytes, registry_keys });
    }
    packages
}

/// The packages with no Add/Remove entry of their own, as rows.
pub fn chocolatey_rows(packages: &[Package]) -> Vec<Program> {
    packages
        .iter()
        .filter(|p| p.registry_keys.is_empty())
        .map(|p| Program {
            // Prefixed like the Store rows, so an id never collides with a registry key name.
            id: format!("chocolatey:{}", p.meta.id),
            name: if p.meta.title.is_empty() { p.meta.id.clone() } else { p.meta.title.clone() },
            publisher: p.meta.authors.clone(),
            version: p.meta.version.clone(),
            install_location: Some(p.folder.clone()),
            size_bytes: Some(p.size_bytes),
            chocolatey_id: Some(p.meta.id.clone()),
            source: Source::Chocolatey,
            ..Program::default()
        })
        .collect()
}

/// `{ programId: packageId }` for every listed program a package installed,
/// matched on the Add/Remove key Chocolatey recorded for it.
pub fn managed_programs(packages: &[Package], programs: &[Program]) -> HashMap<String, String> {
    let by_key: HashMap<String, &str> = packages
        .iter()
        .flat_map(|p| p.registry_keys.iter().map(move |k| (canonical_key_path(k), p.meta.id.as_str())))
        .collect();
    programs
        .iter()
        .filter_map(|p| Some((p.id.clone(), (*by_key.get(&canonical_key_path(p.registry_key.as_deref()?))?).to_owned())))
        .collect()
}
```


**Create `native/crates/prune-core/src/programs/extensions.rs`:**

```rust
//! Browser extensions, which no uninstall list mentions anywhere
//! (`services/browserExtensions.js`, `firefoxExtensions.js`): 33 of them on
//! the machine this was written on. Pure filesystem work.

use std::path::{Path, PathBuf};

use serde_json::Value;

use super::model::{Program, Source};

/// The Chromium-family browsers. All store extensions identically:
/// `<User Data>\<Profile>\Extensions\<id>\<version>\manifest.json`.
const CHROMIUM: [(&str, &str, &str, &str); 5] = [
    ("brave", "Brave", "LOCALAPPDATA", r"BraveSoftware\Brave-Browser\User Data"),
    ("chrome", "Chrome", "LOCALAPPDATA", r"Google\Chrome\User Data"),
    ("edge", "Edge", "LOCALAPPDATA", r"Microsoft\Edge\User Data"),
    ("vivaldi", "Vivaldi", "LOCALAPPDATA", r"Vivaldi\User Data"),
    ("opera", "Opera", "APPDATA", r"Opera Software\Opera Stable"),
];

/// The Gecko browsers keep one JSON index per profile instead of a folder per
/// extension. 3.x's reader for these was never run against a real profile
/// (none existed on its machine), so it fails closed: anything that does not
/// match what is expected is dropped, never guessed at.
const GECKO: [(&str, &str, &str, &str); 5] = [
    ("firefox", "Firefox", "APPDATA", r"Mozilla\Firefox"),
    ("librewolf", "LibreWolf", "APPDATA", "LibreWolf"),
    ("waterfox", "Waterfox", "APPDATA", "Waterfox"),
    ("zen", "Zen", "APPDATA", "zen"),
    ("seamonkey", "SeaMonkey", "APPDATA", r"Mozilla\SeaMonkey"),
];

/// Shipped by the browser itself: nobody chose them and they cannot be removed.
const BUILT_IN: [&str; 2] = ["nmmhkkegccagdldgiimedpiccmgmieda", "pkedcjkdefgpdelpbcmbmeomcjbeemfm"];

/// Resolves a manifest name that points at a localised string
/// (`__MSG_extName__`); message keys are case-insensitive in Chromium.
pub fn resolve_extension_name(raw_name: &str, messages: Option<&Value>) -> Option<String> {
    let name = raw_name.trim();
    let Some(key) = name.strip_prefix("__MSG_").and_then(|n| n.strip_suffix("__")) else {
        return Some(name.to_owned()).filter(|n| !n.is_empty());
    };
    let messages = messages?.as_object()?;
    let found = messages.get(key).or_else(|| messages.get(&key.to_lowercase())).or_else(|| messages.iter().find(|(k, _)| k.eq_ignore_ascii_case(key)).map(|(_, v)| v));
    found?["message"].as_str().map(str::trim).filter(|m| !m.is_empty()).map(str::to_owned)
}

/// Compared numerically per segment, or "1.0.10" sorts below "1.0.9".
fn compare_versions(a: &str, b: &str) -> std::cmp::Ordering {
    let seg = |s: &str| s.split(['.', '_']).map(|p| p.parse::<i64>().unwrap_or(0)).collect::<Vec<_>>();
    let (x, y) = (seg(a), seg(b));
    (0..x.len().max(y.len())).map(|i| x.get(i).unwrap_or(&0).cmp(y.get(i).unwrap_or(&0))).find(|o| o.is_ne()).unwrap_or(std::cmp::Ordering::Equal)
}

/// The newest version folder: an extension keeps old versions beside the
/// current one after an update.
pub fn newest_version_dir(names: &[String]) -> Option<String> {
    names.iter().filter(|n| !n.is_empty()).max_by(|a, b| compare_versions(a, b)).cloned()
}

fn read_json(path: &Path) -> Option<Value> {
    serde_json::from_slice(&std::fs::read(path).ok()?).ok()
}

fn directories(path: &Path) -> Vec<String> {
    std::fs::read_dir(path)
        .map(|e| e.flatten().filter(|d| d.file_type().is_ok_and(|t| t.is_dir())).map(|d| d.file_name().to_string_lossy().into_owned()).collect())
        .unwrap_or_default()
}

fn folder_size(path: &Path) -> u64 {
    #[cfg(windows)]
    return super::walk::measure_folder(&path.to_string_lossy(), &[]);
    #[cfg(not(windows))]
    {
        let _ = path;
        0
    }
}

fn env_dir(var: &str) -> Option<PathBuf> {
    std::env::var_os(var).filter(|v| !v.is_empty()).map(PathBuf::from)
}

fn read_chromium_extension(browser: (&str, &str), profile: &str, extension_id: &str, extensions_dir: &Path) -> Option<Program> {
    let folder = extensions_dir.join(extension_id);
    let version_dir = newest_version_dir(&directories(&folder))?;
    let root = folder.join(&version_dir);
    let manifest = read_json(&root.join("manifest.json"))?;
    let raw_name = manifest["name"].as_str()?;
    let name = if raw_name.starts_with("__MSG_") {
        let locale = manifest["default_locale"].as_str().unwrap_or("en");
        resolve_extension_name(raw_name, read_json(&root.join("_locales").join(locale).join("messages.json")).as_ref())
    } else {
        resolve_extension_name(raw_name, None)
    }?;
    Some(Program {
        id: format!("extension:{}:{profile}:{extension_id}", browser.0),
        name,
        version: manifest["version"].as_str().unwrap_or("").to_owned(),
        browser: Some(browser.1.to_owned()),
        extension_id: Some(extension_id.to_owned()),
        // Every version folder, not just the newest: the old ones are still on disk.
        size_bytes: Some(folder_size(&folder)),
        install_location: Some(folder.to_string_lossy().into_owned()),
        source: Source::Extension,
        ..Program::default()
    })
}

/// Profile directories named in a `profiles.ini`: `[ProfileN]` sections with
/// `Path=` and `IsRelative=`. Gecko writes forward slashes even on Windows.
pub fn parse_profiles_ini(text: &str, base: &Path) -> Vec<PathBuf> {
    let (mut profiles, mut path, mut relative): (Vec<PathBuf>, Option<String>, bool) = (Vec::new(), None, true);
    let flush = |path: &mut Option<String>, relative: &mut bool, profiles: &mut Vec<PathBuf>| {
        if let Some(p) = path.take() {
            let candidate = PathBuf::from(&p);
            profiles.push(if *relative && !candidate.is_absolute() { base.join(p) } else { candidate });
        }
        *relative = true;
    };
    for line in text.lines().map(str::trim) {
        if line.starts_with('[') {
            flush(&mut path, &mut relative, &mut profiles);
        } else if let Some((key, value)) = line.split_once('=') {
            match key.trim().to_lowercase().as_str() {
                "path" => path = Some(value.trim().replace('/', "\\")),
                "isrelative" => relative = value.trim() != "0",
                _ => {}
            }
        }
    }
    flush(&mut path, &mut relative, &mut profiles);
    profiles
}

/// One add-on from `extensions.json`, or `None`: it needs an id, a user
/// install location and a name, and themes, dictionaries and language packs
/// are not extensions.
pub fn normalize_firefox_addon(raw: &Value) -> Option<(String, String, String, Option<String>, bool)> {
    if raw["location"].as_str()? != "app-profile" {
        return None;
    }
    if raw["type"].as_str().is_some_and(|t| t != "extension") {
        return None;
    }
    let id = raw["id"].as_str()?.trim().to_owned();
    let name = raw["defaultLocale"]["name"].as_str()?.trim().to_owned();
    if id.is_empty() || name.is_empty() {
        return None;
    }
    let version = raw["version"].as_str().unwrap_or("").to_owned();
    let path = raw["path"].as_str().filter(|p| !p.is_empty()).map(str::to_owned);
    // A disabled add-on is still installed and still on disk.
    let enabled = raw["active"].as_bool() != Some(false) && raw["userDisabled"].as_bool() != Some(true);
    Some((id, name, version, path, enabled))
}

fn read_firefox_extensions() -> Vec<Program> {
    let mut found = Vec::new();
    for (id, name, var, rel) in GECKO {
        let Some(base) = env_dir(var).map(|b| b.join(rel)) else { continue };
        let mut profiles = std::fs::read_to_string(base.join("profiles.ini")).map(|t| parse_profiles_ini(&t, &base)).unwrap_or_default();
        if profiles.is_empty() {
            profiles = directories(&base.join("Profiles")).into_iter().map(|d| base.join("Profiles").join(d)).collect();
        }
        for profile in profiles {
            let index = read_json(&profile.join("extensions.json"));
            for raw in index.as_ref().and_then(|i| i["addons"].as_array()).into_iter().flatten() {
                let Some((addon_id, addon_name, version, path, enabled)) = normalize_firefox_addon(raw) else { continue };
                let location = path.map_or_else(|| profile.join("extensions").join(format!("{addon_id}.xpi")), PathBuf::from);
                let size = if location.is_file() { std::fs::metadata(&location).map_or(0, |m| m.len()) } else { folder_size(&location) };
                found.push(Program {
                    id: format!("extension:{id}:{}:{addon_id}", profile.to_string_lossy()),
                    name: addon_name,
                    version,
                    browser: Some(name.to_owned()),
                    extension_id: Some(addon_id),
                    enabled: Some(enabled),
                    size_bytes: Some(size),
                    install_location: Some(location.to_string_lossy().into_owned()),
                    source: Source::Extension,
                    ..Program::default()
                });
            }
        }
    }
    found
}

/// Every extension in every browser found, largest first. Empty when none
/// are installed, which is not an error.
pub fn list_browser_extensions() -> Vec<Program> {
    let mut found = Vec::new();
    for (id, name, var, rel) in CHROMIUM {
        let Some(user_data) = env_dir(var).map(|b| b.join(rel)) else { continue };
        // "Default" plus "Profile 1", "Profile 2"; everything else is browser state.
        for profile in directories(&user_data).into_iter().filter(|n| n == "Default" || n.strip_prefix("Profile ").is_some_and(|d| !d.is_empty() && d.bytes().all(|b| b.is_ascii_digit()))) {
            let extensions_dir = user_data.join(&profile).join("Extensions");
            for extension_id in directories(&extensions_dir).into_iter().filter(|e| !BUILT_IN.contains(&e.as_str())) {
                found.extend(read_chromium_extension((id, name), &profile, &extension_id, &extensions_dir));
            }
        }
    }
    found.extend(read_firefox_extensions());
    found.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));
    found
}
```


`programs/mod.rs` gains `pub mod chocolatey;` and `pub mod extensions;`.

- [ ] **Step 4:** `PRUNE_3X_DIR=<folder> cargo test -p prune-core --test programs_sources`. Expected: 8 passed; the 18 package-only rows, 2 tagged programs and 33 extensions equal 3.x's.
- [ ] **Step 5: Commit** `feat(native): Chocolatey packages and browser extensions`

### Task 9: "Not registered" folders, path protection and the Running badge

**Files:**
- Create: `native/crates/prune-core/src/programs/protection.rs`, `native/crates/prune-core/src/programs/unregistered.rs`, `native/crates/prune-core/src/programs/running.rs`
- Modify: `native/crates/prune-core/src/programs/mod.rs`
- Test: `native/crates/prune-core/tests/programs_unregistered.rs`

**Interfaces:**
- Produces: `protection::{Env, os_component_refusal, anchor_root_from_command, footprints_of, build_footprints, footprint_refusal, permanent_deletion_refusal, is_at_or_under}` (2b's leftover scan and removal use the same functions between matching and the disk); `unregistered::{product_tokens, unregistered_roots, in_use_folders, msi_top_folders, unregistered_reason, Context, scan_unregistered_folders, read_machine_use, list_unregistered_programs}`; `running::{ProcessInfo, Running, list_process_paths, match_running_programs, owner_folders, running_programs}`.
- A first-level folder in Program Files (both) or `%LOCALAPPDATA%\Programs` is a "Not registered" program only if no installed program lives in it (footprints widen to the vendor folder), nothing running, scheduled, starting at sign-in or registered as a service or driver points into it, it is not Windows' or a shared container, Windows Installer does not track it (Python's 1 GB folder was once offered), its name does not look like part of an installed program (a four-letter shared run, or a distinctive word), and it holds an executable. If what the machine is using cannot be read, the list is empty rather than guessed: a driver's folder would be offered for removal.
- Running is matched by path, longest folder first (Warframe runs inside Steam's folder and must not read as "Steam is running"), and a folder shared by several programs' uninstallers belongs to none.
- One 3.x rule is deliberately not ported here: the crash-artifact exception in `osComponentRefusal` (a Prefetch trace, error report or dump named for a program). It only applies to files in three folders this list never looks at; 2b adds it with the leftover scan.

- [ ] **Step 1: Write the tests.**

**Create `native/crates/prune-core/tests/programs_unregistered.rs`:**

```rust
//! "Not registered" folders, the path protection they rest on, and the
//! running-program match, ported from 3.x's unregisteredFolders.test.js,
//! leftoverProtection.test.js and runningPrograms.test.js.

use std::collections::{HashMap, HashSet};

use prune_core::programs::model::{Program, Source};
use prune_core::programs::protection::*;
use prune_core::programs::running::*;
use prune_core::programs::unregistered::*;

fn env() -> Env {
    Env {
        system_root: Some(r"C:\Windows".into()),
        system_drive: Some("C:".into()),
        program_files: Some(r"C:\Program Files".into()),
        program_files_x86: Some(r"C:\Program Files (x86)".into()),
        program_data: Some(r"C:\ProgramData".into()),
        local_app_data: Some(r"C:\Users\u\AppData\Local".into()),
        app_data: Some(r"C:\Users\u\AppData\Roaming".into()),
        quarantine_root: Some(r"C:\Users\u\AppData\Roaming\Prune\quarantine".into()),
    }
}

#[test]
fn windows_and_the_microsoft_container_are_never_a_leftover() {
    let e = env();
    for (path, why) in [
        (r"C:\Windows\System32", "That is Windows itself."),
        (r"C:\Program Files\WindowsApps\X", "That belongs to Windows."),
        (r"C:\Program Files\Common Files\Microsoft Shared", "That is shared by many programs and by Windows."),
        (r"C:\Users\u\AppData\Local\Microsoft", "That folder holds data for every Microsoft program on this machine."),
        (r"C:\Users\u\AppData\Roaming\Microsoft\Crypto", "That belongs to Windows."),
        ("relative\\path", "Only a full path can be a leftover."),
    ] {
        assert_eq!(os_component_refusal(path, &e), Some(why), "{path}");
    }
    // A Microsoft PRODUCT is exactly what an uninstall of it leaves behind.
    assert_eq!(os_component_refusal(r"C:\Program Files\Microsoft Office", &e), None);
    assert_eq!(os_component_refusal(r"C:\Users\u\AppData\Local\Microsoft\VSCode", &e), None);
    assert_eq!(os_component_refusal(r"C:\Windows Kits\10", &e), Some("That belongs to Windows.").filter(|_| false));
}

#[test]
fn a_command_line_anchors_on_the_programs_own_folder() {
    let e = env();
    let anchor = |c: &str| anchor_root_from_command(c, &e);
    // Below a programs root: the first folder under it, not the deeper one.
    assert_eq!(anchor(r#""C:\Program Files\Vendor\App\bin\uninstall.exe" /S"#).as_deref(), Some(r"C:\Program Files\Vendor"));
    assert_eq!(anchor(r"C:\Program Files (x86)\Foo\unins000.exe /SILENT").as_deref(), Some(r"C:\Program Files (x86)\Foo"));
    assert_eq!(anchor(r"C:\Users\u\AppData\Local\Programs\Thing\app.exe,0").as_deref(), Some(r"C:\Users\u\AppData\Local\Programs\Thing"));
    // Anywhere else: the file's own folder.
    assert_eq!(anchor(r"D:\Games\Thing\u.exe -x").as_deref(), Some(r"D:\Games\Thing"));
    // Nothing a program owns.
    for none in [r"C:\Windows\System32\msiexec.exe /X{A}", r"C:\u.exe", r"C:\Program Files\Common Files\x\y.exe", r"C:\ProgramData\Package Cache\{g}\setup.exe", "winget uninstall", "", r"C:\Program Files\Microsoft\x.exe"] {
        assert_eq!(anchor(none), None, "{none:?}");
    }
}

#[test]
fn a_folder_holding_or_inside_another_installed_program_is_refused() {
    let e = env();
    let installed = Program { id: "p".into(), name: "Vendor App".into(), install_location: Some(r"C:\Program Files\Vendor".into()), ..Program::default() };
    let fps = build_footprints(&[installed], &e);
    assert_eq!(footprint_refusal(r"C:\Program Files\Vendor", &fps, false).as_deref(), Some("That is where Vendor App is installed."));
    assert!(footprint_refusal(r"C:\Program Files", &fps, false).is_some(), "a folder CONTAINING it");
    assert_eq!(footprint_refusal(r"C:\Program Files\Vendor\Sub", &fps, false).as_deref(), Some("That is inside the folder Vendor App is installed in."));
    assert_eq!(footprint_refusal(r"C:\Program Files\Vendor\Sub", &fps, true), None, "certain excuses 'inside', never 'is'");
    assert_eq!(footprint_refusal(r"C:\Program Files\Other", &fps, false), None);
}

#[test]
fn permanent_deletion_refuses_what_holds_everyones_but_not_one_programs_own() {
    let e = env();
    assert_eq!(permanent_deletion_refusal(r"C:\Program Files\OldTool", &e), None);
    for (path, why) in [
        (r"C:\Program Files", "That is where every installed program lives."),
        (r"C:\Program Files\Common Files", "Common Files is shared by many programs."),
        (r"C:\ProgramData", "That folder holds data for every program on this machine."),
        (r"C:\Users", "That is every user account on this machine."),
        (r"C:\Users\u", "That is a whole user profile."),
        (r"C:\Users\u\Documents", "That is one of your profile's own folders, not a program's."),
        (r"C:\Users\u\AppData\Roaming\Prune\quarantine\b1", "That holds Prune's own quarantine."),
        (r"C:\Users\u\AppData\Roaming\Prune", "That holds Prune's own quarantine."),
        (r"C:\Windows", "That is Windows itself."),
        (r"C:\", "That is a whole drive."),
        (r"C:\a\..\b", "Paths that climb out of themselves are refused."),
        ("a\\b", "Only a full path can be removed."),
    ] {
        assert_eq!(permanent_deletion_refusal(path, &e), Some(why), "{path}");
    }
}

#[test]
fn product_tokens_keep_distinctive_words_only() {
    assert_eq!(product_tokens(&["Adobe Photoshop 2026", "Adobe Inc."]), ["adobe", "photoshop"]);
    // "Team" from "Notepad++ Team" once matched Adobe's "Team Projects Local Hub".
    assert_eq!(product_tokens(&["Notepad++", "Notepad++ Team"]), ["notepad++"]);
    assert!(product_tokens(&["Microsoft Windows Runtime"]).is_empty());
}

fn program(name: &str, publisher: &str, location: &str) -> Program {
    Program { id: name.into(), name: name.into(), publisher: publisher.into(), install_location: Some(location.into()), ..Program::default() }
}

#[test]
fn which_folders_are_offered_as_not_registered() {
    let e = env();
    let programs = vec![program("MuMuPlayer", "Netease", r"C:\Program Files\MuMuPlayer")];
    let footprints = build_footprints(&programs, &e);
    let in_use = in_use_folders(&[r#""C:\Program Files\DriverThing\svc.exe" -k"#.to_owned(), "winget".to_owned()], &e);
    let msi = msi_top_folders(&[r"C:\Program Files\Python314\".to_owned(), r"C:\Windows\x\".to_owned()], &e);
    let ctx = Context { footprints: &footprints, in_use: &in_use, msi_folders: &msi, programs: &programs, env: &e };
    let reason = |d: &str| unregistered_reason(d, &ctx);

    assert_eq!(reason(r"C:\Program Files\OldTool"), None);
    assert_eq!(reason(r"C:\Program Files\Common Files").as_deref(), Some("That folder is shared by many programs or by Windows."));
    assert!(reason(r"C:\Program Files\MuMuPlayer").unwrap().contains("MuMuPlayer"));
    assert!(reason(r"C:\Program Files\DriverThing").unwrap().starts_with("Something running"));
    assert!(reason(r"C:\Program Files\Python314").unwrap().starts_with("Windows Installer tracks"));
    // A shared leading run of four letters, or a distinctive word.
    assert_eq!(reason(r"C:\Program Files\MuMuVMMVbox").as_deref(), Some("That folder looks like part of MuMuPlayer."));
}

#[test]
fn services_drivers_and_run_values_are_anchored_to_their_top_folder() {
    let e = env();
    let used = in_use_folders(&[r"C:\Program Files\Realtek\Audio\HDA\RtkAudUService64.exe".to_owned(), r"C:\Windows\system32\svchost.exe -k x".to_owned()], &e);
    assert_eq!(used, HashSet::from([r"c:\program files\realtek".to_owned()]));
}

fn proc(name: &str, path: &str) -> ProcessInfo {
    ProcessInfo { name: name.into(), path: path.into() }
}

#[test]
fn a_process_belongs_to_the_longest_folder_it_runs_from() {
    // Warframe runs from inside Steam's folder: it must not read as "Steam is running".
    let owners = vec![("steam".to_owned(), r"C:\Games\Steam".to_owned()), ("warframe".to_owned(), r"C:\Games\Steam\steamapps\common\Warframe".to_owned()), ("app".to_owned(), r"C:\Apps\App".to_owned())];
    let procs = [
        proc("Warframe.x64", r"C:\Games\Steam\steamapps\common\Warframe\Warframe.x64.exe"),
        proc("steam", r"C:\Games\Steam\steam.exe"),
        proc("brave", r"C:\Apps\App\brave.exe"),
        proc("brave", r"c:/apps/app/brave.exe"),
        proc("other", r"C:\Apps\App2\other.exe"),
    ];
    let running = match_running_programs(&procs, &owners);
    assert_eq!(running["warframe"], Running { count: 1, names: vec!["Warframe.x64".into()] });
    assert_eq!(running["steam"].count, 1);
    // Thirty processes of one name are one name.
    assert_eq!(running["app"], Running { count: 2, names: vec!["brave".into()] });
    // "C:\Apps\App2" is not inside "C:\Apps\App".
    assert_eq!(running.len(), 3);
}

#[test]
fn owner_folders_use_a_shared_uninstaller_folder_only_when_it_is_one_programs() {
    let steam = Program { id: "Steam".into(), name: "Steam".into(), uninstall_string: Some(r#""C:\Games\Steam\uninstall.exe""#.into()), ..Program::default() };
    let a = Program { id: "a".into(), name: "A".into(), uninstall_string: Some(r#""C:\Ubi\Launcher\u.exe""#.into()), ..Program::default() };
    let b = Program { id: "b".into(), name: "B".into(), uninstall_string: Some(r#""C:\Ubi\Launcher\u.exe""#.into()), ..Program::default() };
    let store = Program { id: "store:x".into(), name: "X".into(), source: Source::Store, install_location: Some(r"C:\Program Files\WindowsApps\X".into()), ..Program::default() };
    let owners = owner_folders(&[steam, a, b, store], &HashMap::new());
    let ids: Vec<&str> = owners.iter().map(|(i, _)| i.as_str()).collect();
    assert_eq!(ids, ["Steam", "store:x"], "the two sharing a folder have none");
}

#[cfg(windows)]
#[test]
fn matches_3x_on_this_machine() {
    let Some(dir) = std::env::var_os("PRUNE_3X_DIR").map(std::path::PathBuf::from) else { return };
    let read = |f: &str| -> serde_json::Value { serde_json::from_slice(&std::fs::read(dir.join(f)).unwrap()).unwrap() };
    let installed = prune_core::programs::registry::list_installed_programs();
    let ours = list_unregistered_programs(&installed);
    let theirs = read("unregistered.json");
    let mut a: Vec<&str> = ours.iter().map(|p| p.id.as_str()).collect();
    let mut b: Vec<&str> = theirs["apps"].as_array().unwrap().iter().map(|p| p["id"].as_str().unwrap()).collect();
    a.sort_unstable();
    b.sort_unstable();
    assert_eq!(a, b);
    assert!(ours.iter().all(|p| p.source == Source::Unregistered));

    // Running: every program 3.x saw running is one we see too (a process may
    // have started or ended in between, so the other direction is not asserted).
    let steam = prune_core::programs::launchers::read_steam_apps(prune_core::programs::launchers::steam_root_from(&installed).as_deref());
    let mut everything = installed.clone();
    everything.extend(prune_core::programs::store::list_store_apps());
    let running = running_programs(&everything, &steam);
    let theirs = read("running.json");
    let seen_by_us = theirs["running"].as_object().unwrap().keys().filter(|id| running.contains_key(*id)).count();
    assert!(seen_by_us * 10 >= theirs["running"].as_object().unwrap().len() * 8, "{seen_by_us} of {}", theirs["running"].as_object().unwrap().len());
}
```


- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3: Implement.**

**Create `native/crates/prune-core/src/programs/protection.rs`:**

```rust
//! What must never be offered for removal (`services/leftoverProtection.js`,
//! the folder rules of `leftoverRemoval.js` and `pathGuard.js`).
//!
//! The list uses these to decide which Program Files folders are genuinely
//! "Not registered" programs; 2b's leftover scan and removal use the same
//! functions between the matching and the disk. Pure functions over paths:
//! nothing here touches the disk.
//!
//! One rule is not ported yet: 3.x lets a Prefetch trace, an error report or
//! a crash dump named for a program through `osComponentRefusal`
//! (`crashArtifacts.js`). It only applies to files in three folders the list
//! never looks at; 2b adds it with the leftover scan.

use super::model::Program;
use super::paths::norm_path;

/// The folders the rules are written against, from the environment.
#[derive(Debug, Clone, Default)]
pub struct Env {
    pub system_root: Option<String>,
    pub system_drive: Option<String>,
    pub program_files: Option<String>,
    pub program_files_x86: Option<String>,
    pub program_data: Option<String>,
    pub local_app_data: Option<String>,
    pub app_data: Option<String>,
    pub quarantine_root: Option<String>,
}

impl Env {
    pub fn from_env() -> Env {
        let var = |k: &str| std::env::var(k).ok().filter(|v| !v.is_empty());
        let app_data = var("APPDATA");
        Env {
            system_root: var("SystemRoot").or_else(|| var("windir")),
            system_drive: var("SystemDrive"),
            program_files: var("ProgramFiles"),
            program_files_x86: var("ProgramFiles(x86)"),
            program_data: var("ProgramData"),
            local_app_data: var("LOCALAPPDATA"),
            quarantine_root: app_data.as_ref().map(|a| format!(r"{a}\Prune\quarantine")),
            app_data,
        }
    }
    fn drive(&self) -> String {
        self.system_drive.clone().unwrap_or_else(|| "C:".to_owned())
    }
}

pub fn is_at_or_under(path: &str, parent: &str) -> bool {
    let (target, root) = (norm_path(path), norm_path(parent));
    target == root || target.starts_with(&format!("{root}\\"))
}

fn has_drive(path: &str) -> bool {
    let b = path.trim().as_bytes();
    b.len() >= 3 && b[0].is_ascii_alphabetic() && b[1] == b':' && (b[2] == b'\\' || b[2] == b'/')
}

/// `C:\` at the start: the shape a command line carries.
fn starts_with_drive_bs(path: &str) -> bool {
    let b = path.as_bytes();
    b.len() >= 3 && b[0].is_ascii_alphabetic() && b[1] == b':' && b[2] == b'\\'
}

/// `C:\` and at least one more character: a folder, not a drive root.
fn has_drive_bs(path: &str) -> bool {
    path.len() > 3 && starts_with_drive_bs(path)
}

fn segments_after_drive(path: &str) -> Vec<String> {
    let n = norm_path(path);
    let rest = if n.as_bytes().get(1) == Some(&b':') { &n[2..] } else { &n[..] };
    rest.split('\\').filter(|s| !s.is_empty()).map(str::to_owned).collect()
}

/// Folders that belong to the operating system or to the runtime every
/// program shares, wherever they turn up in the tree.
const SHARED_FOLDERS: [&str; 9] =
    ["microsoft shared", "reference assemblies", "dotnet", "microsoft.net", "internet explorer", "systemapps", "system32", "syswow64", "winsxs"];

/// Folders that, directly under a `Microsoft` folder, hold the operating
/// system's own data rather than a Microsoft product's.
const MICROSOFT_OS_CHILDREN: [&str; 13] = [
    "crypto", "protect", "vault", "credentials", "systemcertificates", "network", "event viewer", "internet explorer", "clr_v4.0",
    "clr_v4.0_32", "spelling", "device metadata", "dpapi",
];

fn is_windows_name(part: &str) -> bool {
    (part == "windows" || part.starts_with("windows ")) && part != "windows kits"
}

/// Why this path belongs to Windows or to a Microsoft component, or `None`.
/// A Microsoft PRODUCT is deliberately not refused ("Microsoft Office" is
/// exactly what an uninstall of that product leaves behind); the operating
/// system, the shared runtimes and the bare `Microsoft` container are.
pub fn os_component_refusal(path: &str, env: &Env) -> Option<&'static str> {
    if !has_drive(path) {
        return Some("Only a full path can be a leftover.");
    }
    if env.system_root.as_deref().is_some_and(|r| is_at_or_under(path, r)) {
        return Some("That is Windows itself.");
    }
    let parts = segments_after_drive(path);
    for (i, part) in parts.iter().enumerate() {
        if is_windows_name(part) || part == "windowsapps" || part == "windowspowershell" {
            return Some("That belongs to Windows.");
        }
        if SHARED_FOLDERS.contains(&part.as_str()) {
            return Some("That is shared by many programs and by Windows.");
        }
        if part == "microsoft" {
            match parts.get(i + 1) {
                None => return Some("That folder holds data for every Microsoft program on this machine."),
                Some(next) if is_windows_name(next) || MICROSOFT_OS_CHILDREN.contains(&next.as_str()) => {
                    return Some("That belongs to Windows.");
                }
                Some(_) => {}
            }
        }
    }
    None
}

fn programs_roots(env: &Env) -> Vec<String> {
    let drive = env.drive();
    let mut roots = vec![
        env.program_files.clone().unwrap_or_else(|| format!(r"{drive}\Program Files")),
        env.program_files_x86.clone().unwrap_or_else(|| format!(r"{drive}\Program Files (x86)")),
    ];
    if let Some(local) = &env.local_app_data {
        roots.push(format!(r"{local}\Programs"));
        roots.push(local.clone());
    }
    if let Some(app) = &env.app_data {
        roots.push(app.clone());
    }
    roots.push(env.program_data.clone().unwrap_or_else(|| format!(r"{drive}\ProgramData")));
    // Longest first, so LOCALAPPDATA\Programs is tried before LOCALAPPDATA.
    roots.sort_by_key(|r| std::cmp::Reverse(r.len()));
    roots
}

/// First folders under a programs root that are containers, not a program.
const CONTAINER_FOLDERS: [&str; 13] = [
    "microsoft", "temp", "package cache", "packages", "programs", "common files", "windowsapps", "installer", "downloaded installations",
    "crashdumps", "d3dscache", "history", "inetcache",
];

/// The `file` part of a command line that starts with a path: quoted, or
/// unquoted up to the first known extension followed by space, comma, quote
/// or the end.
fn file_in_command(text: &str) -> Option<String> {
    if let Some(rest) = text.strip_prefix('"') {
        return rest.find('"').filter(|e| *e > 0).map(|e| rest[..e].to_owned());
    }
    if !starts_with_drive_bs(text) {
        return None;
    }
    let lower = text.to_lowercase();
    for (at, _) in lower.match_indices('.') {
        let after = &lower[at..];
        for ext in [".exe", ".ico", ".dll", ".msi", ".bat", ".cmd", ".com", ".lnk"] {
            if after.starts_with(ext) {
                let end = at + ext.len();
                if lower[end..].chars().next().is_none_or(|c| c.is_whitespace() || c == ',' || c == '"') {
                    return Some(text[..end].to_owned());
                }
            }
        }
    }
    None
}

/// The folder that holds a program, as far as a command line it registered
/// can say: an `UninstallString` or a `DisplayIcon`. Below a programs root
/// the answer is the first folder under that root; anywhere else it is the
/// file's folder. `None` for Windows, a drive root, Temp or the shared
/// installer cache: anchoring on those would offer the system, or every
/// program's installer, as one program's folder.
pub fn anchor_root_from_command(command: &str, env: &Env) -> Option<String> {
    let text = command.trim();
    let mut file = file_in_command(text)?;
    // A trailing icon index: ",0" or ",-101".
    if let Some(comma) = file.rfind(',') {
        let tail = file[comma + 1..].trim_start_matches('-');
        if !tail.is_empty() && tail.bytes().all(|b| b.is_ascii_digit()) {
            file.truncate(comma);
        }
    }
    let file = file.trim().to_owned();
    if !starts_with_drive_bs(&file) {
        return None;
    }
    let dir = file.rsplit_once(['\\', '/']).map(|(d, _)| d.to_owned())?;
    // A file in a drive root has no folder of its own.
    if !has_drive_bs(&dir) {
        return None;
    }
    let system_root = env.system_root.clone().unwrap_or_else(|| r"C:\Windows".to_owned());
    if is_at_or_under(&dir, &system_root) {
        return None;
    }
    for root in programs_roots(env) {
        if !is_at_or_under(&dir, &root) || norm_path(&dir) == norm_path(&root) {
            continue;
        }
        let first = dir[root.len() + 1..].split(['\\', '/']).next().unwrap_or("");
        if first.is_empty() || CONTAINER_FOLDERS.contains(&first.to_lowercase().as_str()) || is_windows_name(&first.to_lowercase()) {
            return None;
        }
        return Some(format!(r"{root}\{first}"));
    }
    // Not under a root a program installs into: the folder of the file
    // itself, unless that is a Windows component by its own name.
    os_component_refusal(&dir, env).is_none().then_some(dir)
}

fn clean_folder(value: &str) -> Option<String> {
    let trimmed = value.trim().trim_matches('"').trim_end_matches(['\\', '/']).to_owned();
    has_drive(&trimmed).then_some(trimmed)
}

/// Every folder one installed program says is its own: the InstallLocation it
/// registered and the folders its icon and uninstaller live in.
pub fn footprints_of(program: &Program, env: &Env) -> Vec<String> {
    let mut found: Vec<String> = Vec::new();
    let mut add = |dir: Option<String>| {
        if let Some(dir) = dir.filter(|d| !found.iter().any(|k| norm_path(k) == norm_path(d))) {
            found.push(dir);
        }
    };
    add(program.install_location.as_deref().and_then(clean_folder));
    add(program.display_icon.as_deref().and_then(|c| anchor_root_from_command(c, env)));
    add(program.uninstall_string.as_deref().and_then(|c| anchor_root_from_command(c, env)));
    found
}

/// `(folder, program name)` for every installed program.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Footprint {
    pub dir: String,
    pub program: String,
}

pub fn build_footprints(programs: &[Program], env: &Env) -> Vec<Footprint> {
    programs
        .iter()
        .flat_map(|p| {
            let name = if p.name.is_empty() { p.id.clone() } else { p.name.clone() };
            footprints_of(p, env).into_iter().map(move |dir| Footprint { dir, program: name.clone() })
        })
        .collect()
}

/// Why this path would damage another installed program, or `None`. Refused:
/// the program's own folder, and any folder that CONTAINS it (a publisher
/// match finds `C:\Program Files\Vendor` and removing it removes every Vendor
/// product); a folder strictly INSIDE another program's too, unless the caller
/// has the program's own word for it (`certain`).
pub fn footprint_refusal(path: &str, footprints: &[Footprint], certain: bool) -> Option<String> {
    for Footprint { dir, program } in footprints {
        if norm_path(path) == norm_path(dir) || is_at_or_under(dir, path) {
            return Some(format!("That is where {program} is installed."));
        }
        if !certain && is_at_or_under(path, dir) {
            return Some(format!("That is inside the folder {program} is installed in."));
        }
    }
    None
}

/// Folders inside a user profile that belong to the user, not to any one
/// program, relative to the profile.
const PROFILE_FOLDERS: [&str; 22] = [
    "appdata", "appdata\\local", "appdata\\roaming", "appdata\\locallow", "appdata\\local\\microsoft", "appdata\\roaming\\microsoft",
    "appdata\\local\\programs", "appdata\\local\\temp", "appdata\\roaming\\microsoft\\windows\\start menu",
    "appdata\\roaming\\microsoft\\windows\\start menu\\programs", "documents", "desktop", "downloads", "pictures", "music", "videos",
    "favorites", "onedrive", "saved games", "contacts", "links", "searches",
];

/// Why a path must not be deleted outright, or `None` (`permanentDeletionRefusal`):
/// the Disk Map's guard (Windows, whole drives, profiles, the quarantine,
/// anything relative or climbing) minus its rule refusing everything under
/// Program Files, since the folder an uninstaller leaves there is the most
/// common leftover of all; the folders that hold everyone's are refused by name.
pub fn permanent_deletion_refusal(path: &str, env: &Env) -> Option<&'static str> {
    let raw = path.trim();
    if raw.is_empty() {
        return Some("That is not a path.");
    }
    if raw.contains("..") {
        return Some("Paths that climb out of themselves are refused.");
    }
    if !(has_drive(raw) || raw.starts_with("\\\\") || raw.starts_with("//")) {
        return Some("Only a full path can be removed.");
    }
    let n = norm_path(raw);
    if n.len() == 2 && n.as_bytes()[1] == b':' {
        return Some("That is a whole drive.");
    }
    if env.system_root.as_deref().is_some_and(|r| is_at_or_under(raw, r)) {
        return Some("That is Windows itself.");
    }
    let drive = env.drive();
    let users_root = format!(r"{drive}\Users");
    if n == norm_path(&users_root) {
        return Some("That is every user account on this machine.");
    }
    if n.strip_prefix(&format!("{}\\", norm_path(&users_root))).is_some_and(|rest| !rest.contains('\\')) {
        return Some("That is a whole user profile.");
    }
    if let Some(q) = &env.quarantine_root {
        if is_at_or_under(raw, q) || is_at_or_under(q, raw) {
            return Some("That holds Prune's own quarantine.");
        }
    }
    for root in [env.program_files.clone().unwrap_or_else(|| format!(r"{drive}\Program Files")), env.program_files_x86.clone().unwrap_or_else(|| format!(r"{drive}\Program Files (x86)"))] {
        if n == norm_path(&root) {
            return Some("That is where every installed program lives.");
        }
        if n == norm_path(&format!(r"{root}\Common Files")) {
            return Some("Common Files is shared by many programs.");
        }
    }
    let program_data = env.program_data.clone().unwrap_or_else(|| format!(r"{drive}\ProgramData"));
    if n == norm_path(&program_data) || n == norm_path(&format!(r"{program_data}\Microsoft")) {
        return Some("That folder holds data for every program on this machine.");
    }
    if let Some(rest) = n.strip_prefix(&format!("{}\\", norm_path(&users_root))) {
        let in_profile = rest.split('\\').skip(1).collect::<Vec<_>>().join("\\");
        if PROFILE_FOLDERS.contains(&in_profile.as_str()) {
            return Some("That is one of your profile's own folders, not a program's.");
        }
    }
    None
}
```


**Create `native/crates/prune-core/src/programs/unregistered.rs`:**

```rust
//! Program folders in Program Files that nothing registered claims
//! (`services/unregisteredFolders.js`): copied in by hand, or left behind by
//! an uninstaller that removed its registry entry and not its folder.
//!
//! Shown as "Not registered" programs rather than as junk, on purpose: a
//! portable tool unzipped into Program Files looks exactly the same. A
//! first-level folder is skipped when any installed program lives in it,
//! when anything running, scheduled, starting at sign-in or registered as a
//! service or driver points into it, when it is Windows' or a shared
//! container, and when it holds no executable at all.

use std::collections::HashSet;
use std::path::Path;

use super::model::{Program, Source};
use super::paths::norm_path;
use super::protection::{Env, Footprint, anchor_root_from_command, build_footprints, footprint_refusal, os_component_refusal, permanent_deletion_refusal};

const SKIP_NAMES: [&str; 23] = [
    "common files", "windowsapps", "modifiablewindowsapps", "uninstall information", "internet explorer", "microsoft", "dotnet",
    "package cache", "reference assemblies", "msbuild", "windows kits", "microsoft sdks", "iis", "iis express", "packagemanagement",
    "windowspowershell", "microsoft.net", "microsoft update health tools", "microsoft office", "microsoft visual studio",
    "microsoft analysis services", "microsoft sql server",
    // Driver Install Frameworks: what driver installers use to uninstall a driver later.
    "difx",
];

/// Words that name a whole class of software or only say the publisher is an
/// organization: not evidence that a folder belongs to a program
/// (`leftoverMatch.js`). "Team" from "Notepad++ Team" once matched Adobe's
/// "Team Projects Local Hub".
const STOP_WORDS: &[&str] = &[
    "microsoft", "windows", "corporation", "corp", "incorporated", "inc", "ltd", "limited", "llc", "gmbh", "company", "software",
    "update", "updates", "updater", "setup", "installer", "install", "uninstall", "runtime", "redistributable", "driver", "drivers",
    "edition", "version", "tool", "tools", "client", "service", "services", "helper", "component", "components", "package",
    "language", "pack", "library", "libraries", "framework", "engine", "player", "launcher", "desktop", "application",
    "applications", "program", "programs", "professional", "enterprise", "standard", "common", "shared", "system", "systems", "data",
    "files", "server", "plugin", "extension", "support", "free", "trial", "beta", "x64", "x86", "amd64", "arm64", "bit", "the", "and",
    "for", "with", "from", "team", "group", "labs", "studio", "studios", "games", "interactive", "entertainment", "technologies",
    "technology", "digital", "media", "solutions", "development", "developers", "project", "contributors", "authors", "community",
    "foundation", "international", "global", "online", "network", "official",
];

/// The distinctive lower-case words of a product name and its publisher, in
/// order, without duplicates.
pub fn product_tokens(texts: &[&str]) -> Vec<String> {
    let mut tokens: Vec<String> = Vec::new();
    for text in texts {
        for word in text.to_lowercase().split(|c: char| !(c.is_ascii_alphanumeric() || c == '+' || c == '#')) {
            let keep = word.len() >= 4 && !word.starts_with(|c: char| c.is_ascii_digit()) && !STOP_WORDS.contains(&word);
            if keep && !tokens.iter().any(|t| t == word) {
                tokens.push(word.to_owned());
            }
        }
    }
    tokens
}

/// The roots programs install into, for this machine.
pub fn unregistered_roots(env: &Env) -> Vec<String> {
    let mut roots: Vec<String> = Vec::new();
    let candidates = [env.program_files.clone(), env.program_files_x86.clone(), env.local_app_data.as_ref().map(|l| format!(r"{l}\Programs"))];
    for root in candidates.into_iter().flatten() {
        if !roots.iter().any(|r| norm_path(r) == norm_path(&root)) {
            roots.push(root);
        }
    }
    roots
}

/// Lower-cased top folders that something running, scheduled, starting or
/// registered as a service or driver points into.
pub fn in_use_folders(commands: &[String], env: &Env) -> HashSet<String> {
    commands.iter().filter_map(|c| anchor_root_from_command(c, env)).map(|t| norm_path(&t)).collect()
}

/// The first-level folder `path` is in, under one of the programs roots.
fn top_folder_of(path: &str, env: &Env) -> Option<String> {
    let target = norm_path(path);
    for root in unregistered_roots(env).iter().map(|r| norm_path(r)) {
        let rest = target.strip_prefix(&format!("{root}\\"))?;
        let first = rest.split('\\').next().filter(|f| !f.is_empty())?;
        return Some(format!("{root}\\{first}"));
    }
    None
}

/// The top folders of every folder Windows Installer tracks. An MSI install
/// usually registers no folder in Add/Remove at all (its uninstall string is
/// just `MsiExec /X{GUID}`), so without these Python and every other
/// MSI-installed program would look unregistered.
pub fn msi_top_folders(folders: &[String], env: &Env) -> HashSet<String> {
    folders.iter().filter_map(|f| top_folder_of(f, env)).collect()
}

fn letters(text: &str) -> String {
    text.to_lowercase().chars().filter(char::is_ascii_alphanumeric).collect()
}

/// The installed program this folder's name says it belongs to: a shared
/// leading run of four or more letters ("MuMuVMMVbox" beside "MuMuPlayer"),
/// or a distinctive word of the program's name or publisher in the folder's
/// name. Generous on purpose: missing an orphan costs a little disk, offering
/// a working program's helper for removal could cost the program.
fn related_program<'a>(folder_name: &str, programs: &'a [Program]) -> Option<&'a str> {
    let folder = letters(folder_name);
    let folder_words: HashSet<String> = product_tokens(&[folder_name]).into_iter().collect();
    for program in programs {
        let name = letters(&program.name);
        let shared = folder.chars().zip(name.chars()).take_while(|(a, b)| a == b).count();
        if shared >= 4 || product_tokens(&[&program.name, &program.publisher]).iter().any(|w| folder_words.contains(w)) {
            return Some(&program.name);
        }
    }
    None
}

/// What the machine is using, and which programs are installed.
pub struct Context<'a> {
    pub footprints: &'a [Footprint],
    pub in_use: &'a HashSet<String>,
    pub msi_folders: &'a HashSet<String>,
    pub programs: &'a [Program],
    pub env: &'a Env,
}

/// Why this first-level folder is not offered, or `None` when it is.
pub fn unregistered_reason(dir: &str, ctx: &Context) -> Option<String> {
    let folder_name = dir.trim_end_matches(['\\', '/']).rsplit(['\\', '/']).next().unwrap_or("");
    if SKIP_NAMES.contains(&folder_name.to_lowercase().as_str()) {
        return Some("That folder is shared by many programs or by Windows.".to_owned());
    }
    if let Some(refusal) = os_component_refusal(dir, ctx.env).or_else(|| permanent_deletion_refusal(dir, ctx.env)) {
        return Some(refusal.to_owned());
    }
    if let Some(refusal) = footprint_refusal(dir, ctx.footprints, false) {
        return Some(refusal);
    }
    if ctx.in_use.contains(&norm_path(dir)) {
        return Some("Something running, scheduled or registered as a service is in use from that folder.".to_owned());
    }
    if ctx.msi_folders.contains(&norm_path(dir)) {
        return Some("Windows Installer tracks that folder as part of an installed program.".to_owned());
    }
    related_program(folder_name, ctx.programs).map(|related| format!("That folder looks like part of {related}."))
}

/// Every unclaimed first-level folder that holds a program, as rows.
#[cfg(windows)]
pub fn scan_unregistered_folders(roots: &[String], ctx: &Context) -> Vec<Program> {
    use super::walk::{holds_executable, measure_directory, read_dir};
    let mut rows = Vec::new();
    for root in roots {
        let Some(entries) = read_dir(Path::new(root)) else { continue };
        for entry in entries.into_iter().filter(|e| e.is_dir) {
            let dir = format!(r"{}\{}", root.trim_end_matches('\\'), entry.name);
            if unregistered_reason(&dir, ctx).is_some() || !holds_executable(&dir, 4000) {
                continue;
            }
            rows.push(Program {
                // Prefixed like the Store and Chocolatey rows: never a registry key name.
                id: format!("unregistered:{dir}"),
                name: entry.name,
                size_bytes: Some(measure_directory(&dir, 200_000, std::time::Duration::from_secs(8))),
                install_location: Some(dir),
                source: Source::Unregistered,
                ..Program::default()
            });
        }
    }
    rows
}

#[cfg(not(windows))]
pub fn scan_unregistered_folders(_: &[String], _: &Context) -> Vec<Program> {
    let _ = Path::new("");
    Vec::new()
}

/// Everything the machine points at: command lines of services, drivers,
/// running processes, scheduled tasks and Run values, and the folders
/// Windows Installer tracks.
#[derive(Debug, Default)]
pub struct MachineUse {
    pub commands: Vec<String>,
    pub folders: Vec<String>,
}

/// `\??\C:\x\drv.sys` and `\SystemRoot\...` are how a driver's ImagePath is
/// written; WMI's `PathName` (what 3.x reads) hands back a drive path.
fn image_path_command(raw: &str) -> String {
    raw.strip_prefix(r"\??\").unwrap_or(raw).to_owned()
}

#[cfg(windows)]
pub fn read_machine_use() -> Option<MachineUse> {
    use crate::winreg::{Key, Root};
    let mut found = MachineUse::default();

    // Services and drivers: both keep their ImagePath under Services.
    let services = Key::open(Root::LocalMachine, r"SYSTEM\CurrentControlSet\Services");
    if let Some(services) = &services {
        for name in services.subkey_names() {
            if let Some(path) = services.open_sub(&name).and_then(|k| k.string("ImagePath")) {
                found.commands.push(image_path_command(&path));
            }
        }
    }
    let processes = super::running::list_process_paths();
    found.commands.extend(processes.iter().map(|p| p.path.clone()));
    found.commands.extend(scheduled_task_commands());
    for path in [
        r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run",
        r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Run",
    ] {
        found.commands.extend(run_values(Root::LocalMachine, path));
    }
    found.commands.extend(run_values(Root::CurrentUser, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run"));
    if let Some(folders) = Key::open(Root::LocalMachine, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Installer\Folders") {
        found.folders = folders.value_names();
    }
    // A live machine always has services and processes: none at all means
    // the read did not work, and guessing would offer a driver's folder.
    (services.is_some() && !processes.is_empty()).then_some(found)
}

#[cfg(windows)]
fn run_values(root: crate::winreg::Root, path: &str) -> Vec<String> {
    use crate::winreg::{Key, Value};
    let Some(key) = Key::open(root, path) else { return Vec::new() };
    key.value_names().into_iter().filter_map(|n| match key.value(&n)? {
        Value::Str(s) => Some(s),
        _ => None,
    }).collect()
}

/// The `Execute` of every action of every scheduled task, through Task
/// Scheduler's COM interface (what `Get-ScheduledTask` wraps). Hidden tasks
/// included; one that cannot be read is skipped.
#[cfg(windows)]
fn scheduled_task_commands() -> Vec<String> {
    use windows::Win32::System::Com::{CLSCTX_INPROC_SERVER, COINIT_MULTITHREADED, CoCreateInstance, CoInitializeEx};
    use windows::Win32::System::TaskScheduler::{IExecAction, ITaskFolder, ITaskService, TASK_ENUM_HIDDEN, TaskScheduler};
    use windows::Win32::System::Variant::VARIANT;
    use windows::core::{BSTR, Interface};

    fn walk(folder: &ITaskFolder, out: &mut Vec<String>) {
        if let Ok(tasks) = unsafe { folder.GetTasks(TASK_ENUM_HIDDEN.0) } {
            let count = unsafe { tasks.Count() }.unwrap_or(0);
            for i in 1..=count {
                let Ok(task) = (unsafe { tasks.get_Item(&VARIANT::from(i)) }) else { continue };
                let Ok(actions) = (unsafe { task.Definition().and_then(|d| d.Actions()) }) else { continue };
                let mut action_count = 0;
                if unsafe { actions.Count(&mut action_count) }.is_err() {
                    continue;
                }
                for j in 1..=action_count {
                    if let Ok(exec) = unsafe { actions.get_Item(j) }.and_then(|a| a.cast::<IExecAction>()) {
                        let mut path = BSTR::new();
                        if unsafe { exec.Path(&mut path) }.is_ok() {
                            out.push(crate::winreg::expand_env(&path.to_string()));
                        }
                    }
                }
            }
        }
        if let Ok(subs) = unsafe { folder.GetFolders(0) } {
            for i in 1..=unsafe { subs.Count() }.unwrap_or(0) {
                if let Ok(sub) = unsafe { subs.get_Item(&VARIANT::from(i)) } {
                    walk(&sub, out);
                }
            }
        }
    }

    let mut out = Vec::new();
    // SAFETY: COM is initialized for this thread; the interfaces live for the walk.
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        let Ok(service) = CoCreateInstance::<_, ITaskService>(&TaskScheduler, None, CLSCTX_INPROC_SERVER) else { return out };
        let empty = VARIANT::default();
        if service.Connect(&empty, &empty, &empty, &empty).is_err() {
            return out;
        }
        if let Ok(root) = service.GetFolder(&BSTR::from("\\")) {
            walk(&root, &mut out);
        }
    }
    out
}

#[cfg(not(windows))]
pub fn read_machine_use() -> Option<MachineUse> {
    None
}

/// The "Not registered" rows. Empty rather than guessing when what is in
/// use could not be read: without that, a driver's folder would be offered
/// for removal.
pub fn list_unregistered_programs(installed: &[Program]) -> Vec<Program> {
    let env = Env::from_env();
    let Some(machine) = read_machine_use() else { return Vec::new() };
    let footprints = build_footprints(installed, &env);
    let in_use = in_use_folders(&machine.commands, &env);
    let msi_folders = msi_top_folders(&machine.folders, &env);
    let ctx = Context { footprints: &footprints, in_use: &in_use, msi_folders: &msi_folders, programs: installed, env: &env };
    scan_unregistered_folders(&unregistered_roots(&env), &ctx)
}
```


**Create `native/crates/prune-core/src/programs/running.rs`:**

```rust
//! Which installed programs are running right now (`services/runningPrograms.js`).
//!
//! Prune warns before uninstalling something that is open, and the warning
//! earns its place: an uninstaller for a running program either fails or
//! half-succeeds and leaves files the next launch recreates. Matched by path
//! rather than by name: a process called "Update.exe" says nothing about which
//! program it belongs to, but the folder it runs from says everything.

use std::collections::HashMap;

use super::launchers::{SteamApp, parse_steam_app_id};
use super::model::{Program, Source};
use super::paths::{norm_path, size_source_for};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProcessInfo {
    /// The image name without `.exe`, as `Get-Process` shows it.
    pub name: String,
    pub path: String,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Running {
    pub count: usize,
    /// Distinct: a browser is thirty processes and "brave x30" is noise.
    pub names: Vec<String>,
}

/// Every process whose image path can be read. A process the account may not
/// open (most system services) has no path and is left out, as in 3.x.
#[cfg(windows)]
pub fn list_process_paths() -> Vec<ProcessInfo> {
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Diagnostics::ToolHelp::{CreateToolhelp32Snapshot, PROCESSENTRY32W, Process32FirstW, Process32NextW, TH32CS_SNAPPROCESS};
    use windows::Win32::System::Threading::{OpenProcess, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION, QueryFullProcessImageNameW};
    use windows::core::PWSTR;

    let mut found = Vec::new();
    // SAFETY: the snapshot and process handles are closed below; every buffer
    // is sized for the call it is handed to.
    unsafe {
        let Ok(snapshot) = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) else { return found };
        let mut entry = PROCESSENTRY32W { dwSize: size_of::<PROCESSENTRY32W>() as u32, ..Default::default() };
        let mut more = Process32FirstW(snapshot, &mut entry).is_ok();
        while more {
            if let Ok(process) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, entry.th32ProcessID) {
                let mut buf = vec![0u16; 32768];
                let mut len = buf.len() as u32;
                if QueryFullProcessImageNameW(process, PROCESS_NAME_WIN32, PWSTR(buf.as_mut_ptr()), &mut len).is_ok() && len > 0 {
                    let end = entry.szExeFile.iter().position(|c| *c == 0).unwrap_or(entry.szExeFile.len());
                    let exe = String::from_utf16_lossy(&entry.szExeFile[..end]);
                    let name = exe.strip_suffix(".exe").or_else(|| exe.strip_suffix(".EXE")).unwrap_or(&exe).to_owned();
                    found.push(ProcessInfo { name, path: String::from_utf16_lossy(&buf[..len as usize]) });
                }
                let _ = CloseHandle(process);
            }
            more = Process32NextW(snapshot, &mut entry).is_ok();
        }
        let _ = CloseHandle(snapshot);
    }
    found
}

#[cfg(not(windows))]
pub fn list_process_paths() -> Vec<ProcessInfo> {
    Vec::new()
}

/// Maps running processes onto the programs that own them. The LONGEST
/// matching folder wins: Warframe runs from `Steam\steamapps\common\Warframe`,
/// which is inside Steam's own folder too, and shortest-match would report
/// every Steam game as "Steam is running".
pub fn match_running_programs(processes: &[ProcessInfo], owners: &[(String, String)]) -> HashMap<String, Running> {
    let mut folders: Vec<(&str, String)> = owners.iter().map(|(id, f)| (id.as_str(), norm_path(f))).filter(|(_, f)| !f.is_empty()).collect();
    // Longest first, so the first match is the most specific one.
    folders.sort_by_key(|(_, f)| std::cmp::Reverse(f.len()));
    let mut running: HashMap<String, Running> = HashMap::new();
    for process in processes {
        let path = norm_path(&process.path);
        // The trailing separator matters: "C:\App2" is not inside "C:\App".
        let Some((id, _)) = folders.iter().find(|(_, folder)| path.starts_with(&format!("{folder}\\"))) else { continue };
        let entry = running.entry((*id).to_owned()).or_default();
        entry.count += 1;
        let name = process.name.trim();
        if !name.is_empty() && !entry.names.iter().any(|n| n == name) {
            entry.names.push(name.to_owned());
        }
    }
    running
}

/// Every folder that identifies a program: InstallLocation where there is one
/// (Store apps too, which record their WindowsApps folder), Steam's manifest
/// path for Steam games, then the uninstaller's folder, but only where exactly
/// ONE program falls back to it (Steam's own entry has no InstallLocation and
/// is the program most likely to be running while someone tries to remove it).
pub fn owner_folders(programs: &[Program], steam: &HashMap<String, SteamApp>) -> Vec<(String, String)> {
    let registry = || programs.iter().filter(|p| p.source == Source::Registry);
    let mut fallback_users: HashMap<String, usize> = HashMap::new();
    for program in registry().filter(|p| p.install_location.is_none()) {
        if program.uninstall_string.as_deref().and_then(parse_steam_app_id).is_some() {
            continue;
        }
        if let Some(folder) = size_source_for(program) {
            *fallback_users.entry(norm_path(&folder)).or_default() += 1;
        }
    }
    let mut owners = Vec::new();
    for program in registry() {
        if let Some(location) = &program.install_location {
            owners.push((program.id.clone(), location.clone()));
        } else if let Some(path) = program.uninstall_string.as_deref().and_then(parse_steam_app_id).and_then(|id| steam.get(&id)).and_then(|a| a.path.clone()) {
            owners.push((program.id.clone(), path));
        } else if let Some(folder) = size_source_for(program).filter(|f| fallback_users.get(&norm_path(f)) == Some(&1)) {
            owners.push((program.id.clone(), folder));
        }
    }
    for app in programs.iter().filter(|p| p.source == Source::Store) {
        if let Some(location) = &app.install_location {
            owners.push((app.id.clone(), location.clone()));
        }
    }
    owners
}

/// What is running right now, as `{ programId: Running }`. Never cached: the
/// one answer on this screen that is only true at the moment it is asked.
pub fn running_programs(programs: &[Program], steam: &HashMap<String, SteamApp>) -> HashMap<String, Running> {
    match_running_programs(&list_process_paths(), &owner_folders(programs, steam))
}
```


`programs/mod.rs` gains `pub mod protection;`, `pub mod running;`, `pub mod unregistered;`.

- [ ] **Step 4:** `PRUNE_3X_DIR=<folder> cargo test -p prune-core --test programs_unregistered`. Expected: 10 passed; the 5 "Not registered" folders equal 3.x's.
- [ ] **Step 5: Commit** `feat(native): Not registered folders, path protection and running programs`

### Task 10: Windows features and updates, and collation

**Files:**
- Create: `native/crates/prune-core/src/programs/windows_items.rs`, `native/crates/prune-core/src/programs/collate.rs`
- Modify: `native/crates/prune-core/src/programs/mod.rs`
- Test: `native/crates/prune-core/tests/programs_windows_items.rs`

**Interfaces:**
- Produces: `windows_items::{is_protected_feature, feature_rows, update_rows, parse_installed_on, read_enabled_features, read_installed_updates, list_windows_features, list_windows_updates}`; `collate::{compare, Mode}` (`Default`, `Base`, `Numeric`).
- Features are `Win32_OptionalFeature` with `InstallState = 1`; `NetFx4*` and `Windows-Defender*` are marked protected (listed, never offered). Updates are `Win32_QuickFixEngineering` rows with a `KB` and 6 to 8 digits, named "Description KBnnnnnnn", newest first. `InstalledOn` is text: `M/d/yyyy` on most machines and a hexadecimal FILETIME on others; both parse. WMI is slower than the other lookups (about two seconds for each on this PC, the same as 3.x's PowerShell), which is why these two are late-arriving lists behind their own chip.

- [ ] **Step 1: Write the tests.**

**Create `native/crates/prune-core/tests/programs_windows_items.rs`:**

```rust
//! Windows features and updates, and the collation the columns sort by,
//! ported from 3.x's windowsComponents.test.js and sortPrograms.test.js.

use std::cmp::Ordering;

use prune_core::programs::collate::{Mode, compare};
use prune_core::programs::model::Source;
use prune_core::programs::windows_items::*;

#[test]
fn features_are_rows_sorted_by_name_and_the_ones_windows_depends_on_are_protected() {
    let rows = feature_rows(&[
        ("NetFx4-AdvSrvs".into(), ".NET Framework 4.8 Advanced Services".into()),
        ("TelnetClient".into(), "Telnet Client".into()),
        ("Windows-Defender-Default-Definitions".into(), String::new()),
        ("bad name!".into(), "ignored".into()),
    ]);
    let names: Vec<&str> = rows.iter().map(|r| r.name.as_str()).collect();
    assert_eq!(names, [".NET Framework 4.8 Advanced Services", "Telnet Client", "Windows-Defender-Default-Definitions"]);
    assert_eq!(rows[1].id, "feature:TelnetClient");
    assert!(rows[0].feature_protected && rows[2].feature_protected && !rows[1].feature_protected);
    assert!(rows.iter().all(|r| r.source == Source::Feature && r.publisher == "Microsoft"));
}

#[test]
fn updates_are_named_by_windows_own_word_and_listed_newest_first() {
    let rows = update_rows(&[
        ("KB5127648".into(), "Security Update".into(), Some("2026-08-01".into())),
        ("kb5127694".into(), String::new(), Some("2026-10-14".into())),
        ("KB12".into(), "too short".into(), None),
        ("Q123456".into(), "not a KB".into(), None),
    ]);
    assert_eq!(rows.iter().map(|r| r.name.as_str()).collect::<Vec<_>>(), ["KB5127694", "Security Update KB5127648"]);
    assert_eq!(rows[0].id, "update:KB5127694");
    assert_eq!(rows[1].install_date.as_deref(), Some("2026-08-01"));
}

#[test]
fn installed_on_comes_as_month_day_year_or_as_a_hex_filetime() {
    assert_eq!(parse_installed_on("8/19/2026").as_deref(), Some("2026-08-19"));
    assert_eq!(parse_installed_on("10/2/2026 12:00:00 AM").as_deref(), Some("2026-10-02"));
    assert_eq!(parse_installed_on("garbage"), None);
    assert_eq!(parse_installed_on("13/40/2026"), None);
    // 2026-08-19 12:00 UTC.
    let ticks = 116_444_736_000_000_000u64 + 1_787_140_800 * 10_000_000;
    assert_eq!(parse_installed_on(&format!("0x{ticks:016x}")).as_deref(), Some("2026-08-19"));
}

#[test]
fn collation_follows_the_columns_localecompare_options() {
    // Application / Company: sensitivity 'base', so case and accents do not separate.
    assert_eq!(compare("alpha", "ALPHA", Mode::Base), Ordering::Equal);
    assert_eq!(compare("Zeta", "alpha", Mode::Base), Ordering::Greater);
    assert_eq!(compare("Älpha", "Alpha", Mode::Base), Ordering::Equal);
    // Version: digit runs are numbers, not text.
    assert_eq!(compare("1.9", "1.10", Mode::Numeric), Ordering::Less);
    assert_eq!(compare("2026.08.19", "2026.08.9", Mode::Numeric), Ordering::Greater);
    assert_eq!(compare("1.9", "1.10", Mode::Default), Ordering::Greater, "as text, 9 sorts after 1");
}

#[cfg(windows)]
#[test]
fn matches_3x_on_this_machine() {
    let Some(dir) = std::env::var_os("PRUNE_3X_DIR").map(std::path::PathBuf::from) else { return };
    let read = |f: &str| -> serde_json::Value { serde_json::from_slice(&std::fs::read(dir.join(f)).unwrap()).unwrap() };

    let features = list_windows_features();
    let theirs = read("windows-features.json");
    let want = theirs["features"].as_array().unwrap();
    assert_eq!(features.iter().map(|f| f.id.as_str()).collect::<Vec<_>>(), want.iter().map(|f| f["id"].as_str().unwrap()).collect::<Vec<_>>());
    for (f, w) in features.iter().zip(want) {
        assert_eq!((f.name.as_str(), f.feature_protected), (w["name"].as_str().unwrap(), w["protected"].as_bool().unwrap()));
    }

    let updates = list_windows_updates();
    let theirs = read("windows-updates.json");
    let want = theirs["updates"].as_array().unwrap();
    assert_eq!(updates.len(), want.len());
    for (u, w) in updates.iter().zip(want) {
        assert_eq!((u.id.as_str(), u.name.as_str()), (w["id"].as_str().unwrap(), w["name"].as_str().unwrap()));
        assert_eq!(u.install_date.as_deref(), w["installDate"].as_str(), "{}", u.id);
    }
}
```


- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3: Implement.**

**Create `native/crates/prune-core/src/programs/windows_items.rs`:**

```rust
//! Windows' own optional features and installed updates, as rows
//! (`services/windowsComponents.js`, the listing half). Both change Windows
//! itself rather than a program installed on it, so the list marks them and
//! keeps them out of "All".
//!
//! `Get-CimInstance Win32_OptionalFeature` and `Get-HotFix` are WMI queries;
//! this asks WMI the same two questions in process (`IWbemServices::ExecQuery`
//! on `ROOT\CIMV2`) instead of starting PowerShell for each.

use super::model::{Program, Source};

/// Features whose removal breaks things far outside themselves (every .NET
/// program, or the antivirus): listed, never offered.
pub fn is_protected_feature(name: &str) -> bool {
    let lower = name.to_lowercase();
    lower.starts_with("netfx4") || lower.starts_with("windows-defender")
}

fn is_feature_name(name: &str) -> bool {
    name.starts_with(|c: char| c.is_ascii_alphanumeric()) && name.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-'))
}

/// `(name, caption)` pairs of the enabled features, as rows sorted by name.
pub fn feature_rows(features: &[(String, String)]) -> Vec<Program> {
    let mut rows: Vec<Program> = features
        .iter()
        .filter(|(name, _)| is_feature_name(name))
        .map(|(name, caption)| Program {
            id: format!("feature:{name}"),
            name: if caption.is_empty() { name.clone() } else { caption.clone() },
            publisher: "Microsoft".to_owned(),
            feature_protected: is_protected_feature(name),
            source: Source::Feature,
            ..Program::default()
        })
        .collect();
    rows.sort_by(|a, b| super::collate::compare(&a.name, &b.name, super::collate::Mode::Default));
    rows
}

/// `KB` and 6 to 8 digits.
fn kb_digits(id: &str) -> Option<String> {
    let rest = id.strip_prefix("KB").or_else(|| id.strip_prefix("kb"))?;
    ((6..=8).contains(&rest.len()) && rest.bytes().all(|b| b.is_ascii_digit())).then(|| rest.to_owned())
}

/// `(HotFixID, Description, InstalledOn as YYYY-MM-DD)` as rows, newest first.
pub fn update_rows(updates: &[(String, String, Option<String>)]) -> Vec<Program> {
    let mut rows: Vec<Program> = updates
        .iter()
        .filter_map(|(id, description, installed)| {
            let kb = kb_digits(id)?;
            let upper = format!("KB{kb}");
            Some(Program {
                id: format!("update:{upper}"),
                // A bare KB number says nothing; Windows' own word for it does
                // ("Security Update KB5127648").
                name: if description.is_empty() { upper } else { format!("{description} {upper}") },
                publisher: "Microsoft".to_owned(),
                install_date: installed.clone(),
                source: Source::Update,
                ..Program::default()
            })
        })
        .collect();
    rows.sort_by(|a, b| b.install_date.cmp(&a.install_date));
    rows
}

/// `Win32_QuickFixEngineering.InstalledOn` is text: `M/d/yyyy` on most
/// machines, or a hexadecimal FILETIME (`0x01dc...`) on others; both turn up.
pub fn parse_installed_on(text: &str) -> Option<String> {
    let text = text.trim();
    if let Some(hex) = text.strip_prefix("0x").or_else(|| text.strip_prefix("0X")) {
        return super::dates::filetime_to_local_date(u64::from_str_radix(hex, 16).ok()?);
    }
    let date = text.split_whitespace().next()?;
    let mut parts = date.split('/');
    let (m, d, y) = (parts.next()?.parse::<u32>().ok()?, parts.next()?.parse::<u32>().ok()?, parts.next()?.parse::<u32>().ok()?);
    if parts.next().is_some() || !(1..=12).contains(&m) || !(1..=31).contains(&d) || y < 1990 {
        return None;
    }
    Some(format!("{y:04}-{m:02}-{d:02}"))
}

#[cfg(windows)]
fn wmi_query(query: &str, properties: &[&str]) -> Option<Vec<Vec<String>>> {
    use windows::Win32::System::Com::{
        CLSCTX_INPROC_SERVER, COINIT_MULTITHREADED, CoCreateInstance, CoInitializeEx, CoSetProxyBlanket, EOAC_NONE, RPC_C_AUTHN_LEVEL_CALL,
        RPC_C_IMP_LEVEL_IMPERSONATE,
    };
    use windows::Win32::System::Rpc::{RPC_C_AUTHN_WINNT, RPC_C_AUTHZ_NONE};
    use windows::Win32::System::Variant::{VARIANT, VT_BSTR, VariantClear};
    use windows::Win32::System::Wmi::{IWbemLocator, WBEM_FLAG_FORWARD_ONLY, WBEM_FLAG_RETURN_IMMEDIATELY, WBEM_INFINITE, WbemLocator};
    use windows::core::{BSTR, HSTRING};

    // SAFETY: COM is initialized for this thread; every interface and VARIANT
    // below lives only inside this function, and each VARIANT is cleared.
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        let locator: IWbemLocator = CoCreateInstance(&WbemLocator, None, CLSCTX_INPROC_SERVER).ok()?;
        let services = locator.ConnectServer(&BSTR::from("ROOT\\CIMV2"), &BSTR::new(), &BSTR::new(), &BSTR::new(), 0, &BSTR::new(), None).ok()?;
        CoSetProxyBlanket(&services, RPC_C_AUTHN_WINNT, RPC_C_AUTHZ_NONE, None, RPC_C_AUTHN_LEVEL_CALL, RPC_C_IMP_LEVEL_IMPERSONATE, None, EOAC_NONE).ok()?;
        let rows = services
            .ExecQuery(&BSTR::from("WQL"), &BSTR::from(query), WBEM_FLAG_FORWARD_ONLY | WBEM_FLAG_RETURN_IMMEDIATELY, None)
            .ok()?;
        let mut out = Vec::new();
        loop {
            let mut objects = [None];
            let mut returned = 0u32;
            let _ = rows.Next(WBEM_INFINITE, &mut objects, &mut returned);
            let Some(object) = objects[0].take().filter(|_| returned > 0) else { break };
            let mut row = Vec::new();
            for property in properties {
                let mut value = VARIANT::default();
                let got = object.Get(&HSTRING::from(*property), 0, &mut value, None, None).is_ok();
                // The three properties asked for are strings; anything else is a blank.
                let text = if got && value.Anonymous.Anonymous.vt == VT_BSTR {
                    value.Anonymous.Anonymous.Anonymous.bstrVal.to_string()
                } else {
                    String::new()
                };
                let _ = VariantClear(&mut value);
                row.push(text);
            }
            out.push(row);
        }
        Some(out)
    }
}

/// The enabled optional features, `(name, caption)`. Empty when WMI cannot answer.
#[cfg(windows)]
pub fn read_enabled_features() -> Vec<(String, String)> {
    wmi_query("SELECT Name, Caption FROM Win32_OptionalFeature WHERE InstallState = 1", &["Name", "Caption"])
        .unwrap_or_default()
        .into_iter()
        .filter_map(|r| Some((r.first()?.clone(), r.get(1)?.clone())))
        .collect()
}

/// The installed updates, `(HotFixID, Description, date)`.
#[cfg(windows)]
pub fn read_installed_updates() -> Vec<(String, String, Option<String>)> {
    wmi_query("SELECT HotFixID, Description, InstalledOn FROM Win32_QuickFixEngineering", &["HotFixID", "Description", "InstalledOn"])
        .unwrap_or_default()
        .into_iter()
        .filter_map(|r| Some((r.first()?.clone(), r.get(1)?.clone(), r.get(2).and_then(|t| parse_installed_on(t)))))
        .collect()
}

#[cfg(not(windows))]
pub fn read_enabled_features() -> Vec<(String, String)> {
    Vec::new()
}

#[cfg(not(windows))]
pub fn read_installed_updates() -> Vec<(String, String, Option<String>)> {
    Vec::new()
}

pub fn list_windows_features() -> Vec<Program> {
    feature_rows(&read_enabled_features())
}

pub fn list_windows_updates() -> Vec<Program> {
    update_rows(&read_installed_updates())
}
```


**Create `native/crates/prune-core/src/programs/collate.rs`:**

```rust
//! Text ordering the way 3.x's `localeCompare` does it: by the person's own
//! locale, through Windows' own collation (`CompareStringEx`), so "Ärger"
//! sits with the A's and "Setup 10" follows "Setup 9" where numbers are asked
//! for. Nothing here is a byte comparison.

use std::cmp::Ordering;

/// Which `localeCompare` options a column uses (`sortPrograms.js`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Mode {
    /// No options: case and accents matter after letters (Type column, feature names).
    Default,
    /// `sensitivity: 'base'`: "a", "A" and "á" are equal (Application, Company).
    Base,
    /// `numeric: true`: digit runs compare as numbers (Version).
    Numeric,
}

#[cfg(windows)]
pub fn compare(a: &str, b: &str, mode: Mode) -> Ordering {
    use windows::Win32::Globalization::{COMPARE_STRING_FLAGS, CompareStringEx, LINGUISTIC_IGNORECASE, LINGUISTIC_IGNOREDIACRITIC, SORT_DIGITSASNUMBERS};
    use windows::core::PCWSTR;
    let flags = match mode {
        Mode::Default => COMPARE_STRING_FLAGS(0),
        Mode::Base => LINGUISTIC_IGNORECASE | LINGUISTIC_IGNOREDIACRITIC,
        Mode::Numeric => SORT_DIGITSASNUMBERS,
    };
    let (wa, wb): (Vec<u16>, Vec<u16>) = (a.encode_utf16().collect(), b.encode_utf16().collect());
    // SAFETY: both slices are valid for their stated lengths for the call.
    let result = unsafe { CompareStringEx(PCWSTR::null(), flags, &wa, &wb, None, None, None) };
    match result.0 {
        1 => Ordering::Less,
        3 => Ordering::Greater,
        2 => Ordering::Equal,
        _ => a.cmp(b),
    }
}

#[cfg(not(windows))]
pub fn compare(a: &str, b: &str, mode: Mode) -> Ordering {
    match mode {
        Mode::Base => a.to_lowercase().cmp(&b.to_lowercase()),
        _ => a.cmp(b),
    }
}
```


`programs/mod.rs` gains `pub mod collate;` and `pub mod windows_items;`.

- [ ] **Step 4:** `PRUNE_3X_DIR=<folder> cargo test -p prune-core --test programs_windows_items`. Expected: 5 passed; 14 features and 5 updates, names, ids, protection and dates equal 3.x's.
- [ ] **Step 5: Commit** `feat(native): Windows features and updates through WMI, and locale collation`

### Task 11: Other accounts, install traces and the hidden list

**Files:**
- Create: `native/crates/prune-core/src/programs/accounts.rs`, `native/crates/prune-core/src/programs/hidden.rs`
- Modify: `native/crates/prune-core/src/programs/mod.rs`
- Test: `native/crates/prune-core/tests/programs_accounts.rs`

**Interfaces:**
- Produces: `accounts::{Profile, ProfileRow, other_profiles, read_profile_rows, list_other_profiles, TraceSummary, list_traces, trace_for_program}`; `hidden::{normalize_hidden_programs, program_hide_key, is_program_hidden}`.
- Other accounts: real user SIDs (`S-1-5-21-`), not this one, with a profile folder; only the list is read here (2c scans their programs, which needs administrator rights). Traces: `install-traces\<16 hex>.json` read without their file lists; a program matches by its Add/Remove key first and by name only when it has no key (two versions can share a name). Hidden: the `hiddenPrograms` setting's own normalisation (distinct, trimmed, at most 1,024 characters and 5,000 entries; anything else reads as nothing hidden, which shows more rather than less); a row's key is its registry key path, a Store app's package name without its version, else its own id with the `#2` suffix taken off.

- [ ] **Step 1: Write the tests.**

**Create `native/crates/prune-core/tests/programs_accounts.rs`:**

```rust
//! Other accounts, install-monitor records and the hidden list, ported from
//! 3.x's otherAccounts.test.js, installTraces.test.js and hiddenPrograms.test.js.

use std::collections::HashSet;

use prune_core::programs::accounts::*;
use prune_core::programs::hidden::*;
use prune_core::programs::model::{Program, Source};
use serde_json::json;

fn row(sid: &str, path: &str, me: bool) -> ProfileRow {
    ProfileRow { sid: sid.into(), path: path.into(), loaded: false, me }
}

#[test]
fn only_real_other_accounts_with_a_profile_are_listed() {
    let rows = [
        row("S-1-5-18", r"C:\Windows\system32\config\systemprofile", false),
        row("S-1-5-21-1-2-3-1001", r"C:\Users\me", true),
        row("S-1-5-21-1-2-3-1002", r"C:\Users\guest\", false),
        row("S-1-5-21-1-2-3-1003", "", false),
        row("S-1-5-80-1-2", r"C:\Users\svc", false),
    ];
    let others = other_profiles(&rows);
    assert_eq!(others.len(), 1);
    assert_eq!((others[0].sid.as_str(), others[0].name.as_str()), ("S-1-5-21-1-2-3-1002", "guest"));
}

#[cfg(windows)]
#[test]
fn this_machines_profile_list_excludes_the_current_user() {
    let rows = read_profile_rows();
    assert!(rows.iter().any(|r| r.me), "the signed-in account is in ProfileList and is recognised");
    assert!(list_other_profiles().iter().all(|p| !rows.iter().any(|r| r.me && r.sid == p.sid)));
    if let Some(dir) = std::env::var_os("PRUNE_3X_DIR") {
        let theirs: serde_json::Value = serde_json::from_slice(&std::fs::read(std::path::Path::new(&dir).join("other-accounts.json")).unwrap()).unwrap();
        let mut a: Vec<String> = list_other_profiles().into_iter().map(|p| p.sid).collect();
        let mut b: Vec<String> = theirs["profiles"].as_array().unwrap().iter().map(|p| p["sid"].as_str().unwrap().to_owned()).collect();
        a.sort();
        b.sort();
        assert_eq!(a, b);
    }
}

fn scratch(name: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!("prune-traces-{}-{name}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

#[test]
fn traces_are_read_without_their_file_lists_and_matched_by_key_before_name() {
    let dir = scratch("list");
    let write = |id: &str, body: serde_json::Value| std::fs::write(dir.join(format!("{id}.json")), body.to_string()).unwrap();
    write("0123456789abcdef", json!({"id":"0123456789abcdef","program":{"name":"Thing","registryKey":r"HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Thing"},"files":[{"path":"C:\\x"}]}));
    write("fedcba9876543210", json!({"id":"fedcba9876543210","program":{"name":"Portable"}}));
    std::fs::write(dir.join("not-a-trace.json"), "{}").unwrap();
    std::fs::write(dir.join("0123456789abcde.json"), "{}").unwrap();
    std::fs::write(dir.join("aaaaaaaaaaaaaaaa.json"), "{broken").unwrap();
    let mut traces = list_traces(&dir);
    traces.sort_by(|a, b| a.id.cmp(&b.id));
    assert_eq!(traces.len(), 2);

    let by_key = Program { id: "Thing".into(), name: "Another Name".into(), registry_key: Some(r"HKLM:\software\microsoft\windows\currentversion\uninstall\thing".into()), ..Program::default() };
    assert_eq!(trace_for_program(&by_key, &traces).map(|t| t.id.as_str()), Some("0123456789abcdef"));
    // With a key, a name alone never matches: two versions can share one.
    let same_name_other_key = Program { name: "Portable".into(), registry_key: Some(r"HKLM:\other".into()), ..Program::default() };
    assert!(trace_for_program(&same_name_other_key, &traces).is_none());
    let no_key = Program { name: " portable ".into(), ..Program::default() };
    assert_eq!(trace_for_program(&no_key, &traces).map(|t| t.id.as_str()), Some("fedcba9876543210"));
    assert!(list_traces(&dir.join("missing")).is_empty());
}

#[test]
fn the_hidden_list_is_bounded_distinct_and_never_throws() {
    assert_eq!(normalize_hidden_programs(Some(&json!([" reg:a ", "reg:a", "", 5, null, "reg:b"]))), ["reg:a", "reg:b"]);
    assert!(normalize_hidden_programs(Some(&json!("reg:a"))).is_empty());
    assert!(normalize_hidden_programs(Some(&json!({"a": 1}))).is_empty());
    assert!(normalize_hidden_programs(None).is_empty());
    assert_eq!(normalize_hidden_programs(Some(&json!(["x".repeat(1025)]))).len(), 0);
}

#[test]
fn a_hide_key_is_the_most_stable_identity_a_row_has() {
    let reg = Program { id: "7-Zip#2".into(), registry_key: Some(r"HKLM:\SOFTWARE\Foo".into()), ..Program::default() };
    assert_eq!(program_hide_key(&reg).as_deref(), Some(r"reg:hklm:\software\foo"));
    let store = Program { id: "store:X_1.0_x64__abc".into(), source: Source::Store, package_name: Some("Microsoft.Paint".into()), ..Program::default() };
    assert_eq!(program_hide_key(&store).as_deref(), Some("store:microsoft.paint"));
    let ext = Program { id: "extension:brave:Default:abc#2".into(), ..Program::default() };
    assert_eq!(program_hide_key(&ext).as_deref(), Some("id:extension:brave:default:abc"));
    assert_eq!(program_hide_key(&Program::default()), None);
    let hidden: HashSet<String> = ["reg:hklm:\\software\\foo".to_owned()].into();
    assert!(is_program_hidden(&reg, &hidden) && !is_program_hidden(&store, &hidden));
}
```


- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3: Implement.**

**Create `native/crates/prune-core/src/programs/accounts.rs`:**

```rust
//! The other people's accounts on this PC (`services/otherAccounts.js`, the
//! part that needs no rights) and the install monitor's records
//! (`services/installTraces.js`, `frontend/src/lib/installTraces.js`).
//!
//! A per-user install writes into that user's own registry hive, so every
//! uninstaller lists only the programs of the person running it. Reading the
//! other accounts' programs needs administrator rights and is one button
//! (2c); knowing which accounts exist, which decides whether that button is
//! shown, is a plain registry read.

use std::path::Path;

use serde::Deserialize;

use super::chocolatey::canonical_key_path as canonical_key;
use super::model::Program;

/// SYSTEM, LOCAL SERVICE and NETWORK SERVICE.
const SYSTEM_SIDS: [&str; 3] = ["S-1-5-18", "S-1-5-19", "S-1-5-20"];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProfileRow {
    pub sid: String,
    pub path: String,
    pub loaded: bool,
    pub me: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Profile {
    pub sid: String,
    pub name: String,
    pub path: String,
    pub loaded: bool,
}

/// The other people's accounts: real user SIDs, not this one, not Windows'
/// service accounts, with a profile folder.
pub fn other_profiles(rows: &[ProfileRow]) -> Vec<Profile> {
    rows.iter()
        .filter(|r| r.sid.starts_with("S-1-5-21-") && !SYSTEM_SIDS.contains(&r.sid.as_str()) && !r.me && !r.path.is_empty())
        .map(|r| Profile {
            sid: r.sid.clone(),
            name: r.path.trim_end_matches(['\\', '/']).rsplit(['\\', '/']).next().unwrap_or("").to_owned(),
            path: r.path.clone(),
            loaded: r.loaded,
        })
        .collect()
}

#[cfg(windows)]
fn current_user_sid() -> Option<String> {
    use windows::Win32::Foundation::{CloseHandle, HANDLE, HLOCAL, LocalFree};
    use windows::Win32::Security::Authorization::ConvertSidToStringSidW;
    use windows::Win32::Security::{GetTokenInformation, TOKEN_QUERY, TOKEN_USER, TokenUser};
    use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};
    use windows::core::PWSTR;

    // SAFETY: the token handle is closed and the string freed before returning;
    // the buffer is sized by the first GetTokenInformation call.
    unsafe {
        let mut token = HANDLE::default();
        OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token).ok()?;
        let mut len = 0u32;
        let _ = GetTokenInformation(token, TokenUser, None, 0, &mut len);
        let mut buf = vec![0u8; len as usize];
        let ok = GetTokenInformation(token, TokenUser, Some(buf.as_mut_ptr().cast()), len, &mut len).is_ok();
        let _ = CloseHandle(token);
        if !ok {
            return None;
        }
        let user = &*(buf.as_ptr().cast::<TOKEN_USER>());
        let mut text = PWSTR::null();
        ConvertSidToStringSidW(user.User.Sid, &mut text).ok()?;
        let sid = text.to_string().ok();
        let _ = LocalFree(Some(HLOCAL(text.0.cast())));
        sid
    }
}

/// Every account Windows has a profile for.
#[cfg(windows)]
pub fn read_profile_rows() -> Vec<ProfileRow> {
    use crate::winreg::{Key, Root, expand_env};
    let me = current_user_sid();
    let Some(list) = Key::open(Root::LocalMachine, r"SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList") else { return Vec::new() };
    list.subkey_names()
        .into_iter()
        .filter_map(|sid| {
            let path = list.open_sub(&sid)?.string("ProfileImagePath").map(|p| expand_env(&p)).unwrap_or_default();
            Some(ProfileRow { loaded: Key::open(Root::Users, &sid).is_some(), me: me.as_deref() == Some(sid.as_str()), sid, path })
        })
        .collect()
}

#[cfg(not(windows))]
pub fn read_profile_rows() -> Vec<ProfileRow> {
    Vec::new()
}

pub fn list_other_profiles() -> Vec<Profile> {
    other_profiles(&read_profile_rows())
}

/* ----------------------------------------------------------- install traces */

/// What the list needs from a trace file: which program it belongs to.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TraceSummary {
    pub id: String,
    pub program_name: Option<String>,
    pub registry_key: Option<String>,
}

#[derive(Deserialize)]
struct TraceFile {
    id: Option<String>,
    program: Option<TraceProgram>,
}

#[derive(Deserialize)]
struct TraceProgram {
    name: Option<String>,
    #[serde(rename = "registryKey")]
    registry_key: Option<String>,
}

fn is_trace_id(value: &str) -> bool {
    value.len() == 16 && value.bytes().all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'f'))
}

/// One summary per `install-traces/<16 hex>.json`, without the file lists.
/// The folder sits beside `settings.json` and the quarantine, so an upgrade
/// never touches it.
pub fn list_traces(root: &Path) -> Vec<TraceSummary> {
    let Ok(entries) = std::fs::read_dir(root) else { return Vec::new() };
    let mut found = Vec::new();
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        let Some(stem) = name.strip_suffix(".json").filter(|s| is_trace_id(s)) else { continue };
        let Some(trace) = std::fs::read(entry.path()).ok().and_then(|b| serde_json::from_slice::<TraceFile>(&b).ok()) else { continue };
        found.push(TraceSummary {
            id: trace.id.unwrap_or_else(|| stem.to_owned()),
            program_name: trace.program.as_ref().and_then(|p| p.name.clone()),
            registry_key: trace.program.and_then(|p| p.registry_key),
        });
    }
    found
}

/// The install monitor's record of a program: by its own Add/Remove key
/// first (exact), and by display name only when the program has no key to
/// compare, since two versions side by side can share a name.
pub fn trace_for_program<'a>(program: &Program, traces: &'a [TraceSummary]) -> Option<&'a TraceSummary> {
    if let Some(key) = program.registry_key.as_deref().filter(|k| !k.is_empty()) {
        let key = canonical_key(key);
        return traces.iter().find(|t| t.registry_key.as_deref().is_some_and(|k| canonical_key(k) == key));
    }
    let name = program.name.trim().to_lowercase();
    (!name.is_empty()).then(|| traces.iter().find(|t| t.program_name.as_deref().is_some_and(|n| n.trim().to_lowercase() == name))).flatten()
}
```


**Create `native/crates/prune-core/src/programs/hidden.rs`:**

```rust
//! Programs the person hid from the Applications list, by a key that
//! survives the next read of the registry (`frontend/src/lib/hiddenPrograms.js`,
//! `normalizeHiddenPrograms` in `settings.js`). Stored in the `hiddenPrograms`
//! setting. Hiding itself is 2c; reading the list is part of showing one.
//!
//! The row's `id` is not that key. A registry program's id is the subkey's bare
//! name, which is not unique across the hives (the second "7-Zip" is
//! "7-Zip#2", and which one gets the suffix depends on read order); a Store
//! app's id carries its version, so every update would quietly unhide it.

use std::collections::HashSet;

use serde_json::Value;

use super::model::{Program, Source};

const KEY_MAX: usize = 1024;
const LIST_MAX: usize = 5000;

/// The stored list as the screen can rely on it: distinct, trimmed, non-blank
/// strings. Anything else in a hand-edited file reads as nothing hidden, which
/// shows MORE rather than less.
pub fn normalize_hidden_programs(value: Option<&Value>) -> Vec<String> {
    let Some(Value::Array(list)) = value else { return Vec::new() };
    let mut seen = HashSet::new();
    let mut keys = Vec::new();
    for entry in list {
        if keys.len() >= LIST_MAX {
            break;
        }
        let Some(key) = entry.as_str().map(str::trim).filter(|k| !k.is_empty() && k.chars().count() <= KEY_MAX) else { continue };
        if seen.insert(key.to_owned()) {
            keys.push(key.to_owned());
        }
    }
    keys
}

/// In order of what is genuinely stable: a registry entry's full key path
/// (unique by construction), a Store app's package name without its version,
/// anything else's own id with the dedupe suffix taken off. Lowercased:
/// registry paths and package names are case-insensitive.
pub fn program_hide_key(program: &Program) -> Option<String> {
    if let Some(key) = program.registry_key.as_deref().map(str::trim).filter(|k| !k.is_empty()) {
        return Some(format!("reg:{}", key.to_lowercase()));
    }
    if program.source == Source::Store {
        if let Some(name) = program.package_name.as_deref().map(str::trim).filter(|n| !n.is_empty()) {
            return Some(format!("store:{}", name.to_lowercase()));
        }
    }
    if program.id.is_empty() {
        return None;
    }
    let base = match program.id.rsplit_once('#') {
        Some((head, tail)) if !tail.is_empty() && tail.bytes().all(|b| b.is_ascii_digit()) => head,
        _ => &program.id,
    };
    Some(format!("id:{}", base.to_lowercase()))
}

pub fn is_program_hidden(program: &Program, hidden: &HashSet<String>) -> bool {
    program_hide_key(program).is_some_and(|k| hidden.contains(&k))
}
```


`programs/mod.rs` gains `pub mod accounts;` and `pub mod hidden;`.

- [ ] **Step 4:** Expected: 5 passed.
- [ ] **Step 5: Commit** `feat(native): other accounts, install-monitor records and the hidden list`

### Task 12: Program icons

**Files:**
- Create: `native/crates/prune-core/src/programs/icons.rs`
- Modify: `native/crates/prune-core/src/programs/mod.rs`
- Test: `native/crates/prune-core/tests/programs_icons.rs` (also covers Task 13)

**Interfaces:**
- Produces: `IconImage`, `RowIcon`, `type_icon_extension`, `is_bootstrapper_path`, `product_family`, `generic_icon_ids`, `icon_source_ladder`, `read_msi_product_icons`, `resolve_program_icons`, `extract_icon`, `file_type_icon`, `pick_logo_file`, `pick_extension_icon`.
- The ladder is DisplayIcon, then the real binary in InstallLocation, then the uninstaller, then Windows Installer's `ProductIcon`, in that order (Discord and Epic register no DisplayIcon, and ranking the uninstaller second once cost Discord its icon because Squirrel's `Update.exe` carries none). Extraction is 64 x 64 and once per distinct file and index, on four threads. After extraction an icon that identifies nothing is thrown away: nineteen different products here shared one WiX setup glyph. Two signals must both fire (the picture came from `Package Cache`, and the programs sharing it are not one product's versions or architectures); either alone keeps the icon, because this removes icons and an uncertain case must end with the icon still there. A file whose own icon cannot be read falls back to the shell's icon for its type only where the type says something (scripts yes; `.exe` and `.msi` no, whose type icon is one shared glyph).

- [ ] **Step 1: Write the tests.**

**Create `native/crates/prune-core/tests/programs_icons.rs`:**

```rust
//! Icon sources and extraction, ported from 3.x's iconSource.test.js,
//! genericIcon.test.js, msiProductIcon.test.js, iconTypeFallback.test.js and
//! packageIcons.test.js.

use prune_core::programs::icons::*;
use prune_core::programs::package_icons::*;
use serde_json::json;

#[test]
fn only_types_whose_icon_is_not_inside_the_file_get_a_type_icon() {
    for own in ["C:\\a\\setup.exe", "x.DLL", "y.msi", "z.ico", "w.lnk"] {
        assert_eq!(type_icon_extension(own), None, "{own}");
    }
    assert_eq!(type_icon_extension(r"C:\Users\u\run.CMD").as_deref(), Some(".cmd"));
    assert_eq!(type_icon_extension(r"C:\Windows\System32\drivers\etc\hosts"), None);
    assert_eq!(type_icon_extension(r"C:\dir.with.dots\noext"), None);
}

#[test]
fn a_product_family_ignores_versions_and_architectures_but_not_dotted_products() {
    assert_eq!(product_family("Python 3.14.5 (64-bit)"), product_family("Python 3.12.3 (64-bit)"));
    assert_eq!(product_family("Microsoft Visual C++ 2015-2022 Redistributable (x64) - 14.38.33135"), product_family("Microsoft Visual C++ 2015-2022 Redistributable (x86) - 14.38.33135"));
    assert_ne!(product_family("Microsoft Visual C++ Redistributable"), product_family("Microsoft Windows Desktop Runtime"));
    // ".NET" is dotted and is a product: collapsing these would hide the very check.
    assert_ne!(product_family(".NET SDK 8.0"), product_family("ASP.NET Core 8.0"));
    assert_eq!(product_family("7-Zip 22.01"), "7-zip");
    assert_eq!(product_family("1.2.3"), "1.2.3");
    assert_eq!(product_family(""), "");
}

fn entry<'a>(id: &'a str, name: &'a str, path: &'a str, picture: u64) -> IconEntry<'a> {
    IconEntry { id, name, path, picture }
}

#[test]
fn an_installers_default_glyph_is_thrown_away_only_when_both_signals_fire() {
    let cache = r"C:\ProgramData\Package Cache\{a}\x.exe";
    // Nineteen different products sharing the WiX setup glyph from the Package Cache.
    let all = [entry("vc", "Microsoft Visual C++ Redistributable", cache, 1), entry("rt", "Microsoft Windows Desktop Runtime", cache, 1), entry("sdk", ".NET SDK 8.0", cache, 1)];
    let rejected = generic_icon_ids(&all);
    assert_eq!(rejected.len(), 3);

    // Two architectures of ONE product sharing a picture: that is its real icon.
    let same = [entry("a", "Python 3.14 (64-bit)", cache, 2), entry("b", "Python 3.12 (64-bit)", cache, 2)];
    assert!(generic_icon_ids(&same).is_empty());

    // Vendor branding from the product's OWN folder is never touched, even across products.
    let own = r"C:\Program Files\NVIDIA\x.exe";
    let branded = [entry("g", "NVIDIA GeForce", own, 3), entry("p", "NVIDIA PhysX", own, 3), entry("c", "NVIDIA Container", cache, 3)];
    assert!(generic_icon_ids(&branded).is_empty());
    assert!(generic_icon_ids(&[entry("only", "One", cache, 4)]).is_empty());
}

fn names(list: &[&str]) -> Vec<String> {
    list.iter().map(|s| (*s).to_owned()).collect()
}

#[test]
fn a_declared_store_logo_is_a_stem_to_match_not_a_path_to_open() {
    let files = names(&["PaintAppList.scale-200.png", "PaintAppList.targetsize-48.png", "PaintAppList.targetsize-32_altform-unplated.png", "PaintAppList.targetsize-32.png", "Other.png"]);
    assert_eq!(pick_logo_file(r"Assets\PaintAppList.png", &files).as_deref(), Some("PaintAppList.targetsize-32_altform-unplated.png"));
    // The exact file wins when it is really there.
    assert_eq!(pick_logo_file("Other.png", &files).as_deref(), Some("Other.png"));
    assert_eq!(pick_logo_file("Missing.png", &files), None);
    assert_eq!(pick_logo_file("", &files), None);
    assert_eq!(pick_logo_file("X.png", &[]), None);
}

#[test]
fn an_extension_icon_is_the_size_closest_to_48_and_on_a_tie_the_larger() {
    assert_eq!(pick_extension_icon(&json!({"16":"a.png","48":"b.png","128":"c.png"})).as_deref(), Some("b.png"));
    assert_eq!(pick_extension_icon(&json!({"32":"a.png","64":"b.png"})).as_deref(), Some("b.png"));
    assert_eq!(pick_extension_icon(&json!({"x":"a.png","16":""})), None);
    assert_eq!(pick_extension_icon(&json!(null)), None);
}

#[test]
fn the_logo_is_read_from_the_manifest() {
    assert_eq!(declared_store_logo(r#"<uap:VisualElements Square44x44Logo="Assets\Paint.png" Square150x150Logo="x"/>"#).as_deref(), Some(r"Assets\Paint.png"));
    assert_eq!(declared_store_logo("<Properties><Logo>Assets/Store.png</Logo></Properties>").as_deref(), Some("Assets/Store.png"));
    assert_eq!(declared_store_logo("<Package/>"), None);
}

#[cfg(windows)]
mod windows_only {
    use super::*;
    use prune_core::programs::model::Program;

    #[test]
    fn a_real_executables_icon_is_extracted_at_64_pixels_with_transparency() {
        let system = std::env::var("SystemRoot").unwrap_or_else(|_| r"C:\Windows".into());
        let image = extract_icon(&format!(r"{system}\System32\notepad.exe"), 0).expect("notepad has an icon");
        assert_eq!((image.width, image.height), (64, 64));
        assert_eq!(image.rgba.len(), 64 * 64 * 4);
        let pixels: std::collections::HashSet<&[u8]> = image.rgba.chunks_exact(4).collect();
        assert!(pixels.len() > 8, "an icon is a picture, not one colour");
        assert!(image.rgba.chunks_exact(4).any(|p| p[3] > 0), "and it is visible");
        assert!(extract_icon(r"C:\no\such.exe", 0).is_none());
    }

    #[test]
    fn the_shells_script_icon_is_found_by_name_alone() {
        assert!(file_type_icon(".cmd").is_some());
    }

    #[test]
    fn a_png_is_decoded_and_shrunk_to_fit_64() {
        let dir = std::env::temp_dir().join(format!("prune-png-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("wide.png");
        let mut encoder = png::Encoder::new(std::fs::File::create(&path).unwrap(), 128, 64);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        let mut writer = encoder.write_header().unwrap();
        writer.write_image_data(&[200, 40, 40, 255].repeat(128 * 64)).unwrap();
        writer.finish().unwrap();
        let image = decode_raster(&path).expect("WIC decodes PNG");
        assert_eq!((image.width, image.height), (64, 32));
        assert_eq!(&image.rgba[..4], &[200, 40, 40, 255]);
        assert!(decode_raster(&dir.join("missing.png")).is_none());
    }

    #[test]
    fn matches_3x_coverage_on_this_machine() {
        let Some(dir) = std::env::var_os("PRUNE_3X_DIR").map(std::path::PathBuf::from) else { return };
        let read = |f: &str| -> serde_json::Value { serde_json::from_slice(&std::fs::read(dir.join(f)).unwrap()).unwrap() };

        let programs: Vec<Program> = prune_core::programs::registry::list_installed_programs();
        let started = std::time::Instant::now();
        let ours = resolve_program_icons(&programs);
        eprintln!("registry icons: {} in {:?}", ours.len(), started.elapsed());
        let theirs = read("icons.json");
        let theirs = theirs["icons"].as_object().unwrap();
        let both = theirs.keys().filter(|id| ours.contains_key(*id)).count();
        eprintln!("3.x had {}, we have {}, both {}", theirs.len(), ours.len(), both);
        // 3.x's icons are the bar: at least 95% of them, and nothing wildly extra.
        assert!(both * 100 >= theirs.len() * 95, "{both} of {}", theirs.len());
        assert!(ours.len() <= theirs.len() + 10);

        let mut rows = prune_core::programs::store::list_store_apps();
        rows.extend(prune_core::programs::extensions::list_browser_extensions());
        let started = std::time::Instant::now();
        let packages = resolve_package_icons(&rows);
        eprintln!("package icons: {} in {:?}", packages.len(), started.elapsed());
        let theirs = read("package-icons.json");
        let theirs = theirs["icons"].as_object().unwrap();
        let both = theirs.keys().filter(|id| packages.contains_key(*id)).count();
        eprintln!("3.x had {}, we have {}, both {}", theirs.len(), packages.len(), both);
        assert!(both * 100 >= theirs.len() * 90, "{both} of {}", theirs.len());
    }
}
```


- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3: Implement.**

**Create `native/crates/prune-core/src/programs/icons.rs`:**

```rust
//! Every row's real icon (`services/programIcons.js`, `iconSource.js`,
//! `iconExtract.js`, `genericIcon.js`, `iconTypeFallback.js`,
//! `msiProductIcon.js`, `packageIcons.js`).
//!
//! Where an icon comes from, in descending order of how likely it is to be the
//! one a person would recognise: the DisplayIcon the vendor registered; the
//! real binary in InstallLocation (what rescues Discord and Epic, which
//! register none); the uninstaller; Windows Installer's `ProductIcon`. The
//! order matters more than it looks: with the uninstaller second, Discord got
//! no icon at all, because Squirrel's Update.exe satisfied the fallback and
//! then turned out to carry none.

use std::collections::HashMap;
use std::path::Path;

use serde_json::Value;

use super::model::Program;
use super::paths::{IconSource, icon_source_for, icon_source_from_uninstaller, pack_product_code, parse_icon_source, product_code_from};
use super::versions::find_main_executable;

/// Straight (not premultiplied) RGBA, row by row.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct IconImage {
    pub width: u32,
    pub height: u32,
    pub rgba: Vec<u8>,
}

/// What a row draws: a bitmap, or an SVG the renderer rasterizes at the size
/// it needs (some extensions only ship an SVG).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RowIcon {
    Raster(IconImage),
    Svg(Vec<u8>),
}

/* ----------------------------------------------------- the pure decisions */

/// File types whose icon lives inside the file, so the shell's answer for the
/// TYPE is worth nothing: the shell's icon for ".exe" is one generic glyph,
/// and on the startup screen it made two unrelated programs byte-identical.
const OWN_ICON_TYPES: [&str; 11] = [".exe", ".dll", ".com", ".scr", ".cpl", ".ocx", ".ico", ".mun", ".msi", ".msp", ".lnk"];

/// The extension a file-type icon can usefully be asked for, or `None`
/// (a script is "what a batch file looks like"; `hosts` has no type at all).
pub fn type_icon_extension(path: &str) -> Option<String> {
    let dot = path.rfind('.')?;
    let ext = &path[dot..];
    let valid = (2..=13).contains(&ext.len()) && ext[1..].bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-');
    let ext = ext.to_lowercase();
    (valid && !path[dot..].contains(['\\', '/']) && !OWN_ICON_TYPES.contains(&ext.as_str())).then_some(ext)
}

/// `C:\ProgramData\Package Cache` is where WiX keeps the bootstrapper it was
/// installed from, one GUID-named folder per bundle.
pub fn is_bootstrapper_path(path: &str) -> bool {
    path.to_lowercase().replace('/', "\\").contains("\\package cache\\")
}

fn is_version_token(token: &str) -> bool {
    let body = token.strip_prefix('v').unwrap_or(token);
    !body.is_empty() && body.split('.').all(|p| !p.is_empty() && p.bytes().all(|b| b.is_ascii_digit()))
}

fn is_architecture_token(token: &str) -> bool {
    matches!(token, "x64" | "x86" | "amd64" | "arm64" | "win32" | "32-bit" | "64-bit")
}

/// The product a name belongs to, with version and architecture removed. Only
/// used to ask one question: do the programs sharing a picture belong to one
/// product or several? ".NET" is dotted and is a product, so version-ness is
/// digits and dots only.
pub fn product_family(name: &str) -> String {
    let text = name.trim();
    if text.is_empty() {
        return String::new();
    }
    let without_suffix = text.split(" - ").next().unwrap_or(text);
    let mut stripped = String::new();
    let mut depth = 0;
    for c in without_suffix.chars() {
        match c {
            '(' => depth += 1,
            ')' if depth > 0 => {
                depth -= 1;
                stripped.push(' ');
            }
            _ if depth == 0 => stripped.push(c),
            _ => {}
        }
    }
    let tokens: Vec<String> = stripped
        .to_lowercase()
        .split_whitespace()
        .flat_map(|t| {
            // "7.6.5.0-x64" arrives as one token: split a version welded to an architecture.
            match t.rsplit_once('-') {
                Some((head, arch)) if matches!(arch, "x64" | "x86" | "amd64" | "arm64" | "win32") => vec![head.to_owned(), arch.to_owned()],
                _ => vec![t.to_owned()],
            }
        })
        .filter(|t| !t.is_empty() && !is_version_token(t) && !is_architecture_token(t))
        .collect();
    let family = tokens.join(" ");
    if family.is_empty() { text.to_lowercase() } else { family }
}

/// One extracted picture of one program, for judging whether it identifies it.
pub struct IconEntry<'a> {
    pub id: &'a str,
    pub name: &'a str,
    pub path: &'a str,
    pub picture: u64,
}

/// The ids whose icon should be thrown away: nineteen programs here (every
/// Visual C++ redistributable, .NET runtime and SDK) rendered as one
/// byte-identical WiX setup glyph, each row claiming to be the other
/// eighteen. Two signals, and BOTH must fire: the picture came from an
/// installer (not from the product's own folder), and the programs sharing it
/// are not versions or architectures of one product. A picture that fails
/// either test is kept, because this removes icons and an uncertain case must
/// end with the icon still there.
pub fn generic_icon_ids(entries: &[IconEntry]) -> std::collections::HashSet<String> {
    let mut groups: HashMap<u64, Vec<&IconEntry>> = HashMap::new();
    for entry in entries {
        groups.entry(entry.picture).or_default().push(entry);
    }
    let mut rejected = std::collections::HashSet::new();
    for members in groups.values().filter(|m| m.len() >= 2) {
        if !members.iter().all(|m| is_bootstrapper_path(m.path)) {
            continue;
        }
        let families: std::collections::HashSet<String> = members.iter().map(|m| product_family(m.name)).collect();
        if families.len() >= 2 {
            rejected.extend(members.iter().map(|m| m.id.to_owned()));
        }
    }
    rejected
}

/// The best available file for a declared Store logo. A manifest names
/// "Assets\PaintAppList.png", and that exact file frequently does not exist:
/// Windows ships only the scaled and target-size variants beside it, so the
/// declared name is a stem to match against. "unplated" drops the coloured tile
/// behind the glyph, which suits a list row.
pub fn pick_logo_file(declared: &str, available: &[String]) -> Option<String> {
    if declared.is_empty() || available.is_empty() {
        return None;
    }
    let wanted = declared.rsplit(['\\', '/']).next().unwrap_or(declared);
    if let Some(exact) = available.iter().find(|n| n.eq_ignore_ascii_case(wanted)) {
        return Some(exact.clone());
    }
    let stem = wanted.rsplit_once('.').map_or(wanted, |(s, _)| s).to_lowercase();
    let variants: Vec<&String> = available.iter().filter(|n| n.to_lowercase().starts_with(&format!("{stem}."))).collect();
    for qualifier in ["targetsize-32", "targetsize-48", "targetsize-24", "targetsize-16", "scale-100", "scale-200"] {
        let has = |n: &&String, extra: bool| {
            let l = n.to_lowercase();
            l.contains(qualifier) && (!extra || l.contains("unplated"))
        };
        if let Some(v) = variants.iter().find(|n| has(n, true)).or_else(|| variants.iter().find(|n| has(n, false))) {
            return Some((*v).clone());
        }
    }
    variants.first().map(|v| (*v).clone())
}

/// An extension's icon from its manifest `icons` map (keyed by pixel size as
/// strings): the size closest to 48, and on a tie the LARGER, because 64
/// scales down to a 20 px row cleanly and 32 scaled up does not.
pub fn pick_extension_icon(icons: &Value) -> Option<String> {
    let mut sizes: Vec<(i64, &str)> = icons
        .as_object()?
        .iter()
        .filter_map(|(k, v)| Some((k.parse::<i64>().ok()?, v.as_str().filter(|p| !p.is_empty())?)))
        .collect();
    sizes.sort_by(|a, b| (a.0 - 48).abs().cmp(&(b.0 - 48).abs()).then(b.0.cmp(&a.0)));
    sizes.first().map(|(_, p)| (*p).to_owned())
}

/* -------------------------------------------------------- resolving sources */

/// Where each program's icon comes from, in the four-step order. `msi` maps a
/// product code to the file Windows Installer cached for it.
pub fn icon_source_ladder(program: &Program, msi: &HashMap<String, IconSource>) -> Option<IconSource> {
    icon_source_for(program)
        .or_else(|| {
            let location = program.install_location.as_deref()?;
            find_main_executable(location, &program.name).map(|path| IconSource { path, index: 0 })
        })
        .or_else(|| icon_source_from_uninstaller(program))
        .or_else(|| msi.get(&product_code_from(program.uninstall_string.as_deref()?)?).cloned())
}

/// The icon Windows Installer registered for each MSI product, from
/// `HKLM\SOFTWARE\Classes\Installer\Products\<packed code>\ProductIcon`. A path
/// that is no longer on disk (C:\Windows\Installer gets cleaned out) is dropped
/// here rather than discovered later as a failed extraction.
#[cfg(windows)]
pub fn read_msi_product_icons(codes: &[String]) -> HashMap<String, IconSource> {
    use crate::winreg::{Key, Root};
    let mut found = HashMap::new();
    for code in codes {
        let Some(packed) = pack_product_code(code) else { continue };
        let Some(raw) = Key::open(Root::LocalMachine, &format!(r"SOFTWARE\Classes\Installer\Products\{packed}")).and_then(|k| k.string("ProductIcon")) else { continue };
        if let Some(source) = parse_icon_source(&raw).filter(|s| Path::new(&s.path).exists()) {
            found.insert(code.clone(), source);
        }
    }
    found
}

#[cfg(not(windows))]
pub fn read_msi_product_icons(_: &[String]) -> HashMap<String, IconSource> {
    let _ = (pack_product_code(""), parse_icon_source(""), Path::new(""));
    HashMap::new()
}

fn hash_picture(image: &IconImage) -> u64 {
    use std::hash::{Hash, Hasher};
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    image.hash(&mut hasher);
    hasher.finish()
}

/// Every installed program's icon, as `{ programId: IconImage }`. A program
/// with no icon is simply absent and keeps its lettered tile.
pub fn resolve_program_icons(programs: &[Program]) -> HashMap<String, IconImage> {
    let codes: Vec<String> = programs.iter().filter_map(|p| product_code_from(p.uninstall_string.as_deref()?)).collect();
    let msi = read_msi_product_icons(&codes);

    // One extraction per distinct file and index: several entries legitimately
    // point at the same executable.
    let mut source_of: HashMap<&str, IconSource> = HashMap::new();
    for program in programs {
        if let Some(source) = icon_source_ladder(program, &msi) {
            source_of.insert(&program.id, source);
        }
    }
    let mut distinct: Vec<(String, i32)> = source_of.values().map(|s| (s.path.clone(), s.index)).collect();
    distinct.sort();
    distinct.dedup();
    let extracted: HashMap<(String, i32), Option<IconImage>> = extract_many(&distinct).into_iter().collect();

    let names: HashMap<&str, &str> = programs.iter().map(|p| (p.id.as_str(), p.name.as_str())).collect();
    let entries: Vec<IconEntry> = source_of
        .iter()
        .filter_map(|(id, s)| {
            let picture = extracted.get(&(s.path.clone(), s.index))?.as_ref()?;
            Some(IconEntry { id, name: names.get(id).copied().unwrap_or(""), path: &s.path, picture: hash_picture(picture) })
        })
        .collect();
    let rejected = generic_icon_ids(&entries);

    let mut icons = HashMap::new();
    let mut needs_type: Vec<(&str, String)> = Vec::new();
    for (id, source) in &source_of {
        match extracted.get(&(source.path.clone(), source.index)).cloned().flatten() {
            Some(image) if !rejected.contains(*id) => {
                icons.insert((*id).to_owned(), image);
            }
            // Only where the type says something the file's own icon cannot.
            _ => needs_type.extend(type_icon_extension(&source.path).map(|ext| (*id, ext))),
        }
    }
    let wanted: Vec<String> = { let mut e: Vec<String> = needs_type.iter().map(|(_, e)| e.clone()).collect(); e.sort(); e.dedup(); e };
    let by_type: HashMap<String, IconImage> = wanted.iter().filter_map(|e| Some((e.clone(), file_type_icon(e)?))).collect();
    for (id, ext) in needs_type {
        if let Some(image) = by_type.get(&ext) {
            icons.insert(id.to_owned(), image.clone());
        }
    }
    icons
}

/// Extracts the distinct icons on a few threads: opening a hundred executables
/// is I/O, and nothing in it depends on another file.
fn extract_many(distinct: &[(String, i32)]) -> Vec<((String, i32), Option<IconImage>)> {
    use std::sync::Mutex;
    use std::sync::atomic::{AtomicUsize, Ordering};
    let next = AtomicUsize::new(0);
    let out = Mutex::new(Vec::with_capacity(distinct.len()));
    std::thread::scope(|scope| {
        for _ in 0..distinct.len().clamp(1, 4) {
            scope.spawn(|| {
                while let Some((path, index)) = distinct.get(next.fetch_add(1, Ordering::Relaxed)) {
                    let image = extract_icon(path, *index);
                    if let Ok(mut out) = out.lock() {
                        out.push(((path.clone(), *index), image));
                    }
                }
            });
        }
    });
    out.into_inner().unwrap_or_default()
}

/* --------------------------------------------------------------- Windows */

/// The icon at `index` in `path` at 64x64, from an .exe or .dll resource or an
/// .ico file. `PrivateExtractIconsW` takes the size as an argument, where
/// `ExtractAssociatedIcon` always returns 32x32, visibly soft on a high-DPI
/// screen. Every handle is destroyed: these are real GDI objects.
#[cfg(windows)]
pub fn extract_icon(path: &str, index: i32) -> Option<IconImage> {
    use windows::Win32::UI::WindowsAndMessaging::{DestroyIcon, HICON, PrivateExtractIconsW};
    if !Path::new(path).exists() {
        return None;
    }
    let mut name = [0u16; 260];
    let wide: Vec<u16> = path.encode_utf16().collect();
    if wide.len() >= name.len() {
        return None;
    }
    name[..wide.len()].copy_from_slice(&wide);
    let mut icons = [HICON::default()];
    // SAFETY: `name` is NUL-terminated and `icons` holds the one handle asked for.
    let count = unsafe { PrivateExtractIconsW(&name, index, 64, 64, Some(&mut icons), None, 0) };
    if count == 0 || icons[0].is_invalid() {
        return None;
    }
    let image = hicon_to_image(icons[0]);
    // SAFETY: the handle came from PrivateExtractIconsW.
    unsafe {
        let _ = DestroyIcon(icons[0]);
    }
    image
}

#[cfg(windows)]
fn hicon_to_image(icon: windows::Win32::UI::WindowsAndMessaging::HICON) -> Option<IconImage> {
    use windows::Win32::Graphics::Gdi::{
        BI_RGB, BITMAP, BITMAPINFO, BITMAPINFOHEADER, DIB_RGB_COLORS, DeleteObject, GetDC, GetDIBits, GetObjectW, HBITMAP, ReleaseDC,
    };
    use windows::Win32::UI::WindowsAndMessaging::{GetIconInfo, ICONINFO};

    // SAFETY: the ICONINFO bitmaps are deleted, the device context released,
    // and every buffer is sized to the bitmap it receives.
    unsafe {
        let mut info = ICONINFO::default();
        GetIconInfo(icon, &mut info).ok()?;
        let result = (|| {
            let mut bitmap = BITMAP::default();
            if GetObjectW(info.hbmColor.into(), size_of::<BITMAP>() as i32, Some((&raw mut bitmap).cast())) == 0 {
                return None;
            }
            let (width, height) = (bitmap.bmWidth, bitmap.bmHeight);
            if width <= 0 || height <= 0 || width > 512 || height > 512 {
                return None;
            }
            let dc = GetDC(None);
            let read = |bitmap: HBITMAP| -> Vec<u8> {
                let mut header = BITMAPINFO {
                    bmiHeader: BITMAPINFOHEADER {
                        biSize: size_of::<BITMAPINFOHEADER>() as u32,
                        biWidth: width,
                        // Negative: top-down rows.
                        biHeight: -height,
                        biPlanes: 1,
                        biBitCount: 32,
                        biCompression: BI_RGB.0,
                        ..Default::default()
                    },
                    ..Default::default()
                };
                let mut pixels = vec![0u8; (width * height * 4) as usize];
                let got = GetDIBits(dc, bitmap, 0, height as u32, Some(pixels.as_mut_ptr().cast()), &mut header, DIB_RGB_COLORS);
                if got == 0 { Vec::new() } else { pixels }
            };
            let mut bgra = read(info.hbmColor);
            let mask = if info.hbmMask.is_invalid() { Vec::new() } else { read(info.hbmMask) };
            ReleaseDC(None, dc);
            if bgra.is_empty() {
                return None;
            }
            // An icon from before alpha channels carries its transparency in the mask.
            if bgra.chunks_exact(4).all(|p| p[3] == 0) {
                for (px, m) in bgra.chunks_exact_mut(4).zip(mask.chunks_exact(4)) {
                    px[3] = if m.first().copied().unwrap_or(255) == 0 { 255 } else { 0 };
                }
            }
            for px in bgra.chunks_exact_mut(4) {
                px.swap(0, 2);
            }
            Some(IconImage { width: width as u32, height: height as u32, rgba: bgra })
        })();
        let _ = DeleteObject(info.hbmColor.into());
        if !info.hbmMask.is_invalid() {
            let _ = DeleteObject(info.hbmMask.into());
        }
        result
    }
}

/// The shell's icon for a file TYPE (`SHGetFileInfo` with
/// `SHGFI_USEFILEATTRIBUTES` resolves from the name alone, so "x.cmd" gives the
/// script icon without any such file existing).
#[cfg(windows)]
pub fn file_type_icon(extension: &str) -> Option<IconImage> {
    use windows::Win32::Storage::FileSystem::FILE_ATTRIBUTE_NORMAL;
    use windows::Win32::UI::Shell::{SHFILEINFOW, SHGFI_ICON, SHGFI_USEFILEATTRIBUTES, SHGetFileInfoW};
    use windows::Win32::UI::WindowsAndMessaging::DestroyIcon;
    use windows::core::HSTRING;

    let mut info = SHFILEINFOW::default();
    // SAFETY: `info` is a valid SHFILEINFOW; the icon handle is destroyed.
    unsafe {
        let result = SHGetFileInfoW(&HSTRING::from(format!("file{extension}")), FILE_ATTRIBUTE_NORMAL, Some(&mut info), size_of::<SHFILEINFOW>() as u32, SHGFI_ICON | SHGFI_USEFILEATTRIBUTES);
        if result == 0 || info.hIcon.is_invalid() {
            return None;
        }
        let image = hicon_to_image(info.hIcon);
        let _ = DestroyIcon(info.hIcon);
        image
    }
}

#[cfg(not(windows))]
pub fn extract_icon(_: &str, _: i32) -> Option<IconImage> {
    None
}

#[cfg(not(windows))]
pub fn file_type_icon(_: &str) -> Option<IconImage> {
    None
}
```


`programs/mod.rs` gains `pub mod icons;`.

- [ ] **Step 4:** Expected (after Task 13 also exists): 10 passed. Until then the Task 13 tests do not compile; run Tasks 12 and 13 together.
- [ ] **Step 5:** Commit with Task 13.

### Task 13: Store and extension icons

**Files:**
- Create: `native/crates/prune-core/src/programs/package_icons.rs`
- Modify: `native/crates/prune-core/src/programs/mod.rs`
- Test: `native/crates/prune-core/tests/programs_icons.rs` (written in Task 12)

**Interfaces:**
- Produces: `decode_raster`, `declared_store_logo`, `store_icon`, `extension_icon`, `resolve_package_icons`.
- A Store logo is the manifest's `Square44x44Logo` (else `<Logo>`) treated as a stem: the exact file usually does not exist, only `.scale-200` and `.targetsize-32` variants, with `unplated` preferred. An extension's icon is the manifest size nearest 48, the larger on a tie. Files over 256 KB are not icons. PNG, JPEG, GIF and WebP (where Windows has the codec) decode through WIC to at most 64 px; SVG is kept as SVG.

- [ ] **Step 1:** The tests are the ones written in Task 12.
- [ ] **Step 2: Implement.**

**Create `native/crates/prune-core/src/programs/package_icons.rs`:**

```rust
//! Icons for the rows that do not come from the registry: Store apps and
//! browser extensions (`services/packageIcons.js`). They arrived with
//! lettered tiles beside registry programs showing their real icons, which made
//! the new rows look half-finished. Their icons are ordinary image files inside
//! the package or extension folder, so this is file reading and image
//! decoding, not icon extraction.
//!
//! Decoding goes through the Windows Imaging Component, which Windows already
//! ships (PNG, JPEG, GIF, and WebP where its codec is installed): no image
//! decoder is added to Prune. SVG is kept as SVG for the renderer to draw.

use std::collections::HashMap;
use std::path::Path;

use serde_json::Value;

use super::icons::{IconImage, RowIcon, pick_extension_icon, pick_logo_file};
use super::model::{Program, Source};

/// The row renders at 20 px, so a 64 px bitmap is crisp up to 300% scaling
/// and small enough that two hundred of them stay a few megabytes.
const MAX_EDGE: u32 = 64;

/// An icon this large is not an icon; refusing it keeps one odd package from
/// inflating everything.
const MAX_ICON_BYTES: u64 = 256 * 1024;

/// Decodes an image file to straight RGBA, no larger than [`MAX_EDGE`].
#[cfg(windows)]
pub fn decode_raster(path: &Path) -> Option<IconImage> {
    use windows::Win32::Foundation::GENERIC_READ;
    use windows::Win32::Graphics::Imaging::{
        CLSID_WICImagingFactory, GUID_WICPixelFormat32bppRGBA, IWICBitmapSource, IWICImagingFactory, WICBitmapInterpolationModeFant,
        WICConvertBitmapSource, WICDecodeMetadataCacheOnDemand,
    };
    use windows::Win32::System::Com::{CLSCTX_INPROC_SERVER, COINIT_MULTITHREADED, CoCreateInstance, CoInitializeEx};
    use windows::core::{HSTRING, Interface};

    // SAFETY: COM is initialized for this thread; every interface is dropped
    // before returning, and `pixels` is sized for the stride and height asked for.
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        let factory: IWICImagingFactory = CoCreateInstance(&CLSID_WICImagingFactory, None, CLSCTX_INPROC_SERVER).ok()?;
        let decoder = factory.CreateDecoderFromFilename(&HSTRING::from(path.as_os_str()), None, GENERIC_READ, WICDecodeMetadataCacheOnDemand).ok()?;
        let frame = decoder.GetFrame(0).ok()?;
        let (mut width, mut height) = (0u32, 0u32);
        frame.GetSize(&mut width, &mut height).ok()?;
        if width == 0 || height == 0 {
            return None;
        }
        let mut source: IWICBitmapSource = frame.cast().ok()?;
        if width.max(height) > MAX_EDGE {
            let scale = f64::from(MAX_EDGE) / f64::from(width.max(height));
            let (w, h) = (((f64::from(width) * scale).round() as u32).max(1), ((f64::from(height) * scale).round() as u32).max(1));
            let scaler = factory.CreateBitmapScaler().ok()?;
            scaler.Initialize(&source, w, h, WICBitmapInterpolationModeFant).ok()?;
            source = scaler.cast().ok()?;
            (width, height) = (w, h);
        }
        let converted = WICConvertBitmapSource(&GUID_WICPixelFormat32bppRGBA, &source).ok()?;
        let mut pixels = vec![0u8; (width * height * 4) as usize];
        converted.CopyPixels(std::ptr::null(), width * 4, &mut pixels).ok()?;
        Some(IconImage { width, height, rgba: pixels })
    }
}

#[cfg(not(windows))]
pub fn decode_raster(_: &Path) -> Option<IconImage> {
    None
}

/// A file as the icon of a row, by what it is.
fn read_icon(path: &Path) -> Option<RowIcon> {
    let ext = path.extension()?.to_string_lossy().to_lowercase();
    let size = std::fs::metadata(path).ok()?.len();
    if size == 0 || size > MAX_ICON_BYTES {
        return None;
    }
    match ext.as_str() {
        "svg" => std::fs::read(path).ok().map(RowIcon::Svg),
        "png" | "jpg" | "jpeg" | "gif" | "webp" => decode_raster(path).map(RowIcon::Raster),
        _ => None,
    }
}

/// The declared logo in an `AppxManifest.xml`: `Square44x44Logo="..."`, else
/// `<Logo>...</Logo>`. Read with string search rather than an XML parser: the
/// only thing wanted is one attribute.
pub fn declared_store_logo(xml: &str) -> Option<String> {
    let lower = xml.to_lowercase();
    if let Some(at) = lower.find("square44x44logo") {
        let rest = xml[at + "square44x44logo".len()..].trim_start().strip_prefix('=')?.trim_start();
        let quote = rest.chars().next().filter(|c| *c == '"' || *c == '\'')?;
        let value = rest[1..].split(quote).next()?;
        if !value.is_empty() {
            return Some(value.to_owned());
        }
    }
    let start = lower.find("<logo>")? + "<logo>".len();
    let len = lower[start..].find("</logo>")?;
    Some(xml[start..start + len].to_owned()).filter(|v| !v.is_empty())
}

pub fn store_icon(install_location: &str) -> Option<RowIcon> {
    let xml = std::fs::read_to_string(Path::new(install_location).join("AppxManifest.xml")).ok()?;
    let declared = declared_store_logo(&xml)?;
    let relative = declared.replace('/', "\\");
    let folder = Path::new(install_location).join(Path::new(&relative).parent().unwrap_or(Path::new("")));
    let names: Vec<String> = std::fs::read_dir(&folder).ok()?.flatten().map(|e| e.file_name().to_string_lossy().into_owned()).collect();
    read_icon(&folder.join(pick_logo_file(&declared, &names)?))
}

/// `install_location` is the extension's id folder; the manifest lives one
/// level down, in the version folder. The newest-looking folder is tried first.
pub fn extension_icon(install_location: &str) -> Option<RowIcon> {
    let mut versions: Vec<_> = std::fs::read_dir(install_location).ok()?.flatten().filter(|e| e.file_type().is_ok_and(|t| t.is_dir())).collect();
    versions.reverse();
    for version in versions {
        let root = version.path();
        let Some(manifest) = std::fs::read(root.join("manifest.json")).ok().and_then(|b| serde_json::from_slice::<Value>(&b).ok()) else { continue };
        let relative = pick_extension_icon(&manifest["icons"])
            .or_else(|| pick_extension_icon(&manifest["browser_action"]["default_icon"]))
            .or_else(|| pick_extension_icon(&manifest["action"]["default_icon"]));
        if let Some(icon) = relative.and_then(|r| read_icon(&root.join(r.trim_start_matches(['/', '\\'])))) {
            return Some(icon);
        }
    }
    None
}

/// `{ rowId: icon }` for every Store app and extension that has a readable one.
pub fn resolve_package_icons(rows: &[Program]) -> HashMap<String, RowIcon> {
    rows.iter()
        .filter_map(|row| {
            let location = row.install_location.as_deref()?;
            let icon = match row.source {
                Source::Store => store_icon(location),
                Source::Extension => extension_icon(location),
                _ => None,
            }?;
            Some((row.id.clone(), icon))
        })
        .collect()
}
```


`programs/mod.rs` gains `pub mod package_icons;`.

- [ ] **Step 3:** `PRUNE_3X_DIR=<folder> cargo test -p prune-core --test programs_icons -- --nocapture`. Expected: 10 passed, and on this PC the output reads `registry icons: 90 in ~1.3s` (3.x cold: 13.5 s) with `3.x had 90, we have 90, both 90`, and `package icons: 112 in ~0.13s` (3.x cold: 5.2 s) with `both 112`.
- [ ] **Step 4: Commit** `feat(native): program, Store and extension icons through the Windows icon and imaging APIs`

### Task 14: Signatures

**Files:**
- Create: `native/crates/prune-core/src/programs/signatures.rs`
- Modify: `native/crates/prune-core/src/programs/mod.rs`
- Test: `native/crates/prune-core/tests/programs_signatures.rs`

**Interfaces:**
- Produces: `is_system_tool`, `signature_file_for`, `status_from_trust_result`, `check_file`, `resolve_signatures`.
- Valid, Unsigned (`TRUST_E_NOSIGNATURE`, after the catalog check also finds nothing) and Broken (`TRUST_E_BAD_DIGEST`, an untrusted signer or chain: the file changed after the vendor signed it, which is the case worth a red badge); anything else is no answer and the row says nothing. Never a launcher's `steam://` uninstall, never msiexec/rundll32/cmd or `System32`. Remembered per file by path, size and modification time. Four threads: `WinVerifyTrust` hashes every file.

- [ ] **Step 1: Write the tests.**

**Create `native/crates/prune-core/tests/programs_signatures.rs`:**

```rust
//! Digital signatures, ported from 3.x's programSignatures.test.js and
//! checked against what 3.x's `/api/programs/signatures` returned (Windows'
//! own `Get-AuthenticodeSignature`) for the same files.

use std::collections::HashMap;

use prune_core::programs::model::{Program, SigStatus};
use prune_core::programs::signatures::*;

fn program(display_icon: Option<&str>, location: Option<&str>, uninstall: Option<&str>) -> Program {
    Program {
        id: "p".into(),
        name: "App".into(),
        display_icon: display_icon.map(Into::into),
        install_location: location.map(Into::into),
        uninstall_string: uninstall.map(Into::into),
        ..Program::default()
    }
}

#[test]
fn windows_own_tools_never_stand_for_a_program() {
    for tool in [r"C:\Windows\System32\notepad.exe", r"c:\windows\syswow64\x.exe", r"C:\a\MsiExec.exe", "rundll32.exe", r"C:\x\cmd.exe"] {
        assert!(is_system_tool(tool), "{tool}");
    }
    assert!(!is_system_tool(r"C:\Program Files\App\app.exe"));
}

#[test]
fn the_file_is_the_vendors_icon_then_the_main_executable_then_the_uninstaller() {
    let none = |_: &str, _: &str| None;
    let main = |_: &str, _: &str| Some(r"C:\Apps\App\App.exe".to_owned());
    assert_eq!(signature_file_for(&program(Some(r"C:\Apps\App\icon.exe,0"), None, None), &none).as_deref(), Some(r"C:\Apps\App\icon.exe"));
    // An .ico is not a program file.
    assert_eq!(signature_file_for(&program(Some(r"C:\Apps\App\a.ico"), Some(r"C:\Apps\App"), None), &main).as_deref(), Some(r"C:\Apps\App\App.exe"));
    assert_eq!(signature_file_for(&program(None, None, Some(r#""C:\Apps\App\unins000.exe" /S"#)), &none).as_deref(), Some(r"C:\Apps\App\unins000.exe"));
    // A launcher's uninstall is a URL, and an MSI's is Windows' own tool.
    assert_eq!(signature_file_for(&program(None, None, Some(r#""C:\Steam\steam.exe" steam://uninstall/10"#)), &none), None);
    assert_eq!(signature_file_for(&program(None, None, Some("MsiExec.exe /X{A}")), &none), None);
    assert_eq!(signature_file_for(&program(Some(r"C:\Windows\System32\shell32.dll,3"), None, None), &none), None);
}

#[test]
fn windows_answers_become_valid_unsigned_or_broken_and_nothing_else() {
    assert_eq!(status_from_trust_result(0), Some(SigStatus::Valid));
    assert_eq!(status_from_trust_result(0x800B_0100_u32 as i32), Some(SigStatus::Unsigned));
    // Hash mismatch: the file changed after the vendor signed it.
    assert_eq!(status_from_trust_result(0x8009_6010_u32 as i32), Some(SigStatus::Broken));
    assert_eq!(status_from_trust_result(0x800B_0109_u32 as i32), Some(SigStatus::Broken));
    // A format Windows cannot sign, or an error reading it, is no answer.
    assert_eq!(status_from_trust_result(0x800B_0003_u32 as i32), None);
    assert_eq!(status_from_trust_result(5), None);
}

#[cfg(windows)]
mod windows_only {
    use super::*;

    #[test]
    fn a_windows_binary_is_valid_and_a_plain_file_is_not_signed() {
        let system = std::env::var("SystemRoot").unwrap_or_else(|_| r"C:\Windows".into());
        // notepad.exe: signed through the catalog or embedded, either way valid and Microsoft's.
        let signed = check_file(&format!(r"{system}\System32\notepad.exe")).expect("notepad is signed");
        assert_eq!(signed.status, SigStatus::Valid);
        assert!(signed.signer.as_deref().is_some_and(|s| s.contains("Microsoft")), "{:?}", signed.signer);

        let dir = std::env::temp_dir().join(format!("prune-sig-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let plain = dir.join("tool.exe");
        std::fs::write(&plain, b"MZ not really a program").unwrap();
        let answer = check_file(plain.to_str().unwrap());
        assert!(answer.as_ref().is_none_or(|a| a.status == SigStatus::Unsigned), "{answer:?}");
        assert!(check_file(r"C:\no\such.exe").is_none());
    }

    #[test]
    fn matches_3x_on_this_machine() {
        let Some(dir) = std::env::var_os("PRUNE_3X_DIR").map(std::path::PathBuf::from) else { return };
        let theirs: serde_json::Value = serde_json::from_slice(&std::fs::read(dir.join("signatures.json")).unwrap()).unwrap();
        let theirs = theirs["signatures"].as_object().unwrap();
        let programs = prune_core::programs::registry::list_installed_programs();
        let started = std::time::Instant::now();
        let ours = resolve_signatures(&programs, &mut HashMap::new());
        eprintln!("signatures: {} in {:?}", ours.len(), started.elapsed());

        let word = |s: SigStatus| match s {
            SigStatus::Valid => "valid",
            SigStatus::Unsigned => "unsigned",
            SigStatus::Broken => "broken",
        };
        let mut differ = Vec::new();
        for (id, t) in theirs {
            match ours.get(id) {
                Some(o) if word(o.status) == t["status"].as_str().unwrap() && o.signer.as_deref() == t["signer"].as_str() => {}
                other => differ.push(format!("{id}: 3.x {t} ours {:?}", other.map(|o| (word(o.status), &o.signer)))),
            }
        }
        for id in ours.keys().filter(|id| !theirs.contains_key(*id)) {
            differ.push(format!("{id}: only ours"));
        }
        eprintln!("{} of {} differ:\n{}", differ.len(), theirs.len(), differ.join("\n"));
        assert!(differ.is_empty(), "{} signature answers differ from Get-AuthenticodeSignature", differ.len());
    }
}
```


- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3: Implement.**

**Create `native/crates/prune-core/src/programs/signatures.rs`:**

```rust
//! Whether each program's own files carry a valid digital signature, and
//! whose (`services/programSignatures.js`).
//!
//! Windows' own check, `WinVerifyTrust`, which hashes the file as well as
//! checking the chain (a binary changed after signing still carries an intact
//! certificate and reads as verified to a reader that only loads the
//! certificate), and which also finds the catalog signatures Windows' own
//! files use. 3.x reached it through `Get-AuthenticodeSignature` at about 15
//! seconds for 130 programs; this calls it in process.
//!
//! Revocation is NOT checked, and no URL is retrieved (`WTD_REVOKE_NONE`,
//! `WTD_CACHE_ONLY_URL_RETRIEVAL`): checking would send a request to a
//! certificate authority for every program on the list, and the only outbound
//! requests Prune makes are the update check and download.
//!
//! Which file: the vendor's DisplayIcon when it is an executable, then the
//! program's main executable in its folder, then its uninstaller, which is
//! still the vendor's code. Never a launcher's (a steam:// uninstall would
//! report Valve for every game) and never Windows' own tools (msiexec,
//! rundll32), which would report Microsoft for every MSI on the machine.

use std::collections::HashMap;

use super::model::{Program, SigStatus, Signature};
use super::paths::{icon_source_for, parse_uninstaller_path};
use super::versions::find_main_executable;

/// `\windows\system32` and `\windows\syswow64`, or msiexec/rundll32/cmd by name.
pub fn is_system_tool(path: &str) -> bool {
    let lower = path.to_lowercase().replace('/', "\\");
    if lower.contains("\\windows\\system32\\") || lower.contains("\\windows\\syswow64\\") {
        return true;
    }
    let file = lower.rsplit('\\').next().unwrap_or("");
    matches!(file, "msiexec.exe" | "rundll32.exe" | "cmd.exe")
}

fn has_url_scheme(text: &str) -> bool {
    let is_scheme_at = |s: &str| {
        s.find("://").is_some_and(|at| {
            let scheme = &s[..at];
            scheme.starts_with(|c: char| c.is_ascii_alphabetic()) && scheme.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '+' | '.' | '-'))
        })
    };
    is_scheme_at(text) || text.split_whitespace().any(is_scheme_at)
}

/// The file whose signature stands for this program, or `None`.
pub fn signature_file_for(program: &Program, find_executable: &dyn Fn(&str, &str) -> Option<String>) -> Option<String> {
    let is_exe = |p: &str| p.to_lowercase().ends_with(".exe");
    if let Some(declared) = icon_source_for(program).filter(|d| is_exe(&d.path) && !is_system_tool(&d.path)) {
        return Some(declared.path);
    }
    if let Some(location) = program.install_location.as_deref().filter(|l| !l.is_empty()) {
        if let Some(exe) = find_executable(location, &program.name).filter(|e| is_exe(e) && !is_system_tool(e)) {
            return Some(exe);
        }
    }
    let uninstall = program.uninstall_string.as_deref().filter(|u| !has_url_scheme(u))?;
    parse_uninstaller_path(uninstall).executable.filter(|e| !is_system_tool(e))
}

/// Windows' answer as the three words the list uses. Anything else (a format
/// Windows cannot sign, an error reading it) is no answer, and the row says
/// nothing rather than guess.
pub fn status_from_trust_result(hresult: i32) -> Option<SigStatus> {
    const TRUST_E_NOSIGNATURE: i32 = 0x800B_0100_u32 as i32;
    const TRUST_E_BAD_DIGEST: i32 = 0x8009_6010_u32 as i32;
    const TRUST_E_SUBJECT_NOT_TRUSTED: i32 = 0x800B_0004_u32 as i32;
    const CERT_E_UNTRUSTEDROOT: i32 = 0x800B_0109_u32 as i32;
    const CERT_E_CHAINING: i32 = 0x800B_010A_u32 as i32;
    const CERT_E_UNTRUSTEDTESTROOT: i32 = 0x800B_010D_u32 as i32;
    match hresult {
        0 => Some(SigStatus::Valid),
        TRUST_E_NOSIGNATURE => Some(SigStatus::Unsigned),
        // The file changed after it was signed, or the signer is not trusted: the red-badge case.
        TRUST_E_BAD_DIGEST | TRUST_E_SUBJECT_NOT_TRUSTED | CERT_E_UNTRUSTEDROOT | CERT_E_CHAINING | CERT_E_UNTRUSTEDTESTROOT => Some(SigStatus::Broken),
        _ => None,
    }
}

#[cfg(windows)]
mod win {
    use std::ffi::c_void;

    use windows::Win32::Foundation::{CloseHandle, GENERIC_READ, HANDLE, HWND};
    use windows::Win32::Security::Cryptography::Catalog::{
        CATALOG_INFO, CryptCATAdminAcquireContext, CryptCATAdminCalcHashFromFileHandle, CryptCATAdminEnumCatalogFromHash,
        CryptCATAdminReleaseCatalogContext, CryptCATAdminReleaseContext, CryptCATCatalogInfoFromContext,
    };
    use windows::Win32::Security::Cryptography::{CERT_CONTEXT, CERT_NAME_ATTR_TYPE, CertGetNameStringW};
    use windows::Win32::Security::WinTrust::{
        WINTRUST_CATALOG_INFO, WINTRUST_DATA, WINTRUST_DATA_0, WINTRUST_FILE_INFO, WTD_CACHE_ONLY_URL_RETRIEVAL, WTD_CHOICE_CATALOG,
        WTD_CHOICE_FILE, WTD_REVOKE_NONE, WTD_STATEACTION_CLOSE, WTD_STATEACTION_VERIFY, WTD_UI_NONE, WTHelperGetProvCertFromChain,
        WTHelperGetProvSignerFromChain, WTHelperProvDataFromStateData, WinVerifyTrust,
    };
    use windows::Win32::Storage::FileSystem::{CreateFileW, FILE_ATTRIBUTE_NORMAL, FILE_SHARE_DELETE, FILE_SHARE_READ, FILE_SHARE_WRITE, OPEN_EXISTING};
    use windows::core::{GUID, HSTRING, PCSTR, PCWSTR, PWSTR};

    use super::{SigStatus, Signature, status_from_trust_result};

    /// `WINTRUST_ACTION_GENERIC_VERIFY_V2`.
    const GENERIC_VERIFY_V2: GUID = GUID::from_u128(0x00aac56b_cd44_11d0_8cc2_00c04fc295ee);

    /// The signer's common name, else its organization.
    unsafe fn signer_name(state: HANDLE) -> Option<String> {
        // SAFETY: `state` is a live WinVerifyTrust state handle; every pointer
        // returned is owned by that state and used before it is closed.
        unsafe {
            let provider = WTHelperProvDataFromStateData(state);
            if provider.is_null() {
                return None;
            }
            let signer = WTHelperGetProvSignerFromChain(provider, 0, false, 0);
            if signer.is_null() {
                return None;
            }
            let cert = WTHelperGetProvCertFromChain(signer, 0);
            if cert.is_null() || (*cert).pCert.is_null() {
                return None;
            }
            let context: *const CERT_CONTEXT = (*cert).pCert;
            for oid in [PCSTR(b"2.5.4.3\0".as_ptr()), PCSTR(b"2.5.4.10\0".as_ptr())] {
                let mut buf = [0u16; 512];
                let len = CertGetNameStringW(context, CERT_NAME_ATTR_TYPE, 0, Some(oid.0.cast::<c_void>()), Some(&mut buf));
                if len > 1 {
                    return Some(String::from_utf16_lossy(&buf[..len as usize - 1]));
                }
            }
            None
        }
    }

    fn verify_embedded(path: &HSTRING) -> (i32, Option<String>) {
        let mut file = WINTRUST_FILE_INFO { cbStruct: size_of::<WINTRUST_FILE_INFO>() as u32, pcwszFilePath: PCWSTR(path.as_ptr()), ..Default::default() };
        let mut data = WINTRUST_DATA {
            cbStruct: size_of::<WINTRUST_DATA>() as u32,
            dwUIChoice: WTD_UI_NONE,
            fdwRevocationChecks: WTD_REVOKE_NONE,
            dwUnionChoice: WTD_CHOICE_FILE,
            Anonymous: WINTRUST_DATA_0 { pFile: &mut file },
            dwStateAction: WTD_STATEACTION_VERIFY,
            dwProvFlags: WTD_CACHE_ONLY_URL_RETRIEVAL,
            ..Default::default()
        };
        let mut action = GENERIC_VERIFY_V2;
        // SAFETY: `file` and `data` outlive both calls; the state opened by VERIFY is closed.
        unsafe {
            let result = WinVerifyTrust(HWND(-1isize as *mut c_void), &mut action, (&raw mut data).cast());
            let signer = (result == 0).then(|| signer_name(data.hWVTStateData)).flatten();
            data.dwStateAction = WTD_STATEACTION_CLOSE;
            WinVerifyTrust(HWND(-1isize as *mut c_void), &mut action, (&raw mut data).cast());
            (result, signer)
        }
    }

    /// Windows' own files are signed in a catalog, not in themselves: find the
    /// catalog that lists this file's hash and verify against it.
    fn verify_catalog(path: &HSTRING) -> Option<(i32, Option<String>)> {
        // SAFETY: handles and the catalog context are released on every path;
        // buffers are sized by the calls that fill them.
        unsafe {
            let file = CreateFileW(path, GENERIC_READ.0, FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, None, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, None).ok()?;
            let result = (|| {
                let mut admin = 0isize;
                CryptCATAdminAcquireContext(&mut admin, None, None).ok()?;
                let outcome = (|| {
                    let mut len = 0u32;
                    let _ = CryptCATAdminCalcHashFromFileHandle(file, &mut len, None, None);
                    let mut hash = vec![0u8; len as usize];
                    if !CryptCATAdminCalcHashFromFileHandle(file, &mut len, Some(hash.as_mut_ptr()), None).as_bool() {
                        return None;
                    }
                    let catalog = CryptCATAdminEnumCatalogFromHash(admin, &hash, None, None);
                    if catalog == 0 {
                        return None;
                    }
                    let mut info = CATALOG_INFO { cbStruct: size_of::<CATALOG_INFO>() as u32, ..Default::default() };
                    let found = CryptCATCatalogInfoFromContext(catalog, &mut info, 0).is_ok();
                    let verdict = found.then(|| {
                        let tag: String = hash.iter().map(|b| format!("{b:02X}")).collect();
                        let tag = HSTRING::from(tag);
                        let mut member = WINTRUST_CATALOG_INFO {
                            cbStruct: size_of::<WINTRUST_CATALOG_INFO>() as u32,
                            pcwszCatalogFilePath: PCWSTR(info.wszCatalogFile.as_ptr()),
                            pcwszMemberTag: PCWSTR(tag.as_ptr()),
                            pcwszMemberFilePath: PCWSTR(path.as_ptr()),
                            hMemberFile: file,
                            pbCalculatedFileHash: hash.as_mut_ptr(),
                            cbCalculatedFileHash: len,
                            hCatAdmin: admin,
                            ..Default::default()
                        };
                        let mut data = WINTRUST_DATA {
                            cbStruct: size_of::<WINTRUST_DATA>() as u32,
                            dwUIChoice: WTD_UI_NONE,
                            fdwRevocationChecks: WTD_REVOKE_NONE,
                            dwUnionChoice: WTD_CHOICE_CATALOG,
                            Anonymous: WINTRUST_DATA_0 { pCatalog: &mut member },
                            dwStateAction: WTD_STATEACTION_VERIFY,
                            dwProvFlags: WTD_CACHE_ONLY_URL_RETRIEVAL,
                            ..Default::default()
                        };
                        let mut action = GENERIC_VERIFY_V2;
                        let r = WinVerifyTrust(HWND(-1isize as *mut c_void), &mut action, (&raw mut data).cast());
                        let signer = (r == 0).then(|| signer_name(data.hWVTStateData)).flatten();
                        data.dwStateAction = WTD_STATEACTION_CLOSE;
                        WinVerifyTrust(HWND(-1isize as *mut c_void), &mut action, (&raw mut data).cast());
                        (r, signer)
                    });
                    let _ = CryptCATAdminReleaseCatalogContext(admin, catalog, 0);
                    verdict
                })();
                let _ = CryptCATAdminReleaseContext(admin, 0);
                outcome
            })();
            let _ = CloseHandle(file);
            result
        }
    }

    pub fn verify(path: &str) -> Option<Signature> {
        let wide = HSTRING::from(path);
        let (mut result, mut signer) = verify_embedded(&wide);
        if status_from_trust_result(result) == Some(SigStatus::Unsigned) {
            if let Some((catalog_result, catalog_signer)) = verify_catalog(&wide) {
                (result, signer) = (catalog_result, catalog_signer);
            }
        }
        let status = status_from_trust_result(result)?;
        Some(Signature { status, signer: signer.filter(|_| status != SigStatus::Unsigned) })
    }

    #[allow(dead_code)]
    fn _unused(_: PWSTR) {}
}

/// The signature check for one file, or `None` when Windows gave no answer.
#[cfg(windows)]
pub fn check_file(path: &str) -> Option<Signature> {
    win::verify(path)
}

#[cfg(not(windows))]
pub fn check_file(_: &str) -> Option<Signature> {
    None
}

/// A file's identity for remembering its answer: path, size and modification
/// time. A program update rewrites its executable, and that is exactly when
/// the answer can change.
fn file_key(path: &str) -> Option<String> {
    let meta = std::fs::metadata(path).ok()?;
    let modified = meta.modified().ok()?.duration_since(std::time::UNIX_EPOCH).ok()?.as_nanos();
    Some(format!("{}|{}|{modified}", path.to_lowercase(), meta.len()))
}

/// `{ programId: Signature }`. A program with no file to ask about, or one
/// Windows gave no answer for, is absent. `remembered` carries answers between
/// calls in one session.
pub fn resolve_signatures(programs: &[Program], remembered: &mut HashMap<String, Option<Signature>>) -> HashMap<String, Signature> {
    let mut file_of: HashMap<&str, String> = HashMap::new();
    for program in programs {
        if let Some(file) = signature_file_for(program, &|folder, name| find_main_executable(folder, name)) {
            file_of.insert(&program.id, file);
        }
    }
    let mut keys: HashMap<String, String> = HashMap::new();
    for file in file_of.values() {
        if let Some(key) = file_key(file) {
            keys.insert(file.clone(), key);
        }
    }
    let mut missing: Vec<&String> = keys.iter().filter(|(_, k)| !remembered.contains_key(*k)).map(|(f, _)| f).collect();
    missing.sort();
    // WinVerifyTrust hashes every file it checks: spread across four threads.
    let answers = {
        use std::sync::Mutex;
        use std::sync::atomic::{AtomicUsize, Ordering};
        let next = AtomicUsize::new(0);
        let out = Mutex::new(Vec::new());
        std::thread::scope(|scope| {
            for _ in 0..missing.len().clamp(1, 4) {
                scope.spawn(|| {
                    while let Some(file) = missing.get(next.fetch_add(1, Ordering::Relaxed)) {
                        let answer = check_file(file);
                        if let Ok(mut out) = out.lock() {
                            out.push(((*file).clone(), answer));
                        }
                    }
                });
            }
        });
        out.into_inner().unwrap_or_default()
    };
    for (file, answer) in answers {
        if let Some(key) = keys.get(&file) {
            remembered.insert(key.clone(), answer);
        }
    }
    file_of
        .into_iter()
        .filter_map(|(id, file)| Some((id.to_owned(), remembered.get(keys.get(&file)?)?.clone()?)))
        .collect()
}
```


`programs/mod.rs` gains `pub mod signatures;`.

- [ ] **Step 4:** `PRUNE_3X_DIR=<folder> cargo test -p prune-core --test programs_signatures -- --nocapture`. Expected: 5 passed, `signatures: 104 in ~2.6s` (3.x cold: 12.4 s) and `0 of 104 differ` (status and signer name, against `Get-AuthenticodeSignature` on the same files). If a status differs on another machine, fix the HRESULT table in `status_from_trust_result` from that data, not from guesses.
- [ ] **Step 5: Commit** `feat(native): digital signatures through WinVerifyTrust, without network access`

### Task 15: The table's rules

**Files:**
- Create: `native/crates/prune-core/src/programs/view.rs`
- Modify: `native/crates/prune-core/src/programs/mod.rs`
- Test: `native/crates/prune-core/tests/programs_view.rs`

**Interfaces:**
- Produces: `day_number`, `date_from_day_number`, `parse_install_date`, `is_recently_installed`, `RECENT_DAYS`, `SortColumn`, `Direction`, `SortState`, `next_sort_state`, `sort_indices`, `Filter`, `Lists`, `chip_counts`, `ChipCounts`, `Controls`, `Visible`, `visible`, `BatchReason`, `batch_ineligible_reason`, `can_batch`, `batch_summary`, `Tone`, `size_tone`, `format_bytes`, `format_short_date`, `tile_colors`, `tile_color`, `tile_letter`.
- The table's rules, ported rule for rule. New is the last seven whole days (an install date has no time of day), and a program with no date is never new. Sorting: unknown values sink in both directions (an unknown size is not a zero-byte program); New is derived, never unknown; names ignore case and accents, versions compare digit runs as numbers; ties keep arrival order. Default sort: size, largest first; a header click reverses the sorted column or picks the direction people want (size, date and New start descending). Filters: All (registry, Store, package-only Chocolatey), Store, Chocolatey (including tagged registry programs), Extensions, Not registered, Windows, Other accounts (their own lists), Unsigned (none and broken), Left behind; a chip exists only when its count is above zero. The pipeline is filter, then search (name or publisher, case-insensitive), then hiding, then sort; `hidden_count` is counted before the search so typing does not make the number jump. A row is batch-ineligible for a reason (broken, extension, Chocolatey, Not registered, feature or update, other account, a Store app without a package name or not explicitly removable, no uninstall command). Sizes: 1024-based "KB/MB/GB" like Explorer (default), IEC names, or 1000-based, one decimal at most, a dash for unknown, JavaScript's `toFixed` tie rule. The tile letter skips a leading vendor word only when the publisher confirms it; its colour is FNV-1a over the name's UTF-16 units into the palette entries that clear 4.5:1 against the dark ink.

- [ ] **Step 1: Write the tests.**

**Create `native/crates/prune-core/tests/programs_view.rs`:**

```rust
//! The table's rules, ported from 3.x's sortPrograms.test.js,
//! recentPrograms.test.js, batchSelection.test.js, sizeBadgeTone.test.js,
//! formatBytes.test.js, iconTileLetter.test.js, programTileColor.test.js and
//! ProgramList.*.render.test.jsx.

use std::collections::HashSet;

use prune_core::programs::hidden::program_hide_key;
use prune_core::programs::model::*;
use prune_core::programs::view::*;
use prune_core::settings::SizeUnits;

fn p(id: &str, name: &str) -> Program {
    Program { id: id.into(), name: name.into(), publisher: "Acme".into(), uninstall_string: Some(r"C:\a\u.exe".into()), ..Program::default() }
}

fn sized(id: &str, bytes: Option<u64>) -> Program {
    Program { size_bytes: bytes, ..p(id, id) }
}

fn order(list: &[Program], column: SortColumn, direction: Direction, today: i64) -> Vec<String> {
    let refs: Vec<&Program> = list.iter().collect();
    sort_indices(&refs, SortState { column, direction }, today).into_iter().map(|i| list[i].id.clone()).collect()
}

const TODAY: i64 = 20_000;

#[test]
fn day_numbers_and_dates() {
    assert_eq!(day_number(1970, 1, 1), 0);
    assert_eq!(day_number(2000, 3, 1) - day_number(2000, 2, 28), 2, "2000 is a leap year");
    assert_eq!(parse_install_date("2026-08-19"), Some((2026, 8, 19)));
    // Squirrel's minutes where the month belongs, and impossible days, are no date.
    for bad in ["2026-25-15", "2026-02-30", "2026-8-19", "20260819", ""] {
        assert_eq!(parse_install_date(bad), None, "{bad}");
    }
}

#[test]
fn new_means_the_last_seven_whole_days() {
    let on = |days_ago: i64| {
        let n = TODAY - days_ago;
        // Turn a day number back into a date by search: the window only needs day numbers.
        let (mut y, mut m, mut d) = (1970, 1, 1);
        while day_number(y, m, d) < n {
            d += 1;
            if parse_install_date(&format!("{y:04}-{m:02}-{d:02}")).is_none() {
                d = 1;
                m += 1;
                if m > 12 {
                    m = 1;
                    y += 1;
                }
            }
        }
        Program { install_date: Some(format!("{y:04}-{m:02}-{d:02}")), ..p("x", "x") }
    };
    assert!(is_recently_installed(&on(0), TODAY));
    assert!(is_recently_installed(&on(7), TODAY));
    assert!(!is_recently_installed(&on(8), TODAY));
    assert!(!is_recently_installed(&p("none", "none"), TODAY), "no date is never new");
    assert!(!is_recently_installed(&Program { install_date: Some("2026-25-15".into()), ..p("bad", "bad") }, TODAY));
}

#[test]
fn unknown_sizes_sink_in_both_directions() {
    let list = [sized("small", Some(10)), sized("unknown", None), sized("big", Some(1_000)), sized("zero", Some(0))];
    assert_eq!(order(&list, SortColumn::SizeBytes, Direction::Desc, TODAY), ["big", "small", "zero", "unknown"]);
    assert_eq!(order(&list, SortColumn::SizeBytes, Direction::Asc, TODAY), ["zero", "small", "big", "unknown"]);
}

#[test]
fn names_ignore_case_versions_compare_as_numbers_and_ties_keep_their_order() {
    let named = [p("b", "banana"), p("a", "Apple"), p("c", "apple")];
    assert_eq!(order(&named, SortColumn::Name, Direction::Asc, TODAY), ["a", "c", "b"], "Apple and apple tie, keeping arrival order");
    let versions: Vec<Program> = ["1.10", "1.9", ""].iter().enumerate().map(|(i, v)| Program { version: (*v).into(), ..p(&i.to_string(), "x") }).collect();
    assert_eq!(order(&versions, SortColumn::Version, Direction::Asc, TODAY), ["1", "0", "2"]);
}

#[test]
fn the_new_column_brings_new_rows_to_the_top_newest_first_and_never_treats_undated_as_unknown() {
    let dated = |id: &str, date: &str| Program { install_date: Some(date.into()), ..p(id, id) };
    // Day 20000 is 2024-10-04.
    let list = [dated("old", "2020-01-01"), p("undated", "undated"), dated("newer", "2024-10-03"), dated("newest", "2024-10-04")];
    assert_eq!(order(&list, SortColumn::Recent, Direction::Desc, TODAY), ["newest", "newer", "old", "undated"]);
    assert_eq!(order(&list, SortColumn::Recent, Direction::Asc, TODAY), ["undated", "old", "newer", "newest"]);
}

#[test]
fn a_header_click_reverses_or_picks_the_direction_people_want() {
    let start = SortState::default();
    assert_eq!((start.column, start.direction), (SortColumn::SizeBytes, Direction::Desc));
    assert_eq!(next_sort_state(start, SortColumn::SizeBytes).direction, Direction::Asc);
    assert_eq!(next_sort_state(start, SortColumn::Name).direction, Direction::Asc);
    assert_eq!(next_sort_state(start, SortColumn::InstallDate).direction, Direction::Desc);
    assert_eq!(next_sort_state(start, SortColumn::Recent).direction, Direction::Desc);
}

fn lists() -> Lists {
    let mut broken = p("broken", "Broken Thing");
    broken.health = Some(Health { orphaned: true, ..Health::default() });
    let mut unsigned = p("unsigned", "Unsigned Tool");
    unsigned.signature = Some(Signature { status: SigStatus::Unsigned, signer: None });
    let mut tampered = p("tampered", "Tampered");
    tampered.signature = Some(Signature { status: SigStatus::Broken, signer: Some("X".into()) });
    let store = Program { source: Source::Store, size_bytes: Some(3), package_full_name: Some("S_1".into()), non_removable: Some(false), ..p("store:s", "Store App") };
    let choco = Program { source: Source::Chocolatey, chocolatey_id: Some("c".into()), ..p("chocolatey:c", "Choco Pkg") };
    let managed = Program { chocolatey_id: Some("python".into()), ..p("py", "Python") };
    Lists {
        programs: vec![Program { size_bytes: Some(20), publisher: "Valve".into(), ..p("steam", "Steam") }, broken, unsigned, tampered, store, choco, managed],
        extensions: vec![Program { source: Source::Extension, ..p("ext", "uBlock Origin") }],
        unregistered: vec![Program { source: Source::Unregistered, ..p("unregistered:x", "OldTool") }],
        windows_items: vec![Program { source: Source::Feature, ..p("feature:a", "Telnet") }, Program { source: Source::Update, ..p("update:KB1", "KB1") }],
        other_users: Vec::new(),
    }
}

fn controls<'a>(filter: Filter, query: &'a str, hidden: &'a HashSet<String>) -> Controls<'a> {
    Controls { filter, query, sort: SortState::default(), show_hidden: false, hidden, today: TODAY }
}

#[test]
fn chips_count_what_they_filter_and_extensions_stay_out_of_all() {
    let l = lists();
    let c = chip_counts(&l);
    assert_eq!((c.store, c.chocolatey, c.extensions, c.unregistered, c.windows, c.other_users, c.unsigned, c.broken), (1, 2, 1, 1, 2, 0, 2, 1));
    let none = HashSet::new();
    let all = visible(&l, &controls(Filter::All, "", &none));
    assert_eq!(all.rows.len(), 7);
    assert!(!all.narrowed);
    let ext = visible(&l, &controls(Filter::Extensions, "", &none));
    assert_eq!((ext.rows.len(), ext.shown_of, ext.narrowed), (1, 1, true));
    assert_eq!(visible(&l, &controls(Filter::Chocolatey, "", &none)).rows.len(), 2);
    assert_eq!(visible(&l, &controls(Filter::Unsigned, "", &none)).rows.len(), 2);
    assert_eq!(visible(&l, &controls(Filter::Broken, "", &none)).rows.len(), 1);
}

#[test]
fn the_search_reads_the_name_and_the_publisher_and_the_total_follows_it() {
    let l = lists();
    let none = HashSet::new();
    let by_publisher = visible(&l, &controls(Filter::All, "  VALVE ", &none));
    assert_eq!(by_publisher.rows, [0]);
    assert_eq!((by_publisher.total_bytes, by_publisher.narrowed, by_publisher.in_filter), (20, true, 7));
    assert!(visible(&l, &controls(Filter::All, "zzz", &none)).rows.is_empty());
}

#[test]
fn a_hidden_program_leaves_the_rows_the_total_and_the_count_until_shown() {
    let l = lists();
    let hidden: HashSet<String> = [program_hide_key(&l.programs[0]).unwrap()].into();
    let mut c = controls(Filter::All, "", &hidden);
    let v = visible(&l, &c);
    assert_eq!((v.rows.len(), v.hidden_count, v.narrowed, v.total_bytes), (6, 1, true, 3));
    c.show_hidden = true;
    let v = visible(&l, &c);
    assert_eq!((v.rows.len(), v.total_bytes), (7, 23));
}

fn reason(program: &Program) -> Option<BatchReason> {
    batch_ineligible_reason(program)
}

#[test]
fn only_what_can_run_unattended_may_be_ticked() {
    let l = lists();
    assert_eq!(reason(&l.programs[0]), None);
    assert_eq!(reason(&l.programs[1]), Some(BatchReason::Orphaned));
    assert_eq!(reason(&l.extensions[0]), Some(BatchReason::Extension));
    assert_eq!(reason(&l.unregistered[0]), Some(BatchReason::Unregistered));
    assert_eq!(reason(&l.windows_items[0]), Some(BatchReason::Windows));
    assert_eq!(reason(&l.programs[5]), Some(BatchReason::Chocolatey));
    assert_eq!(reason(&Program { uninstall_string: None, ..p("n", "n") }), Some(BatchReason::NoCommand));
    // A Store app: only when Windows said, explicitly, that it may be removed.
    assert_eq!(reason(&l.programs[4]), None);
    let store = |non_removable, full: Option<&str>| Program { source: Source::Store, non_removable, package_full_name: full.map(Into::into), ..p("s", "s") };
    assert_eq!(reason(&store(Some(true), Some("x"))), Some(BatchReason::StoreProtected));
    assert_eq!(reason(&store(None, Some("x"))), Some(BatchReason::StoreUnknown));
    assert_eq!(reason(&store(Some(false), None)), Some(BatchReason::StoreNoPackage));
    assert_eq!(BatchReason::Orphaned.key(), "applications.batchReasons.orphaned");
}

#[test]
fn a_selections_total_counts_unknown_sizes_apart() {
    let (a, b, c) = (sized("a", Some(100)), sized("b", None), sized("c", Some(50)));
    assert_eq!(batch_summary(&[&a, &b, &c]), (3, 150, 1));
}

#[test]
fn size_bands_ramp_to_amber_and_never_past_it() {
    const GB: u64 = 1 << 30;
    assert_eq!(size_tone(None), Tone::Low);
    assert_eq!(size_tone(Some(249 << 20)), Tone::Low);
    assert_eq!(size_tone(Some(250 << 20)), Tone::Moderate);
    assert_eq!(size_tone(Some(2 * GB)), Tone::High);
    assert_eq!(size_tone(Some(15 * GB)), Tone::Peak);
}

#[test]
fn sizes_read_the_way_explorer_does_and_the_people_choose() {
    let w = |b| format_bytes(Some(b), SizeUnits::Windows);
    assert_eq!(format_bytes(None, SizeUnits::Windows), "\u{2014}");
    assert_eq!(w(0), "0 B");
    assert_eq!(w(512), "512 B");
    assert_eq!(w(20_000_000_000), "18.6 GB");
    assert_eq!(w(32 * (1 << 30)), "32 GB");
    assert_eq!(w(1536), "1.5 KB");
    assert_eq!(format_bytes(Some(1_000_000_000), SizeUnits::Decimal), "1 GB");
    assert_eq!(format_bytes(Some(1_000_000_000), SizeUnits::Windows), "953.7 MB");
    assert_eq!(format_bytes(Some(1 << 30), SizeUnits::Binary), "1 GiB");
    assert_eq!(w(u64::MAX), "16777216 TB", "past the last unit the figure grows, the label does not run off");
}

#[test]
fn the_tile_letter_skips_a_vendor_word_only_when_the_publisher_confirms_it() {
    assert_eq!(tile_letter("Microsoft Visual C++ Redistributable", "Microsoft Corporation"), 'V');
    assert_eq!(tile_letter("Windows Desktop Runtime", "Microsoft Corporation"), 'W');
    assert_eq!(tile_letter("Discord", "Discord Inc."), 'D', "named exactly after its publisher: the vendor word IS the name");
    assert_eq!(tile_letter("Epic Games Launcher", "Epic Games, Inc."), 'G');
    assert_eq!(tile_letter("Unknown Thing", "Unknown Publisher"), 'U');
    assert_eq!(tile_letter("  ", ""), '?');
    assert_eq!(tile_letter("7-Zip", "Igor Pavlov"), '7');
}

#[test]
fn tile_colours_are_stable_and_every_one_is_readable() {
    let colors = tile_colors();
    assert!(colors.len() >= 14 && colors.len() <= 16);
    assert_eq!(tile_color("Steam"), tile_color("  STEAM "));
    // The 3.x test pins the hash: FNV-1a over UTF-16 units.
    let all: HashSet<[u8; 3]> = ["Steam", "Brave", "Warframe", "VALORANT", "MuMuPlayer", "Python"].iter().map(|n| tile_color(n)).collect();
    assert!(all.len() >= 3, "names spread over the palette");
}

#[test]
fn a_date_is_written_as_given_in_the_persons_own_format() {
    let shown = format_short_date("2026-08-19").unwrap();
    assert!(shown.contains("19") && shown.contains("2026") || shown.contains("26"), "{shown}");
    assert_eq!(format_short_date("2026-25-15"), None);
    assert_eq!(format_short_date(""), None);
}

#[test]
fn day_numbers_turn_back_into_the_same_dates() {
    for (y, m, d) in [(1970, 1, 1), (2000, 2, 29), (2024, 10, 4), (2026, 12, 31), (1999, 3, 1)] {
        assert_eq!(parse_install_date(&date_from_day_number(day_number(y, m, d))), Some((y, m, d)));
    }
    assert_eq!(date_from_day_number(20_000), "2024-10-04");
}
```


- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3: Implement.**

**Create `native/crates/prune-core/src/programs/view.rs`:**

```rust
//! What the Applications table shows and in what order: filter, search,
//! hiding, sorting, the New badge, batch eligibility, counts, size text and
//! the lettered tile (`ProgramList.jsx`, `sortPrograms.js`,
//! `recentPrograms.js`, `batchSelection.js`, `sizeBadgeTone.js`,
//! `formatBytes.js`, `iconTileLetter.js`, `programTileColor.js`). Pure: the
//! UI draws what this returns and holds no rules of its own.

use std::cmp::Ordering;
use std::collections::HashSet;

use crate::settings::SizeUnits;

use super::collate::{Mode, compare};
use super::hidden::is_program_hidden;
use super::model::{Program, Source};

/* ---------------------------------------------------------------- dates */

/// How recent an install has to be to be flagged New: a fixed week, so the
/// answer is always "what landed on this machine recently" whether or not
/// Prune has run before.
pub const RECENT_DAYS: i64 = 7;

/// A calendar day as a day number (days since 1970-01-01).
pub fn day_number(year: i64, month: i64, day: i64) -> i64 {
    let y = if month <= 2 { year - 1 } else { year };
    let era = y.div_euclid(400);
    let yoe = y - era * 400;
    let mp = (month + 9) % 12;
    let doy = (153 * mp + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

/// `YYYY-MM-DD` as year, month, day, or `None` for anything that is not on
/// the calendar (Squirrel's minutes-for-month dates must never count as new).
pub fn parse_install_date(value: &str) -> Option<(i64, i64, i64)> {
    let b = value.as_bytes();
    let shaped = b.len() == 10 && b[4] == b'-' && b[7] == b'-' && b.iter().enumerate().all(|(i, c)| i == 4 || i == 7 || c.is_ascii_digit());
    if !shaped {
        return None;
    }
    let (y, m, d) = (value[0..4].parse().ok()?, value[5..7].parse().ok()?, value[8..10].parse().ok()?);
    let days = [31, if (y % 4 == 0 && y % 100 != 0) || y % 400 == 0 { 29 } else { 28 }, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    ((1..=12).contains(&m) && d >= 1 && d <= days[(m - 1) as usize]).then_some((y, m, d))
}

fn install_day(program: &Program) -> Option<i64> {
    let (y, m, d) = parse_install_date(program.install_date.as_deref()?)?;
    Some(day_number(y, m, d))
}

/// Whether this program landed within the window. Whole days, not a rolling
/// 168 hours: an install date carries no time of day. No date, never recent.
pub fn is_recently_installed(program: &Program, today: i64) -> bool {
    install_day(program).is_some_and(|d| d >= today - RECENT_DAYS)
}

/* -------------------------------------------------------------- sorting */

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SortColumn {
    Name,
    SizeBytes,
    Version,
    Architecture,
    InstallDate,
    Recent,
    Publisher,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Direction {
    Asc,
    Desc,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SortState {
    pub column: SortColumn,
    pub direction: Direction,
}

impl Default for SortState {
    fn default() -> Self {
        SortState { column: SortColumn::SizeBytes, direction: Direction::Desc }
    }
}

/// What clicking a header does: reverse if it is the sorted column, else
/// switch to it in the direction someone clicking that column almost always
/// wants (largest, newest first).
pub fn next_sort_state(current: SortState, column: SortColumn) -> SortState {
    if current.column == column {
        let direction = if current.direction == Direction::Asc { Direction::Desc } else { Direction::Asc };
        return SortState { column, direction };
    }
    let first_desc = matches!(column, SortColumn::SizeBytes | SortColumn::InstallDate | SortColumn::Recent);
    SortState { column, direction: if first_desc { Direction::Desc } else { Direction::Asc } }
}

/// Unknown values sink to the bottom in BOTH directions: an unknown size is
/// not a zero-byte program. The New column is derived, never unknown: a
/// program with no date is not new, which is an answer.
fn is_unknown(p: &Program, column: SortColumn) -> bool {
    match column {
        SortColumn::Recent => false,
        SortColumn::Name => p.name.is_empty(),
        SortColumn::Publisher => p.publisher.is_empty(),
        SortColumn::Version => p.version.is_empty(),
        SortColumn::Architecture => p.architecture.is_none(),
        SortColumn::SizeBytes => p.size_bytes.is_none(),
        SortColumn::InstallDate => p.install_date.is_none(),
    }
}

fn compare_by(a: &Program, b: &Program, column: SortColumn, today: i64) -> Ordering {
    match column {
        SortColumn::Name => compare(&a.name, &b.name, Mode::Base),
        SortColumn::Publisher => compare(&a.publisher, &b.publisher, Mode::Base),
        SortColumn::Version => compare(&a.version, &b.version, Mode::Numeric),
        SortColumn::Architecture => compare(a.architecture.map_or("", |x| x.label()), b.architecture.map_or("", |x| x.label()), Mode::Default),
        SortColumn::SizeBytes => a.size_bytes.cmp(&b.size_bytes),
        SortColumn::InstallDate => a.install_date.cmp(&b.install_date),
        // New first within the column, then by date so both halves read the way
        // the arrow says; an undated program is as far from new as it gets.
        SortColumn::Recent => is_recently_installed(a, today).cmp(&is_recently_installed(b, today)).then_with(|| install_day(a).cmp(&install_day(b))),
    }
}

/// Indices into `list`, sorted. Stable: ties keep the order they arrived in.
pub fn sort_indices(list: &[&Program], state: SortState, today: i64) -> Vec<usize> {
    let mut order: Vec<usize> = (0..list.len()).collect();
    order.sort_by(|&i, &j| {
        let (a, b) = (list[i], list[j]);
        match (is_unknown(a, state.column), is_unknown(b, state.column)) {
            (true, true) => Ordering::Equal,
            (true, false) => Ordering::Greater,
            (false, true) => Ordering::Less,
            (false, false) => {
                let o = compare_by(a, b, state.column, today);
                if state.direction == Direction::Desc { o.reverse() } else { o }
            }
        }
    });
    order
}

/* ------------------------------------------------------------- filtering */

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum Filter {
    #[default]
    All,
    Store,
    Chocolatey,
    Extensions,
    Unregistered,
    Windows,
    OtherUsers,
    Unused,
    Unsigned,
    Broken,
}

impl Filter {
    /// The id the catalog keys use: `applications.filters.<id>`.
    pub fn key(self) -> &'static str {
        match self {
            Filter::All => "all",
            Filter::Store => "store",
            Filter::Chocolatey => "chocolatey",
            Filter::Extensions => "extensions",
            Filter::Unregistered => "unregistered",
            Filter::Windows => "windows",
            Filter::OtherUsers => "otherUsers",
            Filter::Unused => "unused",
            Filter::Unsigned => "unsigned",
            Filter::Broken => "broken",
        }
    }
}

/// The five lists the screen holds. Extensions, unregistered folders, Windows'
/// features and updates and other accounts' programs are lists of their own:
/// none is an installed program in the sense the count and the total mean,
/// and mixing them in would dilute both.
#[derive(Debug, Clone, Default)]
pub struct Lists {
    /// Registry programs, Store apps and package-only Chocolatey rows, in that order.
    pub programs: Vec<Program>,
    pub extensions: Vec<Program>,
    pub unregistered: Vec<Program>,
    pub windows_items: Vec<Program>,
    pub other_users: Vec<Program>,
}

impl Lists {
    pub fn list_for(&self, filter: Filter) -> &[Program] {
        match filter {
            Filter::Extensions => &self.extensions,
            Filter::Unregistered => &self.unregistered,
            Filter::Windows => &self.windows_items,
            Filter::OtherUsers => &self.other_users,
            _ => &self.programs,
        }
    }
}

fn is_chocolatey(p: &Program) -> bool {
    p.source == Source::Chocolatey || p.chocolatey_id.is_some()
}

/// Chip counts. A chip is offered only when its count is above zero (a
/// permanently-empty view teaches people to ignore it). 3.x's Unused filter
/// is on that list but nothing in the backend ever sets `unused`, so it is
/// never offered and 4.0 has no field for it.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct ChipCounts {
    pub store: usize,
    pub chocolatey: usize,
    pub extensions: usize,
    pub unregistered: usize,
    pub windows: usize,
    pub other_users: usize,
    pub unsigned: usize,
    pub broken: usize,
}

pub fn chip_counts(lists: &Lists) -> ChipCounts {
    let p = &lists.programs;
    ChipCounts {
        store: p.iter().filter(|x| x.source == Source::Store).count(),
        chocolatey: p.iter().filter(|x| is_chocolatey(x)).count(),
        extensions: lists.extensions.len(),
        unregistered: lists.unregistered.len(),
        windows: lists.windows_items.len(),
        other_users: lists.other_users.len(),
        unsigned: p.iter().filter(|x| x.is_unsigned()).count(),
        broken: p.iter().filter(|x| x.is_orphaned()).count(),
    }
}

fn in_filter(p: &Program, filter: Filter) -> bool {
    match filter {
        Filter::Store => p.source == Source::Store,
        Filter::Chocolatey => is_chocolatey(p),
        Filter::Unsigned => p.is_unsigned(),
        Filter::Broken => p.is_orphaned(),
        Filter::Unused => false,
        _ => true,
    }
}

/// Everything the table, the heading and the footer need for one state of the
/// controls.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Visible {
    /// Indices into `Lists::list_for(filter)`, in display order.
    pub rows: Vec<usize>,
    /// Hidden rows the current filter would show with "Show hidden" on. Counted
    /// before the search, like the chips, so typing does not make it jump.
    pub hidden_count: usize,
    /// How many rows are in the filter, before search and hiding.
    pub in_filter: usize,
    pub total_bytes: u64,
    /// Rows carrying the New badge.
    pub new_count: usize,
    /// Whether the search, filter or hiding narrows the list (the heading then
    /// says "N of M shown").
    pub narrowed: bool,
    /// The whole list's length, for "showing N of M".
    pub shown_of: usize,
}

pub struct Controls<'a> {
    pub filter: Filter,
    pub query: &'a str,
    pub sort: SortState,
    pub show_hidden: bool,
    pub hidden: &'a HashSet<String>,
    pub today: i64,
}

/// The pipeline: the list for the filter, narrowed by the filter chip, then
/// the search (name or publisher, case-insensitive), then hiding, then sorted.
pub fn visible(lists: &Lists, c: &Controls) -> Visible {
    let source = lists.list_for(c.filter);
    let candidates: Vec<usize> = (0..source.len()).filter(|&i| in_filter(&source[i], c.filter)).collect();
    let hidden_count = candidates.iter().filter(|&&i| is_program_hidden(&source[i], c.hidden)).count();
    let q = c.query.trim().to_lowercase();
    let matched: Vec<usize> = candidates
        .iter()
        .copied()
        .filter(|&i| q.is_empty() || source[i].name.to_lowercase().contains(&q) || source[i].publisher.to_lowercase().contains(&q))
        .filter(|&i| c.show_hidden || !is_program_hidden(&source[i], c.hidden))
        .collect();
    let refs: Vec<&Program> = matched.iter().map(|&i| &source[i]).collect();
    let rows: Vec<usize> = sort_indices(&refs, c.sort, c.today).into_iter().map(|k| matched[k]).collect();
    Visible {
        total_bytes: rows.iter().map(|&i| source[i].size_bytes.unwrap_or(0)).sum(),
        new_count: rows.iter().filter(|&&i| is_recently_installed(&source[i], c.today)).count(),
        narrowed: !q.is_empty() || c.filter != Filter::All || (!c.show_hidden && hidden_count > 0),
        shown_of: source.len(),
        in_filter: candidates.len(),
        hidden_count,
        rows,
    }
}

/* ---------------------------------------------------------------- batch */

/// Why a row cannot be ticked, as the catalog key under
/// `applications.batchReasons`. A batch runs uninstallers back to back with no
/// one reviewing each, so the bar is higher than for a single click.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BatchReason {
    Orphaned,
    Extension,
    StoreNoPackage,
    StoreProtected,
    StoreUnknown,
    NoCommand,
    Chocolatey,
    Unregistered,
    Windows,
    OtherUser,
}

impl BatchReason {
    pub fn key(self) -> &'static str {
        match self {
            BatchReason::Orphaned => "applications.batchReasons.orphaned",
            BatchReason::Extension => "applications.batchReasons.extension",
            BatchReason::StoreNoPackage => "applications.batchReasons.storeNoPackage",
            BatchReason::StoreProtected => "applications.batchReasons.storeProtected",
            BatchReason::StoreUnknown => "applications.batchReasons.storeUnknown",
            BatchReason::NoCommand => "applications.batchReasons.noCommand",
            BatchReason::Chocolatey => "applications.batchReasons.chocolatey",
            BatchReason::Unregistered => "applications.batchReasons.unregistered",
            BatchReason::Windows => "applications.batchReasons.windows",
            BatchReason::OtherUser => "applications.batchReasons.otherUser",
        }
    }
}

pub fn batch_ineligible_reason(p: &Program) -> Option<BatchReason> {
    if p.is_orphaned() {
        return Some(BatchReason::Orphaned);
    }
    match p.source {
        Source::Extension => return Some(BatchReason::Extension),
        Source::Chocolatey => return Some(BatchReason::Chocolatey),
        Source::Unregistered => return Some(BatchReason::Unregistered),
        Source::Feature | Source::Update => return Some(BatchReason::Windows),
        Source::OtherUser => return Some(BatchReason::OtherUser),
        Source::Store => {
            // Only an app Windows has EXPLICITLY said may be removed is let in:
            // unknown means out, the same lopsided default the removal uses.
            if p.package_full_name.is_none() {
                return Some(BatchReason::StoreNoPackage);
            }
            return match p.non_removable {
                Some(false) => None,
                Some(true) => Some(BatchReason::StoreProtected),
                None => Some(BatchReason::StoreUnknown),
            };
        }
        Source::Registry => {}
    }
    p.uninstall_string.is_none().then_some(BatchReason::NoCommand)
}

pub fn can_batch(p: &Program) -> bool {
    batch_ineligible_reason(p).is_none()
}

/// Count and total of a selection. A missing size is unknown, not zero: it is
/// counted separately so the bar can say "and some of unknown size".
pub fn batch_summary(selected: &[&Program]) -> (usize, u64, usize) {
    let total = selected.iter().filter_map(|p| p.size_bytes).sum();
    (selected.len(), total, selected.iter().filter(|p| p.size_bytes.is_none()).count())
}

/* ---------------------------------------------------------- text and look */

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Tone {
    Low,
    Moderate,
    High,
    Peak,
}

/// Which severity band a size falls in: a ramp from neutral to amber and never
/// red (red here would read as "broken"; a 105 GB game is not broken, it is
/// big). Unknown or zero is the quietest band.
pub fn size_tone(bytes: Option<u64>) -> Tone {
    const MB: u64 = 1 << 20;
    const GB: u64 = 1 << 30;
    match bytes.unwrap_or(0) {
        0 => Tone::Low,
        b if b < 250 * MB => Tone::Low,
        b if b < 2 * GB => Tone::Moderate,
        b if b < 15 * GB => Tone::High,
        _ => Tone::Peak,
    }
}

/// Bytes as the app writes them everywhere: one decimal at most, and a dash,
/// never a zero, for a value nobody measured (`formatBytes`).
pub fn format_bytes(bytes: Option<u64>, units: SizeUnits) -> String {
    let Some(bytes) = bytes else { return "\u{2014}".to_owned() };
    if bytes == 0 {
        return "0 B".to_owned();
    }
    let (base, labels): (f64, [&str; 5]) = match units {
        SizeUnits::Windows => (1024.0, ["B", "KB", "MB", "GB", "TB"]),
        SizeUnits::Binary => (1024.0, ["B", "KiB", "MiB", "GiB", "TiB"]),
        SizeUnits::Decimal => (1000.0, ["B", "KB", "MB", "GB", "TB"]),
    };
    let value = bytes as f64;
    let i = ((value.ln() / base.ln()).floor().max(0.0) as usize).min(4);
    let scaled = value / base.powi(i as i32);
    // JavaScript's toFixed(1) takes the larger of two equally near results.
    let rounded = (scaled * 10.0 + 0.5).floor() / 10.0;
    format!("{} {}", rounded, labels[i])
}

const PALETTE: [&str; 16] = [
    "#e0685f", "#4a92e0", "#5fb85f", "#d9b03a", "#9366d9", "#3bb3c4", "#e08a3c", "#d95f9e", "#a8bf3f", "#6d7fe0", "#3fbf95", "#c064cc",
    "#c47a5a", "#5fa8a0", "#b58fd4", "#8a9bb0",
];

/// The ink on a tile: the dark ground token, not white. White clears WCAG AA on
/// none of the sixteen palette entries; this clears nearly all.
pub const TILE_INK: [u8; 3] = [0x09, 0x09, 0x0b];

fn luminance(rgb: [u8; 3]) -> f64 {
    let lin = |c: u8| {
        let c = f64::from(c) / 255.0;
        if c <= 0.03928 { c / 12.92 } else { ((c + 0.055) / 1.055).powf(2.4) }
    };
    0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2])
}

fn hex(h: &str) -> [u8; 3] {
    let n = |i: usize| u8::from_str_radix(&h[i..i + 2], 16).unwrap_or(0);
    [n(1), n(3), n(5)]
}

/// The palette entries a letter can be read on (4.5:1 against the ink),
/// derived rather than listed so a palette change cannot reintroduce an
/// illegible tile.
pub fn tile_colors() -> Vec<[u8; 3]> {
    PALETTE
        .iter()
        .map(|h| hex(h))
        .filter(|c| {
            let (hi, lo) = (luminance(*c).max(luminance(TILE_INK)), luminance(*c).min(luminance(TILE_INK)));
            (hi + 0.05) / (lo + 0.05) >= 4.5
        })
        .collect()
}

/// FNV-1a over UTF-16 code units, as 3.x's `hash` (`charCodeAt`).
fn fnv(text: &str) -> u32 {
    text.encode_utf16().fold(0x811c_9dc5u32, |h, unit| (h ^ u32::from(unit)).wrapping_mul(0x0100_0193))
}

/// A stable colour for one program, by name: an identity anchor that makes a
/// row findable again after scrolling, and encodes nothing.
pub fn tile_color(name: &str) -> [u8; 3] {
    let colors = tile_colors();
    colors[fnv(&name.trim().to_lowercase()) as usize % colors.len()]
}

fn first_word(text: &str) -> String {
    text.chars().skip_while(|c| !c.is_ascii_alphanumeric()).take_while(char::is_ascii_alphanumeric).collect::<String>().to_lowercase()
}

fn first_character(text: &str) -> Option<char> {
    text.chars().find(char::is_ascii_alphanumeric).map(|c| c.to_ascii_uppercase())
}

/// The letter on the tile a program falls back to. A program with no icon is
/// overwhelmingly a system component named after its vendor, and twenty-six
/// identical "M"s say nothing, so a leading vendor word is skipped, but only
/// when the publisher confirms it ("Windows Software Development Kit" keeps
/// its W: its publisher is Microsoft).
pub fn tile_letter(name: &str, publisher: &str) -> char {
    let text = name.trim();
    let fallback = first_character(text).unwrap_or('?');
    let publisher_word = first_word(publisher);
    if publisher_word.is_empty() || publisher.trim().eq_ignore_ascii_case("unknown publisher") {
        return fallback;
    }
    let name_word = first_word(text);
    if name_word.is_empty() || name_word != publisher_word {
        return fallback;
    }
    let lower = text.to_lowercase();
    let rest = lower.find(&name_word).map_or("", |at| &lower[at + name_word.len()..]);
    first_character(rest).unwrap_or(fallback)
}

/// An install date (`YYYY-MM-DD`) in the person's own short date format
/// (`GetDateFormatEx` with `DATE_SHORTDATE`), or `None` for no date. 3.x
/// writes `new Date(date).toLocaleDateString()`, which reads the date as UTC
/// midnight and so shows the PREVIOUS day anywhere west of UTC; this writes
/// the date it was given.
#[cfg(windows)]
pub fn format_short_date(date: &str) -> Option<String> {
    use windows::Win32::Foundation::SYSTEMTIME;
    use windows::Win32::Globalization::{DATE_SHORTDATE, GetDateFormatEx};
    use windows::core::PCWSTR;
    let (y, m, d) = parse_install_date(date)?;
    let st = SYSTEMTIME { wYear: y as u16, wMonth: m as u16, wDay: d as u16, ..Default::default() };
    let mut buf = [0u16; 80];
    // SAFETY: `st` and `buf` outlive the call; null locale is the user's.
    let n = unsafe { GetDateFormatEx(PCWSTR::null(), DATE_SHORTDATE, Some(&st), PCWSTR::null(), Some(&mut buf), PCWSTR::null()) };
    (n > 1).then(|| String::from_utf16_lossy(&buf[..n as usize - 1]))
}

#[cfg(not(windows))]
pub fn format_short_date(date: &str) -> Option<String> {
    parse_install_date(date).map(|(y, m, d)| format!("{m}/{d}/{y}"))
}

/// The `YYYY-MM-DD` of a day number: the inverse of [`day_number`].
pub fn date_from_day_number(days: i64) -> String {
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + i64::from(month <= 2);
    format!("{year:04}-{month:02}-{day:02}")
}
```


`programs/mod.rs` gains `pub mod view;`.

- [ ] **Step 4:** Expected: 17 passed.
- [ ] **Step 5: Commit** `feat(native): the Applications table's filter, search, sort, selection and text rules`

### Task 16: The staged loader

**Files:**
- Create: `native/crates/prune-core/src/programs/loader.rs`
- Modify: `native/crates/prune-core/src/programs/mod.rs`
- Test: `native/crates/prune-core/tests/programs_loader.rs`

**Interfaces:**
- Produces: `Stage`, `Table` (`apply`, `lists`, `loading`, `icon_for`, public `profiles`, `program_icons`, `package_icons`, `traces`, `error`), `merge_measured_sizes`, `merge_binary_versions`, `merge_install_dates`, `tag_chocolatey_managed`, `with_signatures`, `load_all`.
- `load_all(sizes_store_path, traces_root, send)` reads the registry first and alone, sends `Stage::List`, then starts every other lookup at once on its own thread so the slowest never delays the sizes and icons a person is waiting for; a size shown from a day-old figure is measured again after the answer is out. A registry-reported size, version or date is never overwritten by a measured one; the filled ones are marked (`size_measured`, `version_from_binary`, `install_date_approximate`). Store apps are `non_removable = Some(true)` until Windows has said otherwise. Only a failed list fails the screen.

- [ ] **Step 1: Write the tests.**

**Create `native/crates/prune-core/tests/programs_loader.rs`:**

```rust
//! Merging the pieces as they arrive (ported from 3.x's mergeSizes,
//! mergeVersions, mergeInstallDates and usePrograms tests), and the whole
//! staged load against this machine and against 3.x.

use std::collections::HashMap;
use std::sync::Mutex;

use prune_core::programs::loader::*;
use prune_core::programs::model::*;

fn p(id: &str) -> Program {
    Program { id: id.into(), name: id.into(), ..Program::default() }
}

#[test]
fn a_declared_value_is_never_overwritten_and_a_blank_is_filled_and_marked() {
    let mut list = vec![Program { size_bytes: Some(5), version: "1.0".into(), install_date: Some("2026-01-01".into()), ..p("declared") }, p("blank")];
    merge_measured_sizes(&mut list, &HashMap::from([("declared".into(), 9), ("blank".into(), 9)]));
    merge_binary_versions(&mut list, &HashMap::from([("declared".into(), "2.0".into()), ("blank".into(), "2.0".into())]));
    merge_install_dates(&mut list, &HashMap::from([("declared".into(), "2027-01-01".into()), ("blank".into(), "2027-01-01".into())]));
    assert_eq!((list[0].size_bytes, list[0].version.as_str(), list[0].install_date.as_deref()), (Some(5), "1.0", Some("2026-01-01")));
    assert!(!list[0].size_measured && !list[0].version_from_binary && !list[0].install_date_approximate);
    assert_eq!((list[1].size_bytes, list[1].version.as_str(), list[1].install_date.as_deref()), (Some(9), "2.0", Some("2027-01-01")));
    assert!(list[1].size_measured && list[1].version_from_binary && list[1].install_date_approximate);
}

#[test]
fn the_order_answers_land_in_cannot_matter() {
    let store = Program { source: Source::Store, package_full_name: Some("S_1".into()), ..p("store:S_1") };
    let stages = || {
        vec![
            Stage::Sizes(HashMap::from([("a".into(), 7)])),
            Stage::Store(vec![store.clone()]),
            Stage::List(vec![p("a")]),
            Stage::NonRemovable(HashMap::from([("S_1".into(), false)])),
            Stage::Signatures(HashMap::from([("a".into(), Signature { status: SigStatus::Valid, signer: Some("V".into()) })])),
        ]
    };
    let mut forward = Table::default();
    stages().into_iter().for_each(|s| forward.apply(s));
    let mut backward = Table::default();
    stages().into_iter().rev().for_each(|s| backward.apply(s));
    assert_eq!(forward.lists().programs, backward.lists().programs);
    let lists = forward.lists();
    assert_eq!(lists.programs.len(), 2);
    assert_eq!((lists.programs[0].size_bytes, lists.programs[0].signature.is_some()), (Some(7), true));
    assert_eq!(lists.programs[1].non_removable, Some(false));
}

#[test]
fn until_windows_has_said_a_store_app_is_not_removable() {
    let store = Program { source: Source::Store, package_full_name: Some("S_1".into()), ..p("store:S_1") };
    let mut table = Table::default();
    table.apply(Stage::List(vec![]));
    table.apply(Stage::Store(vec![store]));
    assert_eq!(table.lists().programs[0].non_removable, Some(true));
}

#[test]
fn only_a_failed_list_fails_the_screen() {
    let mut table = Table::default();
    assert!(table.loading());
    table.apply(Stage::Failed("icons"));
    assert!(table.error.is_none() && table.loading());
    table.apply(Stage::Failed("list"));
    assert!(table.error.is_some() && !table.loading());
}

#[test]
fn chocolatey_rows_follow_the_store_and_the_registry_programs_are_tagged() {
    let choco = Program { source: Source::Chocolatey, ..p("chocolatey:x") };
    let mut table = Table::default();
    table.apply(Stage::List(vec![p("py")]));
    table.apply(Stage::Chocolatey { rows: vec![choco], managed: HashMap::from([("py".into(), "python314".into())]) });
    let lists = table.lists();
    assert_eq!(lists.programs.iter().map(|x| x.id.as_str()).collect::<Vec<_>>(), ["py", "chocolatey:x"]);
    assert_eq!(lists.programs[0].chocolatey_id.as_deref(), Some("python314"));
}

#[cfg(windows)]
#[test]
fn the_whole_load_arrives_in_pieces_and_ends_like_3x() {
    let dir = std::env::temp_dir().join(format!("prune-load-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let seen = Mutex::new(Vec::new());
    let table = Mutex::new(Table::default());
    let started = std::time::Instant::now();
    load_all(Some(dir.join("folder-sizes.json")), dir.join("install-traces"), &|stage| {
        let name = format!("{stage:?}");
        let name = name.split(['(', ' ', '{']).next().unwrap_or("").to_owned();
        seen.lock().unwrap().push((name, started.elapsed()));
        table.lock().unwrap().apply(stage);
    });
    let seen = seen.into_inner().unwrap();
    for (name, at) in &seen {
        eprintln!("{at:>10.1?}  {name}");
    }
    assert_eq!(seen[0].0, "List", "the list goes first and alone");
    assert!(seen.len() >= 15, "{} stages", seen.len());

    let lists = table.into_inner().unwrap().lists();
    let Some(dir3x) = std::env::var_os("PRUNE_3X_DIR").map(std::path::PathBuf::from) else { return };
    let read = |f: &str| -> serde_json::Value { serde_json::from_slice(&std::fs::read(dir3x.join(f)).unwrap()).unwrap() };
    // 3.x's header said "235 installed applications": registry + Store + package-only Chocolatey.
    let theirs = read("programs.json")["programs"].as_array().unwrap().len() + read("store.json")["apps"].as_array().unwrap().len() + read("chocolatey.json")["apps"].as_array().unwrap().len();
    assert_eq!(lists.programs.len(), theirs);
    let ours_bytes: u64 = lists.programs.iter().filter_map(|x| x.size_bytes).sum();
    eprintln!("{} programs, {} bytes", lists.programs.len(), ours_bytes);
    assert!(lists.programs.iter().filter(|x| x.source == Source::Registry && x.size_bytes.is_none()).count() <= 5, "nearly every registry row has a size once measured");
}
```


- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3: Implement.**

**Create `native/crates/prune-core/src/programs/loader.rs`:**

```rust
//! The list is made of many answers that arrive at different times
//! (`frontend/src/hooks/usePrograms.js`). The registry read takes a few
//! milliseconds, sizes and icons tens or hundreds, signatures seconds, and the
//! list must not wait on any of it: 3.x asks eight endpoints separately and
//! merges at render, and so does this.
//!
//! The pieces are kept apart and merged by [`Table::lists`], which is derived
//! from whatever has arrived. That is not a stylistic choice: folded into one
//! piece of state, a fast answer merged into a list that had not arrived yet
//! and the list that arrived after wiped it out. Derived, the order they land
//! in cannot matter.

use std::collections::HashMap;
use std::sync::OnceLock;

use super::accounts::{Profile, TraceSummary};
use super::icons::{IconImage, RowIcon};
use super::model::{Program, Signature};
use super::view::Lists;

/// One answer, as it lands.
#[derive(Debug)]
pub enum Stage {
    /// The registry programs. Always first; everything else waits on nothing.
    List(Vec<Program>),
    Sizes(HashMap<String, u64>),
    Versions(HashMap<String, String>),
    InstallDates(HashMap<String, String>),
    Store(Vec<Program>),
    /// Windows' NonRemovable flag per package full name (the one PowerShell call).
    NonRemovable(HashMap<String, bool>),
    Chocolatey { rows: Vec<Program>, managed: HashMap<String, String> },
    Extensions(Vec<Program>),
    Unregistered(Vec<Program>),
    WindowsItems(Vec<Program>),
    Profiles(Vec<Profile>),
    Signatures(HashMap<String, Signature>),
    ProgramIcons(HashMap<String, IconImage>),
    PackageIcons(HashMap<String, RowIcon>),
    Traces(Vec<TraceSummary>),
    /// A stage failed; only the list itself can fail the screen.
    Failed(&'static str),
}

/* ------------------------------------------------------------- merging */

/// Fills in sizes for programs the registry gave none. A registry-reported
/// size is never overwritten: that number is what the installer declared, and
/// quietly replacing figures already read is a change nobody asked for.
pub fn merge_measured_sizes(programs: &mut [Program], sizes: &HashMap<String, u64>) {
    for p in programs.iter_mut().filter(|p| p.size_bytes.is_none()) {
        if let Some(bytes) = sizes.get(&p.id) {
            p.size_bytes = Some(*bytes);
            p.size_measured = true;
        }
    }
}

/// Same rule for versions read off the program's own binary.
pub fn merge_binary_versions(programs: &mut [Program], versions: &HashMap<String, String>) {
    for p in programs.iter_mut().filter(|p| p.version.is_empty()) {
        if let Some(v) = versions.get(&p.id).filter(|v| !v.is_empty()) {
            p.version = v.clone();
            p.version_from_binary = true;
        }
    }
}

/// Same rule for dates; the filled ones are marked approximate so the row can
/// say which are inferred (a muted date) rather than declared.
pub fn merge_install_dates(programs: &mut [Program], dates: &HashMap<String, String>) {
    for p in programs.iter_mut().filter(|p| p.install_date.is_none()) {
        if let Some(d) = dates.get(&p.id).filter(|d| !d.is_empty()) {
            p.install_date = Some(d.clone());
            p.install_date_approximate = true;
        }
    }
}

/// Marks each listed program a Chocolatey package installed with that package's id.
pub fn tag_chocolatey_managed(programs: &mut [Program], managed: &HashMap<String, String>) {
    for p in programs.iter_mut() {
        if let Some(id) = managed.get(&p.id) {
            p.chocolatey_id = Some(id.clone());
        }
    }
}

pub fn with_signatures(programs: &mut [Program], signatures: &HashMap<String, Signature>) {
    for p in programs.iter_mut() {
        if let Some(s) = signatures.get(&p.id) {
            p.signature = Some(s.clone());
        }
    }
}

/// Everything that has arrived so far.
#[derive(Debug, Default)]
pub struct Table {
    registry: Option<Vec<Program>>,
    sizes: HashMap<String, u64>,
    versions: HashMap<String, String>,
    dates: HashMap<String, String>,
    store: Vec<Program>,
    non_removable: HashMap<String, bool>,
    chocolatey_rows: Vec<Program>,
    managed: HashMap<String, String>,
    extensions: Vec<Program>,
    unregistered: Vec<Program>,
    windows_items: Vec<Program>,
    pub profiles: Vec<Profile>,
    signatures: HashMap<String, Signature>,
    pub program_icons: HashMap<String, IconImage>,
    pub package_icons: HashMap<String, RowIcon>,
    pub traces: Vec<TraceSummary>,
    pub error: Option<&'static str>,
}

impl Table {
    /// True until the registry read has answered.
    pub fn loading(&self) -> bool {
        self.registry.is_none() && self.error.is_none()
    }

    pub fn apply(&mut self, stage: Stage) {
        match stage {
            Stage::List(l) => self.registry = Some(l),
            Stage::Sizes(s) => self.sizes = s,
            Stage::Versions(v) => self.versions = v,
            Stage::InstallDates(d) => self.dates = d,
            Stage::Store(s) => self.store = s,
            Stage::NonRemovable(n) => self.non_removable = n,
            Stage::Chocolatey { rows, managed } => {
                self.chocolatey_rows = rows;
                self.managed = managed;
            }
            Stage::Extensions(e) => self.extensions = e,
            Stage::Unregistered(u) => self.unregistered = u,
            Stage::WindowsItems(w) => self.windows_items = w,
            Stage::Profiles(p) => self.profiles = p,
            Stage::Signatures(s) => self.signatures = s,
            Stage::ProgramIcons(i) => self.program_icons = i,
            Stage::PackageIcons(i) => self.package_icons = i,
            Stage::Traces(t) => self.traces = t,
            Stage::Failed(what) => {
                if what == "list" {
                    self.error = Some(what);
                }
            }
        }
    }

    /// The five lists, derived from what has arrived. Only the list itself
    /// is fatal: a failed icon, size or version leaves its rows with the honest
    /// blank they had before. Registry rows first (sizes, versions, dates, the
    /// Chocolatey tag and signatures merged in), then Store apps (an unknown
    /// NonRemovable reads as "not removable"), then package-only Chocolatey rows.
    pub fn lists(&self) -> Lists {
        let mut programs = self.registry.clone().unwrap_or_default();
        merge_measured_sizes(&mut programs, &self.sizes);
        merge_binary_versions(&mut programs, &self.versions);
        merge_install_dates(&mut programs, &self.dates);
        tag_chocolatey_managed(&mut programs, &self.managed);
        with_signatures(&mut programs, &self.signatures);
        programs.extend(self.store.iter().cloned().map(|mut s| {
            s.non_removable = Some(s.package_full_name.as_ref().and_then(|n| self.non_removable.get(n)).copied().unwrap_or(true));
            s
        }));
        programs.extend(self.chocolatey_rows.iter().cloned());
        Lists {
            programs,
            extensions: self.extensions.clone(),
            unregistered: self.unregistered.clone(),
            windows_items: self.windows_items.clone(),
            other_users: Vec::new(),
        }
    }

    /// The icon for a row: a program's own icon, else a package or extension
    /// icon. Two sources, one lookup.
    pub fn icon_for(&self, id: &str) -> Option<IconRef<'_>> {
        self.program_icons.get(id).map(IconRef::Raster).or_else(|| match self.package_icons.get(id)? {
            RowIcon::Raster(i) => Some(IconRef::Raster(i)),
            RowIcon::Svg(b) => Some(IconRef::Svg(b)),
        })
    }
}

pub enum IconRef<'a> {
    Raster(&'a IconImage),
    Svg(&'a [u8]),
}

/* ------------------------------------------------------------- loading */

/// Reads everything, sending each answer as it is ready. Blocks until the last
/// has been sent: call it from a worker thread. The list goes first and alone;
/// every other lookup then runs at once on its own thread, so the slowest
/// (signatures, "Not registered") never delays the sizes and icons a person is
/// waiting for. Nothing here writes except `folder-sizes.json`, the cache 3.x
/// keeps in the same shape.
pub fn load_all(sizes_store_path: Option<std::path::PathBuf>, traces_root: std::path::PathBuf, send: &(dyn Fn(Stage) + Sync)) {
    use super::{accounts, chocolatey, dates, extensions, folder_sizes, icons, package_icons, registry, signatures, sizes, store, unregistered, versions, windows_items};

    let list = registry::list_installed_programs();
    if list.is_empty() {
        send(Stage::Failed("list"));
    }
    send(Stage::List(list.clone()));
    let list = &list;

    let store_rows: OnceLock<Vec<Program>> = OnceLock::new();
    let extension_rows: OnceLock<Vec<Program>> = OnceLock::new();
    let (store_rows, extension_rows) = (&store_rows, &extension_rows);

    std::thread::scope(|scope| {
        scope.spawn(move || {
            let mut kept = folder_sizes::FolderSizeStore::load(sizes_store_path);
            let outcome = sizes::resolve_sizes(list, &mut kept);
            send(Stage::Sizes(outcome.sizes));
            // Shown from a day-old figure: measured again now that the answer is out.
            sizes::refresh_stale(&outcome.stale, &mut kept);
        });
        scope.spawn(move || {
            let rows = store::list_store_apps();
            send(Stage::Store(rows.clone()));
            let _ = store_rows.set(rows);
        });
        scope.spawn(move || send(Stage::NonRemovable(store::read_non_removable())));
        scope.spawn(move || {
            let rows = extensions::list_browser_extensions();
            send(Stage::Extensions(rows.clone()));
            let _ = extension_rows.set(rows);
        });
        scope.spawn(move || {
            let packages = chocolatey::read_packages(&chocolatey::chocolatey_root());
            let managed = if packages.is_empty() { HashMap::new() } else { chocolatey::managed_programs(&packages, list) };
            send(Stage::Chocolatey { rows: chocolatey::chocolatey_rows(&packages), managed });
        });
        scope.spawn(move || send(Stage::Versions(versions::resolve_versions(list))));
        scope.spawn(move || send(Stage::InstallDates(dates::resolve_install_dates(list))));
        scope.spawn(move || send(Stage::ProgramIcons(icons::resolve_program_icons(list))));
        scope.spawn(move || send(Stage::Signatures(signatures::resolve_signatures(list, &mut HashMap::new()))));
        scope.spawn(move || send(Stage::Unregistered(unregistered::list_unregistered_programs(list))));
        scope.spawn(move || {
            let mut items = windows_items::list_windows_features();
            items.extend(windows_items::list_windows_updates());
            send(Stage::WindowsItems(items));
        });
        scope.spawn(move || send(Stage::Profiles(accounts::list_other_profiles())));
        scope.spawn(move || send(Stage::Traces(accounts::list_traces(&traces_root))));
        scope.spawn(move || {
            // The package icons need the Store apps and extensions: wait for both.
            let (store, ext) = loop {
                if let (Some(s), Some(e)) = (store_rows.get(), extension_rows.get()) {
                    break (s, e);
                }
                std::thread::sleep(std::time::Duration::from_millis(20));
            };
            let mut rows = store.clone();
            rows.extend(ext.iter().cloned());
            send(Stage::PackageIcons(package_icons::resolve_package_icons(&rows)));
        });
    });
}
```


`programs/mod.rs` is now complete (24 modules; `walk` is Windows-only).

- [ ] **Step 4:** `PRUNE_3X_DIR=<folder> cargo test -p prune-core --test programs_loader -- --nocapture`. Expected: 6 passed. The whole-load test prints each stage's arrival time; on this PC, on a first run with no `folder-sizes.json` and every lookup running at once: List 65 ms, Traces/Profiles/InstallDates about 70 ms, Chocolatey 0.6 s, Versions 1.2 s, Not registered 1.6 s, Extensions and Store 2.2 s, program icons 2.4 s, package icons 2.5 s, NonRemovable 2.5 s, Windows items 3.5 s, Signatures 3.9 s, Sizes 5.3 s (43 folders measured while everything else runs; with a fresh `folder-sizes.json` it is immediate), and `235 programs`, equal to the 3.x header count.
- [ ] **Step 5: Commit** `feat(native): the staged program loader and the merge that makes arrival order irrelevant`

### Task 17: Counts as numbers, and the five messages still flagged

**Files:**
- Create: `native/tools/fix-plurals.mjs`
- Modify: `native/crates/prune-core/src/i18n.rs`, `native/crates/prune-core/locales/<lang>/prune.ftl` (by the tool, 71 messages), `native/crates/prune-core/locales/needs-review.json` (by the tool)
- Test: `native/crates/prune-core/tests/i18n.rs`

**Interfaces:**
- Produces: `prune_core::i18n::count(n: usize) -> FluentValue<'static>` (the ruling in Global Constraints), and Fluent selects for `app.applicationsSummary`, `applications.empty.hiddenCount`, `applications.footer.newInDays`, `applications.footer.selected` and `applications.footer.uninstallCount` in the languages where 3.x chose its words by the count.
- `fix-plurals.mjs` rewrites a flagged function as a select with CLDR's categories for the language (`Intl.PluralRules`), taking the words for each category from 3.x's own function evaluated at a representative whole number (from 1 up, so the singular reads "1 program"); a category no integer belongs to (Polish and Russian `other`) borrows `many`'s words, because Fluent needs a default variant. Nothing is retyped by hand. It prints every place 3.x's own rule differs from CLDR as `DEVIATION`.

- [ ] **Step 1: Write the failing tests** (appended to `tests/i18n.rs`; the diff below is the whole change to that file).

**Modify `native/crates/prune-core/tests/i18n.rs`** (a unified diff against today's file; apply with the Edit tool, since some working copies are CRLF):

```diff
--- a/native/crates/prune-core/tests/i18n.rs
+++ b/native/crates/prune-core/tests/i18n.rs
@@ -134,3 +134,45 @@
     }
     assert!(left.is_empty(), "still need review: {left:?}");
 }
+
+#[test]
+fn phase2a_namespaces_have_no_needs_review() {
+    let json = fs::read_to_string(locales().join("needs-review.json")).unwrap();
+    let review: serde_json::Map<String, serde_json::Value> = serde_json::from_str(&json).unwrap();
+    let prefixes = [
+        "applications.", "app.applicationsSummary", "app.installedApplications", "sourcesV4.", "sigV6.", "hiddenProgramsV1.",
+        "otherV7.", "uninstallerV3.hunter.button", "uninstallerV3.monitor.button", "uninstallerV3.monitor.badge",
+        "uninstallerV3.forced.button", "uninstallerV3.extensions.manage",
+    ];
+    let mut left = Vec::new();
+    for (lang, keys) in &review {
+        for key in keys.as_array().unwrap() {
+            let key = key.as_str().unwrap();
+            if prefixes.iter().any(|p| key.starts_with(p)) {
+                left.push(format!("{lang}: {key}"));
+            }
+        }
+    }
+    assert!(left.is_empty(), "still need review: {left:?}");
+}
+
+#[test]
+fn a_count_passed_as_a_number_selects_the_languages_plural_form() {
+    use prune_core::i18n::count;
+    let t = |lang: &str, n: usize| Catalog::load(lang).t("applications.footer.uninstallCount", &[("count", count(n))]);
+    assert_eq!(t("en", 1), "Uninstall 1 program");
+    assert_eq!(t("en", 2), "Uninstall 2 programs");
+    // Polish has three forms for whole numbers: 1, 2-4 (and 22-24), 5-21.
+    assert_eq!(t("pl", 1), "Odinstaluj 1 program");
+    assert_eq!(t("pl", 3), "Odinstaluj 3 programy");
+    assert_eq!(t("pl", 5), "Odinstaluj 5 programów");
+    assert_eq!(t("pl", 22), "Odinstaluj 22 programy");
+    // Digits stay plain, as 3.x prints them: no grouping separator.
+    assert_eq!(Catalog::load("en").t("applications.footer.installations", &[("count", count(1234))]), "Installations: 1234");
+    // Romanian: 2-19 is "few", and 20 and up is "other" with its "de".
+    let ro = Catalog::load("ro").t("app.applicationsSummary", &[("count", count(20)), ("size", "1 GB".into())]);
+    assert!(ro.starts_with("20 de aplicații"), "{ro}");
+    // A string never selects a form: it falls to the default.
+    let as_text = Catalog::load("en").t("applications.footer.uninstallCount", &[("count", "1".into())]);
+    assert_eq!(as_text, "Uninstall 1 programs");
+}
```


- [ ] **Step 2:** `cargo test -p prune-core --test i18n`. Expected: FAIL (`count` does not exist; five keys are still flagged).
- [ ] **Step 3: Add `count`.**

**Modify `native/crates/prune-core/src/i18n.rs`** (a unified diff against today's file; apply with the Edit tool, since some working copies are CRLF):

```diff
--- a/native/crates/prune-core/src/i18n.rs
+++ b/native/crates/prune-core/src/i18n.rs
@@ -112,6 +112,14 @@
     }
 }
 
+/// A count as the argument a message selects its plural form by. Counts go
+/// to Fluent as NUMBERS, never as pre-formatted strings: a string cannot pick
+/// `[one]` or `[few]`, and 3.x's own counts are plain digits ("1234"), which is
+/// how Fluent prints a number, so nothing changes on screen.
+pub fn count(n: usize) -> FluentValue<'static> {
+    FluentValue::from(n as f64)
+}
+
 /// The Fluent id for a 3.x dotted key: `.` becomes `-`, and any character
 /// Fluent ids don't allow becomes `_<hex code point>_`, so
 /// `"startup.groups.Run|user"` is `startup-groups-Run_7c_user`. Must match
```


- [ ] **Step 4: Write the tool, then run it on the five keys.**

**Create `native/tools/fix-plurals.mjs`:**

```js
// Rewrites flagged count messages as Fluent selects, for the keys it is given.
//
//   node native/tools/fix-plurals.mjs <key> [<key> ...] [--dry-run]
//
// convert-catalog.mjs flags a 3.x function that chose its words by the value
// of a parameter (`${count} program${count === 1 ? '' : 's'}`) and writes it
// as one pattern under "# needs-review". Fixing one means a Fluent select
// with the language's CLDR plural categories, and the words for each category
// must be 3.x's own. This does that mechanically, so nothing is invented and
// nothing is retyped by hand:
//
//   - the categories are Intl.PluralRules(lang)'s (CLDR, which Fluent uses);
//   - the first parameter is the count. For each category the smallest whole
//     number from 1 up in it is passed (0 only for a category nothing from 1
//     up belongs to), the other parameters get sentinel strings, and the
//     function's output, with the number put back as { $count } and each
//     sentinel as { $name }, is that variant's text;
//   - the result is compared with the function for ten counts (0, 1, 2, 3, 5,
//     11, 21, 22, 101, 1000). Where 3.x's own rule differs from CLDR's (3.x
//     says "0 applications" in French, CLDR treats 0 as singular; 3.x omits
//     Romanian "de" where CLDR's few category does) the select follows CLDR,
//     which is what Fluent applies and what the spec asks for ("proper
//     per-language plural rules"). Each difference is printed as DEVIATION,
//     to be listed in the commit message.
//
// The count must reach Fluent as a NUMBER (FluentValue::from(n)): a string
// never selects a plural variant. See native/crates/prune-core/src/i18n.rs.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const locales = join(repo, 'native', 'crates', 'prune-core', 'locales');
const { CATALOG } = await import(pathToFileURL(join(repo, 'frontend', 'src', 'i18n', 'catalog.js')).href);

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const keys = args.filter((a) => !a.startsWith('--'));
if (keys.length === 0) {
  console.error('usage: fix-plurals.mjs <key> [<key> ...] [--dry-run]');
  process.exit(2);
}

const lookup = (tree, path) => path.split('.').reduce((n, k) => (n != null && Object.hasOwn(n, k) ? n[k] : undefined), tree);
const fluentId = (key) => key.split('.').join('-');
const paramNames = (fn) => {
  const head = fn.toString().match(/^[^(=]*\(([^)]*)\)|^\s*([A-Za-z_$][\w$]*)\s*=>/);
  const list = head?.[1] ?? head?.[2] ?? '';
  return list.split(',').map((p) => p.trim().replace(/=.*$/, '').trim()).filter(Boolean);
};
const OPEN = '';
const CLOSE = '';
const PLACEABLE = /(\{ \$\w+ \})/;

/** Fluent-safe text: braces and a leading [ * . are written as string literals,
 * placeables ({ $count }) are left alone. */
const escapeText = (text) =>
  text
    .split(PLACEABLE)
    .map((part) => (PLACEABLE.test(part) ? part : part.replace(/[{}]/g, (c) => `{"${c}"}`)))
    .join('')
    .split('\n')
    .map((line) => line.replace(/^([[*.])/, '{"$1"}'))
    .join('\n');

/** One whole number for each CLDR category of `lang`. */
function representatives(lang) {
  const rules = new Intl.PluralRules(lang);
  const found = new Map();
  for (let n = 1; n <= 1000; n += 1) {
    const category = rules.select(n);
    if (!found.has(category)) found.set(category, n);
  }
  const zero = rules.select(0);
  if (!found.has(zero)) found.set(zero, 0);
  return found;
}

const asPattern = (text, names) => {
  let out = text;
  for (const name of names) out = out.split(OPEN + name + CLOSE).join(`{ $${name} }`);
  return out;
};

function rewrite(lang, key, fn) {
  const [count, ...others] = paramNames(fn);
  const call = (n) => String(fn(n, ...others.map((o) => OPEN + o + CLOSE)));
  const variants = new Map();
  for (const [category, n] of representatives(lang)) {
    variants.set(category, asPattern(call(n).split(String(n)).join(OPEN + count + CLOSE), [count, ...others]));
  }
  // Fluent needs a default variant. Polish, Russian and others use `other`
  // only for fractions, which a count never is: it borrows `many`'s words.
  if (!variants.has('other')) variants.set('other', variants.get('many') ?? [...variants.values()].at(-1));
  const rules = new Intl.PluralRules(lang);
  const deviations = [];
  for (const n of [0, 1, 2, 3, 5, 11, 21, 22, 101, 1000]) {
    const expected = asPattern(call(n), others);
    const got = variants.get(rules.select(n)).split(`{ $${count} }`).join(String(n));
    if (got !== expected) deviations.push(`n=${n}: 3.x says ${JSON.stringify(expected)}, CLDR gives ${JSON.stringify(got)}`);
  }
  const id = fluentId(key);
  if (variants.size === 1) return { text: `${id} = ${escapeText([...variants.values()][0])}`, deviations };
  const ordered = [...variants].sort(([a], [b]) => (a === 'other') - (b === 'other'));
  const lines = [`${id} =`, `    { $${count} ->`];
  for (const [category, body] of ordered) lines.push(`${category === 'other' ? '   *' : '    '}[${category}] ${escapeText(body)}`);
  lines.push('    }');
  return { text: lines.join('\n'), deviations };
}

const reviewPath = join(locales, 'needs-review.json');
const review = JSON.parse(readFileSync(reviewPath, 'utf8'));
let fixed = 0;
let left = 0;

for (const lang of Object.keys(review)) {
  const wanted = keys.filter((k) => review[lang].includes(k));
  if (wanted.length === 0) continue;
  const file = join(locales, lang, 'prune.ftl');
  const lines = readFileSync(file, 'utf8').split('\n');
  for (const key of wanted) {
    const fn = lookup(CATALOG[lang], key);
    const at = lines.findIndex((l) => l.startsWith(`${fluentId(key)} =`));
    if (typeof fn !== 'function' || at < 0) {
      console.log(`${lang} ${key}: not a function in 3.x or not in ${file}, left flagged`);
      left += 1;
      continue;
    }
    const result = rewrite(lang, key, fn);
    for (const d of result.deviations) console.log(`DEVIATION ${lang} ${key} ${d}`);
    let end = at + 1;
    while (end < lines.length && /^\s+\S/.test(lines[end])) end += 1;
    const from = lines[at - 1]?.trim() === '# needs-review' ? at - 1 : at;
    lines.splice(from, end - from, ...result.text.split('\n'));
    review[lang] = review[lang].filter((k) => k !== key);
    fixed += 1;
  }
  if (!dryRun) writeFileSync(file, lines.join('\n'));
}
if (!dryRun) writeFileSync(reviewPath, `${JSON.stringify(review, null, 2)}\n`);
console.log(`${dryRun ? 'would fix' : 'fixed'} ${fixed}, left flagged ${left}`);
process.exit(left > 0 ? 1 : 0);
```


```
node native/tools/fix-plurals.mjs app.applicationsSummary applications.empty.hiddenCount applications.footer.newInDays applications.footer.selected applications.footer.uninstallCount
```

Expected: `fixed 71, left flagged 0` and 19 `DEVIATION` lines (1 Czech, 5 French, 5 Portuguese, 5 Brazilian Portuguese, 3 Romanian). Keep the printed list: it goes in the commit message body, and the owner is told about it (difference 6). Read two results by eye: `en` `app-applicationsSummary` becomes `[one] { $count } installed application · { $size }` / `*[other] { $count } installed applications · { $size }`, and Polish `applications-footer-uninstallCount` has `[one]`, `[few]`, `[many]` and `*[other]`.
- [ ] **Step 5:** `cargo test -p prune-core --test i18n`. Expected: 13 passed (the completeness tests still hold, no `needs-review` entry is left under the 2a prefixes, and a Polish 22 selects "programy").
- [ ] **Step 6: Commit** `feat(native): counts reach Fluent as numbers, and the Applications plural messages follow CLDR` with the DEVIATION list in the body.

### Task 18: Theme tokens the table needs

**Files:**
- Modify: `native/crates/prune-app/src/theme.rs`, `native/crates/prune-app/tests/theme.rs`

**Interfaces:**
- Adds nine `Palette` fields, each copied from `frontend/src/index.css` for dark and light and checked by the existing `palette_matches_index_css` test (extended from 25 fields to 34): `danger_ink`, `danger_ink_hover`, `danger_edge`, `danger_edge_hover`, `danger_soft_hover`, `danger_soft_active`, `warning_soft`, `success_soft`, `control_border_hover`. The badges, `.btn-remove` and the batch bar use them.

- [ ] **Step 1: Extend the test** (the `fields` list and the count).

**Modify `native/crates/prune-app/tests/theme.rs`** (a unified diff against today's file; apply with the Edit tool, since some working copies are CRLF):

```diff
--- a/native/crates/prune-app/tests/theme.rs
+++ b/native/crates/prune-app/tests/theme.rs
@@ -59,6 +59,15 @@
         ("surface-hover", p.surface_hover),
         ("surface-strong", p.surface_strong),
         ("scrim", p.scrim),
+        ("danger-ink", p.danger_ink),
+        ("danger-ink-hover", p.danger_ink_hover),
+        ("danger-edge", p.danger_edge),
+        ("danger-edge-hover", p.danger_edge_hover),
+        ("danger-soft-hover", p.danger_soft_hover),
+        ("danger-soft-active", p.danger_soft_active),
+        ("warning-soft", p.warning_soft),
+        ("success-soft", p.success_soft),
+        ("control-border-hover", p.control_border_hover),
         ("glass-bg", p.glass_bg),
         ("glass-border", p.glass_border),
         ("aurora-1", p.aurora_1),
@@ -73,7 +82,7 @@
     for (dark, selector) in [(true, ":root"), (false, ":root[data-theme='light']")] {
         let b = block(&css, selector);
         let fs = fields(palette(dark));
-        assert_eq!(fs.len(), 25);
+        assert_eq!(fs.len(), 34);
         for (name, got) in fs {
             let want = parse(&var(&b, name));
             assert!(close(got, want), "{selector} --{name}: rust {got:?} != css {want:?}");
```


- [ ] **Step 2:** `cargo test -p prune-app --test theme`. Expected: FAIL (no such fields).
- [ ] **Step 3: Add the fields and the values.**

**Modify `native/crates/prune-app/src/theme.rs`** (a unified diff against today's file; apply with the Edit tool, since some working copies are CRLF):

```diff
--- a/native/crates/prune-app/src/theme.rs
+++ b/native/crates/prune-app/src/theme.rs
@@ -28,6 +28,15 @@
     pub surface_hover: Color,
     pub surface_strong: Color,
     pub scrim: Color,
+    pub danger_ink: Color,
+    pub danger_ink_hover: Color,
+    pub danger_edge: Color,
+    pub danger_edge_hover: Color,
+    pub danger_soft_hover: Color,
+    pub danger_soft_active: Color,
+    pub warning_soft: Color,
+    pub success_soft: Color,
+    pub control_border_hover: Color,
     /// `.glass-panel`'s fill and edge (the nav rail, cards, dialogs).
     pub glass_bg: Color,
     pub glass_border: Color,
@@ -67,6 +76,15 @@
     surface_hover: rgba(255, 255, 255, 0.05),
     surface_strong: rgba(255, 255, 255, 0.11),
     scrim: rgba(2, 8, 20, 0.62),
+    danger_ink: rgb(0xf7, 0xa8, 0xb0),
+    danger_ink_hover: rgb(0xfb, 0xc7, 0xcc),
+    danger_edge: rgba(236, 81, 98, 0.25),
+    danger_edge_hover: rgba(236, 81, 98, 0.45),
+    danger_soft_hover: rgba(236, 81, 98, 0.2),
+    danger_soft_active: rgba(236, 81, 98, 0.28),
+    warning_soft: rgba(245, 158, 11, 0.12),
+    success_soft: rgba(93, 184, 114, 0.15),
+    control_border_hover: rgba(255, 255, 255, 0.6),
     glass_bg: rgba(9, 9, 11, 0.6),
     glass_border: rgba(255, 255, 255, 0.06),
     aurora_1: rgba(24, 169, 194, 0.16),
@@ -95,6 +113,15 @@
     surface_hover: rgba(28, 25, 23, 0.05),
     surface_strong: rgba(28, 25, 23, 0.09),
     scrim: rgba(28, 25, 23, 0.32),
+    danger_ink: rgb(0xa3, 0x2f, 0x06),
+    danger_ink_hover: rgb(0x7d, 0x24, 0x05),
+    danger_edge: rgba(163, 47, 6, 0.3),
+    danger_edge_hover: rgba(163, 47, 6, 0.55),
+    danger_soft_hover: rgba(163, 47, 6, 0.16),
+    danger_soft_active: rgba(163, 47, 6, 0.22),
+    warning_soft: rgba(125, 77, 5, 0.1),
+    success_soft: rgba(17, 102, 50, 0.1),
+    control_border_hover: rgba(28, 25, 23, 0.72),
     glass_bg: rgba(255, 255, 255, 0.72),
     glass_border: rgba(28, 25, 23, 0.08),
     aurora_1: rgba(17, 114, 141, 0.05),
```


- [ ] **Step 4:** Expected: 2 passed.
- [ ] **Step 5: Commit** `feat(native): the danger, warning and success tokens the Applications table uses`

### Task 19: The grid and which rows to build

**Files:**
- Create: `native/crates/prune-app/src/applications/grid.rs`
- Test: `native/crates/prune-app/tests/applications_grid.rs`

**Interfaces:**
- Produces: `GAP`, `ROW_PAD_X`, `WIDE_WINDOW`, `PANE_INSET`, `HEADER_HEIGHT`, `ROW_WITH_FOLDER`, `ROW_PLAIN`, `row_height`, `Columns`, `is_wide`, `columns(pane_width)`, `window(heights, scroll, viewport)`.
- 3.x's CSS grid reproduced in numbers: `30px minmax(190px,1fr) 72px [128px] 52px 74px 46px minmax(112px,0.7fr) [minmax(92px,0.6fr)] 164px`, a 10 px gap, 16 px of padding each side; Version and Website only from a 1380 px window (CSS `min-[1380px]`), which is a 1212 px page area because the rail and gutters take 168. The test reproduces the measured 3.x: at a 1264 px window the row is 1084 px and Name and Company come out 320 and 224 px. A track that would fall under its floor is frozen and the rest share what is left; when the floors do not fit (the 900 px window) the row is wider than the pane and the table scrolls sideways, as 3.x's does. Rows are built only near the viewport (plus a screenful each side) with a spacer above and below: 210+ rows of a dozen widgets each would otherwise be laid out and drawn on every frame. Heights are 3.x's measured 51.5 and 44.3 px (plus a 1 px divider).

- [ ] **Step 1: Write the tests.**

**Create `native/crates/prune-app/tests/applications_grid.rs`:**

```rust
//! The table's grid and its windowing: the numbers come from the real 3.x,
//! measured in a browser at a 1264 px window.

use prune_app::applications::grid::*;
use prune_core::programs::model::Program;

#[test]
fn the_narrow_grid_matches_3x_at_a_1264_px_window() {
    // Pane 1096: the row is 1084 wide (the panel's 1 px border each side
    // is the panel's own), Name came out 320 px and Company 224 px.
    let c = columns(1094.0);
    assert!((c.name - 320.0).abs() < 1.0, "{}", c.name);
    assert!((c.publisher - 224.0).abs() < 1.0, "{}", c.publisher);
    assert_eq!((c.version, c.website), (None, None));
    assert_eq!((c.select, c.size, c.kind, c.installed, c.new, c.action), (30.0, 72.0, 52.0, 74.0, 46.0, 164.0));
}

#[test]
fn version_and_website_come_back_from_a_1380_px_window() {
    assert!(!is_wide(1380.0 - PANE_INSET - 1.0));
    assert!(is_wide(1380.0 - PANE_INSET));
    let c = columns(1700.0);
    assert_eq!(c.version, Some(128.0));
    assert!(c.website.unwrap() >= 92.0 && c.name > c.publisher && c.publisher > c.website.unwrap());
    // At the 900 px minimum window the pane cannot hold the floors: the grid
    // keeps them and the table scrolls sideways.
    let tight = columns(900.0 - PANE_INSET);
    assert_eq!((tight.name, tight.publisher), (190.0, 112.0));
    assert!(tight.total > 900.0 - PANE_INSET);
}

#[test]
fn a_track_that_would_fall_under_its_floor_is_frozen_and_the_rest_share_what_is_left() {
    // Just above the floors: Company hits 112 first, Name takes the rest.
    let c = columns(850.0);
    assert!(c.publisher >= 112.0 && c.name >= 190.0);
}

#[test]
fn rows_are_as_tall_as_3x_draws_them() {
    let with_folder = Program { install_location: Some(r"C:\x".into()), ..Program::default() };
    assert_eq!(row_height(&with_folder), 51.5);
    assert_eq!(row_height(&Program::default()), 44.3);
}

#[test]
fn only_the_rows_near_the_viewport_are_built() {
    let heights = vec![50.0; 200];
    let (first, last, above, below) = window(&heights, 0.0, 500.0);
    assert_eq!((first, above), (0, 0.0));
    assert!(last >= 10 && last < 30, "{last}");
    assert_eq!(above + heights[first..last].iter().sum::<f32>() + below, 10_000.0);

    let (first, last, above, below) = window(&heights, 5_000.0, 500.0);
    assert!(first > 80 && first < 100 && last > 110 && last < 125, "{first}..{last}");
    assert_eq!(above + heights[first..last].iter().sum::<f32>() + below, 10_000.0);

    // Scrolled past the end after the list shrank: nothing built, one spacer.
    assert_eq!(window(&heights, 99_000.0, 500.0).0, 200);
    assert_eq!(window(&[], 0.0, 500.0), (0, 0, 0.0, 0.0));
}
```


- [ ] **Step 2:** Create `native/crates/prune-app/src/applications/mod.rs` containing only `pub mod grid;`, add `pub mod applications;` to `lib.rs` (the full diff is in Task 23), and run `cargo test -p prune-app --test applications_grid`. Expected: FAIL (no `grid`).
- [ ] **Step 3: Implement.**

**Create `native/crates/prune-app/src/applications/grid.rs`:**

```rust
//! The table's grid, worked out the way 3.x's CSS grid works it out
//! (`ProgramList.jsx`: `COLUMNS`, `NARROW_HIDDEN`, `tableFloor`), and which
//! rows to build for the part of the list that is on screen.
//!
//! 3.x's tracks are `30px minmax(190px,1fr) 72px 128px 52px 74px 46px
//! minmax(112px,0.7fr) minmax(92px,0.6fr) 164px` with a 10 px gap and 16 px
//! of padding each side. Version and Website are the two columns that can go:
//! the narrow grid drops them and the wide one is used from a 1380 px window
//! (CSS `min-[1380px]`). Measured on the real 3.x at a 1264 px window: the
//! pane is 1096 px, the row 1084 px, and Name and Company come out 320 and
//! 224 px, which the test below reproduces.

use prune_core::programs::model::Program;

pub const GAP: f32 = 10.0;
pub const ROW_PAD_X: f32 = 16.0;
/// The window width (CSS `min-[1380px]`) from which Version and Website show.
pub const WIDE_WINDOW: f32 = 1380.0;
/// What surrounds the pane inside the window: the 72 px rail and 48 px of
/// gutter each side. The page area is the window minus this.
pub const PANE_INSET: f32 = 72.0 + 96.0;

/// A header is 32 px of button and a 1 px rule.
pub const HEADER_HEIGHT: f32 = 33.0;

/// Measured on the real 3.x: a row with a Folder button is 51.5 px (the
/// button keeps `.btn-ghost`'s 8 px padding), one with only Uninstall 44.3.
/// Rows are laid out with their action cell always present (it is invisible,
/// not absent, until hover or focus), so the height is a property of the row.
pub const ROW_WITH_FOLDER: f32 = 51.5;
pub const ROW_PLAIN: f32 = 44.3;

pub fn row_height(program: &Program) -> f32 {
    if program.install_location.is_some() { ROW_WITH_FOLDER } else { ROW_PLAIN }
}

/// Track widths in pixels. `version` and `website` are `None` in the narrow grid.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Columns {
    pub select: f32,
    pub name: f32,
    pub size: f32,
    pub version: Option<f32>,
    pub kind: f32,
    pub installed: f32,
    pub new: f32,
    pub publisher: f32,
    pub website: Option<f32>,
    pub action: f32,
    /// The whole row, padding included. Wider than the pane when the floors do
    /// not fit: the table then scrolls sideways, as 3.x's does.
    pub total: f32,
}

/// `(floor, fr)` of the flexible tracks, in order.
fn flexible(wide: bool) -> Vec<(f32, f32)> {
    let mut tracks = vec![(190.0, 1.0), (112.0, 0.7)];
    if wide {
        tracks.push((92.0, 0.6));
    }
    tracks
}

/// A pane's width as the window's (what the media query sees).
pub fn is_wide(pane_width: f32) -> bool {
    pane_width + PANE_INSET >= WIDE_WINDOW
}

/// CSS grid's `minmax(floor, Nfr)` sharing: free space goes out by fr; a
/// track that would fall under its floor is frozen at it and the rest share
/// what is left.
fn share(free: f32, tracks: &[(f32, f32)]) -> Vec<f32> {
    let mut frozen = vec![false; tracks.len()];
    let mut widths = vec![0.0; tracks.len()];
    loop {
        let fixed: f32 = tracks.iter().zip(&frozen).filter(|(_, f)| **f).map(|(t, _)| t.0).sum();
        let fr: f32 = tracks.iter().zip(&frozen).filter(|(_, f)| !**f).map(|(t, _)| t.1).sum();
        if fr == 0.0 {
            break;
        }
        let per_fr = ((free - fixed) / fr).max(0.0);
        let mut changed = false;
        for (i, t) in tracks.iter().enumerate() {
            if !frozen[i] && per_fr * t.1 < t.0 {
                frozen[i] = true;
                changed = true;
            }
        }
        if !changed {
            for (i, t) in tracks.iter().enumerate() {
                widths[i] = if frozen[i] { t.0 } else { per_fr * t.1 };
            }
            return widths;
        }
    }
    tracks.iter().map(|t| t.0).collect()
}

pub fn columns(pane_width: f32) -> Columns {
    let wide = is_wide(pane_width);
    let tracks = flexible(wide);
    // Fixed tracks: select, size, type, installed, new, action (+ version).
    let fixed = 30.0 + 72.0 + 52.0 + 74.0 + 46.0 + 164.0 + if wide { 128.0 } else { 0.0 };
    let count = 2 + tracks.len() + 5 + usize::from(wide);
    // select, name, size, [version], kind, installed, new, publisher, [website], action
    let gaps = (count as f32 - 1.0) * GAP;
    let free = pane_width - 2.0 * ROW_PAD_X - fixed - gaps;
    let flex = share(free, &tracks);
    // The flexible tracks fill the pane exactly, or sit on their floors (and
    // the row is then wider than the pane).
    let total = 2.0 * ROW_PAD_X + fixed + gaps + flex.iter().sum::<f32>();
    Columns {
        select: 30.0,
        name: flex[0],
        size: 72.0,
        version: wide.then_some(128.0),
        kind: 52.0,
        installed: 74.0,
        new: 46.0,
        publisher: flex[1],
        website: wide.then(|| flex[2]),
        action: 164.0,
        total,
    }
}

/// Which rows to build: the ones that touch the viewport, plus a screenful
/// either side so scrolling never shows a blank. `heights` are each row's own
/// height in display order; returns `(first, last_exclusive, space_above,
/// space_below)`. 210+ rows with a dozen widgets each would be laid out and
/// drawn on every frame otherwise.
pub fn window(heights: &[f32], scroll: f32, viewport: f32) -> (usize, usize, f32, f32) {
    let overscan = viewport.max(400.0);
    let (lo, hi) = (scroll - overscan, scroll + viewport + overscan);
    let mut top = 0.0;
    let (mut first, mut last, mut above, mut below) = (0, heights.len(), 0.0, 0.0);
    let mut started = false;
    for (i, h) in heights.iter().enumerate() {
        let bottom = top + h;
        if !started && bottom > lo {
            first = i;
            above = top;
            started = true;
        }
        if started && top >= hi {
            last = i;
            below = heights[i..].iter().sum();
            break;
        }
        top = bottom;
    }
    if !started {
        return (heights.len(), heights.len(), heights.iter().sum(), 0.0);
    }
    (first, last, above, below)
}
```


- [ ] **Step 4:** Expected: 5 passed.
- [ ] **Step 5: Commit** `feat(native): the Applications grid and row windowing, matching 3.x's measured layout`

### Task 20: The screen's state and messages

**Files:**
- Replace: `native/crates/prune-app/src/applications/mod.rs`
- Create: `native/crates/prune-app/src/applications/fixture.rs`
- Modify: `native/crates/prune-app/Cargo.toml` (adds `Win32_System_SystemInformation` for `GetLocalTime`)

**Interfaces:**
- Produces: `Applications` (the state: `table`, `lists`, `query`, `filter`, `sort`, `show_hidden`, `hidden`, `selected`, `cursor`, `scroll`, `viewport`, `running`, `hover`, `folder_missing`, `units`, `today`, `visible`, `all_bytes`, `handles`), `Msg` (`Stage(Delivery)`, `Query`, `Filter`, `Sort`, `ClearFilters`, `ShowHidden`, `Toggle`, `ToggleAll`, `ClearSelection`, `Scrolled`, `Hover`, `FocusRow`, `MoveRow`, `OpenFolder`, `Retry`, `PollRunning`, `Running`, `Inert(Tool)`, `OpenQuarantine`, `Noop`), `Delivery` (a stage in a cloneable cell, since messages are cloned and a stage owns its data), `Applications::{new, opened, returned, left, update, recompute, rows, list, selectable, tab_stop, load_fixture}`, `open_folder`, `blocking`, `after`, `SEARCH_ID`, `RUNNING_POLL`; `fixture::{Fixture, programs, extensions, stages, deliveries}`.
- `opened()` starts the load the first time and only refreshes the date and the running set afterwards. The running chain is one-shot tasks (`blocking` runs the process listing on its own thread; `after` is the app's existing sleeping-thread timer): `Msg::Running` schedules the next `PollRunning` in 15 s, and `PollRunning` does nothing once `left()` has cleared `polling`. After every change `recompute()` re-derives the visible rows and drops from the selection anything no longer shown; a row that may not be ticked cannot be ticked by hand either. `Folder` opens Explorer only on an existing folder, and a missing one changes the button's word to "Not found" (it usually means the entry is stale). Keyboard: one row is the Tab stop; arrows, Home and End move it and scroll it into view.

- [ ] **Step 1:** The behaviour tests for this state are written in Task 24 (they drive the whole `App`); this task is compiled by Task 23.
- [ ] **Step 2: Implement.**

**Create `native/crates/prune-app/src/applications/mod.rs`:**

```rust
//! The Applications screen: its state, its messages and what each does.
//! Read-only in 2a: nothing here uninstalls, removes or writes anything. The
//! tools and the row actions that change the machine are drawn and inert until
//! 2b and 2c; "Folder" opens Explorer and is the one live action.
//!
//! Nothing runs before the screen is first opened (no work before the first
//! frame), no timer runs at idle, and the one poll (which programs are open,
//! 3.x: every 15 s) runs only while this screen is the one shown.

pub mod fixture;
pub mod grid;
pub mod view;
pub mod widgets;

use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use iced::Task;
use prune_core::programs::hidden::normalize_hidden_programs;
use prune_core::programs::launchers::{SteamApp, read_steam_apps, steam_root_from};
use prune_core::programs::loader::{Stage, Table, load_all};
use prune_core::programs::model::Program;
use prune_core::programs::running::{Running, running_programs};
use prune_core::programs::view::{Controls, Filter, Lists, SortColumn, SortState, Visible, can_batch, next_sort_state, visible};
use prune_core::settings::{Settings, SizeUnits};

/// The search box's id: Ctrl+K and Ctrl+F focus it (3.x's `data-app-search`).
pub const SEARCH_ID: &str = "applications-search";

/// How often the "Running" badge is refreshed while the screen is shown.
pub const RUNNING_POLL: Duration = Duration::from_secs(15);

/// A stage handed across the message queue. Messages must be cloneable and a
/// stage owns its data, so it travels in a cell and is taken out once.
#[derive(Clone)]
pub struct Delivery(Arc<Mutex<Option<Stage>>>);

impl std::fmt::Debug for Delivery {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("Delivery")
    }
}

impl Delivery {
    pub fn new(stage: Stage) -> Self {
        Delivery(Arc::new(Mutex::new(Some(stage))))
    }
    fn take(&self) -> Option<Stage> {
        self.0.lock().ok()?.take()
    }
}

/// The tools beside the heading, which are drawn now and work in 2b and 2c.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Tool {
    Hunter,
    Monitor,
    Forced,
    OtherAccounts,
}

#[derive(Debug, Clone)]
pub enum Msg {
    Stage(Delivery),
    Query(String),
    Filter(Filter),
    Sort(SortColumn),
    ClearFilters,
    ShowHidden(bool),
    Toggle(String),
    ToggleAll,
    ClearSelection,
    /// The table scrolled: offset and viewport height, in pixels.
    Scrolled(f32, f32),
    Hover(Option<String>),
    FocusRow(String),
    /// An arrow key, Home or End on the focused row.
    MoveRow(RowMove),
    OpenFolder(String),
    Retry,
    PollRunning,
    Running(Arc<HashMap<String, Running>>),
    /// A button that does something in a later plan.
    Inert(Tool),
    OpenQuarantine,
    /// A row button that does something in a later plan.
    Noop,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RowMove {
    Up,
    Down,
    Home,
    End,
}

pub struct Applications {
    pub table: Table,
    pub lists: Lists,
    pub query: String,
    pub filter: Filter,
    pub sort: SortState,
    pub show_hidden: bool,
    pub hidden: HashSet<String>,
    pub selected: HashSet<String>,
    /// The row the arrow keys are on: the one Tab stop in the list.
    pub cursor: Option<String>,
    pub scroll: f32,
    pub viewport: f32,
    pub running: HashMap<String, Running>,
    pub hover: Option<String>,
    /// Folders Explorer could not open ("Not found" replaces the button's word).
    pub folder_missing: HashSet<String>,
    pub units: SizeUnits,
    /// Today as a day number, read once per load and whenever the screen opens.
    pub today: i64,
    pub visible: Visible,
    /// Every program's size added up: the heading's total when nothing narrows the list.
    pub all_bytes: u64,
    /// Decoded icons, as handles the renderer keeps (building one per frame would hash its pixels each time).
    pub handles: HashMap<String, widgets::IconHandle>,
    started: bool,
    polling: bool,
    steam: HashMap<String, SteamApp>,
    settings_path: std::path::PathBuf,
}

/// Today (local) as a day number.
pub fn today() -> i64 {
    #[cfg(windows)]
    {
        use windows::Win32::System::SystemInformation::GetLocalTime;
        // SAFETY: GetLocalTime takes no input and returns a plain struct.
        let t = unsafe { GetLocalTime() };
        return prune_core::programs::view::day_number(i64::from(t.wYear), i64::from(t.wMonth), i64::from(t.wDay));
    }
    #[cfg(not(windows))]
    {
        let secs = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_or(0, |d| d.as_secs());
        (secs / 86_400) as i64
    }
}

impl Applications {
    pub fn new(settings: &Settings, settings_path: std::path::PathBuf) -> Self {
        Applications {
            table: Table::default(),
            lists: Lists::default(),
            query: String::new(),
            filter: Filter::All,
            sort: SortState::default(),
            show_hidden: false,
            hidden: normalize_hidden_programs(settings.rest.get("hiddenPrograms")).into_iter().collect(),
            selected: HashSet::new(),
            cursor: None,
            scroll: 0.0,
            viewport: 600.0,
            running: HashMap::new(),
            hover: None,
            folder_missing: HashSet::new(),
            units: settings.size_units,
            today: today(),
            visible: Visible::default(),
            all_bytes: 0,
            handles: HashMap::new(),
            started: false,
            polling: false,
            steam: HashMap::new(),
            settings_path,
        }
    }

    /// First opening of the screen: start reading. Later openings only
    /// refresh what is cheap and true only now (the date, who is running).
    pub fn opened(&mut self) -> Task<Msg> {
        self.today = today();
        if self.started {
            return self.poll_now();
        }
        self.started = true;
        let sizes = prune_core::programs::folder_sizes::default_path(&self.settings_path);
        let traces = self.settings_path.parent().map_or_else(|| "install-traces".into(), |d| d.join("install-traces"));
        Task::batch([load_task(sizes, traces), self.poll_now()])
    }

    /// The window came forward: whatever was installed, removed or opened in
    /// Windows meanwhile is read again.
    pub fn returned(&mut self) -> Task<Msg> {
        if self.started { self.poll_now() } else { Task::none() }
    }

    /// The screen was left: the poll stops at its next tick.
    pub fn left(&mut self) {
        self.polling = false;
    }

    fn poll_now(&mut self) -> Task<Msg> {
        if self.table.loading() {
            return Task::none();
        }
        let programs = self.lists.programs.clone();
        let steam = self.steam.clone();
        blocking(move || Msg::Running(Arc::new(running_programs(&programs, &steam))))
    }

    /// Fills the screen with made-up data, for `--render-screens` and tests:
    /// no thread is started and nothing is read from this machine.
    pub fn load_fixture(&mut self, f: fixture::Fixture) {
        self.started = true;
        for delivery in fixture::deliveries(f, self.today) {
            let _ = self.update(Msg::Stage(delivery));
        }
        match f {
            fixture::Fixture::NothingMatches => {
                let _ = self.update(Msg::Query("zzz".into()));
            }
            fixture::Fixture::Selected => {
                let ids: Vec<String> = self.selectable().iter().take(2).map(|p| p.id.clone()).collect();
                for id in ids {
                    let _ = self.update(Msg::Toggle(id));
                }
            }
            _ => {}
        }
    }

    pub fn recompute(&mut self) {
        let c = Controls { filter: self.filter, query: &self.query, sort: self.sort, show_hidden: self.show_hidden, hidden: &self.hidden, today: self.today };
        self.visible = visible(&self.lists, &c);
        self.all_bytes = self.lists.programs.iter().filter_map(|p| p.size_bytes).sum();
        // A selection is a statement about what is in front of you: rows
        // filtered, searched or hidden away leave it.
        let shown: HashSet<&str> = self.visible.rows.iter().map(|&i| self.lists.list_for(self.filter)[i].id.as_str()).collect();
        self.selected.retain(|id| shown.contains(id.as_str()));
        if self.hidden_count_zero() {
            self.show_hidden = false;
        }
    }

    fn keep_handles(&mut self, stage: &Stage) {
        use prune_core::programs::icons::RowIcon;
        match stage {
            Stage::ProgramIcons(map) => {
                for (id, i) in map {
                    self.handles.insert(id.clone(), widgets::IconHandle::Raster(iced::widget::image::Handle::from_rgba(i.width, i.height, i.rgba.clone())));
                }
            }
            Stage::PackageIcons(map) => {
                for (id, icon) in map {
                    let handle = match icon {
                        RowIcon::Raster(i) => widgets::IconHandle::Raster(iced::widget::image::Handle::from_rgba(i.width, i.height, i.rgba.clone())),
                        RowIcon::Svg(bytes) => widgets::IconHandle::Svg(iced::widget::svg::Handle::from_memory(bytes.clone())),
                    };
                    self.handles.insert(id.clone(), handle);
                }
            }
            _ => {}
        }
    }

    fn hidden_count_zero(&self) -> bool {
        self.show_hidden && self.visible.hidden_count == 0
    }

    pub fn list(&self) -> &[Program] {
        self.lists.list_for(self.filter)
    }

    /// The rows in display order.
    pub fn rows(&self) -> impl Iterator<Item = &Program> {
        let list = self.list();
        self.visible.rows.iter().map(move |&i| &list[i])
    }

    /// Rows "Select all" would tick: eligible, and never a hidden one even
    /// with Show hidden on (hiding is "leave this out", and the header box is
    /// the one control that acts on rows without anyone looking at each).
    pub fn selectable(&self) -> Vec<&Program> {
        self.rows().filter(|p| can_batch(p) && !prune_core::programs::hidden::is_program_hidden(p, &self.hidden)).collect()
    }

    /// Brings the row the keyboard is on into view.
    fn scroll_to_cursor(&self) -> Task<Msg> {
        let Some(cursor) = self.cursor.as_deref() else { return Task::none() };
        let mut top = 0.0;
        for program in self.rows() {
            let height = grid::row_height(program) + 1.0;
            if program.id == cursor {
                let target = if top < self.scroll {
                    top
                } else if top + height > self.scroll + self.viewport {
                    top + height - self.viewport
                } else {
                    return Task::none();
                };
                return iced::widget::operation::scroll_to(view::TABLE_ID, iced::widget::scrollable::AbsoluteOffset { x: None, y: Some(target) });
            }
            top += height;
        }
        Task::none()
    }

    pub fn tab_stop(&self) -> Option<&str> {
        let mut rows = self.rows();
        let first = rows.next().map(|p| p.id.as_str());
        match self.cursor.as_deref() {
            Some(c) if self.rows().any(|p| p.id == c) => Some(c),
            _ => first,
        }
    }

    pub fn update(&mut self, msg: Msg) -> Task<Msg> {
        match msg {
            Msg::Stage(delivery) => {
                if let Some(stage) = delivery.take() {
                    if let Stage::List(l) = &stage {
                        self.steam = read_steam_apps(steam_root_from(l).as_deref());
                    }
                    self.keep_handles(&stage);
                    let list_arrived = matches!(stage, Stage::List(_));
                    self.table.apply(stage);
                    self.lists = self.table.lists();
                    self.recompute();
                    if list_arrived {
                        return self.poll_now();
                    }
                }
            }
            Msg::Query(q) => {
                self.query = q;
                self.scroll = 0.0;
                self.recompute();
            }
            Msg::Filter(f) => {
                self.filter = f;
                self.scroll = 0.0;
                self.recompute();
            }
            Msg::Sort(column) => {
                self.sort = next_sort_state(self.sort, column);
                self.recompute();
            }
            Msg::ClearFilters => {
                self.query.clear();
                self.filter = Filter::All;
                self.recompute();
            }
            Msg::ShowHidden(on) => {
                self.show_hidden = on;
                self.recompute();
            }
            Msg::Toggle(id) => {
                if !self.selected.remove(&id) && self.rows().any(|p| p.id == id && can_batch(p)) {
                    self.selected.insert(id);
                }
            }
            Msg::ToggleAll => {
                let ids: Vec<String> = self.selectable().iter().map(|p| p.id.clone()).collect();
                if !ids.is_empty() && ids.iter().all(|i| self.selected.contains(i)) {
                    ids.iter().for_each(|i| {
                        self.selected.remove(i);
                    });
                } else {
                    self.selected.extend(ids);
                }
            }
            Msg::ClearSelection => self.selected.clear(),
            Msg::Scrolled(y, h) => {
                self.scroll = y;
                self.viewport = h;
            }
            Msg::Hover(id) => self.hover = id,
            Msg::FocusRow(id) => self.cursor = Some(id),
            Msg::MoveRow(m) => {
                let ids: Vec<&str> = self.rows().map(|p| p.id.as_str()).collect();
                let at = self.tab_stop().and_then(|c| ids.iter().position(|i| *i == c)).unwrap_or(0);
                let to = match m {
                    RowMove::Home => 0,
                    RowMove::End => ids.len().saturating_sub(1),
                    RowMove::Up => at.saturating_sub(1),
                    RowMove::Down => (at + 1).min(ids.len().saturating_sub(1)),
                };
                self.cursor = ids.get(to).map(|s| (*s).to_owned());
                return self.scroll_to_cursor();
            }
            Msg::OpenFolder(path) => {
                if !open_folder(&path) {
                    self.folder_missing.insert(path);
                }
            }
            Msg::Retry => {
                self.table = Table::default();
                self.lists = Lists::default();
                self.started = false;
                self.recompute();
                return self.opened();
            }
            Msg::PollRunning => {
                // The chain ends when the screen is left; it starts again on opening.
                if !self.polling {
                    return Task::none();
                }
                return self.poll_now();
            }
            Msg::Running(map) => {
                self.running = (*map).clone();
                if !self.polling {
                    self.polling = true;
                }
                return after(RUNNING_POLL, Msg::PollRunning);
            }
            Msg::Inert(_) | Msg::OpenQuarantine | Msg::Noop => {}
        }
        Task::none()
    }
}

/// Opens Explorer on a folder. Only an existing folder is opened: a path that
/// is gone says so on its button ("Not found"), which usually means the entry
/// is stale. Explorer is given the path as an argument, not through a shell.
pub fn open_folder(path: &str) -> bool {
    let p = std::path::Path::new(path);
    if !p.is_dir() {
        return false;
    }
    std::process::Command::new("explorer.exe").arg(p).spawn().is_ok()
}

/// Runs `f` off the UI thread and hands back its message.
pub fn blocking<T: Send + 'static>(f: impl FnOnce() -> T + Send + 'static) -> Task<T> {
    Task::future(async move {
        let (tx, rx) = iced::futures::channel::oneshot::channel();
        std::thread::spawn(move || {
            let _ = tx.send(f());
        });
        rx.await.ok()
    })
    .and_then(Task::done)
}

/// `message` after `delay`, without a timer subscription.
pub fn after(delay: Duration, message: Msg) -> Task<Msg> {
    blocking(move || {
        std::thread::sleep(delay);
        message
    })
}

/// Starts the staged load on its own thread and turns each answer into a message.
fn load_task(sizes: std::path::PathBuf, traces: std::path::PathBuf) -> Task<Msg> {
    use iced::futures::{SinkExt, StreamExt, channel::mpsc};
    let stream = iced::stream::channel(32, move |mut out: mpsc::Sender<Msg>| async move {
        let (tx, mut rx) = mpsc::unbounded::<Stage>();
        std::thread::spawn(move || {
            load_all(Some(sizes), traces, &|stage| {
                let _ = tx.unbounded_send(stage);
            });
        });
        while let Some(stage) = rx.next().await {
            if out.send(Msg::Stage(Delivery::new(stage))).await.is_err() {
                break;
            }
        }
    });
    Task::run(stream, |m| m)
}
```


**Create `native/crates/prune-app/src/applications/fixture.rs`:**

```rust
//! Made-up programs for `--render-screens` and the tests, so the screen can be
//! drawn in every state without reading this machine. Nothing here is real
//! data: the names are the kind a real list holds, the numbers are invented.

use std::collections::HashMap;

use prune_core::programs::loader::Stage;
use prune_core::programs::model::{Arch, Health, Program, SigStatus, Signature, Source};
use prune_core::programs::view::date_from_day_number;

use super::Delivery;

/// What the rendered screen shows.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum Fixture {
    /// Not applicable: the screen keeps its real (loading) state.
    None,
    #[default]
    Loaded,
    /// The list has not arrived: the skeleton.
    Loading,
    /// The registry read failed.
    Error,
    /// The read found no programs at all: the Retry state.
    NoPrograms,
    /// A search that matches nothing.
    NothingMatches,
    /// A few rows ticked: the batch bar.
    Selected,
}

fn program(id: &str, name: &str, publisher: &str, bytes: Option<u64>, ago: Option<i64>, today: i64) -> Program {
    Program {
        id: id.into(),
        name: name.into(),
        publisher: publisher.into(),
        size_bytes: bytes,
        install_date: ago.map(|d| date_from_day_number(today - d)),
        architecture: Some(Arch::Bits64),
        install_location: Some(format!(r"C:\Program Files\{name}")),
        uninstall_string: Some(format!(r#""C:\Program Files\{name}\unins000.exe""#)),
        registry_key: Some(format!(r"HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{id}")),
        health: Some(Health::default()),
        ..Program::default()
    }
}

const GB: u64 = 1 << 30;
const MB: u64 = 1 << 20;

pub fn programs(today: i64) -> Vec<Program> {
    let mut list = vec![
        Program { version: "1.4.2".into(), ..program("wave", "Wave Quest", "Kuro Games", Some(93 * GB), Some(3), today) },
        Program { version: "38.5.1".into(), ..program("frame", "Starforge", "Digital Works", Some(51 * GB), Some(320), today) },
        Program { architecture: None, version: "9.2".into(), ..program("league", "Rift Legends", "Riot Studios, Inc", Some(40 * GB), Some(2), today) },
        Program { version: "7.0.1".into(), ..program("steam", "Steam", "Valve Corporation", Some(14 * GB), Some(400), today) },
        Program {
            version: "126.0".into(),
            signature: Some(Signature { status: SigStatus::Valid, signer: Some("Brave Software".into()) }),
            ..program("brave", "Brave", "Brave Software", Some(900 * MB), Some(40), today)
        },
        Program {
            version: "23.01".into(),
            signature: Some(Signature { status: SigStatus::Unsigned, signer: None }),
            ..program("7zip", "7-Zip", "Igor Pavlov", None, None, today)
        },
        Program { version: "3.1".into(), install_date_approximate: true, ..program("tool", "Disk Tool", "Acme", Some(12 * MB), Some(90), today) },
        Program { install_location: None, ..program("noloc", "Legacy Suite", "Contoso", Some(300 * MB), Some(700), today) },
        Program { health: Some(Health { orphaned: true, ..Health::default() }), ..program("gone", "Removed Thing", "Nobody", Some(5 * MB), Some(500), today) },
        Program { version: "14.38.33135".into(), ..program("vc", "Microsoft Visual C++ Redistributable", "Microsoft Corporation", Some(20 * MB), Some(200), today) },
    ];
    list.push(Program {
        id: "store:Paint_11".into(),
        name: "Paint".into(),
        publisher: "Microsoft Corporation".into(),
        version: "11.2410.1.0".into(),
        source: Source::Store,
        size_bytes: Some(144 * MB),
        install_date: Some(date_from_day_number(today - 60)),
        install_date_approximate: true,
        package_full_name: Some("Paint_11".into()),
        install_location: Some(r"C:\Program Files\WindowsApps\Paint".into()),
        architecture: Some(Arch::Bits64),
        ..Program::default()
    });
    list.push(Program {
        id: "store:SecHealth".into(),
        name: "Windows Security".into(),
        publisher: "Microsoft Corporation".into(),
        source: Source::Store,
        size_bytes: Some(27 * MB),
        package_full_name: Some("SecHealth".into()),
        install_location: Some(r"C:\Program Files\WindowsApps\Sec".into()),
        ..Program::default()
    });
    list.push(Program {
        id: "chocolatey:oscdimg".into(),
        name: "Oscdimg in PATH".into(),
        version: "1.0.0".into(),
        source: Source::Chocolatey,
        chocolatey_id: Some("oscdimg".into()),
        size_bytes: Some(2 * MB),
        install_location: Some(r"C:\ProgramData\chocolatey\lib\oscdimg".into()),
        ..Program::default()
    });
    list
}

pub fn extensions() -> Vec<Program> {
    vec![Program {
        id: "extension:brave:Default:abc".into(),
        name: "uBlock Origin".into(),
        version: "1.60.0".into(),
        browser: Some("Brave".into()),
        source: Source::Extension,
        size_bytes: Some(20 * MB),
        install_location: Some(r"C:\Users\u\AppData\Local\Ext\abc".into()),
        enabled: Some(false),
        ..Program::default()
    }]
}

/// The answers of a finished load, in the order they might arrive.
pub fn stages(fixture: Fixture, today: i64) -> Vec<Stage> {
    let all = programs(today);
    let of = |source: Source| -> Vec<Program> { all.iter().filter(|p| p.source == source).cloned().collect() };
    match fixture {
        Fixture::None | Fixture::Loading => Vec::new(),
        Fixture::Error => vec![Stage::Failed("list")],
        Fixture::NoPrograms => vec![Stage::List(Vec::new())],
        _ => vec![
            Stage::List(of(Source::Registry)),
            Stage::Store(of(Source::Store)),
            Stage::NonRemovable(HashMap::from([("Paint_11".to_owned(), false), ("SecHealth".to_owned(), true)])),
            Stage::Chocolatey { rows: of(Source::Chocolatey), managed: HashMap::new() },
            Stage::Extensions(extensions()),
        ],
    }
}

pub fn deliveries(fixture: Fixture, today: i64) -> Vec<Delivery> {
    stages(fixture, today).into_iter().map(Delivery::new).collect()
}
```


In `prune-app/Cargo.toml` add `"Win32_System_SystemInformation",` to the `windows` features (diff in Task 23).
- [ ] **Step 3:** No commit yet: `mod.rs` references `view` and `widgets`, which Tasks 21 and 22 add. Commit Tasks 20 to 24 together at the end of Task 24.

### Task 21: The widgets

**Files:**
- Create: `native/crates/prune-app/src/applications/widgets.rs`

**Interfaces:**
- Produces: line icons (`TICK`, `SEARCH`, `ARROW_UP`, `ARROW_DOWN`, `BIN` as small SVGs tinted with the text colour; no emoji, no glyph from a font), `icon`, `label`/`mono_label` (Geist and JetBrains Mono, `Shaping::Advanced` so Arabic joins and Thai stacks), `BadgeKind` and `badge` (the 11 px uppercase mono chips: neutral for where a program came from, muted for Unsigned, danger, success for Running, warning, accent for Monitored), `checkbox` (a 24 px target around a 15 px box; disabled is drawn dim), `ghost` (`.btn-ghost`), `remove` (`.btn-remove`, neutral until pointed at), `IconHandle`, `tile` (the 20 px icon or the lettered tile), `fit` (cuts text to an estimated width with an ellipsis: iced clips but does not ellipsize; a known gap).

- [ ] **Step 1: Implement.**

**Create `native/crates/prune-app/src/applications/widgets.rs`:**

```rust
//! The small pieces the table is built from: badges, the checkbox, buttons,
//! line icons and the lettered tile, in the app's style (3.x's `.btn-ghost`,
//! `.btn-remove`, `RowCheckbox`, the 11 px uppercase mono badges).
//!
//! No emoji and no glyphs from a font: icons are small line SVGs, tinted with
//! the text colour.

use iced::widget::{button, container, image, space, svg, text};
use iced::{Background, Border, Color, Element, Length, font};

use prune_core::programs::view::{tile_color, tile_letter};

use crate::screen::{geist, mono};
use crate::theme::Palette;

pub const TICK: &str = r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>"##;
pub const SEARCH: &str = r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>"##;
pub const ARROW_UP: &str = r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2"><polyline points="18 15 12 9 6 15"/></svg>"##;
pub const ARROW_DOWN: &str = r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2"><polyline points="6 9 12 15 18 9"/></svg>"##;
pub const BIN: &str = r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/><path d="M10 11v5"/><path d="M14 11v5"/></svg>"##;

/// A line icon in `color`.
pub fn icon<'a, M: 'a>(source: &'static str, size: f32, color: Color) -> Element<'a, M> {
    svg(svg::Handle::from_memory(source.as_bytes()))
        .width(size)
        .height(size)
        .style(move |_, _| svg::Style { color: Some(color) })
        .into()
}

/// Text in the app's fonts. Advanced shaping so Arabic joins and Thai stacks;
/// the bundled fonts cover Latin and the system's cover the rest.
pub fn label<'a>(content: impl text::IntoFragment<'a>, size: f32, color: Color) -> text::Text<'a> {
    text(content).size(size).color(color).font(geist(font::Weight::Normal)).shaping(text::Shaping::Advanced).wrapping(text::Wrapping::None)
}

pub fn mono_label<'a>(content: impl text::IntoFragment<'a>, size: f32, color: Color) -> text::Text<'a> {
    text(content).size(size).color(color).font(mono(font::Weight::Normal)).shaping(text::Shaping::Advanced).wrapping(text::Wrapping::None)
}

fn with_alpha(c: Color, a: f32) -> Color {
    Color { a, ..c }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BadgeKind {
    /// Where it came from, which browser: none of them is a warning.
    Neutral,
    /// Unsigned: a fact, not an accusation.
    Muted,
    Danger,
    Success,
    Warning,
    /// Installed under the install monitor.
    Accent,
}

/// An 11 px uppercase mono chip (`text-[11px] font-mono uppercase tracking-wider
/// px-1 py-px rounded border`). Letter-spacing is a known fidelity gap.
pub fn badge<'a, M: 'a>(word: &str, kind: BadgeKind, p: &'static Palette) -> Element<'a, M> {
    let (background, ink, edge) = match kind {
        BadgeKind::Neutral => (p.surface_hover, p.text_secondary, p.border_subtle),
        BadgeKind::Muted => (p.surface_hover, p.text_muted, p.border_subtle),
        BadgeKind::Danger => (p.danger_soft, p.danger, with_alpha(p.danger, 0.25)),
        BadgeKind::Success => (p.success_soft, p.success, with_alpha(p.success, 0.25)),
        BadgeKind::Warning => (p.warning_soft, p.warning, with_alpha(p.warning, 0.25)),
        BadgeKind::Accent => (with_alpha(p.accent_primary, 0.10), p.accent_primary, with_alpha(p.accent_primary, 0.25)),
    };
    container(mono_label(word.to_uppercase(), 11.0, ink))
        .padding([1.0, 4.0])
        .style(move |_| container::Style {
            background: Some(Background::Color(background)),
            border: Border { color: edge, width: 1.0, radius: 4.0.into() },
            ..container::Style::default()
        })
        .into()
}

/// The row checkbox: a 24 px target around a 15 px box. A disabled box is
/// drawn dim; its reason lives in the row's data for screen readers (iced has
/// none yet), and is not shown, as in 3.x.
pub fn checkbox<'a, M: Clone + 'a>(checked: bool, enabled: bool, on_toggle: M, p: &'static Palette) -> Element<'a, M> {
    let boxed = container(if checked && enabled { icon(TICK, 9.0, p.accent_ink) } else { space().width(9).height(9).into() })
        .width(15)
        .height(15)
        .center_x(15)
        .center_y(15)
        .style(move |_| {
            let (fill, edge) = if !enabled {
                (Color::TRANSPARENT, with_alpha(p.border_subtle, p.border_subtle.a * 0.3))
            } else if checked {
                (p.accent_primary, p.accent_primary)
            } else {
                (p.surface_subtle, p.control_border)
            };
            container::Style {
                background: Some(Background::Color(fill)),
                border: Border { color: edge, width: 1.0, radius: 4.0.into() },
                ..container::Style::default()
            }
        });
    let target = container(boxed).width(24).height(20).center_x(24).center_y(20);
    let b = button(target).padding(0).style(|_, _| button::Style::default());
    if enabled { b.on_press(on_toggle).into() } else { b.into() }
}

/// `.btn-ghost`: a quiet outlined button.
pub fn ghost<'a, M: Clone + 'a>(word: impl Into<String>, size: f32, pad: [f32; 2], radius: f32, on_press: Option<M>, p: &'static Palette) -> Element<'a, M> {
    let b = button(label(word.into(), size, p.text_primary).font(geist(font::Weight::Medium)))
        .padding(pad)
        .style(move |_, status| {
            let hovered = matches!(status, button::Status::Hovered | button::Status::Pressed);
            button::Style {
                background: Some(Background::Color(match status {
                    button::Status::Pressed => p.surface_strong,
                    button::Status::Hovered => p.surface_hover,
                    _ => Color::TRANSPARENT,
                })),
                border: Border { color: if hovered { p.border_hover } else { p.border_subtle }, width: 1.0, radius: radius.into() },
                text_color: p.text_primary,
                ..button::Style::default()
            }
        });
    match on_press {
        Some(m) => b.on_press(m).into(),
        None => b.into(),
    }
}

/// `.btn-remove`: neutral and outlined, turning to the danger colours only
/// under the pointer. Inert in 2a.
pub fn remove<'a, M: Clone + 'a>(word: impl Into<String>, on_press: M, p: &'static Palette) -> Element<'a, M> {
    let content = iced::widget::row![icon(BIN, 13.0, p.text_secondary), label(word.into(), 11.5, p.text_secondary).font(geist(font::Weight::Medium))].spacing(6).align_y(iced::Alignment::Center);
    button(content)
        .padding([4.0, 10.0])
        .on_press(on_press)
        .style(move |_, status| {
            let hot = matches!(status, button::Status::Hovered | button::Status::Pressed);
            button::Style {
                background: Some(Background::Color(match status {
                    button::Status::Pressed => p.danger_soft_active,
                    button::Status::Hovered => p.danger_soft,
                    _ => Color::TRANSPARENT,
                })),
                border: Border { color: if hot { p.danger_edge } else { p.control_border }, width: 1.0, radius: 8.0.into() },
                text_color: if hot { p.danger_ink } else { p.text_secondary },
                ..button::Style::default()
            }
        })
        .into()
}

/// What a row draws as its icon.
#[derive(Debug, Clone)]
pub enum IconHandle {
    Raster(image::Handle),
    Svg(svg::Handle),
}

/// The 20 px icon, or the lettered tile a program with none falls back to.
pub fn tile<'a, M: 'a>(name: &str, publisher: &str, icon: Option<&IconHandle>) -> Element<'a, M> {
    match icon {
        Some(IconHandle::Raster(h)) => image(h.clone()).width(20).height(20).into(),
        Some(IconHandle::Svg(h)) => svg(h.clone()).width(20).height(20).into(),
        None => {
            let [r, g, b] = tile_color(name);
            let ink = Color::from_rgb8(0x09, 0x09, 0x0b);
            container(text(tile_letter(name, publisher).to_string()).size(11).color(ink).font(geist(font::Weight::Bold)))
                .width(20)
                .height(20)
                .center_x(20)
                .center_y(20)
                .style(move |_| container::Style {
                    background: Some(Background::Color(Color::from_rgb8(r, g, b))),
                    border: Border { radius: 4.0.into(), ..Border::default() },
                    ..container::Style::default()
                })
                .into()
        }
    }
}

/// Fits `text` into `width` px at `size`, ending in an ellipsis. iced clips but
/// does not ellipsize, and 3.x's cells `truncate`; the width of a glyph is
/// estimated from the font size, which is a known fidelity gap (the cut can be
/// a character early or late).
pub fn fit(text: &str, width: f32, size: f32, monospace: bool) -> String {
    let advance = size * if monospace { 0.6 } else { 0.55 };
    let room = (width / advance).floor() as usize;
    let count = text.chars().count();
    if count <= room {
        return text.to_owned();
    }
    let kept: String = text.chars().take(room.saturating_sub(1)).collect();
    format!("{}\u{2026}", kept.trim_end())
}

pub fn fill() -> Length {
    Length::Fill
}
```


### Task 22: The screen

**Files:**
- Create: `native/crates/prune-app/src/applications/view.rs`
- Test: `native/crates/prune-app/tests/applications_keys.rs`

**Interfaces:**
- Produces: `Ctx { catalog, palette, handles }`, `summary` (the heading's line: "N installed applications · size", or "N of M shown · size" while anything narrows the list, or "N of M shown" for Windows' features and updates, which have no size), `view`, `TABLE_ID`.
- Layout, from 3.x: heading 30 px semibold with the summary 10 px below it, the four tool buttons on the right (Hunter, Install with monitoring…, Forced uninstall… are inert until 2b/2c; Quarantine goes to its screen); search (flexible, 240 to 448 px) and the filter groups in a wrapping row (sources: All, Store, Chocolatey, Extensions, Not registered, Windows, Other accounts; checks: Unsigned, Left behind), the "Other accounts…" button when other accounts exist and none are read, "Show hidden (N)" while anything in view is hidden; the definition sentence under Unsigned, Not registered, Windows and Other accounts, said rather than left for a tooltip; the panel (translucent glass, 12 px radius) with the sticky header (checkbox, sortable column headers with a direction arrow on the sorted one, Version and Website only in the wide grid), the rows, and the footer. A row: checkbox, icon or lettered tile, name, badges in 3.x's order (Hidden, Left behind, Running, Store, the browser, owner, Chocolatey, Not registered, Feature/Update, Unsigned, Signature broken, Disabled, Monitored), size in the amber ramp (never red), version, type, installed (muted when inferred), New, company, website, and an action cell shown on hover or when the row has the keyboard (Folder, then Uninstall/Force remove/Remove…/Turn off/In Windows/Required/via browser by source, all inert but Folder). Footer: "Installations: N · M new in 7 days" and the total, or "Showing N of M"; with rows ticked it becomes the batch bar ("N selected · size", "+ N of unknown size", Clear, "Uninstall N programs", inert). States: the skeleton (the real headers and ten rows of bars, static), the load error (the raw error in the danger colour), the genuinely-empty state with Retry (an empty read with no search and no filter is not a filter the person forgot), the everything-hidden state with its way back, and "Nothing matches…" naming the search and the filter with "Clear search and filters".
- `applications_keys.rs` reads the view's own source for every `"applications.…"`, `"app.…"`, `"sourcesV4.…"`, `"sigV6.…"`, `"hiddenProgramsV1.…"`, `"otherV7.…"`, `"uninstallerV3.…"` and `"nav.…"` string, adds the keys built with `format!`, and proves each exists in all 40 languages.

- [ ] **Step 1: Write the key test.**

**Create `native/crates/prune-app/tests/applications_keys.rs`:**

```rust
//! Every catalog key the Applications screen uses is in every language: a
//! missing one would show the key itself on screen. The keys are read from the
//! view's own source, so a key added later is checked without editing this test.

use prune_core::i18n::{Catalog, LANGUAGES, fluent_id};

const NAMESPACES: [&str; 8] = ["applications.", "app.", "sourcesV4.", "sigV6.", "hiddenProgramsV1.", "otherV7.", "uninstallerV3.", "nav."];

fn keys_in(source: &str) -> Vec<String> {
    let mut keys = Vec::new();
    for (i, piece) in source.split('"').enumerate() {
        // Odd pieces are inside quotes.
        if i % 2 == 1 && NAMESPACES.iter().any(|n| piece.starts_with(n)) && piece.chars().all(|c| c.is_ascii_alphanumeric() || c == '.') && !piece.ends_with('.') {
            keys.push(piece.to_owned());
        }
    }
    keys.sort();
    keys.dedup();
    keys
}

#[test]
fn every_key_the_screen_uses_exists_in_every_language() {
    let src = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("src/applications");
    let mut keys = Vec::new();
    for file in ["view.rs", "mod.rs", "widgets.rs"] {
        keys.extend(keys_in(&std::fs::read_to_string(src.join(file)).unwrap()));
    }
    // Built with format!, so not visible to the scan: one word per filter.
    for filter in ["all", "unused", "store", "chocolatey", "extensions", "unregistered", "windows", "otherUsers", "unsigned", "broken"] {
        keys.push(format!("applications.filters.{filter}"));
    }
    for reason in ["orphaned", "extension", "storeNoPackage", "storeProtected", "storeUnknown", "noCommand", "chocolatey", "unregistered", "windows", "otherUser"] {
        keys.push(format!("applications.batchReasons.{reason}"));
    }
    assert!(keys.len() > 50, "found only {}", keys.len());
    let mut missing = Vec::new();
    for lang in LANGUAGES {
        let catalog = Catalog::load(lang);
        for key in &keys {
            if !catalog.has_id(&fluent_id(key)) {
                missing.push(format!("{lang}: {key}"));
            }
        }
    }
    assert!(missing.is_empty(), "{} missing, first: {:?}", missing.len(), &missing[..missing.len().min(8)]);
}
```


- [ ] **Step 2: Implement the view.**

**Create `native/crates/prune-app/src/applications/view.rs`:**

```rust
//! The Applications screen drawn: heading, tools, search, filter tabs, the
//! table, the footer, and the loading, error and empty states
//! (`ProgramList.jsx`, `App.jsx`).

use std::collections::HashMap;

use iced::widget::{Space, button, column, container, mouse_area, responsive, row, scrollable, space, stack, text_input};
use iced::{Alignment, Background, Border, Color, Element, Length, Padding, font};

use prune_core::i18n::{Catalog, FluentValue, count};
use prune_core::programs::accounts::trace_for_program;
use prune_core::programs::hidden::is_program_hidden;
use prune_core::programs::model::{Program, SigStatus, Source};
use prune_core::programs::view::{
    Direction, Filter, SortColumn, Tone, batch_summary, can_batch, chip_counts, format_bytes,
    format_short_date, is_recently_installed, size_tone, RECENT_DAYS,
};

use super::grid::{self, Columns, GAP, HEADER_HEIGHT, ROW_PAD_X, row_height};
use super::widgets::{ARROW_DOWN, ARROW_UP, BadgeKind, IconHandle, SEARCH, badge, checkbox, fit, ghost, icon, label, mono_label, remove, tile};
use super::{Applications, Msg, SEARCH_ID, Tool};
use crate::screen::geist;
use crate::theme::Palette;

pub const TABLE_ID: &str = "applications-table";

/// Everything the view reads besides the state.
#[derive(Clone, Copy)]
pub struct Ctx<'a> {
    pub catalog: &'a Catalog,
    pub palette: &'static Palette,
    pub handles: &'a HashMap<String, IconHandle>,
}

fn t(c: &Ctx, key: &str) -> String {
    c.catalog.t(key, &[])
}

fn ta(c: &Ctx, key: &str, args: &[(&str, FluentValue)]) -> String {
    c.catalog.t(key, args)
}

fn text_arg(s: &str) -> FluentValue<'static> {
    FluentValue::from(s.to_owned())
}

/// The line under the heading (`applicationsSummary`).
pub fn summary(c: &Ctx, s: &Applications) -> String {
    let v = &s.visible;
    let size = |bytes: u64| text_arg(&format_bytes(Some(bytes), s.units));
    if v.narrowed && s.filter == Filter::Windows {
        return ta(c, "sourcesV4.summaryNoSize", &[("shown", count(v.rows.len())), ("total", count(v.shown_of))]);
    }
    if v.narrowed {
        return ta(c, "app.applicationsSummaryFiltered", &[("shown", count(v.rows.len())), ("total", count(v.shown_of)), ("size", size(v.total_bytes))]);
    }
    ta(c, "app.applicationsSummary", &[("count", count(s.lists.programs.len())), ("size", size(s.all_bytes))])
}

/// The screen. `responsive` gives the page area, which decides the grid.
pub fn view<'a>(s: &'a Applications, c: Ctx<'a>) -> Element<'a, Msg> {
    responsive(move |size| page(s, c, size.width - 96.0, size.height)).into()
}

fn page<'a>(s: &'a Applications, c: Ctx<'a>, pane: f32, height: f32) -> Element<'a, Msg> {
    let p = c.palette;
    let heading = column![
        label(t(&c, "app.installedApplications"), 30.0, p.text_primary).font(geist(font::Weight::Semibold)).line_height(1.0),
        space().height(10),
        label(summary(&c, s), 13.0, p.text_secondary),
    ];
    let tools = row![
        ghost(t(&c, "uninstallerV3.hunter.button"), 14.0, [8.0, 16.0], 12.0, Some(Msg::Inert(Tool::Hunter)), p),
        ghost(t(&c, "uninstallerV3.monitor.button"), 14.0, [8.0, 16.0], 12.0, Some(Msg::Inert(Tool::Monitor)), p),
        ghost(t(&c, "uninstallerV3.forced.button"), 14.0, [8.0, 16.0], 12.0, Some(Msg::Inert(Tool::Forced)), p),
        ghost(t(&c, "nav.quarantine"), 14.0, [8.0, 16.0], 12.0, Some(Msg::OpenQuarantine), p),
    ]
    .spacing(8);
    let head = row![heading, space().width(Length::Fill), tools].align_y(Alignment::End);

    let body: Element<'a, Msg> = if let Some(err) = s.table.error {
        label(ta(&c, "applications.loadError", &[("error", text_arg(err))]), 14.0, p.danger).into()
    } else if s.table.loading() {
        skeleton(&c, pane)
    } else {
        column![controls(s, &c, pane), definition(s, &c), panel(s, &c, pane, (height - 220.0).max(240.0))].spacing(0).into()
    };
    container(column![head, space().height(24), body].width(Length::Fill)).padding(Padding { top: 40.0, right: 48.0, bottom: 24.0, left: 48.0 }).width(Length::Fill).height(Length::Fill).into()
}

/* ------------------------------------------------------------ controls */

fn chip<'a>(word: String, on: bool, msg: Msg, p: &'static Palette) -> Element<'a, Msg> {
    button(label(word, 12.5, if on { p.text_primary } else { p.text_muted }).font(geist(font::Weight::Medium)))
        .padding([6.0, 12.0])
        .on_press(msg)
        .style(move |_, status| button::Style {
            background: Some(Background::Color(if on || matches!(status, button::Status::Hovered) && on { p.surface_hover } else { Color::TRANSPARENT })),
            border: Border { radius: 8.0.into(), ..Border::default() },
            text_color: p.text_primary,
            ..button::Style::default()
        })
        .into()
}

fn group<'a>(chips: Vec<Element<'a, Msg>>, p: &'static Palette) -> Element<'a, Msg> {
    container(row(chips).spacing(4))
        .padding(4)
        .style(move |_| container::Style {
            background: Some(Background::Color(p.bg_panel)),
            border: Border { color: p.border_subtle, width: 1.0, radius: 12.0.into() },
            ..container::Style::default()
        })
        .into()
}

fn controls<'a>(s: &'a Applications, c: &Ctx<'a>, _pane: f32) -> Element<'a, Msg> {
    let p = c.palette;
    let counts = chip_counts(&s.lists);
    let on = |f: Filter| s.filter == f;
    let count_label = |key: &str, n: usize| ta(c, key, &[("n", count(n))]);

    let search = container(stack![
        text_input(&t(c, "applications.search.placeholder"), &s.query)
            .on_input(Msg::Query)
            .id(SEARCH_ID)
            .padding(Padding { top: 8.0, right: 16.0, bottom: 8.0, left: 40.0 })
            .size(13)
            .font(geist(font::Weight::Normal))
            .style(move |_, status| {
                let focused = matches!(status, text_input::Status::Focused { .. });
                text_input::Style {
                    background: Background::Color(p.bg_panel),
                    border: Border { color: if focused { p.accent_primary } else { p.border_subtle }, width: 1.0, radius: 12.0.into() },
                    icon: p.text_muted,
                    placeholder: p.text_muted,
                    value: p.text_primary,
                    selection: p.accent_primary_soft,
                }
            }),
        container(icon(SEARCH, 16.0, p.text_muted)).padding(Padding { top: 10.0, right: 0.0, bottom: 0.0, left: 14.0 }),
    ])
    .width(Length::FillPortion(1))
    .max_width(448);

    let mut sources = vec![chip(t(c, "applications.filters.all"), on(Filter::All), Msg::Filter(Filter::All), p)];
    for (filter, n, key) in [
        (Filter::Store, counts.store, "applications.filters.storeCount"),
        (Filter::Chocolatey, counts.chocolatey, "applications.filters.chocolateyCount"),
        (Filter::Extensions, counts.extensions, "applications.filters.extensionsCount"),
        (Filter::Unregistered, counts.unregistered, "applications.filters.unregisteredCount"),
        (Filter::Windows, counts.windows, "applications.filters.windowsCount"),
        (Filter::OtherUsers, counts.other_users, "applications.filters.otherUsersCount"),
    ] {
        if n > 0 {
            sources.push(chip(count_label(key, n), on(filter), Msg::Filter(filter), p));
        }
    }
    let mut checks = Vec::new();
    for (filter, n, key) in [(Filter::Unsigned, counts.unsigned, "applications.filters.unsignedCount"), (Filter::Broken, counts.broken, "applications.filters.brokenCount")] {
        if n > 0 {
            checks.push(chip(count_label(key, n), on(filter), Msg::Filter(filter), p));
        }
    }

    let mut items: Vec<Element<'a, Msg>> = vec![search.into(), group(sources, p)];
    if !checks.is_empty() {
        items.push(group(checks, p));
    }
    // An action, so not a segment: only on a PC with other accounts, and only
    // until their programs have been read (that read is 2c).
    if !s.table.profiles.is_empty() && s.lists.other_users.is_empty() {
        items.push(ghost(t(c, "otherV7.button"), 12.5, [6.0, 12.0], 8.0, Some(Msg::Inert(Tool::OtherAccounts)), p));
    }
    if s.visible.hidden_count > 0 {
        let word = ta(c, "hiddenProgramsV1.showHidden", &[("n", count(s.visible.hidden_count))]);
        items.push(group(vec![chip(word, s.show_hidden, Msg::ShowHidden(!s.show_hidden), p)], p));
    }
    // Wraps rather than squeezing: with every source present the filters alone
    // are about 660 px, and at the 900 px window the search box was left 58 px
    // wide. The filters drop to their own line instead.
    column![row(items).spacing(12).align_y(Alignment::Center).wrap().vertical_spacing(12), space().height(16)].into()
}

/// The sentence under the controls while a filter that needs one is on:
/// what it is based on, said rather than left for a tooltip.
fn definition<'a>(s: &'a Applications, c: &Ctx<'a>) -> Element<'a, Msg> {
    let key = match s.filter {
        Filter::Unsigned => "sigV6.definition",
        Filter::Unregistered => "sourcesV4.unregisteredDefinition",
        Filter::Windows => "sourcesV4.windowsDefinition",
        Filter::OtherUsers => "otherV7.definition",
        _ => return space().height(0).into(),
    };
    column![iced::widget::text(t(c, key)).size(12).color(c.palette.text_secondary).font(geist(font::Weight::Normal)).shaping(iced::widget::text::Shaping::Advanced).width(Length::Fixed(620.0)), space().height(12)].into()
}

/* --------------------------------------------------------------- table */

fn panel<'a>(s: &'a Applications, c: &Ctx<'a>, pane: f32, max_height: f32) -> Element<'a, Msg> {
    let p = c.palette;
    let cols = grid::columns(pane - 2.0);
    let rows: Vec<&Program> = s.rows().collect();

    let heights: Vec<f32> = rows.iter().map(|r| row_height(r) + 1.0).collect();
    let (first, last, above, below) = grid::window(&heights, s.scroll, s.viewport);
    let tab_stop = s.tab_stop();
    let mut list = column![space().height(above)].width(cols.total);
    for program in &rows[first..last] {
        list = list.push(row_view(s, c, program, &cols, tab_stop == Some(program.id.as_str())));
        list = list.push(divider(p));
    }
    list = list.push(space().height(below));

    let body: Element<'a, Msg> = if rows.is_empty() { empty_state(s, c) } else { list.into() };
    let table = column![
        header(s, c, &cols),
        scrollable(body)
            .id(TABLE_ID)
            .on_scroll(|v| Msg::Scrolled(v.absolute_offset().y, v.bounds().height))
            .height(Length::Fixed((max_height - HEADER_HEIGHT - 34.0).max(120.0)))
            .width(cols.total.max(pane - 2.0)),
    ];
    let scroller = scrollable(table).direction(scrollable::Direction::Horizontal(scrollable::Scrollbar::default())).width(Length::Fill);
    container(column![scroller, footer(s, c)])
        .style(move |_| container::Style {
            background: Some(Background::Color(p.glass_bg)),
            border: Border { color: p.glass_border, width: 1.0, radius: 12.0.into() },
            ..container::Style::default()
        })
        .clip(true)
        .into()
}

fn divider<'a>(p: &'static Palette) -> Element<'a, Msg> {
    container(space().height(1)).width(Length::Fill).style(move |_| container::Style { background: Some(Background::Color(p.border_subtle)), ..container::Style::default() }).into()
}

fn cell<'a>(w: f32, content: impl Into<Element<'a, Msg>>) -> Element<'a, Msg> {
    container(content).width(w).clip(true).align_y(Alignment::Center).into()
}

fn header<'a>(s: &'a Applications, c: &Ctx<'a>, cols: &Columns) -> Element<'a, Msg> {
    let p = c.palette;
    let all_selected = {
        let sel = s.selectable();
        !sel.is_empty() && sel.iter().all(|r| s.selected.contains(&r.id))
    };
    let head = |w: f32, key: &str, col: SortColumn, right: bool| -> Element<'a, Msg> {
        let active = s.sort.column == col;
        let ink = if active { p.text_primary } else { p.text_muted };
        let mut inner = row![mono_label(t(c, key).to_uppercase(), 11.0, ink)].spacing(4).align_y(Alignment::Center);
        if active {
            inner = inner.push(icon(if s.sort.direction == Direction::Asc { ARROW_UP } else { ARROW_DOWN }, 9.0, ink));
        }
        let b = button(container(inner).width(Length::Fill).align_x(if right { Alignment::End } else { Alignment::Start }))
            .padding(0)
            .height(32)
            .width(w)
            .on_press(Msg::Sort(col))
            .style(|_, _| button::Style::default());
        b.into()
    };
    let plain = |w: f32, key: &str| -> Element<'a, Msg> { cell(w, mono_label(t(c, key).to_uppercase(), 11.0, p.text_muted)) };
    let mut r = row![cell(cols.select, checkbox(all_selected, !s.selectable().is_empty(), Msg::ToggleAll, p)), head(cols.name, "applications.columns.application", SortColumn::Name, false), head(cols.size, "applications.columns.size", SortColumn::SizeBytes, true)];
    if let Some(w) = cols.version {
        r = r.push(head(w, "applications.columns.version", SortColumn::Version, false));
    }
    r = r
        .push(head(cols.kind, "applications.columns.type", SortColumn::Architecture, false))
        .push(head(cols.installed, "applications.columns.installed", SortColumn::InstallDate, false))
        .push(head(cols.new, "applications.columns.new", SortColumn::Recent, false))
        .push(head(cols.publisher, "applications.columns.company", SortColumn::Publisher, false));
    if let Some(w) = cols.website {
        r = r.push(plain(w, "applications.columns.website"));
    }
    r = r.push(Space::new().width(cols.action));
    container(r.spacing(GAP).padding([0.0, ROW_PAD_X]).height(32).align_y(Alignment::Center))
        .width(cols.total)
        .style(move |_| container::Style { background: Some(Background::Color(p.glass_bg)), border: Border { color: p.border_subtle, width: 0.0, ..Border::default() }, ..container::Style::default() })
        .into()
}

fn size_color(tone: Tone, p: &Palette) -> Color {
    match tone {
        Tone::Low => p.text_secondary,
        Tone::Moderate => p.text_primary,
        Tone::High | Tone::Peak => p.warning,
    }
}

fn row_view<'a>(s: &'a Applications, c: &Ctx<'a>, program: &'a Program, cols: &Columns, focused: bool) -> Element<'a, Msg> {
    let p = c.palette;
    let id = program.id.clone();
    let hot = s.hover.as_deref() == Some(program.id.as_str()) || (focused && s.cursor.is_some());
    let hidden = s.show_hidden && is_program_hidden(program, &s.hidden);
    let eligible = can_batch(program) && !is_program_hidden(program, &s.hidden) || can_batch(program);

    let mut badges: Vec<Element<'a, Msg>> = Vec::new();
    let word = |key: &str| t(c, key);
    let mut push = |text: String, kind: BadgeKind| badges.push(badge(&text, kind, p));
    if hidden {
        push(word("hiddenProgramsV1.badge"), BadgeKind::Neutral);
    }
    if program.is_orphaned() {
        push(word("applications.badges.broken"), BadgeKind::Danger);
    }
    if s.running.contains_key(&program.id) {
        push(word("applications.badges.running"), BadgeKind::Success);
    }
    match program.source {
        Source::Store => push(word("applications.badges.store"), BadgeKind::Neutral),
        Source::Extension => push(program.browser.clone().unwrap_or_default(), BadgeKind::Neutral),
        Source::OtherUser => push(program.owner.clone().unwrap_or_default(), BadgeKind::Neutral),
        Source::Unregistered => push(word("sourcesV4.badges.unregistered"), BadgeKind::Neutral),
        Source::Feature => push(word("sourcesV4.badges.feature"), BadgeKind::Neutral),
        Source::Update => push(word("sourcesV4.badges.update"), BadgeKind::Neutral),
        _ => {}
    }
    if program.source == Source::Chocolatey || program.chocolatey_id.is_some() {
        push(word("sourcesV4.badges.chocolatey"), BadgeKind::Neutral);
    }
    match program.signature.as_ref().map(|g| g.status) {
        Some(SigStatus::Unsigned) => push(word("sigV6.badges.unsigned"), BadgeKind::Muted),
        Some(SigStatus::Broken) => push(word("sigV6.badges.broken"), BadgeKind::Danger),
        _ => {}
    }
    if program.source == Source::Extension && program.enabled == Some(false) {
        push(word("applications.badges.disabled"), BadgeKind::Muted);
    }
    if trace_for_program(program, &s.table.traces).is_some() {
        push(word("uninstallerV3.monitor.badge"), BadgeKind::Accent);
    }

    let name_room = (cols.name - 20.0 - 10.0).max(60.0);
    let name = container(label(fit(&program.name, name_room * 0.62, 12.5, false), 12.5, p.text_primary)).clip(true);
    let name_cell = cell(cols.name, row![tile(&program.name, &program.publisher, c.handles.get(&program.id)), name, row(badges).spacing(4)].spacing(10).align_y(Alignment::Center));

    let size = mono_label(format_bytes(program.size_bytes, s.units), 12.0, size_color(size_tone(program.size_bytes), p));
    let dash = "\u{2014}".to_owned();
    let installed = program.install_date.as_deref().and_then(format_short_date).unwrap_or_else(|| dash.clone());
    let installed_ink = if program.install_date_approximate { p.text_muted } else { p.text_secondary };
    let is_new = is_recently_installed(program, s.today);
    let new_cell: Element<'a, Msg> = if is_new {
        container(mono_label(t(c, "applications.columns.new").to_uppercase(), 11.0, p.text_secondary))
            .padding([1.0, 4.0])
            .style(move |_| container::Style { background: Some(Background::Color(p.surface_hover)), border: Border { color: p.control_border, width: 1.0, radius: 4.0.into() }, ..container::Style::default() })
            .into()
    } else {
        space().into()
    };

    let mut r = row![
        cell(cols.select, checkbox(s.selected.contains(&program.id), eligible, Msg::Toggle(id.clone()), p)),
        name_cell,
        cell(cols.size, container(size).width(Length::Fill).align_x(Alignment::End)),
    ];
    if let Some(w) = cols.version {
        let v = if program.version.is_empty() { dash.clone() } else { fit(&program.version, w, 11.5, true) };
        r = r.push(cell(w, mono_label(v, 11.5, p.text_secondary)));
    }
    r = r
        .push(cell(cols.kind, mono_label(program.architecture.map_or(dash.clone(), |a| a.label().to_owned()), 11.5, p.text_muted)))
        .push(cell(cols.installed, mono_label(installed, 11.5, installed_ink)))
        .push(cell(cols.new, new_cell))
        .push(cell(cols.publisher, label(fit(&program.publisher, cols.publisher, 11.5, false), 11.5, p.text_secondary)));
    if let Some(w) = cols.website {
        let site = program.website.as_deref().map_or(dash, |u| fit(u.trim_start_matches("https://").trim_start_matches("http://"), w, 11.5, true));
        r = r.push(cell(w, mono_label(site, 11.5, p.text_muted)));
    }
    r = r.push(cell(cols.action, container(actions(s, c, program, hot)).width(Length::Fill).align_x(Alignment::End)));

    let height = row_height(program);
    let shaded = hot;
    mouse_area(
        container(r.spacing(GAP).padding([0.0, ROW_PAD_X]).align_y(Alignment::Center))
            .height(height)
            .width(cols.total)
            .align_y(Alignment::Center)
            .style(move |_| container::Style { background: Some(Background::Color(if shaded { p.surface_hover } else { Color::TRANSPARENT })), ..container::Style::default() }),
    )
    .on_enter(Msg::Hover(Some(id.clone())))
    .on_exit(Msg::Hover(None))
    .on_press(Msg::FocusRow(id))
    .into()
}

/// The row's buttons, shown on hover or when the row has the keyboard. All of
/// them change the machine and are inert until 2b and 2c, except Folder.
fn actions<'a>(s: &'a Applications, c: &Ctx<'a>, program: &'a Program, shown: bool) -> Element<'a, Msg> {
    let p = c.palette;
    if !shown && program.source != Source::Extension {
        return space().into();
    }
    let mut r = row![].spacing(6).align_y(Alignment::Center);
    if let Some(location) = &program.install_location {
        let missing = s.folder_missing.contains(location);
        let word = t(c, if missing { "applications.reveal.notFound" } else { "applications.reveal.button" });
        r = r.push(ghost(word, 11.0, [8.0, 16.0], 12.0, Some(Msg::OpenFolder(location.clone())), p));
    }
    let noop = || Msg::Noop;
    match program.source {
        Source::Extension => {
            if shown {
                r = r.push(ghost(t(c, "uninstallerV3.extensions.manage"), 11.0, [8.0, 16.0], 12.0, Some(noop()), p));
            }
            r = r.push(mono_label(t(c, "applications.viaBrowser"), 11.0, p.text_muted));
        }
        Source::Feature if program.feature_protected => r = r.push(mono_label(t(c, "sourcesV4.actions.required"), 11.0, p.text_muted)),
        Source::Feature => r = r.push(remove(t(c, "sourcesV4.actions.turnOff"), noop(), p)),
        Source::Update | Source::Chocolatey => r = r.push(remove(t(c, "applications.uninstall"), noop(), p)),
        Source::OtherUser => {
            if program.install_location.is_some() {
                r = r.push(remove(t(c, "sourcesV4.actions.remove"), noop(), p));
            }
        }
        Source::Unregistered => r = r.push(remove(t(c, "sourcesV4.actions.remove"), noop(), p)),
        Source::Store if program.non_removable != Some(false) => r = r.push(ghost(t(c, "applications.inWindows.button"), 11.0, [8.0, 16.0], 12.0, Some(noop()), p)),
        Source::Store => r = r.push(remove(t(c, "applications.uninstall"), noop(), p)),
        Source::Registry => {
            let word = if program.is_orphaned() { "applications.forceRemove" } else { "applications.uninstall" };
            r = r.push(remove(t(c, word), noop(), p));
        }
    }
    r.into()
}

/* -------------------------------------------------------------- footer */

fn footer<'a>(s: &'a Applications, c: &Ctx<'a>) -> Element<'a, Msg> {
    let p = c.palette;
    let selected: Vec<&Program> = s.rows().filter(|r| s.selected.contains(&r.id)).collect();
    if !selected.is_empty() {
        let (n, bytes, unknown) = batch_summary(&selected);
        let mut left = row![label(ta(c, "applications.footer.selected", &[("count", count(n))]), 12.0, p.text_primary).font(geist(font::Weight::Medium)), label(" \u{b7} ", 12.0, p.text_secondary), mono_label(format_bytes(Some(bytes), s.units), 12.0, p.text_secondary)].align_y(Alignment::Center);
        if unknown > 0 {
            left = left.push(label(format!(" {}", ta(c, "applications.footer.unknownSizes", &[("count", count(unknown))])), 12.0, p.text_muted));
        }
        let right = row![
            button(label(t(c, "applications.footer.clear"), 11.5, p.text_secondary)).padding([0.0, 8.0]).height(24).on_press(Msg::ClearSelection).style(|_, _| button::Style::default()),
            // The batch uninstall is 2b.
            button(label(ta(c, "applications.footer.uninstallCount", &[("count", count(n))]), 12.0, p.danger_ink).font(geist(font::Weight::Medium)))
                .padding([6.0, 14.0])
                .on_press(Msg::Noop)
                .style(move |_, _| button::Style { background: Some(Background::Color(p.danger_soft)), border: Border { color: p.danger_edge, width: 1.0, radius: 999.0.into() }, text_color: p.danger_ink, ..button::Style::default() }),
        ]
        .spacing(10)
        .align_y(Alignment::Center);
        return container(row![left, space().width(Length::Fill), right].align_y(Alignment::Center).padding([8.0, 16.0]))
            .width(Length::Fill)
            .style(move |_| container::Style { background: Some(Background::Color(Color { a: 0.07, ..p.accent_primary })), border: Border { color: Color { a: 0.25, ..p.accent_primary }, width: 1.0, ..Border::default() }, ..container::Style::default() })
            .into();
    }
    let v = &s.visible;
    let total = s.list().len();
    let mut line = if v.rows.len() == s.lists.programs.len() && s.filter == Filter::All {
        ta(c, "applications.footer.installations", &[("count", count(s.lists.programs.len()))])
    } else {
        ta(c, "applications.footer.showingOf", &[("shown", count(v.rows.len())), ("total", count(total))])
    };
    if v.new_count > 0 {
        line = format!("{line} \u{b7} {}", ta(c, "applications.footer.newInDays", &[("count", count(v.new_count)), ("days", count(RECENT_DAYS as usize))]));
    }
    let mut r = row![mono_label(line, 11.5, p.text_muted), space().width(Length::Fill)];
    if s.filter != Filter::Windows {
        r = r.push(mono_label(format!("{} {}", format_bytes(Some(v.total_bytes), s.units), t(c, "applications.footer.total")), 11.5, p.text_muted));
    }
    container(r.padding([8.0, 16.0]).align_y(Alignment::Center))
        .width(Length::Fill)
        .style(move |_| container::Style { background: Some(Background::Color(p.surface_subtle)), border: Border { color: p.border_subtle, width: 0.0, ..Border::default() }, ..container::Style::default() })
        .into()
}

/* -------------------------------------------------------------- states */

fn empty_state<'a>(s: &'a Applications, c: &Ctx<'a>) -> Element<'a, Msg> {
    let p = c.palette;
    let q = s.query.trim();
    let filter_word = |c: &Ctx| t(c, &format!("applications.filters.{}", s.filter.key()));
    let all_hidden = q.is_empty() && !s.show_hidden && s.visible.hidden_count > 0 && s.visible.hidden_count == s.visible.in_filter;
    let nothing_at_all = q.is_empty() && s.filter == Filter::All && s.lists.programs.is_empty();

    let (message, second, button_el): (String, Option<String>, Element<'a, Msg>) = if nothing_at_all {
        // 'all' plus an empty query never filters anything out, so this means
        // the read itself found no programs, and a real Windows install always
        // has dozens (a fresh Windows 10 once showed this screen empty).
        (t(c, "applications.empty.noPrograms"), None, ghost(t(c, "applications.retry"), 12.5, [8.0, 14.0], 8.0, Some(Msg::Retry), p))
    } else if all_hidden {
        (t(c, "hiddenProgramsV1.allHidden"), None, ghost(ta(c, "hiddenProgramsV1.showHidden", &[("n", count(s.visible.hidden_count))]), 12.5, [8.0, 14.0], 8.0, Some(Msg::ShowHidden(true)), p))
    } else {
        // Almost always a filter the person forgot, not an empty machine.
        let m = match (q.is_empty(), s.filter == Filter::All) {
            (false, false) => ta(c, "applications.empty.withQueryAndFilter", &[("query", text_arg(q)), ("filterLabel", text_arg(&filter_word(c)))]),
            (false, true) => ta(c, "applications.empty.withQuery", &[("query", text_arg(q))]),
            _ => ta(c, "applications.empty.withFilter", &[("filterLabel", text_arg(&filter_word(c)))]),
        };
        (m, Some(ta(c, "applications.empty.hiddenCount", &[("count", count(s.list().len()))])), ghost(t(c, "applications.empty.clear"), 12.5, [8.0, 14.0], 8.0, Some(Msg::ClearFilters), p))
    };
    let mut col = column![label(message, 13.0, p.text_secondary)].align_x(Alignment::Center).spacing(6);
    if let Some(second) = second {
        col = col.push(label(second, 12.5, p.text_muted));
    }
    container(col.push(space().height(8)).push(button_el)).width(Length::Fill).padding([64.0, 24.0]).align_x(Alignment::Center).into()
}

/// The shape of the table that is coming, not a line of text where it will be:
/// the header, the column set and ten rows of bars. Static, where 3.x breathes:
/// a running animation redraws the window at the display's rate, and this one
/// would only ever run while the list loads.
fn skeleton<'a>(c: &Ctx<'a>, pane: f32) -> Element<'a, Msg> {
    let p = c.palette;
    let cols = grid::columns(pane - 2.0);
    let widths = [cols.select, cols.name, cols.size, cols.kind, cols.installed, cols.new, cols.publisher];
    let keys = [None, Some("application"), Some("size"), Some("type"), Some("installed"), Some("new"), Some("company")];
    let head = keys.iter().zip(widths).fold(row![].spacing(12).padding([8.0, 20.0]), |r, (k, w)| {
        r.push(cell(w, mono_label(k.map(|k| t(c, &format!("applications.columns.{k}")).to_uppercase()).unwrap_or_default(), 11.0, p.text_muted)))
    });
    let mut body = column![head].width(Length::Fill);
    for i in 0..10 {
        let bars = widths.iter().enumerate().fold(row![].spacing(12).padding([10.0, 20.0]), |r, (j, w)| {
            let share = 0.45 + ((i * 7 + j * 11) % 45) as f32 / 100.0;
            r.push(cell(*w, container(space().width(Length::Fixed(w * share)).height(9)).style(move |_| container::Style { background: Some(Background::Color(p.surface_strong)), border: Border { radius: 999.0.into(), ..Border::default() }, ..container::Style::default() })))
        });
        body = body.push(divider(p)).push(bars);
    }
    body = body.push(container(mono_label(t(c, "applications.loading"), 11.5, p.text_muted)).padding([10.0, 20.0]));
    container(body).style(move |_| container::Style { background: Some(Background::Color(p.glass_bg)), border: Border { color: p.glass_border, width: 1.0, radius: 12.0.into() }, ..container::Style::default() }).into()
}
```


### Task 23: Wire the screen into the app

**Files:**
- Modify: `native/crates/prune-app/src/app.rs`, `native/crates/prune-app/src/render.rs`, `native/crates/prune-app/src/lib.rs`, `native/crates/prune-app/Cargo.toml`, `native/crates/prune-app/tests/render.rs`

**Interfaces:**
- `App` gains `applications: Applications`, `Message::Applications(applications::Msg)` and `Message::SearchFocus(bool)`, and four small behaviours:
  - `go(screen)` replaces `navigate` in `Navigate` and the Ctrl+1..8/Ctrl+, shortcuts: it starts the load on the first visit to Applications and ends the running chain on leaving it.
  - Ctrl+K and Ctrl+F focus the search box only on this screen (3.x's `data-app-search`: the shortcut is the app's, the box belongs to one screen). A pointer press asks the runtime whether the search box has the keyboard (`operation::is_focused`) and sets `typing`, which is what makes Ctrl+K's siblings (plain letters, arrows) go to the box or to the table.
  - Arrow keys, Home and End move between rows only while no text field has the keyboard (3.x: only while a row itself has focus).
  - A window that comes forward re-reads who is running.
- `render.rs`: `Options` gains `applications: Fixture`; rendering the Applications screen fills it with made-up rows (no thread, nothing read from the machine); every other screen is unchanged.

- [ ] **Step 1: Apply the changes.**

**Modify `native/crates/prune-app/src/app.rs`** (a unified diff against today's file; apply with the Edit tool, since some working copies are CRLF):

```diff
--- a/native/crates/prune-app/src/app.rs
+++ b/native/crates/prune-app/src/app.rs
@@ -18,6 +18,7 @@
 use prune_core::i18n::Catalog;
 use prune_core::settings::{self, Settings, ThemeChoice};
 
+use crate::applications::{self, Applications};
 use crate::aurora;
 use crate::listener::listener;
 use crate::motion::{STANDARD, Tween};
@@ -89,6 +90,10 @@
             Key::Named(Named::Tab) => "Tab".into(),
             Key::Named(Named::Enter) => "Enter".into(),
             Key::Named(Named::Space) => " ".into(),
+            Key::Named(Named::ArrowUp) => "ArrowUp".into(),
+            Key::Named(Named::ArrowDown) => "ArrowDown".into(),
+            Key::Named(Named::Home) => "Home".into(),
+            Key::Named(Named::End) => "End".into(),
             _ => return None,
         };
         let code = match physical_key {
@@ -151,6 +156,10 @@
     /// The title bar's buttons and the window's maximized state, from the
     /// window procedure.
     Caption(CaptionEvent),
+    /// The Applications screen's own messages.
+    Applications(applications::Msg),
+    /// Whether the search box has the keyboard, from the focus query run after a click.
+    SearchFocus(bool),
 }
 
 pub struct App {
@@ -201,6 +210,7 @@
     caption_pressed: Option<Button>,
     /// Maximized: the maximize button shows the restore glyph.
     maximized: bool,
+    applications: Applications,
 }
 
 impl App {
@@ -208,6 +218,7 @@
         let Startup { settings, window_state, window_state_path, os_light, reduced_motion, trace_startup } = startup;
         let theme = settings::effective_theme(&settings);
         let minimize_to_tray = settings.minimize_to_tray;
+        let applications = Applications::new(&settings, settings::settings_path());
         let screen = Screen::Dashboard;
         let (top, share) = rail::mark_anchor(screen);
         App {
@@ -246,6 +257,7 @@
             caption_hover: None,
             caption_pressed: None,
             maximized: false,
+            applications,
         }
     }
 
@@ -285,6 +297,15 @@
         open.map(Message::WindowOpened)
     }
 
+    /// For rendering and tests: the Applications screen filled with made-up data.
+    pub fn load_applications_fixture(&mut self, f: applications::fixture::Fixture) {
+        self.applications.load_fixture(f);
+    }
+
+    pub fn applications(&self) -> &Applications {
+        &self.applications
+    }
+
     pub fn screen(&self) -> Screen {
         self.screen
     }
@@ -329,6 +350,11 @@
         self.reveal_requested
     }
 
+    /// Whether a text field has the keyboard.
+    pub fn typing(&self) -> bool {
+        self.typing
+    }
+
     pub fn focused(&self) -> Option<Screen> {
         self.focus
     }
@@ -373,7 +399,7 @@
 
     pub fn update(&mut self, message: Message) -> Task<Message> {
         match message {
-            Message::Navigate(screen) => self.navigate(screen),
+            Message::Navigate(screen) => return self.go(screen),
             Message::RailHover(hover) => {
                 self.rail_hover = hover;
                 self.sync_rail();
@@ -403,6 +429,11 @@
                 if self.focus.take().is_some() {
                     self.sync_rail();
                 }
+                // Whether the click landed in or out of the search box decides whether
+                // letters are typing or shortcuts: ask the runtime once the click has been handled.
+                if self.screen == Screen::Applications {
+                    return iced::widget::operation::is_focused(applications::SEARCH_ID).map(Message::SearchFocus);
+                }
             }
             Message::WindowOpened(id) => {
                 self.trace("window-created");
@@ -428,10 +459,16 @@
             }
             Message::WindowChanged => return self.window_changed(Instant::now()),
             Message::SaveTimer => return self.save_timer(Instant::now()),
+            Message::Applications(applications::Msg::OpenQuarantine) => return self.go(Screen::Quarantine),
+            Message::Applications(m) => return self.applications_update(m),
+            Message::SearchFocus(on) => self.typing = on,
             Message::WindowFocused => {
                 // Both are Windows settings the person may have just changed.
                 self.recheck_os_theme();
                 self.reduced_motion = crate::motion::reduced_motion();
+                if self.screen == Screen::Applications {
+                    return self.applications.returned().map(Message::Applications);
+                }
             }
             Message::CloseRequested => {
                 self.save_window_state();
@@ -497,6 +534,28 @@
         Task::batch([window::minimize(id, false), window::set_mode(id, window::Mode::Windowed), window::gain_focus(id)])
     }
 
+    /// Goes to a screen, and does what opening or leaving one does. The
+    /// Applications screen reads nothing until it is first opened.
+    fn go(&mut self, screen: Screen) -> Task<Message> {
+        let was = self.screen;
+        self.navigate(screen);
+        if was == screen {
+            return Task::none();
+        }
+        if was == Screen::Applications {
+            self.applications.left();
+            self.typing = false;
+        }
+        if screen == Screen::Applications { self.applications.opened().map(Message::Applications) } else { Task::none() }
+    }
+
+    fn applications_update(&mut self, m: applications::Msg) -> Task<Message> {
+        if let applications::Msg::Query(_) = &m {
+            self.typing = true;
+        }
+        self.applications.update(m).map(Message::Applications)
+    }
+
     fn navigate(&mut self, screen: Screen) {
         if self.screen == screen {
             return;
@@ -590,10 +649,18 @@
             typing: self.typing,
         };
         match match_shortcut(&press) {
-            Some(Shortcut::Settings) => self.navigate(Screen::Settings),
-            Some(Shortcut::Screen(n)) => self.navigate(Screen::ORDER[n - 1]),
+            Some(Shortcut::Settings) => return self.go(Screen::Settings),
+            Some(Shortcut::Screen(n)) => return self.go(Screen::ORDER[n - 1]),
             // The search box and the shortcut list arrive with their screens.
+            // The shortcut belongs to the app, the box to one screen (3.x's `data-app-search`).
+            Some(Shortcut::Search) if self.screen == Screen::Applications => {
+                self.typing = true;
+                return iced::widget::operation::focus(applications::SEARCH_ID);
+            }
             Some(Shortcut::Search | Shortcut::Help) => {}
+            None if self.screen == Screen::Applications && !self.typing && !(k.ctrl || k.alt || k.meta) && matches!(k.key.as_str(), "ArrowUp" | "ArrowDown" | "Home" | "End") => {
+                return self.row_key(&k.key);
+            }
             None if !(k.ctrl || k.alt || k.meta) => self.focus_key(k),
             None => {}
         }
@@ -603,6 +670,19 @@
     /// Tab / Shift+Tab move keyboard focus through the rail (the only
     /// focusable things in Phase 1) and wrap; Enter or Space opens the
     /// focused screen.
+    /// Arrow keys, Home and End move between rows only while no text field has
+    /// the keyboard (3.x: only while the row itself has focus).
+    fn row_key(&mut self, key: &str) -> Task<Message> {
+        let to = match key {
+            "ArrowUp" => applications::RowMove::Up,
+            "ArrowDown" => applications::RowMove::Down,
+            "Home" => applications::RowMove::Home,
+            "End" => applications::RowMove::End,
+            _ => return Task::none(),
+        };
+        self.applications.update(applications::Msg::MoveRow(to)).map(Message::Applications)
+    }
+
     fn focus_key(&mut self, k: &KeyInput) {
         match k.key.as_str() {
             "Tab" => {
@@ -699,7 +779,12 @@
             pressed: self.caption_pressed,
             maximized: self.maximized,
         });
-        let page = row![space().width(COLLAPSED_WIDTH), screen::view(self.screen, &self.catalog, p)]
+        let content: Element<'_, Message> = if self.screen == Screen::Applications {
+            applications::view::view(&self.applications, applications::view::Ctx { catalog: &self.catalog, palette: p, handles: &self.applications.handles }).map(Message::Applications)
+        } else {
+            screen::view(self.screen, &self.catalog, p)
+        };
+        let page = row![space().width(COLLAPSED_WIDTH), content]
             .width(Length::Fill)
             .height(Length::Fill);
         let rail = rail::view(
```


**Modify `native/crates/prune-app/src/render.rs`** (a unified diff against today's file; apply with the Edit tool, since some working copies are CRLF):

```diff
--- a/native/crates/prune-app/src/render.rs
+++ b/native/crates/prune-app/src/render.rs
@@ -37,6 +37,7 @@
 
 #[derive(Debug, Clone, PartialEq)]
 pub struct Options {
+    pub applications: crate::applications::fixture::Fixture,
     pub theme: ThemeChoice,
     pub lang: String,
     pub scale: f32,
@@ -45,7 +46,7 @@
 
 impl Default for Options {
     fn default() -> Self {
-        Options { theme: ThemeChoice::Dark, lang: "en".into(), scale: 1.0, rail: RailMode::Collapsed }
+        Options { applications: crate::applications::fixture::Fixture::Loaded, theme: ThemeChoice::Dark, lang: "en".into(), scale: 1.0, rail: RailMode::Collapsed }
     }
 }
 
@@ -108,6 +109,9 @@
     // Reduced motion makes every transition land at once.
     let mut app = App::new(Startup { settings, reduced_motion: true, ..Startup::default() });
     let _ = app.update(Message::Navigate(screen));
+    if screen == Screen::Applications {
+        app.load_applications_fixture(o.applications);
+    }
     if o.rail == RailMode::Expanded {
         let _ = app.update(Message::RailHover(true));
     }
```


**Modify `native/crates/prune-app/tests/render.rs`** (a unified diff against today's file; apply with the Edit tool, since some working copies are CRLF):

```diff
--- a/native/crates/prune-app/tests/render.rs
+++ b/native/crates/prune-app/tests/render.rs
@@ -10,7 +10,7 @@
 use prune_core::settings::ThemeChoice;
 
 fn opts(lang: &str, scale: f32) -> Options {
-    Options { theme: ThemeChoice::Dark, lang: lang.into(), scale, rail: RailMode::Collapsed }
+    Options { applications: Default::default(), theme: ThemeChoice::Dark, lang: lang.into(), scale, rail: RailMode::Collapsed }
 }
 
 fn scratch(name: &str) -> PathBuf {
```


**Modify `native/crates/prune-app/src/lib.rs`** (a unified diff against today's file; apply with the Edit tool, since some working copies are CRLF):

```diff
--- a/native/crates/prune-app/src/lib.rs
+++ b/native/crates/prune-app/src/lib.rs
@@ -16,3 +16,4 @@
 pub mod tray;
 pub mod window_state;
 pub mod zoom;
+pub mod applications;
```


**Modify `native/crates/prune-app/Cargo.toml`** (a unified diff against today's file; apply with the Edit tool, since some working copies are CRLF):

```diff
--- a/native/crates/prune-app/Cargo.toml
+++ b/native/crates/prune-app/Cargo.toml
@@ -37,6 +37,7 @@
     "Win32_System_Registry",
     "Win32_System_Threading",
     "Win32_UI_HiDpi",
+    "Win32_System_SystemInformation",
     # The title bar's window subclass, auto-hide taskbar check and
     # non-client mouse-leave tracking.
     "Win32_UI_Input_KeyboardAndMouse",
```


- [ ] **Step 2:** `cd native && cargo build -p prune-app`. Expected: builds. If an iced 0.14 call differs from the snippets (a style struct field, `Row::wrap`, `scrollable::Direction`, `operation::scroll_to`'s offset type), fix the call; do not change behaviour.

### Task 24: State and render tests, and the comparison with 3.x

**Files:**
- Test: `native/crates/prune-app/tests/applications.rs`

**Interfaces:**
- Drives the whole `App` through `Message::Applications(...)` against the fixture rows, and renders the screen to PNG in every state.

- [ ] **Step 1: Write the tests.**

**Create `native/crates/prune-app/tests/applications.rs`:**

```rust
//! The Applications screen: what its controls do, and how it looks. Ported
//! from 3.x's ProgramList.*.render.test.jsx; the rows come from
//! `applications::fixture`, so no test reads this machine.

use std::collections::HashSet;

use prune_app::app::{App, KeyInput, Message, Startup};
use prune_app::applications::fixture::Fixture;
use prune_app::applications::{Msg, RowMove};
use prune_app::render::{self, Image, Options, RailMode};
use prune_app::screen::Screen;
use prune_core::programs::view::{Filter, SortColumn};
use prune_core::settings::ThemeChoice;

fn opened(f: Fixture) -> App {
    let mut app = App::new(Startup::default());
    let _ = app.update(Message::Navigate(Screen::Applications));
    app.load_applications_fixture(f);
    app
}

fn send(app: &mut App, m: Msg) {
    let _ = app.update(Message::Applications(m));
}

fn names(app: &App) -> Vec<String> {
    app.applications().rows().map(|p| p.name.clone()).collect()
}

#[test]
fn the_list_is_everything_the_screen_counts_and_largest_first() {
    let app = opened(Fixture::Loaded);
    let a = app.applications();
    // Registry programs, Store apps and package-only Chocolatey rows are "installed
    // applications"; the extension is a list of its own.
    assert_eq!(a.lists.programs.len(), 13);
    assert_eq!(a.lists.extensions.len(), 1);
    assert_eq!(names(&app)[..3], ["Wave Quest", "Starforge", "Rift Legends"]);
    assert!(a.visible.new_count == 2 && !a.visible.narrowed);
}

#[test]
fn nothing_is_read_before_the_screen_is_opened_and_nothing_ticks_at_rest() {
    let app = App::new(Startup::default());
    assert!(app.applications().table.loading(), "a fresh app has read nothing");
    // Reduced motion lands the rail's mark at once, so what is left is the screen's own.
    let mut app = App::new(Startup { reduced_motion: true, ..Startup::default() });
    let _ = app.update(Message::Navigate(Screen::Applications));
    app.load_applications_fixture(Fixture::Loaded);
    assert_eq!(app.subscription().units(), 0, "no timer, no frame clock at rest, loaded and open");
}

#[test]
fn search_reads_name_and_publisher_and_a_filter_swaps_the_list() {
    let mut app = opened(Fixture::Loaded);
    send(&mut app, Msg::Query("valve".into()));
    assert_eq!(names(&app), ["Steam"]);
    send(&mut app, Msg::ClearFilters);
    send(&mut app, Msg::Filter(Filter::Extensions));
    assert_eq!(names(&app), ["uBlock Origin"]);
    send(&mut app, Msg::Filter(Filter::Broken));
    assert_eq!(names(&app), ["Removed Thing"]);
    send(&mut app, Msg::Filter(Filter::Unsigned));
    assert_eq!(names(&app), ["7-Zip"]);
}

#[test]
fn a_header_click_sorts_and_the_same_click_reverses() {
    let mut app = opened(Fixture::Loaded);
    send(&mut app, Msg::Sort(SortColumn::Name));
    assert_eq!(names(&app)[0], "7-Zip");
    send(&mut app, Msg::Sort(SortColumn::Name));
    assert_eq!(names(&app)[0], "Windows Security");
}

#[test]
fn a_selection_that_has_been_filtered_away_is_not_kept() {
    // The property 3.x's render test exists for: tick a row, filter it off
    // screen, and nothing the person cannot see is selected.
    let mut app = opened(Fixture::Loaded);
    send(&mut app, Msg::Toggle("steam".into()));
    assert_eq!(app.applications().selected, HashSet::from(["steam".to_owned()]));
    send(&mut app, Msg::Filter(Filter::Broken));
    assert!(app.applications().selected.is_empty());
}

#[test]
fn select_all_takes_only_what_can_be_removed_unattended() {
    let mut app = opened(Fixture::Loaded);
    send(&mut app, Msg::ToggleAll);
    let selected = &app.applications().selected;
    // Not the broken entry, the protected Store app or the Chocolatey row.
    assert!(!selected.contains("gone") && !selected.contains("store:SecHealth") && !selected.contains("chocolatey:oscdimg"));
    assert!(selected.contains("steam") && selected.contains("store:Paint_11"));
    send(&mut app, Msg::ToggleAll);
    assert!(app.applications().selected.is_empty(), "again clears");
    // A row that may not be ticked cannot be ticked one by one either.
    send(&mut app, Msg::Toggle("gone".into()));
    assert!(app.applications().selected.is_empty());
}

#[test]
fn one_row_is_the_tab_stop_and_the_arrow_keys_move_it() {
    let mut app = opened(Fixture::Loaded);
    assert_eq!(app.applications().tab_stop(), Some("wave"));
    send(&mut app, Msg::MoveRow(RowMove::Down));
    assert_eq!(app.applications().tab_stop(), Some("frame"));
    send(&mut app, Msg::MoveRow(RowMove::End));
    let last = names(&app).len() - 1;
    assert_eq!(app.applications().rows().nth(last).map(|p| p.id.as_str()), app.applications().tab_stop());
    send(&mut app, Msg::MoveRow(RowMove::Down));
    assert_eq!(app.applications().rows().nth(last).map(|p| p.id.as_str()), app.applications().tab_stop(), "no wrap past the end");
    send(&mut app, Msg::MoveRow(RowMove::Home));
    assert_eq!(app.applications().tab_stop(), Some("wave"));
}

#[test]
fn arrow_keys_move_rows_only_while_no_text_field_has_the_keyboard() {
    let mut app = opened(Fixture::Loaded);
    let _ = app.update(Message::Key(KeyInput::named("ArrowDown")));
    assert_eq!(app.applications().tab_stop(), Some("frame"));
    let _ = app.update(Message::SearchFocus(true));
    let _ = app.update(Message::Key(KeyInput::named("ArrowDown")));
    assert_eq!(app.applications().tab_stop(), Some("frame"), "a text field keeps its arrow keys");
}

#[test]
fn ctrl_k_asks_for_the_search_box_only_on_this_screen() {
    let mut app = opened(Fixture::Loaded);
    let _ = app.update(Message::Key(KeyInput::ctrl("k", "KeyK")));
    assert!(app.typing(), "the box has the keyboard");
    let mut other = App::new(Startup::default());
    let _ = other.update(Message::Key(KeyInput::ctrl("k", "KeyK")));
    assert!(!other.typing());
}

#[test]
fn an_empty_result_says_why_and_how_to_undo_it() {
    let mut app = opened(Fixture::NothingMatches);
    assert!(names(&app).is_empty() && app.applications().visible.narrowed);
    send(&mut app, Msg::ClearFilters);
    assert_eq!(names(&app).len(), 13);
    // Retry re-reads: it starts again from nothing.
    let mut none = opened(Fixture::NoPrograms);
    assert!(none.applications().lists.programs.is_empty() && !none.applications().table.loading());
    send(&mut none, Msg::Retry);
    assert!(none.applications().table.loading());
}

#[test]
fn only_a_failed_list_is_an_error() {
    let app = opened(Fixture::Error);
    assert!(app.applications().table.error.is_some());
}

/* ------------------------------------------------------------- looks */

fn options(fixture: Fixture, theme: ThemeChoice, lang: &str) -> Options {
    Options { applications: fixture, theme, lang: lang.into(), scale: 1.0, rail: RailMode::Collapsed }
}

fn shot(fixture: Fixture, theme: ThemeChoice, lang: &str) -> Image {
    render::render_screen(Screen::Applications, &options(fixture, theme, lang))
}

fn distinct(img: &Image, x0: u32, y0: u32, x1: u32, y1: u32) -> usize {
    let mut seen = HashSet::new();
    for y in y0..y1.min(img.height) {
        for x in x0..x1.min(img.width) {
            let i = ((y * img.width + x) * 4) as usize;
            seen.insert([img.rgba[i], img.rgba[i + 1], img.rgba[i + 2]]);
        }
    }
    seen.len()
}

#[test]
fn every_state_draws_in_both_themes() {
    let dir = std::env::temp_dir().join(format!("prune-apps-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    for fixture in [Fixture::Loaded, Fixture::Loading, Fixture::Error, Fixture::NoPrograms, Fixture::NothingMatches, Fixture::Selected] {
        for theme in [ThemeChoice::Dark, ThemeChoice::Light] {
            let img = shot(fixture, theme, "en");
            assert!(img.width >= 900 && img.height >= 560);
            // The page area, right of the rail: more than a flat colour.
            assert!(distinct(&img, 100, 60, img.width, img.height) > 20, "{fixture:?} {theme:?} is blank");
            render::write_png(&dir.join(format!("{fixture:?}-{theme:?}.png")), &img).unwrap();
        }
    }
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn the_loaded_table_differs_from_the_skeleton_and_the_selection_adds_the_batch_bar() {
    let loaded = shot(Fixture::Loaded, ThemeChoice::Dark, "en");
    let loading = shot(Fixture::Loading, ThemeChoice::Dark, "en");
    let selected = shot(Fixture::Selected, ThemeChoice::Dark, "en");
    assert_ne!(loaded.rgba, loading.rgba);
    assert_ne!(loaded.rgba, selected.rgba);
}

#[test]
fn other_scripts_draw_real_glyphs_in_the_table_header() {
    for lang in ["ar", "el", "ja", "th"] {
        let img = shot(Fixture::Loaded, ThemeChoice::Dark, lang);
        // The heading band: the translated title is drawn, not a row of boxes.
        assert!(distinct(&img, 120, 80, 520, 120) > 6, "{lang}");
    }
}
```


- [ ] **Step 2:** `cargo test -p prune-app --test applications --test applications_grid --test applications_keys --test render --test shell --test theme`. Expected: 14 + 5 + 1 + 8 + 22 + 2 passed.
- [ ] **Step 3: Render and compare.** `cargo run -p prune-app -- --render-screens %TEMP%\prune-png` writes `applications-dark-en-1.png` (and the light and other-language variants with `--theme light --lang el`). Put it beside a 3.x screenshot of the same fixture (the 3.x frontend can be served with `npm run dev` in `frontend/` against `backend` started as in "How the live checks work", and screenshotted at 1264 x 800; the measured numbers above came from that) and the owner's screenshots of the real window. Check, in this order: heading and summary position; the tools; the search box's 448 px width and the two filter groups wrapping to a second line when they do not fit; header height 33 px and the sort arrow on Size; row heights; the badges; the amber sizes; the muted inferred dates; the footer. Write down every difference in the commit message (letter-spacing, blur and the estimated ellipsis are the known three). The first render of this screen, with fixture rows at a 1264 px window, matched 3.x's layout closely; the header checkbox and the title's baseline against the tool buttons are the two places to tune (`items-baseline` in 3.x's heading row).
- [ ] **Step 4: Commit** (Tasks 20 to 24 together): `feat(native): the Applications screen, read-only, with the loading, error and empty states`

### Task 25: The 3.x comparison and the numbers

**Files:**
- Create: `native/perf/phase2a-applications.md`

- [ ] **Step 1:** Capture 3.x again (`capture-3x.ps1`) and run every live test in one go:

```
set PRUNE_3X_DIR=%TEMP%\prune-3x
set PRUNE_3X_PROGRAMS=%TEMP%\prune-3x\programs.json
cd native && cargo test -p prune-core --test programs_registry_live --test programs_dates --test programs_store --test programs_sources --test programs_unregistered --test programs_windows_items --test programs_accounts --test programs_icons --test programs_signatures --test programs_loader -- --nocapture
```

Expected: all pass. A failure after a program updated between the capture and the run is data drift, not a bug: capture again.
- [ ] **Step 2: Record the numbers** in `native/perf/phase2a-applications.md`: the table below, and the date and PC.

Measured while writing this plan, on this PC, 3.x with a cold backend, one request at a time:

| What | 3.x | 4.0 |
|---|---|---|
| registry list | 2.4 s | 0.07 s |
| sizes (43 measured) | 3.5 s | 5.3 s on the first run with all lookups at once; immediate with a fresh `folder-sizes.json` |
| program icons (90) | 13.5 s | 1.3 s alone, 2.4 s with everything running |
| Store apps + package icons | 5 s + 5.2 s | 0.45 s, 0.13 s alone |
| signatures (104) | 12.4 s | 2.6 s |
| versions / install dates | 4.8 s / 3.5 s | 1.2 s / 0.07 s |
| Not registered | 10.6 s | 1.6 s |
| Windows features + updates | 2.8 s + 2.1 s | 3.5 s together (WMI, in the background) |
| running programs | 3.9 s | well under 0.1 s |
| **Applications ready** (every row has name, icon, size) | about 16 s (list, then the slowest of sizes, icons, Store) | about 5.3 s cold, about 2.5 s with the size cache fresh |

The spec's target is "at least 2x faster than 3.2": met on a cold first launch and by a wide margin on every later one. Sizes are the one lookup that is not faster when everything starts at once (the walks compete with the other threads); if Task 24's owner run finds that matters, start the size walk before the signatures and the "Not registered" scan (a one-line reorder in `load_all`).
- [ ] **Step 3:** Idle on Dashboard is unchanged (this phase adds no subscription and no work before the first frame: Task 24 asserts it). Applications' own working set and idle CPU are measured on the real window by the owner (the measuring tool launches the app on the Dashboard, and a `--screen` option for it belongs to Phase 6); the Applications budget is 100 MB.
- [ ] **Step 4: Commit** `perf(native): Phase 2a numbers against 3.x`

---

**Phase 2a is done when:**
- All tasks are committed.
- `cargo test --workspace`, `cargo clippy -- -D warnings` and `cargo deny check licenses` are green in CI (the live tests skip without `PRUNE_3X_DIR`).
- On this PC the live comparisons pass: 132 registry rows, 85 Store apps, 18 package-only Chocolatey rows, 33 extensions, 5 Not registered folders, 14 features, 5 updates, 90 + 112 icons and 104 signatures equal 3.x's, and the header reads 235.
- No i18n key the screen uses has a `needs-review` entry, and every one exists in all 40 languages.
- The PNGs of the screen (loaded, loading, error, empty, nothing matches, selected; dark and light; English, Greek, Arabic, Japanese and Thai) have been shown to the owner beside 3.2's, with the list of fidelity gaps.
- The owner has seen the numbers in `native/perf/phase2a-applications.md` and has opened the real window on Applications once.

Then write the Phase 2b plan against what 2a actually produced.

---

## Phase 2b outline: removing a program

Written when it starts, against 2a's types (`Program`, `Table`, `Msg::Noop` and the inert buttons it replaces). Nothing here is designed yet beyond what the 3.x code fixes.
- **The uninstall flow:** run a program's own uninstaller, with the silent modes 3.x knows, and the wizard-answering for installers that ask questions (3.x's `uninstaller*`, `wizard` services); the Uninstall and Force remove buttons, the row menu's Uninstall, and the batch bar's "Uninstall N programs" (batch eligibility is already in `programs::view`); Store removal (`Remove-AppxPackage` through `PackageManager::RemovePackageAsync`, whose NonRemovable flag 2a already carries), Chocolatey, Windows features and updates with a restore point and the consent step, running-program warnings (the Running badge is in 2a).
- **Leftovers:** the review after an uninstall (files, registry keys, scheduled tasks, services), with the confidence tiers; reuses `programs::protection` from 2a and adds the crash-artifact exception 2a deferred.
- **Quarantine and backups:** moving leftovers to `%APPDATA%\Prune\quarantine` with the 3.x manifest format, registry and task backups, restore; stays readable by 3.2.
- Writes only through Quarantine or the Recycle Bin, as 3.x does; destructive tests run against temp trees and a throwaway registry key.

## Phase 2c outline: the other tools on this screen

- **Hunter** (point at a window, find its program), **Install monitor and traces** (snapshot, install, diff; writes `install-traces\`, which 2a already reads), **Forced uninstall** (also the target of every "Remove…" row), **Find in Prune** (right-click and drag-and-drop of an `.exe` or `.lnk`).
- **Hide from list** and the row's right-click menu (Open folder, Properties through `SHObjectProperties`, Copy uninstall command, Unhide), writing `hiddenPrograms` through Phase 1's `settings::save` (2a reads the list and draws "Hidden" and "Show hidden").
- **Other accounts:** the elevated read of other accounts' registry hives (`RegLoadAppKey` on a copy of `NTUSER.DAT`, one UAC prompt), the `otherUsers` list and its filter.
- **Extension "Copy page address"** (the Manage button 2a draws inert), "In Windows" (opens Windows' Installed apps page), "Properties".
