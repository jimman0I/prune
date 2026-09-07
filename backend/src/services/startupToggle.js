import { runPowerShellJson } from './powershell.js';
import { runElevatedPowerShellJson } from '../lib/elevated.js';
import { approvedKindFor } from './startupApproved.js';

/** Switching a startup entry on and off, the way Windows does it.
 *
 * Revo's Autorun Manager has a checkbox per row, and it is the thing the
 * screen is for -- a list that can only report is a worse Task Manager.
 * Prune reads the state from StartupApproved already (see
 * startupApproved.js); this writes the same place, so a change made here
 * shows up in Task Manager's Startup tab and in Settings > Startup Apps,
 * and a change made there shows up here.
 *
 * What it deliberately does NOT do is delete the Run value or move the
 * shortcut. That is what "disable" means to Windows: the entry stays
 * exactly where it is and a separate record says not to run it. Removing
 * the entry instead would be a one-way door dressed up as a switch.
 */
const APPROVED_ROOTS = {
  user: 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved',
  machine: 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved'
};

/** Unix epoch to the FILETIME epoch (1601-01-01), in milliseconds. */
const FILETIME_EPOCH_OFFSET_MS = 11644473600000n;

/** Why this entry cannot be switched, or null when it can.
 *
 * A string rather than a boolean because every one of these has to be
 * shown to somebody: a control that is simply inert, with no reason
 * given, is the thing this whole screen was criticised for. */
export function toggleRefusal(item) {
  if (!item) return 'There is no entry to switch.';

  // The three sources Prune reads but does not write. Each is switchable
  // somewhere -- Task Scheduler, services.msc, the app's own settings --
  // and none of them through StartupApproved, which is the only thing
  // this module knows how to write. Listing them read-only is honest;
  // offering a switch that silently writes to the wrong place would not
  // be. Checked BEFORE the name check so each gets its own reason rather
  // than a generic one.
  const BY_SOURCE = {
    task: 'This is a scheduled task. Windows keeps its on/off state on the task itself, not with the sign-in entries — change it in Task Scheduler.',
    service: 'This is a Windows service. It starts with the machine rather than at sign-in, and its startup type is changed in Services.',
    appx: 'This is a Store app’s own startup task. It is switched from the app’s settings or from Windows’ Startup Apps page.'
  };
  if (BY_SOURCE[item.source]) return BY_SOURCE[item.source];

  const name = item.approvedName || item.name;
  if (!name) {
    return 'Windows files its decision under the entry name, and this entry has none.';
  }

  if (approvedKindFor(item) === null) {
    // Confirmed against both hives on this machine: StartupApproved holds
    // Run, Run32 and StartupFolder, and nothing else. A RunOnce entry
    // written into the Run subkey would either do nothing or switch off a
    // completely different program that happens to share its name.
    return 'Windows keeps no on/off record for RunOnce entries — they delete themselves after they run, so there is nothing to switch off.';
  }

  return null;
}

/** The registry key holding this entry's on/off state, or null.
 *
 * Two coordinates, and getting either wrong writes a decision that
 * Windows will never read: the hive (a machine entry's state is not in
 * HKCU) and the subkey (a 32-bit Run value's state is not under Run). */
export function approvedKeyPath(item) {
  const kind = approvedKindFor(item);
  if (kind === null) return null;
  const root = APPROVED_ROOTS[item?.rawScope === 'machine' ? 'machine' : 'user'];
  return `${root}\\${kind}`;
}

/** The twelve bytes to write.
 *
 * Byte 0 carries the state in its low bit -- even runs, odd does not --
 * bytes 1 to 3 are zero in every value Windows has written here, and
 * bytes 4 to 11 are a little-endian FILETIME of when the entry was
 * switched off. Enabled values carry eight zeros there instead of a time,
 * which is what Windows itself writes and what every enabled entry on
 * this machine holds.
 *
 * `previous` is whatever is in the registry now, so an unfamiliar state
 * byte survives: 0x06 and 0x07 turn up on some machines beside the usual
 * 0x02 and 0x03, Windows reads only the low bit of either, and replacing
 * a byte we do not fully understand with our own would throw away
 * information for nothing. */
export function toggleBytes(enabled, previous, now = Date.now()) {
  const base = firstByteOf(previous) ?? 0x02;
  const state = enabled ? (base & ~1) & 0xff : (base | 1) & 0xff;

  const stamp = enabled ? [0, 0, 0, 0, 0, 0, 0, 0] : fileTimeBytes(now);
  return [state, 0, 0, 0, ...stamp];
}

/** The state byte of an existing value, or null when there isn't one.
 *
 * Narrower than startupApproved.js's reader on purpose: that one has to
 * cope with every shape PowerShell's JSON has produced for a REG_BINARY,
 * because it is reading a whole machine's worth of them. This one is
 * handed a value the caller just read back through the same path, so an
 * array or nothing are the only shapes that matter, and anything else
 * falls through to the Windows default rather than being guessed at. */
function firstByteOf(previous) {
  if (Array.isArray(previous) && previous.length > 0) {
    const first = Number(previous[0]);
    return Number.isFinite(first) ? first & 0xff : null;
  }
  if (typeof previous === 'number' && Number.isFinite(previous)) return previous & 0xff;
  return null;
}

/** A JavaScript timestamp as the eight little-endian bytes of a FILETIME:
 * 100-nanosecond intervals since 1601-01-01 UTC.
 *
 * BigInt rather than Number because the value passes 2^53 in 1899 and
 * every date anyone will use here is far past that -- in plain doubles
 * the low bytes, which is most of what distinguishes one write from the
 * next, come out as rounding noise. */
function fileTimeBytes(now) {
  let value = (BigInt(Math.floor(now)) + FILETIME_EPOCH_OFFSET_MS) * 10000n;
  const bytes = [];
  for (let i = 0; i < 8; i++) {
    bytes.push(Number(value & 0xffn));
    value >>= 8n;
  }
  return bytes;
}

function psLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** The script that records the decision.
 *
 * Writes and then reads back, so "the write did nothing" and "the write
 * worked" are distinguishable from the caller's side -- with a registry
 * write under a key that may not exist and a hive that may need
 * administrator, they otherwise look identical.
 *
 * -LiteralPath throughout: registry value names and key paths contain
 * brackets often enough (`{GUID}` uninstall keys, product names with
 * [brackets]) that wildcard interpretation would be a live bug rather
 * than a theoretical one. */
export function buildToggleScript(item, enabled, bytes) {
  const key = psLiteral(approvedKeyPath(item));
  const name = psLiteral(item.approvedName || item.name);
  const literal = bytes.join(',');

  return `
$key = ${key}
$name = ${name}
if (-not (Test-Path -LiteralPath $key)) { New-Item -Path $key -Force | Out-Null }
New-ItemProperty -LiteralPath $key -Name $name -Value ([byte[]](${literal})) -PropertyType Binary -Force | Out-Null
$after = @(Get-ItemProperty -LiteralPath $key | ForEach-Object { $_.PSObject.Properties } | Where-Object { $_.Name -eq $name } | Select-Object -First 1 -ExpandProperty Value)
ConvertTo-Json -Compress -InputObject ([PSCustomObject]@{ written = $true; value = @($after) })
`;
}

/** Reads the value currently recorded for one entry, or null.
 *
 * Its own query rather than a field carried through from the list: the
 * list is a second or two old by the time anyone clicks, and the byte
 * this preserves is exactly the kind of thing another program may have
 * changed in between. Reading HKLM needs no elevation -- only writing
 * does -- so this is the same cheap call for both scopes. */
async function readApprovedValue(item) {
  const key = psLiteral(approvedKeyPath(item));
  const name = psLiteral(item.approvedName || item.name);
  const script = `
$key = ${key}
$name = ${name}
$value = $null
if (Test-Path -LiteralPath $key) {
  $value = Get-ItemProperty -LiteralPath $key | ForEach-Object { $_.PSObject.Properties } | Where-Object { $_.Name -eq $name } | Select-Object -First 1 -ExpandProperty Value
}
ConvertTo-Json -Compress -InputObject ([PSCustomObject]@{ value = @($value) })
`;
  try {
    const result = await runPowerShellJson(script, { timeoutMs: 10000 });
    const value = result?.value;
    return Array.isArray(value) && value.length > 0 ? value : null;
  } catch {
    // Not fatal. A missing previous value is the ordinary case anyway --
    // most entries have never been switched off -- and the default state
    // byte is what Windows itself writes for a fresh one.
    return null;
  }
}

/** Switches one startup entry on or off.
 *
 * Returns a discriminated result rather than throwing, matching the
 * elevation helper's own contract, because "the user clicked No on the
 * UAC prompt" is an ordinary outcome of pressing this button and not an
 * error to be reported as one:
 *   { ok: true, enabled }
 *   { ok: false, cancelled: true }
 *   { ok: false, error }
 *
 * Machine-wide entries go through elevation. HKLM is readable by anyone
 * and writable by nobody unelevated, so without this the toggle on an
 * all-users row would fail with an access-denied message the user can do
 * nothing about -- and roughly half the entries on this machine are
 * machine-wide. */
export async function setStartupEnabled(item, enabled, { now = Date.now() } = {}) {
  const refusal = toggleRefusal(item);
  if (refusal) return { ok: false, error: refusal };

  const previous = await readApprovedValue(item);
  const bytes = toggleBytes(enabled, previous, now);
  const script = buildToggleScript(item, enabled, bytes);

  if (item.rawScope === 'machine') {
    const result = await runElevatedPowerShellJson(script, { timeoutMs: 60000 });
    if (!result.ok) return result;
    return confirm(result.data, enabled);
  }

  try {
    return confirm(await runPowerShellJson(script, { timeoutMs: 15000 }), enabled);
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/** Checks the value that came back actually says what was asked for.
 *
 * The write can succeed and still leave the wrong state -- a policy that
 * re-enables an entry, another program writing at the same moment -- and
 * a UI that reports success from the absence of an exception would then
 * show a switch in a position the machine disagrees with. */
function confirm(data, enabled) {
  const value = data?.value;
  const first = Array.isArray(value) && value.length > 0 ? Number(value[0]) : null;
  if (first === null || !Number.isFinite(first)) {
    return { ok: false, error: 'The change was written but could not be read back.' };
  }

  const nowEnabled = (first & 1) === 0;
  if (nowEnabled !== enabled) {
    return {
      ok: false,
      error: `Windows still has this entry ${nowEnabled ? 'enabled' : 'disabled'} after the change.`
    };
  }

  return { ok: true, enabled: nowEnabled };
}
