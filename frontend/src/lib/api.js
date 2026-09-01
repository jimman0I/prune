const API_URL = 'http://127.0.0.1:3101/api';

export async function fetchPrograms() {
  const res = await fetch(`${API_URL}/programs`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data.programs;
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

export async function fetchDiskSpace() {
  const res = await fetch(`${API_URL}/disk-space`);
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
