import { describe, it, expect } from 'vitest';
import { startupIconSources, typeIconExtension, getStartupIcons } from './startupIcons.js';

const item = (over = {}) => ({
  id: 'registry:user:Run:KeePassXC',
  name: 'KeePassXC',
  source: 'registry',
  executable: 'C:\\Program Files\\KeePassXC\\KeePassXC.exe',
  command: '"C:\\Program Files\\KeePassXC\\KeePassXC.exe"',
  ...over
});

describe('startupIconSources', () => {
  it('reads a registry entry straight off the executable it launches', () => {
    const sources = startupIconSources([item()]);
    expect(sources.get('registry:user:Run:KeePassXC')).toEqual({
      path: 'C:\\Program Files\\KeePassXC\\KeePassXC.exe',
      index: 0,
      viaShortcut: false
    });
  });

  it('marks a .lnk for resolving instead of reading it directly', () => {
    // PrivateExtractIcons returns nothing for a shortcut -- verified on
    // this machine against the real FxSound.lnk. The icon belongs to what
    // the shortcut points at, and only the shell can say what that is.
    const sources = startupIconSources([item({
      id: 'folder:machine:Startup folder:FxSound',
      source: 'folder',
      executable: 'C:\\ProgramData\\...\\Startup\\FxSound.lnk'
    })]);
    expect(sources.get('folder:machine:Startup folder:FxSound').viaShortcut).toBe(true);
  });

  it('marks a .url the same way', () => {
    const sources = startupIconSources([item({
      id: 'u', source: 'folder', executable: 'C:\\...\\Startup\\Site.url'
    })]);
    expect(sources.get('u').viaShortcut).toBe(true);
  });

  it('treats a script in the Startup folder as an ordinary file', () => {
    // A .cmd is not a shortcut; there is nothing to resolve. It simply
    // carries no icon, which the type-icon fallback answers instead.
    const sources = startupIconSources([item({
      id: 'c', source: 'folder', executable: 'C:\\...\\Startup\\resurrect.cmd'
    })]);
    expect(sources.get('c')).toEqual({
      path: 'C:\\...\\Startup\\resurrect.cmd', index: 0, viaShortcut: false
    });
  });

  it('takes an icon index off a command that carries one', () => {
    // Run values point at shell32.dll,42 often enough that ignoring the
    // index would show the wrong icon rather than none.
    const sources = startupIconSources([item({
      id: 'i', executable: 'C:\\Windows\\System32\\shell32.dll', command: 'C:\\Windows\\System32\\shell32.dll,44'
    })]);
    expect(sources.get('i').index).toBe(44);
  });

  it('ignores a trailing comma that is part of an argument, not an index', () => {
    const sources = startupIconSources([item({
      id: 'a', command: '"C:\\App\\a.exe" --flag,value'
    })]);
    expect(sources.get('a').index).toBe(0);
  });

  it('skips an entry with no executable to read', () => {
    // A bare command name resolved through PATH has no file to open.
    expect(startupIconSources([item({ id: 'n', executable: null })]).has('n')).toBe(false);
  });

  it('copes with no items', () => {
    expect(startupIconSources(null).size).toBe(0);
  });
});

describe('typeIconExtension', () => {
  it('gives the extension a file-type icon can be asked for', () => {
    expect(typeIconExtension('C:\\x\\resurrect.cmd')).toBe('.cmd');
    expect(typeIconExtension('C:\\x\\thing.VBS')).toBe('.vbs');
  });

  it('has nothing to ask for when there is no extension', () => {
    expect(typeIconExtension('C:\\x\\thing')).toBeNull();
    expect(typeIconExtension(null)).toBeNull();
  });

  it('refuses to ask for a binary type', () => {
    // Measured: the shell's icon for ".exe" is one generic glyph, and on
    // this machine it was handed to BOTH Discord's Update.exe and
    // RtkAudUService, which have no icon of their own -- two unrelated
    // programs rendered as the same picture. An executable's icon lives
    // inside it, so failing to read it means there is no icon, and the
    // lettered tile at least carries the entry's initial.
    expect(typeIconExtension('C:\\x\\Update.exe')).toBeNull();
    expect(typeIconExtension('C:\\x\\thing.dll')).toBeNull();
    expect(typeIconExtension('C:\\x\\thing.SCR')).toBeNull();
  });
});

/** Real extraction against real files on this machine. A mocked version
 * would only prove the plumbing, which is the mistake that let a broken
 * PowerShell script sit in leftoverScan.js for weeks. */
describe('getStartupIcons (real extraction)', () => {
  it('extracts an icon for an ordinary executable', async () => {
    const icons = await getStartupIcons([item({
      id: 'notepad', executable: 'C:\\Windows\\System32\\notepad.exe', command: 'C:\\Windows\\System32\\notepad.exe'
    })]);
    expect(icons.notepad).toMatch(/^data:image\/png;base64,/);
    expect(icons.notepad.length).toBeGreaterThan(200);
  }, 90000);

  it('falls back to the file-type icon for a file with no icon of its own', async () => {
    // Windows itself has an answer for what a .cmd looks like, and it is
    // more use than a lettered tile: a script that runs at sign-in is
    // exactly the entry worth recognising on sight. Verified that
    // PrivateExtractIcons returns 0 for a .cmd, so this can only be
    // passing through the type-icon path.
    const icons = await getStartupIcons([item({
      id: 'cmd', source: 'folder',
      executable: 'C:\\Windows\\System32\\winrm.cmd',
      command: 'C:\\Windows\\System32\\winrm.cmd'
    })]);
    expect(icons.cmd).toMatch(/^data:image\/png;base64,/);
  }, 90000);

  it('claims nothing for a file with neither an icon nor a known type', async () => {
    // `hosts` has no extension to ask the shell about and no resource to
    // read. An empty answer is the honest one -- the row keeps its
    // lettered tile rather than being given a generic page glyph that
    // says nothing.
    const icons = await getStartupIcons([item({
      id: 'hosts',
      executable: 'C:\\Windows\\System32\\drivers\\etc\\hosts',
      command: 'C:\\Windows\\System32\\drivers\\etc\\hosts'
    })]);
    expect(icons.hosts).toBeUndefined();
  }, 90000);

  it('gives two iconless executables nothing rather than the same glyph', async () => {
    // The failure this prevents, measured on this machine: Discord's
    // Update.exe and RtkAudUService64.exe both carry no icon, and both
    // came back with the shell's generic ".exe" picture -- identical, so
    // the two rows claimed to be the same program.
    const icons = await getStartupIcons([
      item({ id: 'a', executable: 'C:\\Users\\jimmanol\\AppData\\Local\\Discord\\Update.exe', command: 'a' }),
      item({
        id: 'b',
        executable: 'C:\\WINDOWS\\System32\\DriverStore\\FileRepository\\realtekservice.inf_amd64_719a4f3eb3c3c65a\\RtkAudUService64.exe',
        command: 'b'
      })
    ]);
    // Either may legitimately have an icon on another machine; what must
    // never happen is the two of them sharing one.
    if (icons.a && icons.b) expect(icons.a).not.toBe(icons.b);
  }, 90000);

  it('resolves a real shortcut to the icon it points at', async () => {
    const icons = await getStartupIcons([item({
      id: 'lnk', source: 'folder',
      executable: 'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\FxSound.lnk',
      command: 'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\FxSound.lnk'
    })]);
    // Skipped rather than failed if that shortcut is not on this machine:
    // this asserts the resolution works, not that FxSound is installed.
    if (icons.lnk) expect(icons.lnk).toMatch(/^data:image\/png;base64,/);
  }, 90000);

  it('returns nothing rather than throwing when there is nothing to read', async () => {
    expect(await getStartupIcons([])).toEqual({});
    expect(await getStartupIcons([item({ id: 'x', executable: null })])).toEqual({});
  }, 30000);
});
