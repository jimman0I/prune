import { describe, it, expect, beforeEach } from 'vitest';
import { getProgramIcons, clearIconCache } from './programIcons.js';

/** These run real PowerShell against real files on this machine. The
 * extraction is the whole feature, and a mocked version would only prove
 * the plumbing -- exactly the mistake that let a broken PowerShell script
 * sit in leftoverScan.js for weeks. */
describe('getProgramIcons (real extraction)', () => {
  beforeEach(() => clearIconCache());

  it('extracts a real icon from an executable on this machine', async () => {
    const icons = await getProgramIcons([
      { id: 'notepad', displayIcon: 'C:\\Windows\\System32\\notepad.exe' }
    ]);
    expect(icons.notepad).toMatch(/^data:image\/png;base64,/);
    // A real 64px PNG, not an empty or truncated one.
    expect(icons.notepad.length).toBeGreaterThan(200);
  }, 60000);

  it('honours an icon index into a resource DLL', async () => {
    // Indices 0 and 44, not 3 and 4: shell32's 3 and 4 are both folder
    // icons and are byte-identical on this Windows build, so that pair
    // fails whether the index works or not. Verified by extracting nine
    // indices and comparing hashes -- every other pair differs.
    const icons = await getProgramIcons([
      { id: 'a', displayIcon: 'C:\\Windows\\System32\\shell32.dll,0' },
      { id: 'b', displayIcon: 'C:\\Windows\\System32\\shell32.dll,44' }
    ]);
    expect(icons.a).toBeTruthy();
    expect(icons.b).toBeTruthy();
    // If the index were ignored, every program pointing at the same DLL
    // would come out looking the same.
    expect(icons.a).not.toBe(icons.b);
  }, 60000);

  it('omits a program whose icon file does not exist, rather than failing the batch', async () => {
    const icons = await getProgramIcons([
      { id: 'gone', displayIcon: 'C:\\nope\\missing.exe' },
      { id: 'real', displayIcon: 'C:\\Windows\\System32\\notepad.exe' }
    ]);
    expect(icons.gone).toBeUndefined();
    expect(icons.real).toBeTruthy();
  }, 60000);

  it('omits a program with nothing to extract from', async () => {
    const icons = await getProgramIcons([
      { id: 'msi', uninstallString: 'MsiExec.exe /X{GUID}' },
      { id: 'none', displayIcon: null, uninstallString: null }
    ]);
    expect(icons).toEqual({});
  }, 60000);

  it('returns an empty map for an empty list without spawning anything', async () => {
    expect(await getProgramIcons([])).toEqual({});
  });

  it('serves a repeat request from cache', async () => {
    const program = [{ id: 'notepad', displayIcon: 'C:\\Windows\\System32\\notepad.exe' }];
    await getProgramIcons(program);
    const started = Date.now();
    const icons = await getProgramIcons(program);
    // Cached means no PowerShell spawn, which is the difference between
    // milliseconds and hundreds of them.
    expect(Date.now() - started).toBeLessThan(150);
    expect(icons.notepad).toBeTruthy();
  }, 60000);

  it('shares one extraction between programs pointing at the same file', async () => {
    const icons = await getProgramIcons([
      { id: 'one', displayIcon: 'C:\\Windows\\System32\\notepad.exe' },
      { id: 'two', displayIcon: 'C:\\Windows\\System32\\notepad.exe,0' }
    ]);
    expect(icons.one).toBe(icons.two);
  }, 60000);
});
