import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { gzip, gunzip } from 'node:zlib';
import { promisify } from 'node:util';
import { settingsPath } from './settings.js';
import { normalizeArchive } from '../lib/scanArchive.js';
import { compareScans } from '../lib/compareScans.js';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

/** Saved Disk Map scans: a gzipped compact tree per scan (see
 * lib/scanArchive.js) and a tiny sidecar with what the list shows, so listing
 * never has to decompress a multi-megabyte file.
 *
 * They live beside settings.json, in Prune's own data folder -- in the
 * installed app that is userData, which an upgrade keeps. A function, not a
 * constant, so tests point it at a temp folder. */
export function scansDir() {
  return process.env.UNREVO_SCANS_DIR || join(dirname(settingsPath()), 'disk-scans');
}

/** Ids are generated here and only ever looked up by exact shape, so an id
 * from a request can never name a path outside the folder. */
const ID = /^[a-z0-9]{6,40}$/;
export const isScanId = (id) => typeof id === 'string' && ID.test(id);

/** Plenty to keep a history, bounded so the folder cannot grow forever. */
export const MAX_SAVED_SCANS = 50;

const archivePath = (id) => join(scansDir(), `${id}.scan.gz`);
const metaPath = (id) => join(scansDir(), `${id}.meta.json`);

function cleanLabel(label, fallback) {
  const text = typeof label === 'string' ? label.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 120) : '';
  return text || fallback;
}

/** Saves a compact scan. Returns { ok: true, meta } or { ok: false, error }. */
export async function saveScan({ label, source, truncated, archive: input } = {}) {
  const checked = normalizeArchive(input);
  if (!checked.ok) return checked;
  const { archive, nodeCount } = checked;

  await fs.mkdir(scansDir(), { recursive: true });
  if ((await listScans()).length >= MAX_SAVED_SCANS) {
    return { ok: false, error: `Prune keeps ${MAX_SAVED_SCANS} saved scans. Delete one to save another.` };
  }

  const savedAt = Date.now();
  const id = `${savedAt.toString(36)}${randomBytes(4).toString('hex')}`;
  const meta = {
    id,
    label: cleanLabel(label, archive.root.n),
    savedAt,
    root: archive.root.n,
    source: source === 'crawl' ? 'crawl' : 'fast',
    truncated: truncated === true,
    totalBytes: archive.root.s,
    allocatedBytes: typeof archive.root.a === 'number' ? archive.root.a : null,
    folders: nodeCount
  };

  // The archive first, the sidecar last: the sidecar is what makes a scan
  // appear in the list, so a crash between the two leaves an invisible file
  // rather than a listed scan that cannot be opened.
  await fs.writeFile(archivePath(id), await gzipAsync(JSON.stringify(archive)));
  await fs.writeFile(metaPath(id), JSON.stringify(meta));
  return { ok: true, meta };
}

/** Newest first. An unreadable sidecar is skipped rather than failing the list. */
export async function listScans() {
  let names;
  try {
    names = await fs.readdir(scansDir());
  } catch {
    return [];
  }
  const metas = [];
  for (const name of names.filter((n) => n.endsWith('.meta.json'))) {
    try {
      const meta = JSON.parse(await fs.readFile(join(scansDir(), name), 'utf8'));
      if (isScanId(meta?.id)) metas.push(meta);
    } catch { /* a half-written or damaged sidecar is not a scan */ }
  }
  return metas.sort((a, b) => b.savedAt - a.savedAt);
}

/** { meta, archive } for an id, or null when there is no such scan. */
export async function loadScan(id) {
  if (!isScanId(id)) return null;
  try {
    const [meta, packed] = await Promise.all([
      fs.readFile(metaPath(id), 'utf8').then(JSON.parse),
      fs.readFile(archivePath(id))
    ]);
    const checked = normalizeArchive(JSON.parse((await gunzipAsync(packed)).toString('utf8')));
    return checked.ok ? { meta, archive: checked.archive } : null;
  } catch {
    return null;
  }
}

/** Removes a saved scan. True if there was one. */
export async function deleteScan(id) {
  if (!isScanId(id)) return false;
  let existed = false;
  for (const path of [metaPath(id), archivePath(id)]) {
    try { await fs.unlink(path); existed = true; } catch { /* already gone */ }
  }
  return existed;
}

/** Compares two saved scans, the older as the starting point whichever order
 * they were named in. Null when either does not exist. */
export async function compareSaved(idA, idB, { limit = 25 } = {}) {
  const [a, b] = await Promise.all([loadScan(idA), loadScan(idB)]);
  if (!a || !b) return null;
  const [older, newer] = a.meta.savedAt <= b.meta.savedAt ? [a, b] : [b, a];
  return { older: older.meta, newer: newer.meta, ...compareScans(older.archive, newer.archive, { limit }) };
}
