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

/** Plenty to keep a history, bounded so the folder cannot grow forever.
 * Counts the scans a person saved by hand; the automatic ones have a bound of
 * their own (AUTO_KEEP per drive) and neither uses up the other's room. */
export const MAX_SAVED_SCANS = 50;

/** How many automatic scans of one drive are kept: the latest, and the one
 * before it so the two can be compared. */
export const AUTO_KEEP = 2;

/** A scan file with no sidecar is the debris of a save that died between its
 * two writes. One younger than this may belong to a save still in progress. */
const ORPHAN_GRACE_MS = 10 * 60 * 1000;

const archivePath = (id) => join(scansDir(), `${id}.scan.gz`);
const metaPath = (id) => join(scansDir(), `${id}.meta.json`);

function cleanLabel(label, fallback) {
  const text = typeof label === 'string' ? label.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 120) : '';
  return text || fallback;
}

/** Strictly increasing, so two saves in one millisecond still have an order. */
let lastStamp = 0;
function nextStamp() {
  lastStamp = Math.max(Date.now(), lastStamp + 1);
  return lastStamp;
}

/** Writes a validated archive and its sidecar. `extra` is merged into the
 * sidecar (the automatic scans add what keys them). */
async function persist({ label, source, truncated, archive, nodeCount, extra }) {
  const savedAt = nextStamp();
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
    folders: nodeCount,
    ...extra
  };

  // The archive first, the sidecar last: the sidecar is what makes a scan
  // appear in the list, so a crash between the two leaves an invisible file
  // rather than a listed scan that cannot be opened.
  await fs.writeFile(archivePath(id), await gzipAsync(JSON.stringify(archive)));
  await fs.writeFile(metaPath(id), JSON.stringify(meta));
  return meta;
}

/** Saves a compact scan. Returns { ok: true, meta } or { ok: false, error }. */
export async function saveScan({ label, source, truncated, archive: input } = {}) {
  const checked = normalizeArchive(input);
  if (!checked.ok) return checked;
  const { archive, nodeCount } = checked;

  await fs.mkdir(scansDir(), { recursive: true });
  // Only the ones saved by hand count against the limit.
  if ((await listScans()).filter((m) => m.auto !== true).length >= MAX_SAVED_SCANS) {
    return { ok: false, error: `Prune keeps ${MAX_SAVED_SCANS} saved scans. Delete one to save another.` };
  }
  return { ok: true, meta: await persist({ label, source, truncated, archive, nodeCount }) };
}

/** One automatic save at a time: two overlapping prunes of the same drive
 * could otherwise each see the other's scan as the newest and keep too many
 * or too few. */
let autoQueue = Promise.resolve();

const DRIVE = /^[A-Za-z]$/;

/** Saves a drive's scan on its own, after a Disk Map scan finishes, and prunes
 * that drive's automatic scans to the latest AUTO_KEEP. Scans saved by hand are
 * never looked at. Returns { ok: true, meta, removed: [ids] } or
 * { ok: false, error }. */
export function saveAutoScan({ drive, label, source, truncated, capacityBytes, archive: input } = {}) {
  const run = autoQueue.then(() => saveAutoScanNow({ drive, label, source, truncated, capacityBytes, archive: input }));
  autoQueue = run.catch(() => {});
  return run;
}

async function saveAutoScanNow({ drive, label, source, truncated, capacityBytes, archive: input }) {
  if (typeof drive !== 'string' || !DRIVE.test(drive)) return { ok: false, error: 'An automatic scan needs a drive letter.' };
  const letter = drive.toUpperCase();
  const checked = normalizeArchive(input);
  if (!checked.ok) return checked;
  const { archive, nodeCount } = checked;
  // Keyed by drive, so the scan has to be of that drive.
  if (archive.root.n.replace(/[\\/]+$/, '').toUpperCase() !== `${letter}:`) {
    return { ok: false, error: 'That scan is not of the drive it was saved for.' };
  }

  await fs.mkdir(scansDir(), { recursive: true });
  const meta = await persist({
    label, source, truncated, archive, nodeCount,
    extra: {
      auto: true,
      drive: letter,
      capacityBytes: typeof capacityBytes === 'number' && Number.isFinite(capacityBytes) && capacityBytes > 0 ? capacityBytes : null
    }
  });
  const removed = await pruneAuto(letter);
  await sweepOrphans();
  return { ok: true, meta, removed };
}

const exists = (path) => fs.stat(path).then(() => true, () => false);

/** Keeps the newest AUTO_KEEP automatic scans of a drive. A sidecar whose scan
 * file has gone is debris, not a scan: it is removed first and does not count
 * towards the two. Returns the ids it removed. */
async function pruneAuto(letter) {
  const removed = [];
  const intact = [];
  for (const meta of await listScans()) {
    if (meta.auto !== true || meta.drive !== letter) continue;
    if (await exists(archivePath(meta.id))) intact.push(meta);
    else { await deleteScan(meta.id); removed.push(meta.id); }
  }
  for (const meta of intact.slice(AUTO_KEEP)) {
    await deleteScan(meta.id);
    removed.push(meta.id);
  }
  return removed;
}

/** Removes scan files that no sidecar claims and that have sat for a while. */
async function sweepOrphans() {
  let names;
  try { names = await fs.readdir(scansDir()); } catch { return; }
  const claimed = new Set(names.filter((n) => n.endsWith('.meta.json')).map((n) => n.slice(0, -'.meta.json'.length)));
  for (const name of names.filter((n) => n.endsWith('.scan.gz'))) {
    if (claimed.has(name.slice(0, -'.scan.gz'.length))) continue;
    try {
      const { mtimeMs } = await fs.stat(join(scansDir(), name));
      if (Date.now() - mtimeMs > ORPHAN_GRACE_MS) await fs.unlink(join(scansDir(), name));
    } catch { /* gone already */ }
  }
}

/** The automatic scans, newest first, of one drive or of all, with how many
 * there are and the disk they use. Only ones whose scan file is still there. */
export async function listAutoScans({ drive } = {}) {
  const letter = typeof drive === 'string' && DRIVE.test(drive) ? drive.toUpperCase() : null;
  const scans = [];
  let bytes = 0;
  for (const meta of await listScans()) {
    if (meta.auto !== true || (letter && meta.drive !== letter)) continue;
    try {
      const [archive, sidecar] = await Promise.all([fs.stat(archivePath(meta.id)), fs.stat(metaPath(meta.id))]);
      bytes += archive.size + sidecar.size;
      scans.push(meta);
    } catch { /* the scan file is gone */ }
  }
  return { scans, count: scans.length, bytes };
}

/** Removes every automatic scan and nothing else. Returns how many. */
export async function deleteAutoScans() {
  let count = 0;
  for (const meta of await listScans()) {
    if (meta.auto === true && await deleteScan(meta.id)) count += 1;
  }
  return count;
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
