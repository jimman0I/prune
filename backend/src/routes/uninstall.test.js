import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestServer } from '../testSupport/routeServer.js';

/** The endpoint that runs a program's own uninstaller.
 *
 * Two things under test, and they pull in different directions.
 *
 * The first is the trust boundary. This route ends in cmd.exe, so what it
 * agrees to run has to come from the machine rather than from the request
 * -- the same rule /programs/startup/toggle already follows. The body
 * names a program; the command comes from a fresh read of the uninstall
 * registry.
 *
 * The second is the stream. An uninstaller can run for a minute, so
 * progress has to arrive while it runs. That is why the validation has to
 * finish BEFORE the stream opens: once a 200 and an event-stream header
 * are on the wire there is no status code left to refuse with.
 */

const programs = [
  { id: 'Thing', name: 'Thing', uninstallString: '"C:\\Program Files\\Thing\\uninst.exe" /S' },
  { id: 'Msi App', name: 'Msi App', uninstallString: 'MsiExec.exe /X{GUID}' },
  { id: 'No Uninstaller', name: 'No Uninstaller', uninstallString: null }
];
const listInstalledPrograms = vi.fn(async () => programs);
vi.mock('../services/programs.js', () => ({
  listInstalledPrograms: (...a) => listInstalledPrograms(...a)
}));

const runUninstaller = vi.fn(async (uninstallString, onEvent) => {
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
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { res, text: await res.text() };
};

describe('what POST /uninstall agrees to run', () => {
  it('runs the command the registry holds, never one the request supplied', async () => {
    // The point of the whole route. A body that names a program AND a
    // command gets the command ignored: the string handed to cmd.exe is
    // the one read back out of the uninstall registry a moment ago.
    const { text } = await start({
      programId: 'Thing',
      uninstallString: 'calc.exe & echo anything at all'
    });
    /* The whole program now, not a bare string: making an uninstall silent
     * needs QuietUninstallString as well, and it comes from this same
     * fresh registry read. What this test is about is unchanged -- the
     * command run is the registry's, never the request's. */
    expect(runUninstaller).toHaveBeenCalledWith(
      expect.objectContaining({ uninstallString: '"C:\\Program Files\\Thing\\uninst.exe" /S' }),
      expect.any(Function)
    );
    expect(text).not.toContain('calc.exe');
  });

  it('reads the registry fresh for every uninstall', async () => {
    // Not cached, deliberately. Every uninstall changes the registry this
    // reads, so a batch working from one snapshot would be checking each
    // program against a list that its own earlier removals invalidated.
    await start({ programId: 'Thing' });
    await start({ programId: 'Msi App' });
    expect(listInstalledPrograms).toHaveBeenCalledTimes(2);
  });

  it('needs a program id', async () => {
    for (const body of [undefined, {}, { programId: '' }, { programId: 42 }, { uninstallString: 'calc.exe' }]) {
      const { res } = await start(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    expect(runUninstaller).not.toHaveBeenCalled();
  });

  it('is a 404 for a program that is no longer installed', async () => {
    // The list on screen is a snapshot, and a program genuinely can be
    // gone by the time its row is clicked -- including because an earlier
    // program in the same batch removed it.
    const { res, text } = await start({ programId: 'Uninstalled Already' });
    expect(res.status).toBe(404);
    expect(JSON.parse(text).error).toMatch(/no longer/i);
    expect(runUninstaller).not.toHaveBeenCalled();
  });

  it('refuses a program whose registry entry registers no uninstall command', async () => {
    const { res, text } = await start({ programId: 'No Uninstaller' });
    expect(res.status).toBe(400);
    expect(JSON.parse(text).error).toMatch(/no registered uninstall command/i);
    expect(runUninstaller).not.toHaveBeenCalled();
  });

  it('refuses with a real status code, before the stream opens', async () => {
    // Not as an error event on a 200. Once the event-stream header is on
    // the wire the refusal has to be smuggled through the body, and every
    // caller has to parse a stream to discover its request was rejected.
    const { res } = await start({ programId: 'Uninstalled Already' });
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
    expect(res.headers.get('content-type')).not.toMatch(/event-stream/);
  });

  it('is not reachable by a GET', async () => {
    const res = await server.call('/uninstall');
    expect(res.status).toBe(404);
    expect(runUninstaller).not.toHaveBeenCalled();
  });
});

describe('the stream, once a command has been settled on', () => {
  it("streams the uninstaller's progress rather than one lump at the end", async () => {
    // An uninstaller can run for a minute. A response that said nothing
    // until it finished would be indistinguishable from a hang, which is
    // the whole reason this is an event stream.
    const { res, text } = await start({ programId: 'Msi App' });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/event-stream/);
    expect(text).toContain('event: running');
    expect(text).toContain('MsiExec.exe /X{GUID}');
    expect(text).toContain('event: exited');
    expect(text).toContain('event: done');
  });

  it('reports a launch failure as an error event, since the 200 is already sent', async () => {
    runUninstaller.mockRejectedValueOnce(new Error('Failed to launch uninstaller: ENOENT'));
    const { text } = await start({ programId: 'Thing' });
    expect(text).toContain('event: error');
    expect(text).toContain('ENOENT');
    expect(text).not.toContain('event: done');
  });

  it('reports a non-zero exit without calling it a failure of its own', async () => {
    // Uninstallers routinely report success when they were not, and the
    // reverse. The code is surfaced; nothing downstream is gated on it,
    // which is why the leftover scan runs regardless.
    runUninstaller.mockImplementationOnce(async (str, onEvent) => {
      onEvent('exited', { code: 1603, stderr: 'fatal error during installation' });
      return { code: 1603 };
    });
    const { res, text } = await start({ programId: 'Msi App' });
    expect(res.status).toBe(200);
    expect(text).toContain('1603');
    expect(text).toContain('event: done');
  });
});
