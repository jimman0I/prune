import { Router } from 'express';
import { scanForLeftovers } from '../services/leftoverScan.js';
import { getSettings } from '../services/settings.js';
import { normalizePath, toExcludePattern } from '../lib/cleanGuards.js';

const router = Router();

/** Drops leftover folders at or under one the user excluded.
 *
 * Settings -> Cleanup -> exclusions kept Deep Clean and the Disk Map out
 * of those folders, but the leftover scan ignored them, so a folder the
 * user had said never to touch could be offered -- ticked by default --
 * after an uninstall whose name matched it. Revo excludes folders from its
 * leftover scan for the same reason.
 *
 * The user's folders only, not the cleaner's built-in list: those are
 * junk-cleaning rules, and a scan for one program's leftovers is not
 * cleaning junk. A prefix match on separator-wrapped paths, so "D:\Keep"
 * excludes D:\Keep\x and never D:\Keeper. The count travels with the
 * result so the review can say something was held back. */
function withoutExcluded(result, excludeFolders) {
  const patterns = (Array.isArray(excludeFolders) ? excludeFolders : []).map(toExcludePattern).filter(Boolean);
  const items = result?.files?.items;
  if (patterns.length === 0 || !Array.isArray(items)) return result;
  const kept = items.filter((item) => !patterns.some((pattern) => normalizePath(item.path).startsWith(pattern)));
  return { ...result, files: { ...result.files, items: kept, excluded: items.length - kept.length } };
}

router.post('/scan', async (req, res) => {
  const { name, publisher } = req.body || {};
  if (!name) { res.status(400).json({ error: 'name is required' }); return; }
  try {
    const result = await scanForLeftovers({ name, publisher });
    const settings = await getSettings().catch(() => ({}));
    res.json(withoutExcluded(result, settings?.excludeFolders));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
