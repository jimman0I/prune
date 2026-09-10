import { Router } from 'express';
import { runUninstaller } from '../services/uninstall.js';
import { listInstalledPrograms } from '../services/programs.js';
import { chromiumApplicationFolder } from '../services/silentUninstall.js';
import { isRunningUnder } from '../services/runningPrograms.js';

const router = Router();

function sendEvent(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/** Runs one installed program's own uninstaller.
 *
 * The body names a program by id and nothing else. The command comes from
 * a fresh read of the uninstall registry, looked up here.
 *
 * That indirection is the entire security posture of this route. What it
 * ends in is `cmd.exe /c <string>` -- an UninstallString is a raw shell
 * command line, not an executable plus an argv array, and cmd.exe is what
 * splits quoted paths and flags the way the registry entry expects (see
 * services/uninstall.js). So a route that took the string from the request
 * would be a route that runs whatever a caller sends, as the logged-in
 * user. It used to be exactly that.
 *
 * Nothing was reachable through it that a local process could not already
 * do directly -- localOnly keeps web pages out, and anything running as
 * this user can spawn cmd.exe itself -- so this is not a fix for a live
 * hole. It is the same rule /programs/startup/toggle already follows,
 * applied to the more dangerous of the two routes, which had the looser
 * contract of the two. A client should not be able to describe a command;
 * it should only be able to point at a program the machine already agreed
 * is installed.
 *
 * The lookup costs about 1.5 seconds. It is not cached, and should not be:
 * every uninstall changes the registry it reads, so a batch working from
 * one snapshot would check each program against a list its own earlier
 * removals had already invalidated. Fresh reads also mean the last thing
 * checked before an uninstaller runs is that the program is still there.
 *
 * Validation finishes before the stream opens. Once a 200 and an
 * event-stream header are on the wire there is no status code left to
 * refuse with, and every caller would have to parse a stream to discover
 * its request was rejected.
 */
router.post('/', async (req, res) => {
  const { programId } = req.body || {};
  if (typeof programId !== 'string' || !programId) {
    res.status(400).json({ error: 'programId is required.' });
    return;
  }

  let program;
  try {
    program = (await listInstalledPrograms()).find((entry) => entry.id === programId);
  } catch (err) {
    res.status(500).json({ error: `Could not read the uninstall registry: ${err.message}` });
    return;
  }

  if (!program) {
    // Not a 500: the list on screen is a snapshot, and a program can
    // genuinely be gone by the time its row is clicked -- including
    // because an earlier program in the same batch removed it.
    res.status(404).json({ error: `"${programId}" is no longer in the uninstall registry.` });
    return;
  }
  if (!program.uninstallString) {
    res.status(400).json({ error: `${program.name} has no registered uninstall command.` });
    return;
  }

  /* Whether a Chromium browser is running, asked BEFORE the stream opens.
   *
   * --force-uninstall makes a browser's uninstall silent, and it also
   * closes every running instance without asking -- the dialog it skips is
   * the one that tells you to close it first. So the silent command is
   * only built for a browser known not to be running, and this is where
   * that is known.
   *
   * Only for Chromium: the check costs about a second and a half, and no
   * other kind of uninstaller uses the answer. Edge and WebView2 are
   * excluded before this point and never checked, because they are never
   * made silent.
   *
   * The answer is passed through untouched, null included. Tidying a null
   * into a false -- `!!running` -- is the one-character bug that would
   * turn "could not tell" into "safe to kill". */
  let running;
  const applicationFolder = chromiumApplicationFolder(program.uninstallString);
  if (applicationFolder) running = await isRunningUnder(applicationFolder);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  try {
    const result = await runUninstaller({ ...program, running }, (type, data) => sendEvent(res, type, data));
    sendEvent(res, 'done', result);
  } catch (err) {
    sendEvent(res, 'error', { message: err.message });
  } finally {
    res.end();
  }
});

export default router;
