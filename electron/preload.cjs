const { contextBridge, ipcRenderer } = require('electron');

/** The whole bridge between the window and the main process.
 *
 * Deliberately narrow. It is not "expose the window" or "expose Electron":
 * each entry sends one fixed kind of request, and the main process checks
 * every argument it is given.
 *
 * setTheme -- Windows paints the minimize/maximize/close buttons itself,
 * over the bar the app draws (see titleBarOverlay in main.cjs). Those
 * colours are not CSS, so switching the app to its light theme left three
 * dark glyphs on a light strip until the renderer could say so. There is
 * no minimize, maximize or close here: those stay Windows' own, which is
 * the reason this app kept Snap Layouts and correct edge hit-testing.
 *
 * updates -- the side-nav update button (components/UpdateButton.jsx).
 * The renderer names the version it showed the user; main.cjs hands it to
 * electron/updater.cjs, which refuses any other. It cannot pass a URL, a
 * path or a command: where the update comes from is fixed in the build
 * (the GitHub release), not chosen here.
 */
contextBridge.exposeInMainWorld('pruneWindow', {
  setTheme: (theme) => ipcRenderer.send('prune:theme', theme),
  updates: {
    prepare: (version) => ipcRenderer.invoke('prune:update:prepare', version),
    install: () => ipcRenderer.invoke('prune:update:install'),
    setInstallOnQuit: (enabled) => ipcRenderer.invoke('prune:update:install-on-quit', enabled === true),
    onProgress: (callback) => {
      const listener = (_event, percent) => callback(percent);
      ipcRenderer.on('prune:update:progress', listener);
      return () => ipcRenderer.removeListener('prune:update:progress', listener);
    }
  }
});
