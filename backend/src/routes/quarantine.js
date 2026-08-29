import { Router } from 'express';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { quarantineAndDelete, restoreQuarantine, quarantineRoot } from '../services/quarantine.js';
import { tryCreateRestorePoint } from '../services/restorePoint.js';

const router = Router();

router.post('/remove', async (req, res) => {
  const { programName, files, registryKeys } = req.body || {};
  if (!programName) { res.status(400).json({ error: 'programName is required' }); return; }
  try {
    const restorePoint = await tryCreateRestorePoint(`unrevo: forced removal of ${programName}`);
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
    const manifest = await restoreQuarantine(join(quarantineRoot(), req.params.batchDir));
    res.json(manifest);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;