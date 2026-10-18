import { runPowerShellJson } from './powershell.js';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runElevatedPowerShellJson } from '../lib/elevated.js';
import { readUninstallEntries } from '../lib/regfReader.js';
import { parseRegistryDate } from './programs.js';

/** Programs installed for the other people who use this PC.
 *
 * A per-user install writes its Add/Remove entry into that user's own
 * registry hive (HKCU while they are signed in), so every uninstaller,
 * Prune included, lists only the programs of the person running it. On
 * the dev machine three other accounts exist and none was visible.
 *
 * Reading them takes administrator rights: an account that is signed out
 * has its hive only as the NTUSER.DAT file in its profile, which has to be
 * loaded into the registry to be read, and one that is signed in keeps its
 * hive readable only by itself and administrators. So the scan is one
 * elevated script, run when the person asks for it, never in the
 * background.
 *
 * A signed-out account's file is never opened in place. It is COPIED, with
 * its .LOG1/.LOG2 journals, and the copy is opened with RegLoadAppKey: a
 * hive loaded into this one process only, never under HKEY_USERS, and
 * unloaded by Windows when its handle closes or the process ends. The
 * person's own file is only ever read, and nothing can be left mounted to
 * stop their profile loading at the next sign-in.
 *
 * The first version used `reg load` into HKEY_USERS, with a careful
 * unload. On the dev machine it never got that far: reg.exe refused all
 * three accounts with "The filename or extension is too long", found on
 * the first real elevated run. The copy needs none of what reg load does.
 *
 * Listing only, plus Forced uninstall. Running another account's own
 * uninstaller from this account would act on THIS account's registry and
 * folders, not theirs. */

const SYSTEM_SIDS = new Set(['S-1-5-18', 'S-1-5-19', 'S-1-5-20']);

export const PROFILES_QUERY = `
$ErrorActionPreference = 'SilentlyContinue'
$me = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$list = @(Get-ChildItem 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\ProfileList' | ForEach-Object {
  $p = Get-ItemProperty -LiteralPath $_.PSPath
  [PSCustomObject]@{ sid = $_.PSChildName; path = [Environment]::ExpandEnvironmentVariables([string]$p.ProfileImagePath); loaded = (Test-Path -LiteralPath ('Registry::HKEY_USERS\\' + $_.PSChildName)); me = ($_.PSChildName -eq $me) }
})
ConvertTo-Json -Compress -InputObject $list
`;

/** The other people's accounts: real user SIDs, not this one, not
 * Windows' service accounts, with a profile folder. */
export function otherProfiles(rows) {
  return (Array.isArray(rows) ? rows : rows ? [rows] : [])
    .filter((r) => r && typeof r.sid === 'string' && /^S-1-5-21-/.test(r.sid) && !SYSTEM_SIDS.has(r.sid) && !r.me && typeof r.path === 'string' && r.path)
    .map((r) => ({ sid: r.sid, name: r.path.replace(/[\\/]+$/, '').split(/[\\/]/).pop(), path: r.path, loaded: r.loaded === true }));
}

export async function listOtherProfiles({ run = runPowerShellJson } = {}) {
  try {
    return otherProfiles(await run(PROFILES_QUERY, { timeoutMs: 30000 }));
  } catch {
    return [];
  }
}

const psLiteral = (value) => `'${String(value).replace(/'/g, "''")}'`;
const SID = /^S-1-5-21-\d+-\d+-\d+-\d+$/;

/** The elevated half of the scan, for the given profiles. A signed-in
 * account's hive is open in Windows already and is read where it is; a
 * signed-out account's NTUSER.DAT is only COPIED, into `copyDir` (a folder
 * Prune made, so this account can read and delete what lands there), and
 * read by lib/regfReader.js afterwards. Its answer:
 *   { accounts: [{ sid, programs?: [...], copy?: path, error? }] } */
export function buildScanScript(profiles, copyDir) {
  const items = profiles
    .filter((p) => SID.test(p.sid))
    .map((p) => `[PSCustomObject]@{ sid = ${psLiteral(p.sid)}; path = ${psLiteral(p.path)} }`)
    .join(',\n  ');
  return `
$ErrorActionPreference = 'Stop'
$profiles = @(
  ${items}
)
$copyDir = ${psLiteral(copyDir)}
$sub = 'Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
$fields = @('DisplayName','Publisher','DisplayVersion','UninstallString','QuietUninstallString','InstallLocation','DisplayIcon','EstimatedSize','InstallDate','SystemComponent','ParentKeyName','ReleaseType')

function Read-Uninstall($root) {
  $found = @()
  if ($null -eq $root) { return ,$found }
  try {
    foreach ($name in $root.GetSubKeyNames()) {
      $k = $root.OpenSubKey($name, $false)
      if ($null -eq $k) { continue }
      try {
        $entry = [ordered]@{ keyName = $name }
        foreach ($f in $fields) { $v = $k.GetValue($f); if ($null -ne $v) { $entry[$f] = [string]$v } }
        $found += [PSCustomObject]$entry
      } finally { $k.Dispose() }
    }
  } finally { $root.Dispose() }
  return ,$found
}

$accounts = @()
$n = 0
foreach ($p in $profiles) {
  $n++
  $result = [ordered]@{ sid = $p.sid }
  try {
    if (Test-Path -LiteralPath ('Registry::HKEY_USERS\\' + $p.sid)) {
      $result.programs = Read-Uninstall ([Microsoft.Win32.Registry]::Users.OpenSubKey($p.sid + '\\' + $sub, $false))
    } else {
      $hive = Join-Path $p.path 'NTUSER.DAT'
      if (-not (Test-Path -LiteralPath $hive)) { throw 'This account has no registry file.' }
      $copy = Join-Path $copyDir ('account' + $n + '.dat')
      [IO.File]::Copy($hive, $copy, $true)
      $result.copy = $copy
      # Its journals too: a hive can hold its newest changes only there.
      $result.logs = @()
      foreach ($ext in @('.LOG1', '.LOG2')) {
        $from = $hive + $ext
        if (Test-Path -LiteralPath $from) { [IO.File]::Copy($from, ($copy + $ext), $true); $result.logs += ($copy + $ext) }
      }
    }
  } catch {
    $result.error = $_.Exception.Message
  }
  $accounts += [PSCustomObject]$result
}
ConvertTo-Json -Compress -Depth 5 -InputObject ([PSCustomObject]@{ accounts = $accounts })
`;
}

/** Registry entries to program rows, filtered the way the main list is:
 * no name, a system component or an update of something else is not a
 * program. */
export function accountRows(account, profile) {
  const rows = [];
  for (const e of account.programs || []) {
    if (!e?.DisplayName || e.SystemComponent === '1' || e.ParentKeyName || /update|hotfix/i.test(e.ReleaseType || '')) continue;
    const kb = Number(e.EstimatedSize);
    rows.push({
      id: `user:${profile.sid}:${e.keyName}`,
      name: e.DisplayName,
      publisher: e.Publisher || '',
      version: e.DisplayVersion || '',
      installLocation: e.InstallLocation || null,
      sizeBytes: Number.isFinite(kb) && kb > 0 ? kb * 1024 : null,
      installDate: parseRegistryDate(e.InstallDate),
      owner: profile.name,
      ownerSid: profile.sid,
      source: 'otherUser'
    });
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

let lastScan = null;

/** What is known: the other accounts, and the last scan of them, if any. */
export async function getOtherAccounts() {
  return { profiles: await listOtherProfiles(), scan: lastScan };
}

/** Scans every other account, elevated. { ok: true, scan } |
 * { ok: false, cancelled } | { ok: false, error }. */
export async function scanOtherAccounts({ runElevated = runElevatedPowerShellJson, profiles, readFile = readFileSync } = {}) {
  const list = profiles ?? await listOtherProfiles();
  if (!list.length) return { ok: true, scan: (lastScan = { at: new Date().toISOString(), accounts: [], programs: [] }) };
  // Made here, by this account, so it can read and delete what the elevated
  // copy puts in it.
  const copyDir = mkdtempSync(join(tmpdir(), 'prune-accounts-'));
  try {
    const result = await runElevated(buildScanScript(list, copyDir), { timeoutMs: 5 * 60 * 1000 });
    if (!result.ok) return result;
    const bySid = new Map(list.map((p) => [p.sid, p]));
    const accounts = [];
    const programs = [];
    for (const account of result.data?.accounts || []) {
      const profile = bySid.get(account.sid);
      if (!profile) continue;
      let read = account;
      if (account.copy && !account.error) {
        try {
          const logs = (Array.isArray(account.logs) ? account.logs : account.logs ? [account.logs] : []).map((log) => readFile(log));
          read = { programs: readUninstallEntries(readFile(account.copy), { logs }).entries };
        } catch (err) {
          read = { programs: [], error: err.message };
        }
      }
      const rows = accountRows(read, profile);
      programs.push(...rows);
      accounts.push({ sid: profile.sid, name: profile.name, count: rows.length, ...(read.error ? { error: read.error } : {}) });
    }
    lastScan = { at: new Date().toISOString(), accounts, programs };
    return { ok: true, scan: lastScan };
  } finally {
    // The copies are other people's registries: never left behind.
    rmSync(copyDir, { recursive: true, force: true });
  }
}

/** Testing seam. */
export function clearOtherAccountsScan() {
  lastScan = null;
}
