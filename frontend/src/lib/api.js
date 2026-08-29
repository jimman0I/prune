const API_URL = 'http://127.0.0.1:3101/api';

export async function fetchPrograms() {
  const response = await fetch(`${API_URL}/programs`);
  if (!response.ok) throw new Error('Failed to fetch programs');
  return response.json();
}

export async function scanForLeftovers(name, publisher) {
  const response = await fetch(`${API_URL}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, publisher }),
  });
  if (!response.ok) throw new Error('Failed to scan for leftovers');
  return response.json();
}

export async function removeQuarantined({ programName, files, registryKeys }) {
  const response = await fetch(`${API_URL}/quarantine/remove`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ programName, files, registryKeys }),
  });
  if (!response.ok) throw new Error('Failed to remove quarantined items');
  return response.json();
}

export async function fetchQuarantineBatches() {
  const response = await fetch(`${API_URL}/quarantine/batches`);
  if (!response.ok) throw new Error('Failed to fetch quarantine batches');
  return response.json();
}

export async function restoreQuarantineBatch(batchDirName) {
  const response = await fetch(`${API_URL}/quarantine/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ batchDirName }),
  });
  if (!response.ok) throw new Error('Failed to restore quarantine batch');
  return response.json();
}

export function parseSSELine(line) {
  if (!line || line.startsWith(':')) return null;
  const [field, ...rest] = line.split(':');
  const value = rest.join(':').trimStart();
  if (field === 'data') {
    try {
      return JSON.parse(value);
    } catch {
      return value || null;
    }
  }
  return null;
}

export function streamUninstall(uninstallString, onEvent) {
  const eventSource = new EventSource(`${API_URL}/uninstall/stream?cmd=${encodeURIComponent(uninstallString)}`);
  eventSource.onmessage = (e) => {
    const parsed = parseSSELine(e.data);
    if (parsed) onEvent(parsed);
  };
  eventSource.onerror = () => eventSource.close();
  return () => eventSource.close();
}
