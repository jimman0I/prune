const { contextBridge, ipcRenderer } = require('electron');

/** The crosshair's whole bridge: two fixed one-way messages, no arguments.
 *
 * It reports that the crosshair was dropped, or that the person cancelled.
 * It does not say where: the main process reads the pointer itself at that
 * moment (see hunterWidget.cjs), so the page has no coordinates to lie about
 * and nothing else to ask for. */
contextBridge.exposeInMainWorld('pruneHunterWidget', {
  drop: () => ipcRenderer.send('prune:hunter-widget:drop'),
  cancel: () => ipcRenderer.send('prune:hunter-widget:cancel')
});
