/** Prune replacing itself with a newer release, when asked to.
 *
 * electron-updater does the real work: it reads latest.yml from the
 * GitHub release, downloads the installer, checks it against the SHA-512
 * in that file and runs it silently. This module is the part Prune
 * decides for itself, and all of it is about consent:
 *
 *   - Nothing downloads because a check found something, and nothing
 *     installs because the app quit. electron-updater does both by
 *     default; both are switched off here, and install-on-quit comes back
 *     only when the user turns on "Install updates automatically".
 *   - Only the version the user was shown is installed. If a newer one was
 *     published between the button appearing and the click, that one has
 *     not been seen, so this refuses rather than install it.
 *   - A development build refuses outright. An unpackaged Electron has
 *     nothing to replace, and electron-updater would quietly answer null.
 *
 * `send` reports download progress to the window; see main.cjs. */
const VERSION = /^\d+\.\d+\.\d+$/;

function createUpdater({ autoUpdater, isPackaged, send = () => {} }) {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  let ready = null;
  let preparing = null;

  autoUpdater.on('download-progress', (progress) => {
    send('progress', Math.round(progress?.percent ?? 0));
  });

  async function download(version) {
    const result = await autoUpdater.checkForUpdates();
    const offered = result?.updateInfo?.version ?? null;
    if (!result?.isUpdateAvailable || offered !== version) {
      throw new Error(offered && offered !== version
        ? `GitHub is offering ${offered}, not ${version}. Check for updates again to see it.`
        : `GitHub is offering nothing newer than this version, so ${version} was not downloaded.`);
    }
    await autoUpdater.downloadUpdate();
    ready = version;
    return { version };
  }

  /** Downloads `version`, and only that version. Repeated calls while one
   * is running share it; once downloaded, it is not downloaded again. */
  async function prepare(version) {
    if (!isPackaged) {
      throw new Error('Updates install into the installed app only, not a development build.');
    }
    if (typeof version !== 'string' || !VERSION.test(version)) {
      throw new Error('That is not a version Prune can install.');
    }
    if (ready === version) return { version };
    if (!preparing) {
      preparing = download(version).finally(() => { preparing = null; });
    }
    return preparing;
  }

  /** Closes Prune, installs silently, and reopens it. Prune installs per
   * user, so there is no admin prompt, and no wizard to click through a
   * second time. */
  function install() {
    if (!ready) throw new Error('There is no downloaded update to install.');
    autoUpdater.quitAndInstall(true, true);
  }

  /** Whether a downloaded update installs the next time Prune closes. */
  function installOnQuit(enabled) {
    autoUpdater.autoInstallOnAppQuit = enabled === true;
  }

  return { prepare, install, installOnQuit, readyVersion: () => ready };
}

module.exports = { createUpdater };
