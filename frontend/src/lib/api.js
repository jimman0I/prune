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

export async function fetchCleanupScan() {
  const res = await fetch(`${API_URL}/cleanup-scan`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

export async function executeCleanupCategories(categoryIds) {
  const res = await fetch(`${API_URL}/cleanup-execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categoryIds })
  });
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
 * (event/data) block format. */
export async function streamUninstall(uninstallString, onEvent) {
  const res = await fetch(`${API_URL}/uninstall`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uninstallString })
  });
  if (!res.ok || !res.body) throw new Error(`Request failed: ${res.status}`);

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
