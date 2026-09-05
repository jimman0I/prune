const API_URL = 'http://127.0.0.1:3101/api';

export async function fetchPrograms() {
  const res = await fetch(`${API_URL}/programs`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data.programs;
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
  return data.icons;
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
  return data.sizes;
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
  return data.versions;
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
  return data.installDates;
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
  return data.apps;
}

/** Browser extensions, which no uninstall list mentions.
 *
 * Separate again: they live in browser profile folders rather than the
 * registry, and Prune reads them straight off disk. */
export async function fetchBrowserExtensions() {
  const res = await fetch(`${API_URL}/programs/extensions`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data.extensions;
}

/** Everything Windows launches at sign-in. */
export async function fetchStartupItems() {
  const res = await fetch(`${API_URL}/programs/startup`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data.items;
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

/** One reading of CPU, memory and disk throughput.
 *
 * Polled rather than streamed: the reading costs microseconds on the
 * backend and the disk figure is whatever its single background counter
 * last reported, so a request does no work beyond copying three numbers.
 * Asking is also what keeps that counter alive -- it shuts down when the
 * requests stop. */
export async function fetchResources() {
  const res = await fetch(`${API_URL}/resources`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

/** The scheduled run's status: when it next fires, when it last did, and
 * how many windows went by while the machine was off. */
export async function fetchAutomation() {
  const res = await fetch(`${API_URL}/automation`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
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
  return data.icons;
}

/** Opens Windows' own Installed apps page, where Store apps are removed. */
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
  return data.running;
}

export async function scanForLeftovers(name, publisher) {
  const res = await fetch(`${API_URL}/leftovers/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, publisher })
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
export async function scanForcedUninstall({ name, publisher, registryKey }) {
  const res = await fetch(`${API_URL}/forced-uninstall/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, publisher, registryKey })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

export async function removeQuarantined({ programName, files, registryKeys }) {
  const res = await fetch(`${API_URL}/quarantine/remove`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ programName, files, registryKeys })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

export async function fetchQuarantineBatches() {
  const res = await fetch(`${API_URL}/quarantine`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data.batches;
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
  const res = await fetch(`${API_URL}/deep-clean/scan/stream`, { signal });
  if (!res.ok || !res.body) throw new Error(`Request failed: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let currentEvent = 'message';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    // Line-buffered on purpose: a chunk boundary lands mid-event often
    // enough that parsing whatever arrived would drop rules at random.
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
  return data.categories;
}

export async function fetchDeepCleanScan() {
  const res = await fetch(`${API_URL}/deep-clean/scan`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data.categories;
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
  return data.icons;
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
export async function scanDriveFast(driveLetter = 'C') {
  const res = await fetch(`${API_URL}/mft-scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ driveLetter })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

export async function fetchDiskScan(path, signal) {
  const res = await fetch(`${API_URL}/disk-scan?path=${encodeURIComponent(path)}`, { signal });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

export async function fetchUninstallHistory() {
  const res = await fetch(`${API_URL}/uninstall-history`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data.entries;
}

export async function appendHistoryEntry({ programName, publisher, sizeBytes }) {
  const res = await fetch(`${API_URL}/uninstall-history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ programName, publisher, sizeBytes })
  });
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
      else if (parsed.field === 'data') onEvent(currentEvent, JSON.parse(parsed.value));
    }
  }
}
