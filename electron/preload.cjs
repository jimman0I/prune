const { contextBridge, ipcRenderer } = require('electron');

/** The whole bridge, and it does one thing.
 *
 * Windows paints the minimize/maximize/close buttons itself, over the bar
 * the app draws (see titleBarOverlay in main.cjs). Those colours are set
 * once when the window is created and are NOT CSS -- nothing in the
 * stylesheet reaches them -- so switching the app to its light theme left
 * three dark glyphs on a light strip.
 *
 * This is deliberately not "expose the window to the renderer". It sends
 * one string, the main process validates it against a fixed list, and
 * there is no minimize, maximize or close here: those stay Windows' own,
 * which is the reason this app kept Snap Layouts and correct edge
 * hit-testing instead of drawing its own buttons.
 */
contextBridge.exposeInMainWorld('pruneWindow', {
  setTheme: (theme) => ipcRenderer.send('prune:theme', theme)
});
