/** The program sources the uninstall registry does not cover: Chocolatey
 * packages, program folders nothing registered claims, Windows' optional
 * features and installed Windows updates. Their own file so api.js, which
 * every screen imports, does not grow with them. */
const API_URL = 'http://127.0.0.1:3101/api';

async function getJson(path) {
  const res = await fetch(`${API_URL}${path}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

/** Chocolatey packages with no Add/Remove entry of their own (`apps`,
 * shaped like programs, source: 'chocolatey'), and `managed`: { programId:
 * packageId } for the listed programs a package installed. */
export async function fetchChocolatey() {
  const data = await getJson('/programs/chocolatey');
  return { apps: data.apps ?? [], managed: data.managed ?? {} };
}

/** Program folders nothing registered claims, source: 'unregistered'. */
export async function fetchUnregisteredPrograms() {
  return (await getJson('/programs/unregistered')).apps ?? [];
}

/** Windows' optional features that are on, source: 'feature'. */
export async function fetchWindowsFeatures() {
  return (await getJson('/programs/windows-features')).features ?? [];
}

/** Installed Windows updates, source: 'update'. */
export async function fetchWindowsUpdates() {
  return (await getJson('/programs/windows-updates')).updates ?? [];
}

async function postRemoval(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

/** The three removals answer { ok: true, restartNeeded? },
 * { ok: false, cancelled: true } when the UAC prompt was declined, or
 * { ok: false, needsConsent: true, reason } when no restore point could be
 * made and nothing changed. A refusal or failure throws. */
export function removeChocolateyPackage(id) {
  return postRemoval('/programs/chocolatey/remove', { id });
}

export function disableWindowsFeature(name, { allowWithoutRestorePoint = false } = {}) {
  return postRemoval('/programs/windows-features/disable', { name, allowWithoutRestorePoint });
}

export function uninstallWindowsUpdate(kb, { allowWithoutRestorePoint = false } = {}) {
  return postRemoval('/programs/windows-updates/uninstall', { kb, allowWithoutRestorePoint });
}

/** One removal for any row this file's sources produce. A program a
 * Chocolatey package installed carries `chocolateyId` and goes the same way
 * as a package row. */
export function removeSourceItem(item, options) {
  if (item.source === 'feature') return disableWindowsFeature(item.featureName, options);
  if (item.source === 'update') return uninstallWindowsUpdate(`KB${item.kb}`, options);
  return removeChocolateyPackage(item.chocolateyId);
}
