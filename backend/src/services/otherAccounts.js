import { runPowerShellJson } from './powershell.js';
import { runElevatedPowerShellJson } from '../lib/elevated.js';

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
 * A hive this loads is ALWAYS unloaded again, because a hive left mounted
 * stops that user's profile from loading at their next sign-in. The script
 * reads through .NET registry handles it disposes itself, not the
 * PowerShell registry drive (which holds handles open and makes the
 * unload fail), collects garbage, retries the unload, and reports any hive
 * it could not release.
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

/** The elevated scan, for the given profiles. Its answer:
 *   { accounts: [{ sid, programs: [...], error? }], stuck: [mount names] } */
export function buildScanScript(profiles) {
  const items = profiles
    .filter((p) => SID.test(p.sid))
    .map((p) => `[PSCustomObject]@{ sid = ${psLiteral(p.sid)}; path = ${psLiteral(p.path)} }`)
    .join(',\n  ');
  return `
$ErrorActionPreference = 'Stop'
$profiles = @(
  ${items}
)
$sub = 'Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
$fields = @('DisplayName','Publisher','DisplayVersion','UninstallString','QuietUninstallString','InstallLocation','DisplayIcon','EstimatedSize','InstallDate','SystemComponent','ParentKeyName','ReleaseType')

function Read-Uninstall([string]$hiveName) {
  $found = @()
  $root = [Microsoft.Win32.Registry]::Users.OpenSubKey($hiveName + '\\' + $sub, $false)
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
$stuck = @()
$n = 0
foreach ($p in $profiles) {
  $n++
  $result = [ordered]@{ sid = $p.sid; programs = @() }
  try {
    if (Test-Path -LiteralPath ('Registry::HKEY_USERS\\' + $p.sid)) {
      $result.programs = Read-Uninstall $p.sid
    } else {
      $hive = Join-Path $p.path 'NTUSER.DAT'
      if (-not (Test-Path -LiteralPath $hive)) { throw 'This account has no registry file.' }
      $mount = 'PruneScan' + $n + '_' + $PID
      & reg.exe load ('HKU\\' + $mount) $hive 2>&1 | Out-Null
      if ($LASTEXITCODE -ne 0) { throw 'Windows would not open this account''s registry file.' }
      try {
        $result.programs = Read-Uninstall $mount
      } finally {
        [GC]::Collect(); [GC]::WaitForPendingFinalizers()
        $released = $false
        for ($try = 0; $try -lt 5 -and -not $released; $try++) {
          & reg.exe unload ('HKU\\' + $mount) 2>&1 | Out-Null
          if ($LASTEXITCODE -eq 0) { $released = $true } else { Start-Sleep -Milliseconds 400; [GC]::Collect() }
        }
        if (-not $released) { $stuck += $mount }
      }
    }
  } catch {
    $result.error = $_.Exception.Message
  }
  $accounts += [PSCustomObject]$result
}
ConvertTo-Json -Compress -Depth 5 -InputObject ([PSCustomObject]@{ accounts = $accounts; stuck = $stuck })
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
      installDate: /^\d{8}$/.test(e.InstallDate || '') ? `${e.InstallDate.slice(0, 4)}-${e.InstallDate.slice(4, 6)}-${e.InstallDate.slice(6, 8)}` : null,
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
export async function scanOtherAccounts({ runElevated = runElevatedPowerShellJson, profiles } = {}) {
  const list = profiles ?? await listOtherProfiles();
  if (!list.length) return { ok: true, scan: (lastScan = { at: new Date().toISOString(), accounts: [], programs: [], stuck: [] }) };
  const result = await runElevated(buildScanScript(list), { timeoutMs: 5 * 60 * 1000 });
  if (!result.ok) return result;
  const bySid = new Map(list.map((p) => [p.sid, p]));
  const accounts = [];
  const programs = [];
  for (const account of result.data?.accounts || []) {
    const profile = bySid.get(account.sid);
    if (!profile) continue;
    const rows = accountRows(account, profile);
    programs.push(...rows);
    accounts.push({ sid: profile.sid, name: profile.name, count: rows.length, ...(account.error ? { error: account.error } : {}) });
  }
  lastScan = { at: new Date().toISOString(), accounts, programs, stuck: result.data?.stuck || [] };
  return { ok: true, scan: lastScan };
}

/** Testing seam. */
export function clearOtherAccountsScan() {
  lastScan = null;
}
