/** Hands a Blob to the user as a file download, with no round trip to the
 * backend and no new IPC: the renderer makes the file itself and the browser
 * layer (Electron's, in the packaged app) does the saving.
 *
 * The object URL is revoked on the next turn rather than immediately, since
 * revoking before the browser has started reading the link can cancel the
 * download. `doc`, `urlApi` and `defer` are injectable so this is testable
 * without a real download. */
export function saveBlob(blob, filename, { doc = document, urlApi = URL, defer = (fn) => setTimeout(fn, 0) } = {}) {
  const url = urlApi.createObjectURL(blob);
  const link = doc.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  doc.body.appendChild(link);
  link.click();
  link.remove();
  defer(() => urlApi.revokeObjectURL(url));
}
