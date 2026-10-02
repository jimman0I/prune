import { Router, text } from 'express';
import { getSettings, updateSettings } from '../services/settings.js';
import { validateCustomLocation, normalizeCustomLocations } from '../lib/customLocations.js';
import { importBleachBitXml, ImportError, MAX_XML_BYTES } from '../lib/bleachbitImport.js';
import { saveImported, removeImported, listImported } from '../lib/userRules.js';

/** Custom locations and imported BleachBit cleaners.
 *
 * What the Settings screen manages; Deep Clean itself reads the result
 * through loadCleanerRules (lib/userRules.js). The XML arrives as the raw
 * text/plain request body rather than JSON: the app-wide JSON parser stops at
 * 100 KB, and a cleaner file is just text. Its size is checked again by the
 * importer, which never executes or fetches anything in it. */

const router = Router();

const locationsOf = async () => normalizeCustomLocations((await getSettings()).customLocations);

router.get('/', async (req, res) => {
  try {
    res.json({ locations: await locationsOf(), imported: listImported() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/locations', async (req, res) => {
  const raw = req.body?.path;
  if (typeof raw !== 'string') { res.status(400).json({ error: 'path (text) is required', reason: 'empty' }); return; }
  const checked = validateCustomLocation(raw);
  if (!checked.ok) { res.status(400).json({ error: `That location cannot be added (${checked.reason}).`, reason: checked.reason }); return; }
  try {
    const next = normalizeCustomLocations([...(await locationsOf()), checked.path]);
    const saved = await updateSettings({ customLocations: next });
    res.json({ locations: saved.customLocations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/locations/remove', async (req, res) => {
  const raw = req.body?.path;
  if (typeof raw !== 'string') { res.status(400).json({ error: 'path (text) is required' }); return; }
  try {
    const gone = raw.trim().replace(/\//g, '\\').replace(/(?<=.)\\+$/, '').toLowerCase();
    const next = (await locationsOf()).filter((p) => p.toLowerCase() !== gone);
    const saved = await updateSettings({ customLocations: next });
    res.json({ locations: saved.customLocations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/import', text({ type: '*/*', limit: `${MAX_XML_BYTES + 1024}` }), async (req, res) => {
  const xml = typeof req.body === 'string' ? req.body : '';
  if (xml.trim() === '') { res.status(400).json({ error: 'The file is empty.', code: 'notXml' }); return; }
  try {
    const { cleaner, report } = importBleachBitXml(xml);
    if (cleaner.rules.length === 0) {
      // Something to say, nothing to keep.
      res.json({ imported: false, cleaner: { id: cleaner.id, label: cleaner.label, ruleCount: 0 }, report });
      return;
    }
    await saveImported(cleaner, report, { source: String(req.query.name ?? '') });
    res.json({ imported: true, cleaner: { id: cleaner.id, label: cleaner.label, ruleCount: cleaner.rules.length }, report });
  } catch (err) {
    if (err instanceof ImportError) { res.status(400).json({ error: err.message, code: err.code }); return; }
    res.status(500).json({ error: err.message });
  }
});

router.delete('/imported/:id', async (req, res) => {
  try {
    const removed = await removeImported(req.params.id);
    if (!removed) { res.status(404).json({ error: 'No such imported cleaner.' }); return; }
    res.json({ removed: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
