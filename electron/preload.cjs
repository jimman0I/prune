const { contextBridge, ipcRenderer, webUtils } = require('electron');

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
 * admin -- the Disk Map's 'Restart Prune as administrator'. Two requests,
 * neither with an argument: whether a restart is possible here (a packaged
 * build on Windows) and the restart itself. The main process starts its own
 * executable elevated and quits only if that worked; the window cannot name
 * a program, a path or a command (see relaunchAdmin.cjs).
 *
 * updates -- the side-nav update button (components/UpdateButton.jsx).
 * The renderer names the version it showed the user; main.cjs hands it to
 * electron/updater.cjs, which refuses any other. It cannot pass a URL, a
 * path or a command: where the update comes from is fixed in the build
 * (the GitHub release), not chosen here.
 *
 * hunter -- the Hunter dialog's drag-the-crosshair flow (hunterWidget.cjs).
 * start opens the crosshair and minimises Prune; the only thing it carries
 * is two short plain-text labels for the crosshair (a hint and a cancel word,
 * already translated), which the main process cuts and cleans. cancel closes
 * the crosshair. onResult hears the answer once, on a one-way event: what the
 * crosshair was dropped on (or that it was cancelled). The window never
 * supplies a coordinate, a path or a command -- the main process reads the
 * pointer itself and asks the backend.
 *
 * onOpenRequest -- File Explorer's right-click entries ("Shred with Prune",
 * "Find in Prune (uninstall)"). The main process reads them from the command
 * line (explorerRequests.cjs) and sends each to the page on one one-way event:
 * { kind: 'shred' | 'find-program', path }. The page can send back only one
 * thing, whether it is listening (true/false), so a request that arrives while
 * it loads waits instead of being lost. A request only ever opens a dialog; it
 * does not make the main process do anything.
 *
 * pickPaths / pathForFile -- Deep Clean's "Shred files...". pickPaths asks
 * the main process for a native chooser ('files' or 'folders') and gets
 * path strings back. pathForFile turns a dropped File into its real path
 * (a sandboxed page cannot read it any other way); it only reads, and
 * what is done with the path is decided by the backend's own guards.
 */
contextBridge.exposeInMainWorld('pruneWindow', {
  setTheme: (theme) => ipcRenderer.send('prune:theme', theme),
  admin: {
    canRelaunch: () => ipcRenderer.invoke('prune:admin:can-relaunch'),
    relaunch: () => ipcRenderer.invoke('prune:admin:relaunch')
  },
  hunter: {
    start: (labels) => ipcRenderer.invoke('prune:hunter:start', {
      hint: labels && typeof labels.hint === 'string' ? labels.hint : '',
      cancel: labels && typeof labels.cancel === 'string' ? labels.cancel : ''
    }),
    cancel: () => ipcRenderer.invoke('prune:hunter:cancel'),
    onResult: (callback) => {
      const listener = (_event, result) => callback(result);
      ipcRenderer.on('prune:hunter:result', listener);
      return () => ipcRenderer.removeListener('prune:hunter:result', listener);
    }
  },
  onOpenRequest: (callback) => {
    const listener = (_event, request) => {
      const kind = request && request.kind;
      const path = request && request.path;
      if ((kind === 'shred' || kind === 'find-program') && typeof path === 'string') callback({ kind, path });
    };
    ipcRenderer.on('prune:open-request', listener);
    ipcRenderer.send('prune:open-request:ready', true);
    return () => {
      ipcRenderer.removeListener('prune:open-request', listener);
      ipcRenderer.send('prune:open-request:ready', false);
    };
  },
  pickPaths: (kind) => ipcRenderer.invoke('prune:pick-paths', kind),
  pathForFile: (file) => {
    try { return webUtils.getPathForFile(file) || ''; } catch { return ''; }
  },
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
