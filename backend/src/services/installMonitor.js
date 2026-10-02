import { execFile } from 'node:child_process';
import { statSync } from 'node:fs';
import { isAbsolute, extname } from 'node:path';
import { captureSystemState, captureFiles, diffFiles, diffState, chooseProgram } from './installSnapshot.js';
import { saveTrace, newTraceId } from './installTraces.js';

/** "Install with monitoring": Revo's installation monitor.
 *
 * Take a "before" picture, run the installer, take an "after" picture, and
 * keep the difference. Uninstalling that program later then knows exactly
 * what its installer put on the machine, whatever it was named.
 *
 * One monitored install at a time, held in memory. The states, in order:
 *   idle -> installing -> (exited) -> analyzing -> done | failed
 * `exited` is the installer having closed too fast to trust: a bootstrapper
 * that hands off to another process exits within seconds while the real
 * installation carries on, so a quick exit waits for the person to press
 * "Done installing" instead of snapshotting too early. An installer that ran
 * for MIN_AUTO_FINISH_MS or more and exited cleanly finishes by itself.
 *
 * Every outside thing is injectable so the state machine is tested without
 * running an installer or reading the machine. */

/** An installer that ran this long and exited cleanly has done its work. */
export const MIN_AUTO_FINISH_MS = 20000;
/** How long to let the machine settle after the installer closes. */
const DEFAULT_SETTLE_MS = 3000;
/** A monitor nobody finished is abandoned, and its snapshot freed. */
const SESSION_TTL_MS = 3 * 60 * 60 * 1000;

/** Why this cannot be run as an installer, or null. */
export function validateInstaller(path) {
  if (typeof path !== 'string' || !isAbsolute(path)) return 'Choose an installer by its full path.';
  if (!['.exe', '.msi'].includes(extname(path).toLowerCase())) return 'Only .exe and .msi installers can be monitored.';
  try {
    if (!statSync(path).isFile()) return 'That is not a file.';
  } catch {
    return 'That file does not exist.';
  }
  return null;
}

/** Runs the installer through the shell, so a UAC prompt works, and resolves
 * when it exits. The path travels in an environment variable, never in the
 * script text. Resolves { code, error } -- a declined UAC prompt or a file
 * that cannot be started is code 3 with the reason. */
function launchInstaller(installerPath) {
  const exited = new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command',
        "try { Start-Process -FilePath $env:PRUNE_INSTALLER -Wait -ErrorAction Stop } catch { [Console]::Error.Write($_.Exception.Message); exit 3 }"],
      { env: { ...process.env, PRUNE_INSTALLER: installerPath }, windowsHide: true, timeout: SESSION_TTL_MS },
      (error, _stdout, stderr) => {
        if (!error) resolve({ code: 0 });
        else resolve({ code: typeof error.code === 'number' ? error.code : 1, error: String(stderr || error.message).trim() });
      }
    );
  });
  return { exited };
}

function buildTrace({ id, installerPath, createdAt, durationMs, stateDiff, fileDiff }) {
  const chosen = chooseProgram(stateDiff.uninstall, installerPath);
  const program = chosen ? {
    name: chosen.program.name,
    publisher: chosen.program.publisher || null,
    version: chosen.program.version || null,
    installLocation: chosen.program.installLocation || null,
    uninstallString: chosen.program.uninstallString || null,
    key: chosen.program.key,
    registryKey: chosen.program.psKey || null
  } : null;

  const registry = [];
  if (chosen) registry.push({ path: chosen.program.key });
  for (const entry of stateDiff.run) registry.push({ path: entry.key, valueName: entry.valueName });

  return {
    id, version: 1, createdAt, durationMs, installer: installerPath,
    program,
    alsoInstalled: chosen ? chosen.others.map((o) => o.name) : [],
    files: fileDiff.added,
    modifiedFileCount: fileDiff.modified,
    registry,
    services: stateDiff.services.map((s) => ({ name: s.name, pathName: s.pathName })),
    // Windows schedules and rewrites its own tasks all the time; none is an
    // installer's.
    tasks: stateDiff.tasks
      .filter((t) => !/^\\microsoft\\windows(\\|$)/i.test(t.path || ''))
      .map((t) => ({ name: t.name, path: t.path })),
    partial: fileDiff.truncated === true || fileDiff.addedTruncated === true
  };
}

export function createInstallMonitor({
  captureSystemState: captureState = captureSystemState,
  captureFiles: captureFileList = captureFiles,
  diffFiles: diffFileList = diffFiles,
  launch = launchInstaller,
  saveTrace: save = saveTrace,
  now = Date.now,
  settleMs = DEFAULT_SETTLE_MS
} = {}) {
  let session = null;
  let generation = 0;
  let expiry = null;

  const idle = () => ({ state: 'idle' });
  const publicStatus = () => {
    if (!session) return idle();
    const { state, installerPath, startedAt, error, trace } = session;
    return { state, installerPath, startedAt, ...(error ? { error } : {}), ...(trace ? { trace } : {}) };
  };

  const clearSession = () => {
    generation += 1;
    clearTimeout(expiry);
    session = null;
  };

  async function analyze(mine) {
    if (!session || session.generation !== mine) return;
    session.state = 'analyzing';
    try {
      if (settleMs > 0) await new Promise((resolve) => setTimeout(resolve, settleMs));
      const afterState = await captureState();
      const fileDiff = await diffFileList(session.beforeFiles);
      const stateDiff = diffState(session.beforeState, afterState);
      if (!session || session.generation !== mine) return;

      const trace = buildTrace({
        id: newTraceId(), installerPath: session.installerPath, createdAt: now(),
        durationMs: now() - session.startedAt, stateDiff, fileDiff
      });
      await save(trace);
      if (!session || session.generation !== mine) return;
      session.trace = {
        id: trace.id, programName: trace.program?.name ?? null, fileCount: trace.files.length,
        registryCount: trace.registry.length, taskCount: trace.tasks.length, serviceCount: trace.services.length, partial: trace.partial
      };
      session.beforeFiles = null; // the snapshot can go
      session.state = 'done';
    } catch (err) {
      if (!session || session.generation !== mine) return;
      session.beforeFiles = null;
      session.state = 'failed';
      session.error = `The install could not be compared: ${err.message}`;
    }
  }

  return {
    status: publicStatus,

    /** Takes the "before" snapshot, then starts the installer. Resolves once
     * the installer is running. Throws, leaving the monitor idle, if the
     * installer is not valid or the snapshot fails. */
    async start({ installerPath }) {
      if (session && ['installing', 'exited', 'analyzing'].includes(session.state)) {
        throw new Error('A monitored install is already in progress.');
      }
      const problem = validateInstaller(installerPath);
      if (problem) throw new Error(problem);

      clearSession();
      const mine = generation;
      session = { generation: mine, state: 'snapshotting', installerPath, startedAt: now() };
      try {
        session.beforeState = await captureState();
        session.beforeFiles = await captureFileList();
      } catch (err) {
        if (session && session.generation === mine) session = null;
        throw new Error(`The "before" snapshot failed: ${err.message}`);
      }
      if (!session || session.generation !== mine) return;

      session.startedAt = now();
      session.state = 'installing';
      expiry = setTimeout(() => { if (session?.generation === mine) clearSession(); }, SESSION_TTL_MS);
      expiry.unref?.();

      const { exited } = launch(installerPath);
      exited.then((result) => {
        if (!session || session.generation !== mine || session.state !== 'installing') return;
        if (result.code !== 0 || result.error) {
          session.beforeFiles = null;
          session.state = 'failed';
          session.error = result.error || `The installer exited with code ${result.code}.`;
          return;
        }
        if (now() - session.startedAt >= MIN_AUTO_FINISH_MS) analyze(mine);
        else session.state = 'exited';
      });
    },

    /** "Done installing": take the "after" snapshot now. */
    async finish() {
      if (!session || !['installing', 'exited'].includes(session.state)) return;
      await analyze(session.generation);
    },

    /** Abandons the monitor, whatever state it is in. Nothing is recorded. */
    cancel() {
      clearSession();
    }
  };
}

/** The one monitor the app uses. */
export const installMonitor = createInstallMonitor();
