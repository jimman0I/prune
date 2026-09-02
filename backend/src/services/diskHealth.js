import { runPowerShellJson } from './powershell.js';
import { runElevatedPowerShellJson } from '../lib/elevated.js';

/** Real physical-disk health, via the same PowerShell chokepoint every
 * other backend service uses. Two tiers, because Windows splits this data
 * across two permission levels:
 *
 *   - Get-PhysicalDisk works unelevated: model, media type, bus type,
 *     capacity, and Windows' own HealthStatus/OperationalStatus verdict.
 *   - Get-StorageReliabilityCounter is ADMIN-ONLY: wear, temperature,
 *     power-on hours, uncorrected error counts. Confirmed live on this
 *     machine unelevated: "Access to a CIM resource was not available to
 *     the client." Legacy ATA SMART via MSStorageDriver_FailurePredictStatus
 *     is not a fallback either -- NVMe drives answer "Not supported".
 *
 * So the reliability half is wrapped in its own try/catch INSIDE the
 * script: an unelevated run still returns full disk identity plus
 * Windows' health verdict, with every counter null and
 * reliabilityAvailable false, instead of failing the whole query.
 *
 * `lifeRemainingPercent` is only ever derived from a real wear reading.
 * When wear is unreadable it stays null and the UI shows the real
 * HealthStatus instead -- same "honest unavailable over a fabricated
 * number" rule diskSpace.js's own getSystemDriveSpace() already follows.
 * An SSD life gauge is exactly the wrong place to invent a figure. */
/** One query, run two ways -- unelevated by getDiskHealth() and through a
 * UAC prompt by getElevatedDiskHealth(). Identical either way: the only
 * difference is whether Get-StorageReliabilityCounter is allowed to
 * answer, which is precisely what the inner try/catch absorbs. */
const DISK_QUERY = `
  $disks = Get-PhysicalDisk | ForEach-Object {
    $d = $_
    $rc = $null
    try { $rc = $d | Get-StorageReliabilityCounter -ErrorAction Stop } catch { }
    [PSCustomObject]@{
      deviceId = $d.DeviceId
      model = $d.FriendlyName
      mediaType = [string]$d.MediaType
      busType = [string]$d.BusType
      sizeBytes = $d.Size
      healthStatus = [string]$d.HealthStatus
      operationalStatus = [string]$d.OperationalStatus
      wearPercent = if ($rc) { $rc.Wear } else { $null }
      temperatureC = if ($rc) { $rc.Temperature } else { $null }
      powerOnHours = if ($rc) { $rc.PowerOnHours } else { $null }
      readErrorsUncorrected = if ($rc) { $rc.ReadErrorsUncorrected } else { $null }
      writeErrorsUncorrected = if ($rc) { $rc.WriteErrorsUncorrected } else { $null }
      reliabilityAvailable = ($rc -ne $null)
    }
  }
  ConvertTo-Json -InputObject @($disks) -Compress -Depth 3
`;

export async function getDiskHealth() {
  let raw;
  try {
    raw = await runPowerShellJson(DISK_QUERY);
  } catch {
    return null; // PowerShell itself unavailable -- honest "unknown", not a guess
  }
  return normalizeDisks(raw);
}

function normalizeDisks(raw) {
  if (!raw) return null;

  // Real gotcha, confirmed live: `@($disks) | ConvertTo-Json` PIPED emits a
  // bare object for a one-disk machine and an array for several, so the
  // shape silently changes with the hardware it runs on. DISK_QUERY avoids
  // it with -InputObject, but normalizing here too means a single-disk
  // laptop can never crash this code path.
  const list = Array.isArray(raw) ? raw : [raw];

  const disks = list.map((d) => ({
    deviceId: d.deviceId ?? null,
    model: d.model ?? null,
    mediaType: d.mediaType || null,
    busType: d.busType || null,
    sizeBytes: d.sizeBytes ?? null,
    healthStatus: d.healthStatus || null,
    operationalStatus: d.operationalStatus || null,
    wearPercent: numberOrNull(d.wearPercent),
    lifeRemainingPercent: lifeRemainingFrom(d.wearPercent),
    temperatureC: numberOrNull(d.temperatureC),
    powerOnHours: numberOrNull(d.powerOnHours),
    readErrorsUncorrected: numberOrNull(d.readErrorsUncorrected),
    writeErrorsUncorrected: numberOrNull(d.writeErrorsUncorrected),
    reliabilityAvailable: Boolean(d.reliabilityAvailable)
  }));

  return {
    disks,
    // Any disk reporting wear counts -- a machine can mix an NVMe that
    // answers with an external drive that doesn't.
    reliabilityAvailable: disks.some((d) => d.reliabilityAvailable)
  };
}

/** The same query, run through one UAC prompt so the reliability counters
 * are actually readable. Only ever called from an explicit user action --
 * see runElevatedPowerShellJson's own note on why that matters.
 *
 * Returns the same shape as getDiskHealth() on success, so the frontend
 * swaps one result for the other with no special-casing, plus the two
 * ordinary non-success outcomes: the user declined the prompt, or the
 * drive genuinely doesn't expose wear even to an administrator (real
 * possibility -- plenty of consumer NVMe firmware doesn't implement the
 * counters Windows asks for). */
export async function getElevatedDiskHealth() {
  const result = await runElevatedPowerShellJson(DISK_QUERY);
  if (!result.ok) {
    if (result.cancelled) return { cancelled: true };
    return { error: result.error };
  }
  const normalized = normalizeDisks(result.data);
  if (!normalized) return { error: 'The elevated query returned no disks.' };
  return normalized;
}

function numberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** 100 - wear, clamped to 0..100. A drive past its rated endurance can
 * report wear above 100 (NVMe "Percentage Used" is explicitly allowed to
 * exceed 100 by the spec); "-40% life remaining" is not a thing to show
 * anyone, so that floors at 0. */
function lifeRemainingFrom(wearPercent) {
  const wear = numberOrNull(wearPercent);
  if (wear === null) return null;
  return Math.max(0, Math.min(100, Math.round(100 - wear)));
}
