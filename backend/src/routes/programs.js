import { Router } from 'express';
import { listInstalledPrograms } from '../services/programs.js';
import { getProgramIcons } from '../services/programIcons.js';
import { getProgramSizes } from '../services/programSizes.js';
import { getProgramVersions } from '../services/programVersions.js';
import { getProgramInstallDates } from '../services/installDates.js';
import { getStoreApps } from '../services/storeApps.js';
import { getBrowserExtensions } from '../services/browserExtensions.js';
import { getStartupItems } from '../services/startupItems.js';
import { revealPath, openInstalledAppsSettings } from '../services/revealPath.js';
import { getPackageIcons } from '../services/packageIcons.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const programs = await listInstalledPrograms();
    res.json({ programs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Every program's real icon, as { programId: dataUri }.
 *
 * Separate from the list on purpose. Extraction spawns PowerShell and
 * reads ~90 executables, and making the program list wait on that would
 * trade a fast list for a prettier one. The UI renders rows immediately
 * and fills the icons in when they arrive; a program with no extractable
 * icon is simply absent from the map and keeps its lettered tile. */
router.get('/icons', async (req, res) => {
  try {
    res.json({ icons: await getProgramIcons() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Measured install-folder sizes for the programs whose registry entry
 * has no EstimatedSize, as { programId: bytes }.
 *
 * Separate from the list for the same reason the icons are: this walks
 * install folders and takes ~13 seconds on this machine, and the list
 * must not wait on it. A program that can't be measured safely is absent
 * from the map and keeps its honest blank. */
router.get('/sizes', async (req, res) => {
  try {
    res.json({ sizes: await getProgramSizes() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Versions read off the application binaries of programs whose registry
 * entry has no DisplayVersion, as { programId: version }.
 *
 * Separate from the list for the same reason as the icons and sizes: it
 * searches install folders for the right binary before it can read
 * anything. Cheaper than the sizes -- under two seconds, since it reads
 * resource tables rather than walking every file -- but still not
 * something the list should wait behind. */
router.get('/versions', async (req, res) => {
  try {
    res.json({ versions: await getProgramVersions() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Install dates for the programs whose registry entry never declared one,
 * as { programId: 'YYYY-MM-DD' }.
 *
 * More than half the list on this machine -- 67 of 129 -- so the column
 * read as mostly empty next to Revo, which fills every row. Taken from the
 * uninstall key's own last-write time, which is what Revo uses too: its
 * dates for Steam, Ubisoft Connect, Rainbow Six and Wuthering Waves match
 * these exactly.
 *
 * Separate from the list for the same reason as the sizes and versions,
 * though this one is cheap (~1.6s): it opens every uninstall key in three
 * hives, and the list should not wait behind it. */
router.get('/install-dates', async (req, res) => {
  try {
    res.json({ installDates: await getProgramInstallDates() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Microsoft Store apps, which the uninstall registry does not list at all.
 *
 * 81 of them on this machine, 6.28 GB, entirely invisible to Prune until
 * now while Revo gives them a module of their own. They come back shaped
 * like the registry programs so the same list can render them, marked with
 * source: 'store' because how you remove one is genuinely different.
 *
 * Its own endpoint like the rest of the late-arriving data: it measures 81
 * package folders and takes about five seconds. */
router.get('/store', async (req, res) => {
  try {
    res.json({ apps: await getStoreApps() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Browser extensions, which no uninstall list mentions anywhere.
 *
 * Revo gives them a module of their own, and they are a real blind spot:
 * 24 of them here across Brave, Chrome and Edge totalling 390 MB, one of
 * which is 305 MB on its own. Pure filesystem work, about a second.
 *
 * They come back shaped like programs so the same list renders them,
 * marked source: 'extension'. */
router.get('/extensions', async (req, res) => {
  try {
    res.json({ extensions: await getBrowserExtensions() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Everything Windows launches at sign-in.
 *
 * Revo keeps an autorun manager under Tools, and it belongs beside an
 * uninstaller: these entries outlive the programs that create them, so a
 * carelessly removed program leaves Windows trying to launch a file that
 * is not there at every sign-in. Read-only, and quick (0.5s). */
router.get('/startup', async (req, res) => {
  try {
    res.json({ items: await getStartupItems() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Opens File Explorer on a program's folder.
 *
 * Revo puts this behind its More Commands button and it is the most-used
 * thing there: the list says a program is 55 GB and the next question is
 * always where. POST rather than GET because it has an effect on the
 * machine -- a window opens -- and nothing with an effect should be
 * reachable by a prefetch or a retry.
 *
 * Opening a folder is the only thing it does. It cannot delete, move or
 * run anything, and the path is handed to CreateProcess as an argument
 * vector rather than through a shell. */
router.post('/reveal', async (req, res) => {
  try {
    const result = await revealPath(req.body?.path);
    if (!result.ok) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Icons for the rows that do not come from the registry.
 *
 * The Store apps and browser extensions arrived with lettered tiles beside
 * registry programs showing their real icons, which made the new rows look
 * half-finished. Their icons are ordinary files inside the package or
 * extension folder, so this is plain file reading rather than icon
 * extraction. 100 of 105 resolve here.
 *
 * Its own endpoint like /icons, and merged into the same map by the UI. */
router.get('/package-icons', async (req, res) => {
  try {
    res.json({ icons: await getPackageIcons() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Opens Windows' own Installed apps page.
 *
 * Where Store apps are removed. Prune lists them but does not remove them,
 * and pointing at the place without opening it is half an answer. Takes no
 * input at all -- the URI is fixed. */
router.post('/apps-settings', async (req, res) => {
  try {
    res.json(await openInstalledAppsSettings());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
