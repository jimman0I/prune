import { isScanTooLarge, SCAN_TOO_LARGE } from './scanTooLarge.js';
const API_URL = 'http://127.0.0.1:3101/api';

export async function fetchPrograms() {
  const res = await fetch(`${API_URL}/programs`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data.programs ?? [];
}

/** Every installed program's real icon, as { programId: dataUri }.
 *
 * A separate call from fetchPrograms on purpose: the backend has to spawn
 * PowerShell and read ~90 executables to build this, and making the
 * program list wait on that would trade a fast list for a prettier one.
 * Fetch it after the rows are on screen and let the icons fill in.
 *
 * A program with no extractable icon is simply absent from the map --
 * 35 of 129 on this machine, mostly MSI redistributables that register
 * no icon at all -- and keeps its lettered tile. */
export async function fetchProgramIcons() {
  const res = await fetch(`${API_URL}/programs/icons`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data.icons ?? {};
}

/** Measured install-folder sizes for the programs whose registry entry
 * records none, as { programId: bytes }.
 *
 * A separate call from fetchPrograms on purpose: the backend walks real
 * install folders to produce this (~13 seconds here), and the list must
 * not wait on it. A program that can't be measured safely is absent and
 * keeps its blank. */
export async function fetchProgramSizes() {
  const res = await fetch(`${API_URL}/programs/sizes`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data.sizes ?? {};
}

/** Versions read off the program's own binary, for the entries whose
 * registry record has none.
 *
 * Separate from fetchPrograms for the same reason the sizes are: the
 * backend has to find the right executable inside each install folder
 * before it can read anything. A program whose binary reports nothing
 * usable is absent and keeps its blank. */
export async function fetchProgramVersions() {
  const res = await fetch(`${API_URL}/programs/versions`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data.versions ?? {};
}

/** Install dates for the entries whose registry record declared none.
 *
 * Read from each uninstall key's own last-write time, which means opening
 * every key in three hives -- quick (~1.6s) but still not something the
 * program list should wait behind. */
export async function fetchProgramInstallDates() {
  const res = await fetch(`${API_URL}/programs/install-dates`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data.installDates ?? {};
}

/** Microsoft Store apps, which the uninstall registry does not list.
 *
 * Separate from fetchPrograms because the backend enumerates and measures
 * 81 package folders to build it (~5s). They arrive shaped like programs,
 * marked with source: 'store'. */
export async function fetchStoreApps() {
  const res = await fetch(`${API_URL}/programs/store`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data.apps ?? [];
}

/** Browser extensions, which no uninstall list mentions.
 *
 * Separate again: they live in browser profile folders rather than the
 * registry, and Prune reads them straight off disk. */
export async function fetchBrowserExtensions() {
  const res = await fetch(`${API_URL}/programs/extensions`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data.extensions ?? [];
}

/** Everything Windows launches at sign-in. */
export async function fetchStartupItems() {
  const res = await fetch(`${API_URL}/programs/startup`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data.items ?? [];
}

/** Icons for the startup entries, as { entryId: dataUri }.
 *
 * A separate call from fetchStartupItems for the same reason the program
 * icons are: the backend resolves shortcuts and opens every executable in
 * the list to build this, and the rows must not wait on it.
 *
 * Never throws. Icons are decoration on a screen whose job is the list,
 * and the lettered tiles are a complete fallback on their own -- a failed
 * extraction must not be the thing that empties the rows. An entry with
 * no icon is simply absent from the map. */
export async function fetchStartupIcons() {
  try {
    const res = await fetch(`${API_URL}/programs/startup/icons`);
    if (!res.ok) return {};
    const data = await res.json();
    return data?.icons || {};
  } catch {
    return {};
  }
}

/** The scheduled run's status: when it next fires, when it last did, and
 * how many windows went by while the machine was off. */
export async function fetchAutomation() {
  const res = await fetch(`${API_URL}/automation`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

/** The lifetime total behind "Prune has freed X since <date>": { freedBytes,
 * since }, where `since` is when the first byte was counted (ms) or null. Kept
 * by the backend, which counts only space that is really back -- never a move
 * into Quarantine. A reply that is not numbers reads as nothing counted. */
export async function fetchStats() {
  const res = await fetch(`${API_URL}/stats`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  const freed = Number(data?.freedBytes);
  const since = Number(data?.since);
  return {
    freedBytes: Number.isFinite(freed) && freed > 0 ? freed : 0,
    since: Number.isFinite(since) && since > 0 ? since : null
  };
}

/** The local drives that are short of room: { percent, drives: [{ drive, label,
 * freeBytes, totalBytes, percentFree }] }. The share is the backend's, read from
 * Settings (0 is Off, and answers with no drives). */
export async function fetchLowDisk() {
  const res = await fetch(`${API_URL}/low-disk`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return { percent: Number(data?.percent) || 0, drives: Array.isArray(data?.drives) ? data.drives : [] };
}

/** Catches up a run that is due. Deliberately not "run now": a button
 * that ignored the schedule would be a second, hidden way to clean, and
 * the Deep Clean screen already exists for that. */
export async function checkAutomation() {
  const res = await fetch(`${API_URL}/automation/check`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

/** Duplicate files under one folder.
 *
 * Takes the signal useQuery provides, so leaving the screen or pressing
 * Stop closes the connection -- and the route watches for that, which is
 * what actually halts the hashing rather than abandoning its result. */
export async function fetchDuplicates(path, signal) {
  const res = await fetch(`${API_URL}/duplicates?path=${encodeURIComponent(path)}`, { signal });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

/** Moves one path from the Disk Map into quarantine.
 *
 * Never throws, and a refusal is not an error. The guard returns a REASON
 * -- "That is Windows itself" -- and the screen has to be able to say it;
 * collapsing that into a thrown exception would lose the one piece of
 * information worth showing. */
export async function quarantineDiskPath(path, reportedSizeBytes) {
  try {
    const res = await fetch(`${API_URL}/quarantine/path`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, reportedSizeBytes })
    });
    const data = await res.json().catch(() => null);
    if (!data) return { ok: false, error: `The removal failed (${res.status}).` };
    return data;
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/** Switches one startup entry on or off.
 *
 * Returns a result instead of throwing, unlike everything else in this
 * file. The two most likely non-successes here are the user declining a
 * UAC prompt and Windows refusing the write, and neither is an exception:
 * one is a decision the user just made and the other is an answer about
 * their machine. Thrown, they would both arrive at the screen as the same
 * red banner, which is how a deliberate "no" ends up looking like a
 * crash. */
export async function setStartupItemEnabled(id, enabled) {
  try {
    const res = await fetch(`${API_URL}/programs/startup/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, enabled })
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      // A 500 from an unhandled throw has no JSON body at all.
      return { ok: false, error: `The change failed (${res.status}).` };
    }

    if (!res.ok) return { ok: false, error: data?.error || `The change failed (${res.status}).` };
    return data;
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/** Opens File Explorer on a folder.
 *
 * Goes through the backend because the renderer cannot reach Electron's
 * shell -- contextIsolation is on, nodeIntegration off, no preload, and
 * that is the right way round. */
export async function revealInExplorer(path) {
  const res = await fetch(`${API_URL}/programs/reveal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

/** Icons for the Store apps and browser extensions.
 *
 * Read from files inside each package rather than extracted from a
 * binary, and merged into the same icon map the registry programs use. */
export async function fetchPackageIcons() {
  const res = await fetch(`${API_URL}/programs/package-icons`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data.icons ?? {};
}

/** Removes one Store app for the current user.
 *
 * Sends only the package name; the backend looks it up in a fresh
 * Get-AppxPackage read and removes what the machine reports, never what
 * this sends. Windows-marked non-removable packages are refused there
 * too, not just hidden here. */
export async function removeStoreApp(packageFullName) {
  const res = await fetch(`${API_URL}/programs/store/remove`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ packageFullName })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

/** Opens Windows' own Installed apps page, for the Store apps Windows
 * will not let Prune remove. */
export async function openInstalledAppsSettings() {
  const res = await fetch(`${API_URL}/programs/apps-settings`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

/** Which programs are running right now.
 *
 * Not cached anywhere -- it is the one answer that is only true at the
 * moment it is asked. */
export async function fetchRunningPrograms() {
  const res = await fetch(`${API_URL}/programs/running`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data.running ?? {};
}

/** Leftover scan. `mode` ('safe' | 'moderate' | 'advanced') and `anchors`
 * (the program's own install location and registry key) are optional: left
 * out, the backend uses the remembered mode and searches by name alone. */
export async function scanForLeftovers(name, publisher, { mode, anchors, programId, traceId } = {}) {
  const res = await fetch(`${API_URL}/leftovers/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name, publisher,
      ...(mode ? { mode } : {}), ...(anchors ? { anchors } : {}), ...(programId ? { programId } : {}),
      // The id of the install monitor's record of this program, when it has one.
      ...(traceId ? { traceId } : {})
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

/** Leftover scan for a program whose own uninstaller can't run -- broken,
 * missing, or never registered. Same scanner the normal uninstall flow
 * uses afterward, plus the program's own Add/Remove Programs entry, which
 * a working uninstaller would have removed itself.
 *
 * Scans only. Removal is removeQuarantined below, the same call the
 * ordinary flow makes. */
export async function scanForcedUninstall({ name, publisher, registryKey, mode, anchors }) {
  const res = await fetch(`${API_URL}/forced-uninstall/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, publisher, registryKey, ...(mode ? { mode } : {}), ...(anchors ? { anchors } : {}) })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

/** The address of the extension's own page in its browser, to copy and paste
 * there. Takes the row id (the backend looks the browser and extension up
 * again) and resolves { ok, browser, address }. Launches nothing: Prune never
 * starts a browser, and cannot remove an extension itself. */
export async function fetchExtensionPageAddress(id) {
  const res = await fetch(`${API_URL}/programs/extensions/page-address`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

/* ------------------------------------------------------------ backups */

async function backupCall(path, options) {
  const res = await fetch(`${API_URL}/backups${path}`, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

/** Registry exports and scheduled-task definitions Prune saved before it
 * changed something with no Recycle Bin, newest first. */
export async function fetchBackups() {
  return (await backupCall('')).backups ?? [];
}
/** Puts one back. Resolves { kind, restored, failed: [...], elevated }. */
export const restoreBackup = (id) => backupCall(`/${encodeURIComponent(id)}/restore`, { method: 'POST' });
export const deleteBackup = (id) => backupCall(`/${encodeURIComponent(id)}`, { method: 'DELETE' });

/* ------------------------------------------------------------- hunter */

/* Finding the window is not an API call from here: the crosshair lives in the
 * desktop app (lib/hunterBridge.js), and its main process asks the backend
 * what is at the drop point. Only what follows a result is fetched here. */

/** Ends the process Hunter named. Never throws for a refusal: resolves
 * { ok: false, error } so the screen can say why. */
export async function endHuntedProcess(pid, exePath) {
  try {
    const res = await fetch(`${API_URL}/hunter/end-process`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pid, exePath })
    });
    return await res.json();
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/* ---------------------------------------------------- install monitor */

async function monitorCall(path, options) {
  const res = await fetch(`${API_URL}/install-monitor${path}`, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

/** Takes the "before" snapshot and starts the installer. Resolves once the
 * installer is running; the snapshot makes that take several seconds. */
export function startInstallMonitor(installerPath) {
  return monitorCall('/start', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ installerPath })
  });
}
/** Where the monitor is: { state: 'idle' | 'installing' | 'exited' | 'analyzing' | 'done' | 'failed', ... }. */
export const fetchInstallMonitor = () => monitorCall('/session');
/** "Done installing". Answers at once; poll fetchInstallMonitor for the result. */
export const finishInstallMonitor = () => monitorCall('/session/finish', { method: 'POST' });
export const cancelInstallMonitor = () => monitorCall('/session/cancel', { method: 'POST' });

export async function fetchInstallTraces() {
  const data = await monitorCall('/traces');
  return data.traces ?? [];
}
export const deleteInstallTrace = (id) => monitorCall(`/traces/${encodeURIComponent(id)}`, { method: 'DELETE' });

/** Shows a native dialog ('folder' or 'installer') and resolves { path },
 * where path is null if it was cancelled. The dialog is the backend's, not
 * the window's: the renderer has no file API. */
export async function pickPath(kind) {
  const res = await fetch(`${API_URL}/picker/${encodeURIComponent(kind)}`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

export async function removeQuarantined({ programName, files, registryKeys, scheduledTasks, destination }) {
  const res = await fetch(`${API_URL}/quarantine/remove`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Only when the dialog chose one. The backend reads its absence as
    // Quarantine, which is what every caller before this meant. Scheduled
    // tasks ({ name, path } pairs) likewise only when some were ticked.
    body: JSON.stringify({
      programName, files, registryKeys,
      ...(scheduledTasks?.length ? { scheduledTasks } : {}),
      ...(destination ? { destination } : {})
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

/** The quarantine, and what it adds up to.
 *
 * Returns the whole payload rather than just the batches. The totals and
 * the cap come from the backend because they are computed by the same
 * code that enforces the cap -- a second implementation here could
 * disagree with it about what an unmeasured batch is worth, and then the
 * figure above the list would not be the figure the purge acts on. */
export async function fetchQuarantineBatches() {
  const res = await fetch(`${API_URL}/quarantine`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return {
    batches: data.batches ?? [],
    totalBytes: data.totalBytes ?? 0,
    batchCount: data.batchCount ?? (data.batches?.length ?? 0),
    unknownSizeCount: data.unknownSizeCount ?? 0,
    exact: data.exact !== false,
    maxBytes: data.maxBytes ?? null
  };
}

export async function restoreQuarantineBatch(batchDirName) {
  const res = await fetch(`${API_URL}/quarantine/${encodeURIComponent(batchDirName)}/restore`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

export async function deleteQuarantineBatch(batchDirName) {
  const res = await fetch(`${API_URL}/quarantine/${encodeURIComponent(batchDirName)}`, { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

export async function emptyQuarantine() {
  const res = await fetch(`${API_URL}/quarantine/empty`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

export async function fetchSettings() {
  const res = await fetch(`${API_URL}/settings`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

export async function updateSettings(partial) {
  const res = await fetch(`${API_URL}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(partial)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

/** "Always run as administrator" (Settings, General): the flag Windows itself
 * honours for this copy of Prune, read from the registry by the backend.
 * { supported, enabled, elevatedNow, startsWithWindows } -- see
 * backend/src/services/runAsAdmin.js. */
export async function fetchRunAsAdmin() {
  const res = await fetch(`${API_URL}/settings/run-as-admin`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

/** Sets or clears that flag; resolves the new state. It takes effect from the
 * next start of Prune, and the backend refuses it in a development build. */
export async function setRunAsAdmin(enabled) {
  const res = await fetch(`${API_URL}/settings/run-as-admin`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}
/** The running version, and -- only when the user has turned the update
 * check on -- whether GitHub has a newer release. With the setting off the
 * backend answers from this machine alone. */
export async function fetchUpdateCheck() {
  const res = await fetch(`${API_URL}/update-check`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

/** Opens the newer release's page in the browser. Sends no address: the
 * backend opens the page its own last check found, and nothing else. */
export async function openUpdatePage() {
  const res = await fetch(`${API_URL}/update-check/open`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

/** What a bug report will say about this machine: Prune's version,
 * Windows' version and the architecture. The dialog lists these so the user
 * sees exactly what goes along with their text. */
export async function fetchBugReportInfo() {
  const res = await fetch(`${API_URL}/bug-report/info`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

/** Opens a prefilled GitHub issue in the browser. Sends the user's title
 * and description, this session's last known Applications count (if any
 * -- see lib/lastProgramsCount.js) and no address: the backend builds the
 * URL itself. */
export async function openBugReport({ title, description, programsFound }) {
  const res = await fetch(`${API_URL}/bug-report/open`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description, programsFound })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

export async function runSandboxTest() {
  const res = await fetch(`${API_URL}/sandbox-test`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

/** The deep-clean scan, streamed a rule at a time.
 *
 * fetchDeepCleanScan below takes ~19 seconds and returns nothing until
 * it is completely finished, which on screen is indistinguishable from
 * being stuck. This calls `onEvent(type, data)` as each rule's real size
 * comes back, so the tree can fill in while the scan is still running.
 *
 * `signal` aborts it. The server watches for the disconnect and stops
 * walking the filesystem, so this is a real cancel rather than just
 * ignoring the rest of the answer.
 *
 * Events: 'start' { total }, 'rule' (one scanned rule), 'done'
 * { aborted, total, scanned }, 'error' { message }. */
export async function streamDeepCleanScan(onEvent, signal) {
  await streamSSE(`${API_URL}/deep-clean/scan/stream`, onEvent, signal);
}

/** The clean itself, streamed a rule at a time -- BleachBit's own "Delete
 * ... Vacuum ..." output, moved to the step that actually does either.
 *
 * executeDeepClean below is a single POST that returns nothing until
 * every selected rule has been quarantined or deleted, which for a large
 * batch is the scan's old silence problem again, just moved to the step
 * that touches the disk. `ruleIds` travels as a query string because
 * this is a GET, same reason streamDeepCleanScan is: the reader below is
 * a plain fetch of an SSE body, not EventSource, but the backend route it
 * calls only ever accepts GET, matching /scan/stream.
 *
 * Events: 'start' { total }, 'rule' (one cleaned rule, carrying its own
 * name/category), 'done' { aborted, total, executed, freedBytes,
 * results }, 'error' { message }. */
export async function streamDeepCleanExecute(ruleIds, onEvent, signal) {
  const ids = ruleIds.map(encodeURIComponent).join(',');
  await streamSSE(`${API_URL}/deep-clean/execute/stream?ids=${ids}`, onEvent, signal);
}

/** Reads a Server-Sent-Events response body, calling `onEvent(type, data)`
 * as each event arrives rather than waiting for the whole response.
 *
 * Shared by both Deep Clean streams above: same line-buffered parsing
 * (a chunk boundary lands mid-event often enough that parsing whatever
 * arrived would drop rules at random), same signal-driven cancellation. */
async function streamSSE(url, onEvent, signal, init = {}) {
  const res = await fetch(url, { ...init, signal });
  if (!res.ok || !res.body) {
    // A refused POST carries its reason as JSON; a dropped stream has none.
    const detail = await res.json?.().then((d) => d?.error).catch(() => null);
    throw new Error(detail || `Request failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let currentEvent = 'message';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    let sep;
    while ((sep = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, sep);
      buf = buf.slice(sep + 1);
      const parsed = parseSSELine(line);
      if (!parsed) continue;
      if (parsed.field === 'event') currentEvent = parsed.value;
      else if (parsed.field === 'data') onEvent(currentEvent, JSON.parse(parsed.value));
    }
  }
}

/** What shredding these paths would destroy, counted without touching
 * anything: { files, bytes, refused: [{path, reason}], refusedCount,
 * truncated }. The confirmation step shows it before anything is shredded. */
export async function previewShred(paths) {
  const res = await fetch(`${API_URL}/shred/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paths })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

/** Shreds the paths, streaming progress. `passes` is 1 or 3. The request
 * always says `confirmed: true` -- this is only ever called after the
 * confirmation step, and the backend refuses anything without it.
 *
 * Events: 'start' { passes }, 'progress' { filesDone, bytesDone,
 * currentPath }, 'done' { shreddedFiles, bytes, aborted, failed, held,
 * failedCount, heldCount }, 'error' { message }. */
export async function streamShred(paths, passes, onEvent, signal) {
  await streamSSE(`${API_URL}/shred`, onEvent, signal, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paths, passes, confirmed: true })
  });
}

/** Reads a JSON reply, and on failure throws an Error that also carries the
 * server's machine-readable `reason` / `code`, so the screen can answer in
 * the person's language instead of showing English from the backend. */
async function jsonOrThrow(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || `Request failed: ${res.status}`);
    if (data.reason) error.reason = data.reason;
    // 413: the body was bigger than the server will read at all.
    if (data.code) error.code = data.code; else if (res.status === 413) error.code = 'tooLarge';
    throw error;
  }
  return data;
}

/** The user's Custom locations and their imported BleachBit cleaners:
 * { locations: [path], imported: [{id, label, source, importedAt,
 * ruleCount, report}] }. */
export async function fetchCustomCleaners() {
  return jsonOrThrow(await fetch(`${API_URL}/custom-cleaners`));
}

/** Adds a Custom location. Refused ones throw with `.reason` (empty |
 * relative | climb | protected | wildcard | long). */
export async function addCustomLocation(path) {
  return jsonOrThrow(await fetch(`${API_URL}/custom-cleaners/locations`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path })
  }));
}

export async function removeCustomLocation(path) {
  return jsonOrThrow(await fetch(`${API_URL}/custom-cleaners/locations/remove`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path })
  }));
}

/** Imports a BleachBit cleaner file. `text` is the file's contents, sent as
 * plain text (it can be bigger than the JSON body limit). Resolves
 * { imported, cleaner, report }; a refused file throws with `.code`. */
export async function importCleaner(name, text) {
  return jsonOrThrow(await fetch(`${API_URL}/custom-cleaners/import?name=${encodeURIComponent(name)}`, {
    method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: text
  }));
}

export async function removeImportedCleaner(id) {
  return jsonOrThrow(await fetch(`${API_URL}/custom-cleaners/imported/${encodeURIComponent(id)}`, { method: 'DELETE' }));
}

/** The rule list, grouped, with no sizes.
 *
 * Reads a JSON file and touches no disk, so it comes back in a few tens
 * of milliseconds. That is what lets Deep Clean show its tree the moment
 * the tab opens instead of an empty panel, with the half-minute
 * measurement filling the sizes in afterwards. */
export async function fetchDeepCleanRules() {
  const res = await fetch(`${API_URL}/deep-clean/rules`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data.categories ?? [];
}

/** What a free-space wipe would do on this machine -- the drive, how much it
 * would write and a time estimate from a real ~1 second write test -- for
 * the confirm dialog. Not called until that dialog opens. */
export async function fetchWipeEstimate({ drive, passes } = {}) {
  const params = new URLSearchParams();
  if (drive) params.set('drive', drive);
  if (passes) params.set('passes', String(passes));
  const query = params.toString();
  const res = await fetch(`${API_URL}/deep-clean/wipe-estimate${query ? `?${query}` : ''}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

/** The local fixed drives the wipe can be pointed at, plus the profile drive
 * it uses when none is chosen: { drives: [{drive, label, totalBytes,
 * freeBytes}], profileDrive }. */
export async function fetchWipeDrives() {
  const res = await fetch(`${API_URL}/deep-clean/wipe-drives`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

/** The icon for each Deep Clean category, as { category: dataUri }.
 *
 * Never throws, for the same reason the startup icons don't: these are
 * decoration on a list whose job is the rules, and every heading has a
 * lettered tile to fall back to. A category with no icon is simply absent
 * from the map. */
export async function fetchCleanerCategoryIcons() {
  try {
    const res = await fetch(`${API_URL}/deep-clean/category-icons`);
    if (!res.ok) return {};
    const data = await res.json();
    return data?.icons ?? {};
  } catch {
    return {};
  }
}

export async function fetchDeepCleanScan() {
  const res = await fetch(`${API_URL}/deep-clean/scan`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data.categories ?? [];
}

/** Every real cookie domain found on this machine, with how many cookies
 * each has. Throws on failure (unlike fetchCleanerCategoryIcons, which
 * swallows errors because icons are decoration) -- this is the result of
 * an explicit user click, and a scan that silently returned nothing would
 * look identical to "this machine truly has no cookies anywhere", which
 * is never true. */
export async function fetchCookieDomains() {
  const res = await fetch(`${API_URL}/deep-clean/cookie-domains`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return { domains: data.domains ?? [], errors: data.errors ?? [] };
}

export async function executeDeepClean(ruleIds) {
  const res = await fetch(`${API_URL}/deep-clean/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ruleIds })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

/** The same clean, run elevated -- for the rules a scan already marked
 * `accessible: false` (a folder Windows won't list without
 * administrator). Raises a real UAC prompt every call; only ever reached
 * from a button the user pressed after seeing which rules it covers.
 * Returns the discriminated { ok, data } / { ok:false, cancelled } /
 * { ok:false, error } shape elevated.js's callers all use -- a declined
 * prompt is a normal outcome, not a thrown error, so this never throws
 * on `cancelled`. */
export async function executeDeepCleanElevated(ruleIds) {
  const res = await fetch(`${API_URL}/deep-clean/execute-elevated`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ruleIds })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

export async function fetchDiskHealth() {
  const res = await fetch(`${API_URL}/disk-health`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

/** Raises a real UAC prompt on the user's machine, so it must only ever be
 * called from an explicit click -- never a mount effect or a refresh. */
export async function unlockDiskWear() {
  const res = await fetch(`${API_URL}/disk-health/elevated`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

/** Windows' own icons for the given file extensions, plus the folder and
 * generic-file icons, as { key: dataUri }.
 *
 * Keys are the extension itself (".mp4"), or "folder" / "file". Anything
 * the shell can't resolve is simply absent and the caller keeps drawing
 * its plain coloured cell. */
export async function fetchFileTypeIcons(extensions) {
  const res = await fetch(`${API_URL}/file-icons`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ extensions })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data.icons ?? {};
}

export async function fetchDiskSpace() {
  const res = await fetch(`${API_URL}/disk-space`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

// `signal` (optional AbortSignal) lets a caller actually cancel the
// underlying HTTP request -- e.g. DiskMap.jsx aborts on unmount/path
// change, so navigating away from a huge in-flight scan really does stop
// it server-side (backend/src/routes/diskScan.js listens for the request
// closing early), instead of leaving it running to completion unheard.
/** Whole-drive scan read straight from the NTFS Master File Table.
 *
 * Raises a UAC prompt -- Windows won't open a raw volume handle for an
 * unelevated process, which is why WizTree asks for administrator too. So
 * this must only ever be called from a button the user pressed, never a
 * background refresh: a consent dialog nobody asked for is how software
 * teaches people to approve them without reading.
 *
 * A declined prompt resolves to { cancelled: true } rather than throwing.
 * The user answered the question; the answer was no. */
export async function scanDriveFast(driveLetters = ['C']) {
  // Every drive in ONE request: the backend hands them to a single helper,
  // so choosing C: and D: is one consent prompt rather than two.
  const letters = Array.isArray(driveLetters) ? driveLetters : [driveLetters];
  const res = await fetch(`${API_URL}/mft-scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ driveLetters: letters })
  });
  let data;
  try {
    data = await res.json();
  } catch (err) {
    // A reply too big to read as text raises a RangeError ("Invalid string
    // length"); the Disk Map words that as what it is (isScanTooLarge).
    if (isScanTooLarge(err)) throw Object.assign(new Error(err.message), { code: SCAN_TOO_LARGE });
    throw err;
  }
  if (!res.ok) throw Object.assign(new Error(data.error || `Request failed: ${res.status}`), data.code ? { code: data.code } : {});
  return data;
}

/** Whether the fast scan can run without a prompt, i.e. whether Prune itself
 * was started as administrator: { elevated: boolean }. */
export async function fetchMftStatus() {
  const res = await fetch(`${API_URL}/mft-scan/status`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

/* ---- saved Disk Map scans (backend/src/routes/savedScans.js) ----------- */

async function savedScansRequest(path, options) {
  const res = await fetch(`${API_URL}/saved-scans${path}`, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

/** What the list shows, newest first. */
export async function fetchSavedScans() {
  return (await savedScansRequest('')).scans ?? [];
}

/** Saves a compact archive (lib/compactTree.js); resolves to its list entry. */
export async function saveDiskScan({ label, source, truncated, archive }) {
  const data = await savedScansRequest('', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label, source, truncated, archive })
  });
  return data.scan;
}

/** { scan, archive } for one saved scan. */
export async function loadSavedScan(id) {
  return savedScansRequest(`/${encodeURIComponent(id)}`);
}

export async function deleteSavedScan(id) {
  await savedScansRequest(`/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** Which folders changed between two saved scans. */
export async function compareSavedScans(a, b, limit = 25) {
  return savedScansRequest(`/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}&limit=${limit}`);
}

/** The automatic scans -- the latest two of each drive, saved when a Disk Map
 * scan finishes -- newest first: { scans, count, bytes }. */
export async function fetchAutoScans(drive) {
  return savedScansRequest(drive ? `/auto?drive=${encodeURIComponent(drive)}` : '/auto');
}

/** Saves a finished scan of one drive as its automatic scan. Resolves to the
 * list entry, or null when Settings says not to remember scans. */
export async function saveAutoDiskScan({ drive, label, source, truncated, capacityBytes, archive }) {
  const data = await savedScansRequest('/auto', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ drive, label, source, truncated, capacityBytes, archive })
  });
  return data.scan ?? null;
}

/** Removes every automatic scan (never the ones saved by hand). Resolves to how many. */
export async function deleteAutoScans() {
  return (await savedScansRequest('/auto', { method: 'DELETE' })).deleted ?? 0;
}

/** The local drives the Disk Map can scan, and which one holds Windows:
 * { systemDrive: 'C', drives: [{ letter, label, fileSystem, totalBytes,
 * freeBytes, removable, system, ntfs }] }. */
export async function fetchDrives() {
  const res = await fetch(`${API_URL}/drives`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

/** Scans a folder for the disk map. With `onProgress`, the scan streams over
 * SSE and every `progress` / `complete` payload is forwarded as it arrives;
 * the finished tree is then fetched by the id the `complete` event carries.
 * Without it this is the original single request, unchanged. */
export async function fetchDiskScan(path, signal, { onProgress } = {}) {
  if (typeof onProgress === 'function') return fetchDiskScanStreamed(path, signal, onProgress);
  const res = await fetch(`${API_URL}/disk-scan?path=${encodeURIComponent(path)}`, { signal });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

/** Asks the backend to stop a running streamed scan. The stream itself then
 * ends normally with the partial tree (flagged truncated), so the caller
 * does nothing else: it just keeps waiting for fetchDiskScan to resolve.
 * `scanId` comes from the stream's `start` event. Resolves false, never
 * throws, when the scan was already over -- stopping something that has
 * finished is not an error worth showing. */
export async function stopDiskScan(scanId) {
  try {
    const res = await fetch(`${API_URL}/disk-scan/stop/${encodeURIComponent(scanId)}`, { method: 'POST' });
    return res.ok;
  } catch {
    return false;
  }
}

async function fetchDiskScanStreamed(path, signal, onProgress) {
  let done = null;
  let failure = null;
  await streamSSE(`${API_URL}/disk-scan/stream?path=${encodeURIComponent(path)}`, (type, data) => {
    if (type === 'progress' || type === 'start') onProgress(data);
    else if (type === 'complete') { done = data; onProgress(data); }
    else if (type === 'error') failure = data?.message || 'Scan failed';
  }, signal);

  if (failure) throw new Error(failure);
  if (!done) throw new Error('The scan ended before it finished');

  const res = await fetch(`${API_URL}/disk-scan/result/${encodeURIComponent(done.resultId)}`, { signal });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

/** The five latest entries (the Dashboard), or every one with { all: true }
 * (the History view). */
export async function fetchUninstallHistory({ all = false } = {}) {
  const res = await fetch(`${API_URL}/uninstall-history${all ? '?all=1' : ''}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data.entries ?? [];
}

/** Writes one history entry. Takes whatever the entry knows -- the backend
 * keeps only the fields it recognises -- and resolves { ok, id }, or
 * { ok, skipped } when the history is turned off. */
export async function appendHistoryEntry(fields) {
  const res = await fetch(`${API_URL}/uninstall-history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

/** Adds what became known after the entry was written (how the leftover
 * review went). */
export async function updateHistoryEntry(id, fields) {
  const res = await fetch(`${API_URL}/uninstall-history/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

/** Deletes the whole history. */
export async function clearUninstallHistory() {
  const res = await fetch(`${API_URL}/uninstall-history`, { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

/** One line of an SSE block. `field` is 'event' or 'data'; anything else
 * (including a blank line, the block separator) is not a recognized
 * field and returns null. The SSE spec strips exactly one leading space
 * after the colon, not all leading whitespace. Exported for testing. */
export function parseSSELine(line) {
  const match = line.match(/^(event|data): ?(.*)$/);
  if (!match) return null;
  return { field: match[1], value: match[2] };
}

/** Streams POST /api/uninstall, calling onEvent(type, data) for each SSE
 * block as it arrives. Mirrors Re:Route's own SSE parsing shape (this
 * project's sibling app), adapted to this project's simpler two-field
 * (event/data) block format.
 *
 * Takes a program id, not an uninstall command. The command is read out
 * of the uninstall registry by the backend, which will not run a string
 * a client sent it -- see routes/uninstall.js. */
export async function streamUninstall(programId, onEvent) {
  const res = await fetch(`${API_URL}/uninstall`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ programId })
  });
  // A refusal arrives as JSON with a real status, before any stream
  // starts, and its sentence is written to be shown to a person -- "Thing
  // is no longer in the uninstall registry" says what happened, where
  // "Request failed: 404" says only that this app is confused. Parsed
  // only on the failure path: on success the body is the stream.
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  if (!res.body) throw new Error(`Request failed: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let currentEvent = 'message';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    let sep;
    while ((sep = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, sep);
      buf = buf.slice(sep + 1);
      const parsed = parseSSELine(line);
      if (!parsed) continue;
      if (parsed.field === 'event') currentEvent = parsed.value;
      else if (parsed.field === 'data') {
        const data = JSON.parse(parsed.value);
        // The backend ends a stream with "error" when the uninstaller could
        // not run, or when a before-uninstall step -- the registry backup
        // the user asked for -- stopped it. Resolving would send the caller
        // on to a leftover scan as if the uninstall had worked; both dialogs
        // pass callbacks that ignore events, so this is where it has to stop.
        if (currentEvent === 'error') {
          await reader.cancel().catch(() => {});
          throw new Error(data?.message || 'The uninstall did not complete.');
        }
        onEvent(currentEvent, data);
      }
    }
  }
}
