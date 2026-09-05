import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestServer } from '../testSupport/routeServer.js';

/** The endpoint that runs a program's own uninstaller.
 *
 * runUninstaller is mocked, and has to be: the real one hands its
 * argument to cmd.exe. What is tested here is the stream contract the
 * Uninstall screen is built on -- that progress arrives while the
 * uninstaller is running rather than in one lump at the end, and that a
 * failure arrives as an event rather than as a dead connection.
 */

const runUninstaller = vi.fn(async (uninstallString, onEvent) => {
  if (!uninstallString) throw new Error('This program has no registered uninstall command.');
  onEvent('running', { command: uninstallString });
  onEvent('exited', { code: 0, stderr: null });
  return { code: 0 };
});

vi.mock('../services/uninstall.js', () => ({
  runUninstaller: (...a) => runUninstaller(...a)
}));

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => { vi.clearAllMocks(); });

const start = async (body) => {
  const res = await fetch(`${server.base}/uninstall`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return { res, text: await res.text() };
};

describe('POST /uninstall', () => {
  it('streams the uninstaller\'s progress rather than one lump at the end', async () => {
    // An uninstaller can run for a minute. A response that said nothing
    // until it finished would be indistinguishable from a hang, which is
    // the whole reason this is an event stream.
    const { res, text } = await start({ uninstallString: 'MsiExec.exe /X{GUID}' });
    expect(res.headers.get('content-type')).toMatch(/text\/event-stream/);
    expect(text).toContain('event: running');
    expect(text).toContain('MsiExec.exe /X{GUID}');
    expect(text).toContain('event: exited');
    expect(text).toContain('event: done');
  });

  it('reports a program with no uninstall command as an error event', async () => {
    // The stream's 200 is already sent by the time this is known, so
    // there is no status code left to carry it. A closed connection with
    // no explanation would look like a crash.
    const { text } = await start({});
    expect(text).toContain('event: error');
    expect(text).toContain('no registered uninstall command');
    expect(text).not.toContain('event: done');
  });

  it('ends the stream either way, rather than leaving it open', async () => {
    // Both branches run res.end(). A stream left open holds the
    // connection and the UI's spinner with it.
    runUninstaller.mockRejectedValueOnce(new Error('Failed to launch uninstaller: ENOENT'));
    const { text } = await start({ uninstallString: 'nope.exe' });
    expect(text).toContain('event: error');
    expect(text).toContain('ENOENT');
  });

  it('reports a non-zero exit without calling it a failure of its own', async () => {
    // Uninstallers routinely report success when they were not, and the
    // reverse. The code is surfaced; nothing downstream is gated on it,
    // which is why the leftover scan runs regardless.
    runUninstaller.mockImplementationOnce(async (str, onEvent) => {
      onEvent('exited', { code: 1603, stderr: 'fatal error during installation' });
      return { code: 1603 };
    });
    const { res, text } = await start({ uninstallString: 'MsiExec.exe /X{GUID}' });
    expect(res.status).toBe(200);
    expect(text).toContain('1603');
    expect(text).toContain('event: done');
  });

  it('is not reachable by a GET', async () => {
    const res = await server.call('/uninstall');
    expect(res.status).toBe(404);
    expect(runUninstaller).not.toHaveBeenCalled();
  });

  it('passes the uninstall string through verbatim -- the known trust boundary', async () => {
    // Recorded rather than approved. Unlike /programs/startup/toggle,
    // which takes only an id and looks the real target up itself, this
    // route hands the body's string to the service, which runs it through
    // cmd.exe. localOnly is what stops a web page reaching it; a local
    // process running as the same user could already run the command
    // directly, so it grants nothing new -- but the two routes disagree
    // about how much a client is trusted, and the more dangerous one is
    // the looser of the two. See the note in the commit that added this.
    await start({ uninstallString: '"C:\\Program Files\\Thing\\uninst.exe" /S' });
    expect(runUninstaller).toHaveBeenCalledWith(
      '"C:\\Program Files\\Thing\\uninst.exe" /S',
      expect.any(Function)
    );
  });
});
