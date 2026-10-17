import { runElevatedPowerShellJson } from '../lib/elevated.js';

/** Windows' own optional features and installed updates, as program rows.
 *
 * Both change Windows itself rather than a program installed on it, so
 * neither is removed casually: the screen asks first, in those words, and
 * the removal script makes a System Restore point before it touches
 * anything. When no restore point could be made and none from the last day
 * exists, nothing is changed and the person is asked again, explicitly,
 * whether to go ahead without one.
 *
 * Turning a feature off is undone from the same Windows Features dialog.
 * An update removed is offered again by Windows Update. */

const psLiteral = (value) => `'${String(value).replace(/'/g, "''")}'`;

/* ------------------------------------------------------------- features */

/** Features whose removal breaks things far outside themselves -- every
 * .NET program, or the antivirus. Listed, never offered. */
const PROTECTED_FEATURE = /^(NetFx4|Windows-Defender)/i;

const FEATURE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export const FEATURES_QUERY = `
$ErrorActionPreference = 'Stop'
$list = @(Get-CimInstance Win32_OptionalFeature -Filter 'InstallState=1' | ForEach-Object { [PSCustomObject]@{ name = [string]$_.Name; caption = [string]$_.Caption } })
ConvertTo-Json -Compress -InputObject $list
`;

export function featureRows(features) {
  return (features || [])
    .filter((f) => f && typeof f.name === 'string' && FEATURE_NAME.test(f.name))
    .map((f) => ({
      id: `feature:${f.name}`,
      name: f.caption || f.name,
      publisher: 'Microsoft',
      version: '',
      installLocation: null,
      sizeBytes: null,
      featureName: f.name,
      protected: PROTECTED_FEATURE.test(f.name),
      source: 'feature'
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function readEnabledFeatures({ run } = {}) {
  const runner = run ?? (await import('./powershell.js')).runPowerShellJson;
  const list = await runner(FEATURES_QUERY, { timeoutMs: 60000 });
  return Array.isArray(list) ? list : list ? [list] : [];
}

export async function listWindowsFeatures(options) {
  return featureRows(await readEnabledFeatures(options));
}

/* -------------------------------------------------------------- updates */

export const UPDATES_QUERY = `
$ErrorActionPreference = 'Stop'
$list = @(Get-HotFix | ForEach-Object {
  $on = $null
  try { if ($_.InstalledOn) { $on = ([datetime]$_.InstalledOn).ToString('yyyy-MM-dd') } } catch {}
  [PSCustomObject]@{ id = [string]$_.HotFixID; description = [string]$_.Description; installedOn = $on }
})
ConvertTo-Json -Compress -InputObject $list
`;

const KB = /^KB(\d{6,8})$/i;

export function updateRows(updates) {
  return (updates || [])
    .filter((u) => u && typeof u.id === 'string' && KB.test(u.id))
    .map((u) => ({
      id: `update:${u.id.toUpperCase()}`,
      name: u.id.toUpperCase(),
      publisher: 'Microsoft',
      version: '',
      installLocation: null,
      sizeBytes: null,
      installDate: u.installedOn || null,
      description: u.description || '',
      kb: KB.exec(u.id)[1],
      source: 'update'
    }))
    .sort((a, b) => String(b.installDate || '').localeCompare(String(a.installDate || '')));
}

export async function readInstalledUpdates({ run } = {}) {
  const runner = run ?? (await import('./powershell.js')).runPowerShellJson;
  const list = await runner(UPDATES_QUERY, { timeoutMs: 60000 });
  return Array.isArray(list) ? list : list ? [list] : [];
}

export async function listWindowsUpdates(options) {
  return updateRows(await readInstalledUpdates(options));
}

/* ------------------------------------------------------------ removal */

/** The restore-point half of every removal script. Sets $rp; when nothing
 * protects this change and the caller did not accept that, writes the
 * answer and stops before the change. Checkpoint-Computer only warns when
 * Windows' one-a-day limit stops it, so success is judged by the newest
 * restore point, not by the call. */
function restorePointBlock(description, allowWithout) {
  return `
$rp = [PSCustomObject]@{ created = $false; recent = $false; reason = '' }
try {
  Checkpoint-Computer -Description ${psLiteral(description)} -RestorePointType 'MODIFY_SETTINGS' -ErrorAction Stop -WarningAction SilentlyContinue
} catch { $rp.reason = $_.Exception.Message }
try {
  $newest = Get-ComputerRestorePoint -ErrorAction Stop | Sort-Object SequenceNumber -Descending | Select-Object -First 1
  if ($newest) {
    $age = (Get-Date) - [Management.ManagementDateTimeConverter]::ToDateTime($newest.CreationTime)
    if ($age.TotalMinutes -lt 10) { $rp.created = $true }
    elseif ($age.TotalHours -lt 24) { $rp.recent = $true }
  }
} catch { if (-not $rp.reason) { $rp.reason = $_.Exception.Message } }
if (-not $rp.created -and -not $rp.recent -and -not $rp.reason) { $rp.reason = 'System Protection may be turned off for the Windows drive.' }
if (-not $rp.created -and -not $rp.recent -and -not ${allowWithout ? '$true' : '$false'}) {
  ConvertTo-Json -Compress -InputObject ([PSCustomObject]@{ changed = $false; restorePoint = $rp })
  # return, not exit: this runs inside the elevated wrapper's script block,
  # and exit would end it before the answer is written.
  return
}
`;
}

export function buildDisableFeatureScript(featureName, { allowWithoutRestorePoint = false } = {}) {
  return `$ErrorActionPreference = 'Stop'
${restorePointBlock(`Prune: turn off ${featureName}`, allowWithoutRestorePoint)}
try {
  $r = Disable-WindowsOptionalFeature -Online -FeatureName ${psLiteral(featureName)} -NoRestart
  ConvertTo-Json -Compress -InputObject ([PSCustomObject]@{ changed = $true; restartNeeded = [bool]$r.RestartNeeded; restorePoint = $rp })
} catch {
  ConvertTo-Json -Compress -InputObject ([PSCustomObject]@{ changed = $false; error = $_.Exception.Message; restorePoint = $rp })
}`;
}

/** wusa shows Windows' own confirmation and progress; /quiet is ignored for
 * an uninstall on Windows 10 and 11, so it is not pretended here. */
export function buildUninstallUpdateScript(kb, { allowWithoutRestorePoint = false } = {}) {
  return `$ErrorActionPreference = 'Stop'
${restorePointBlock(`Prune: remove update KB${kb}`, allowWithoutRestorePoint)}
try {
  $p = Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\\wusa.exe') -ArgumentList @('/uninstall', ${psLiteral(`/kb:${kb}`)}, '/norestart') -Wait -PassThru
  ConvertTo-Json -Compress -InputObject ([PSCustomObject]@{ changed = $true; exitCode = $p.ExitCode; restorePoint = $rp })
} catch {
  ConvertTo-Json -Compress -InputObject ([PSCustomObject]@{ changed = $false; error = $_.Exception.Message; restorePoint = $rp })
}`;
}

/** What a removal script's answer means, in the contract every removal
 * route uses: { ok: true, restartNeeded? } | { ok: false, cancelled } |
 * { ok: false, needsConsent: true, reason } | { ok: false, error }. */
function interpret(result, success) {
  if (!result.ok) return result;
  const data = result.data || {};
  const restorePoint = data.restorePoint || null;
  if (!data.changed && !data.error) {
    return { ok: false, needsConsent: true, reason: restorePoint?.reason || 'No restore point could be made.', restorePoint };
  }
  if (data.error) return { ok: false, error: data.error, restorePoint };
  return { ...success(data), restorePoint };
}

export async function disableWindowsFeature(featureName, { allowWithoutRestorePoint = false, runElevated = runElevatedPowerShellJson, read = readEnabledFeatures } = {}) {
  if (typeof featureName !== 'string' || !FEATURE_NAME.test(featureName)) return { ok: false, error: 'That is not a Windows feature name.' };
  if (PROTECTED_FEATURE.test(featureName)) return { ok: false, error: 'Prune does not turn that feature off: too much of Windows depends on it.' };
  // Read again here, never taken on the client's word.
  const enabled = await read();
  if (!enabled.some((f) => f.name.toLowerCase() === featureName.toLowerCase())) return { ok: false, error: 'That feature is already off.' };
  const result = await runElevated(buildDisableFeatureScript(featureName, { allowWithoutRestorePoint }), { timeoutMs: 15 * 60 * 1000 });
  return interpret(result, (data) => ({ ok: true, ...(data.restartNeeded ? { restartNeeded: true } : {}) }));
}

// wusa's answers. 3010 and 1641 are success with a restart to finish.
const WUSA_NOT_INSTALLED = 2359303; // 0x00240007
const WUSA_NOT_APPLICABLE = -2145124329; // 0x80240017
const WUSA_CANCELLED = [1223, -2147023673]; // ERROR_CANCELLED, 0x800704C7

export function wusaOutcome(code) {
  if (code === 0) return { ok: true };
  if (code === 3010 || code === 1641) return { ok: true, restartNeeded: true };
  if (WUSA_CANCELLED.includes(code)) return { ok: false, cancelled: true };
  if (code === WUSA_NOT_INSTALLED || code === WUSA_NOT_APPLICABLE) {
    return { ok: false, error: 'Windows says this update cannot be removed. Some updates, like servicing stack updates, are permanent.' };
  }
  return { ok: false, error: `Windows could not remove the update (code ${Number.isFinite(code) ? code : 'unknown'}).` };
}

export async function uninstallWindowsUpdate(kbId, { allowWithoutRestorePoint = false, runElevated = runElevatedPowerShellJson, read = readInstalledUpdates } = {}) {
  const match = typeof kbId === 'string' ? KB.exec(kbId) : null;
  if (!match) return { ok: false, error: 'That is not an update number.' };
  const installed = await read();
  if (!installed.some((u) => String(u.id).toUpperCase() === `KB${match[1]}`)) return { ok: false, error: 'That update is no longer installed.' };
  const result = await runElevated(buildUninstallUpdateScript(match[1], { allowWithoutRestorePoint }), { timeoutMs: 30 * 60 * 1000 });
  return interpret(result, (data) => wusaOutcome(Number(data.exitCode)));
}
