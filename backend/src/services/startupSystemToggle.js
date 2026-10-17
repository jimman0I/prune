import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { runPowerShellJson } from './powershell.js';
import { runElevatedPowerShellJson } from '../lib/elevated.js';
import { settingsPath } from './settings.js';

/** Switching scheduled tasks and services on and off.
 *
 * Neither is recorded in StartupApproved (startupToggle.js), so each is
 * switched where Windows itself keeps its state: a task is enabled or
 * disabled on the task, and a service's startup type moves between
 * Automatic and Manual. Manual rather than Disabled on purpose -- a program
 * or another service that needs it can still start it on demand, so
 * switching it off here cannot leave something that depends on it unable to
 * run at all.
 *
 * A service the list only shows while it is Automatic would vanish the
 * moment it was switched off, with no way back. Prune keeps its own short
 * record of the services it switched off, and the startup list keeps
 * showing those (switched off) until they are switched back on. */

function psLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** "\Vendor\Updater" -> folder "\Vendor\" and name "Updater". */
function splitTaskKey(key) {
  const cut = String(key).lastIndexOf('\\');
  return { path: String(key).slice(0, cut + 1) || '\\', name: String(key).slice(cut + 1) };
}

export function buildTaskToggleScript(key, enabled) {
  const { path, name } = splitTaskKey(key);
  const where = `-TaskPath ${psLiteral(path)} -TaskName ${psLiteral(name)}`;
  return `
$ErrorActionPreference = 'Stop'
$task = Get-ScheduledTask ${where}
${enabled ? 'Enable-ScheduledTask' : 'Disable-ScheduledTask'} -InputObject $task | Out-Null
$state = [string](Get-ScheduledTask ${where}).State
ConvertTo-Json -Compress -InputObject ([PSCustomObject]@{ state = $state })
`;
}

export function buildServiceToggleScript(name, enabled) {
  return `
$ErrorActionPreference = 'Stop'
Set-Service -Name ${psLiteral(name)} -StartupType ${enabled ? 'Automatic' : 'Manual'}
$mode = [string](Get-CimInstance Win32_Service -Filter ("Name='" + ${psLiteral(name)}.Replace("'", "''") + "'")).StartMode
ConvertTo-Json -Compress -InputObject ([PSCustomObject]@{ startMode = $mode })
`;
}

export function servicesOffPath() {
  return join(dirname(settingsPath()), 'startup-services-off.json');
}

/** Short names of the services Prune switched off, oldest first. */
export function readServicesSwitchedOff() {
  try {
    const list = JSON.parse(readFileSync(servicesOffPath(), 'utf8'));
    return Array.isArray(list) ? list.filter((name) => typeof name === 'string' && name !== '') : [];
  } catch {
    return [];
  }
}

function recordService(name, switchedOff) {
  const current = readServicesSwitchedOff().filter((known) => known.toLowerCase() !== String(name).toLowerCase());
  const next = switchedOff ? [...current, name] : current;
  mkdirSync(dirname(servicesOffPath()), { recursive: true });
  writeFileSync(servicesOffPath(), JSON.stringify(next));
}

const ACCESS_DENIED = /access is denied|0x80070005|unauthorized/i;

/** Switches one task or service. Same result contract as setStartupEnabled:
 * { ok: true, enabled } | { ok: false, cancelled: true } | { ok: false, error }.
 *
 * A task tries first without elevation -- one a person's own programs
 * registered for their account can be switched without a consent prompt --
 * and elevates only when Windows refuses. A service always needs it. */
export async function setSystemStartupEnabled(item, enabled, { run = runPowerShellJson, runElevated = runElevatedPowerShellJson } = {}) {
  if (!item?.key || (item.source !== 'task' && item.source !== 'service')) {
    return { ok: false, error: 'Only a scheduled task or a service can be switched here.' };
  }

  if (item.source === 'task') {
    const script = buildTaskToggleScript(item.key, enabled);
    let data;
    try {
      data = await run(script, { timeoutMs: 15000 });
    } catch (err) {
      if (!ACCESS_DENIED.test(err.message)) return { ok: false, error: err.message };
      const elevated = await runElevated(script, { timeoutMs: 60000 });
      if (!elevated.ok) return elevated;
      data = elevated.data;
    }
    const nowEnabled = data?.state ? data.state !== 'Disabled' : null;
    return confirm(nowEnabled, enabled);
  }

  const elevated = await runElevated(buildServiceToggleScript(item.key, enabled), { timeoutMs: 60000 });
  if (!elevated.ok) return elevated;
  const mode = elevated.data?.startMode;
  const result = confirm(mode ? mode === 'Auto' : null, enabled);
  if (result.ok) recordService(item.key, !enabled);
  return result;
}

function confirm(nowEnabled, enabled) {
  if (nowEnabled === null) return { ok: false, error: 'The change was made but its result could not be read back.' };
  if (nowEnabled !== enabled) {
    return { ok: false, error: `Windows still has this entry ${nowEnabled ? 'enabled' : 'disabled'} after the change.` };
  }
  return { ok: true, enabled: nowEnabled };
}
