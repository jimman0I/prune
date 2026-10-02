/** The renderer's side of "Restart Prune as administrator".
 *
 * The desktop app exposes `window.pruneWindow.admin` (electron/preload.cjs):
 * two fixed requests, neither with an argument. In a browser, in a test, or
 * in a development build there is no such bridge or it declines, and the
 * button is simply not offered -- never an error. */
const bridge = () => (typeof window === 'undefined' ? undefined : window.pruneWindow?.admin);

/** Whether a restart can be offered here: a packaged Windows build only. */
export async function canRestartAsAdmin() {
  try {
    return (await bridge()?.canRelaunch?.()) === true;
  } catch {
    return false;
  }
}

/** Restarts Prune elevated. Resolves to:
 *   { ok: true }                -- the new instance started; this one is closing
 *   { ok: false, cancelled }    -- the UAC prompt was declined; nothing changed
 *   { ok: false, error }        -- anything else
 *   { ok: false, unsupported }  -- no bridge
 * Never rejects: a declined prompt is an answer, not a failure. */
export async function restartAsAdmin() {
  const admin = bridge();
  if (!admin?.relaunch) return { ok: false, unsupported: true };
  try {
    return await admin.relaunch();
  } catch (err) {
    return { ok: false, error: err?.message || 'Prune could not restart as administrator.' };
  }
}
