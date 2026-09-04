import { Router } from 'express';
import { readdir, readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { existsSync } from 'node:fs';
import { quarantineAndDelete, restoreQuarantine, quarantineRoot, deletePermanently, emptyQuarantine } from '../services/quarantine.js';
import { tryCreateRestorePoint } from '../services/restorePoint.js';
import { getSettings } from '../services/settings.js';

// Real bug, found dogfooding Phase 4 (2026-09-01): `manifest.batchDir` (the
// field every list/restore/delete client-side call keys off) is the FULL
// ABSOLUTE path written by quarantineAndDelete -- `join(quarantineRoot(),
// '<ts>-<program>')` -- not a bare directory name. The pre-existing
// QuarantinePanel.jsx already passes that value straight through as the
// :batchDir route param, so `join(quarantineRoot(), req.params.batchDir)`
// below was joining an absolute path onto quarantineRoot() a SECOND time --
// path.join does not special-case an absolute later segment, it just
// concatenates and normalizes, so the result was a doubled, nonexistent
// path. Confirmed live: POST /api/quarantine/<encoded full batchDir>/restore
// against a real quarantined batch returned "ENOENT ... qroot\qroot\<ts>-
// <program>\manifest.json" every time, 100% reproducible -- restore (and,
// by the same code shape, permanent delete) never worked through the HTTP
// layer, only the direct service-function unit tests (which pass the full
// path straight to restoreQuarantine/deletePermanently, bypassing this
// route entirely) ever exercised the correct path. basename() here makes
// the route accept either a bare directory name OR a full path from any
// client -- old or new -- and always resolve it under quarantineRoot(),
// where every batch actually lives.
function resolveBatchDir(rawParam) {
  return join(quarantineRoot(), basename(rawParam));
}

const router = Router();

router.post('/remove', async (req, res) => {
  const { programName, files, registryKeys } = req.body || {};
  if (!programName) { res.status(400).json({ error: 'programName is required' }); return; }
  try {
    // Revo's SRInCP, which it ships on. Prune already made one before
    // every forced removal -- it just made one unconditionally, which is a
    // slow no-op on a machine where System Protection is turned off, and
    // there was no way to say so.
    const settings = await getSettings();
    const restorePoint = settings.createRestorePoint === false
      ? { created: false, reason: 'turned off in Settings' }
      : await tryCreateRestorePoint(`Prune: forced removal of ${programName}`);
    const manifest = await quarantineAndDelete({ programName, files: files || [], registryKeys: registryKeys || [] });
    res.json({ ...manifest, restorePoint });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  const root = quarantineRoot();
  if (!existsSync(root)) { res.json({ batches: [] }); return; }
  const entries = await readdir(root, { withFileTypes: true });
  const batches = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = join(root, entry.name, 'manifest.json');
    if (!existsSync(manifestPath)) continue;
    try {
      batches.push(JSON.parse(await readFile(manifestPath, 'utf8')));
    } catch { /* skip a corrupted manifest rather than failing the whole list */ }
  }
  batches.sort((a, b) => b.createdAt - a.createdAt);
  res.json({ batches });
});

router.post('/:batchDir/restore', async (req, res) => {
  try {
    const manifest = await restoreQuarantine(resolveBatchDir(req.params.batchDir));
    res.json(manifest);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Real, permanent delete of one already-quarantined batch -- nothing left
// to restore afterward. Mounted BEFORE /empty in this file's read order
// doesn't matter for Express (different HTTP methods/segment shapes never
// collide), but kept here so every :batchDir route sits together.
router.delete('/:batchDir', async (req, res) => {
  try {
    const result = await deletePermanently(resolveBatchDir(req.params.batchDir));
    if (!result.deleted) { res.status(404).json({ error: `No quarantine batch found at "${req.params.batchDir}".` }); return; }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/empty', async (req, res) => {
  try {
    res.json(await emptyQuarantine());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;