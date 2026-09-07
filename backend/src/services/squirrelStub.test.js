import { describe, it, expect } from 'vitest';
import { processStartTarget, newestAppDir } from './squirrelStub.js';

/** Squirrel launcher stubs, and the icon that isn't in them.
 *
 * Found on this machine: the user-hive Discord entry runs
 * "…\Discord\Update.exe" --processStart Discord.exe, and Update.exe
 * carries no icon resource at all -- PrivateExtractIcons reports 0, and so
 * does Windows' own ExtractIconExW. The row fell back to a lettered tile
 * even though the icon everyone recognises was one directory away, in
 * app-1.0.9256\Discord.exe.
 *
 * Squirrel is what Electron apps install with, so this shape is not one
 * program's quirk: Discord, Slack, GitHub Desktop, Signal and Teams
 * classic all write a Run value pointing at the same stub. The stub is
 * deliberately iconless -- it is a bootstrapper that hands off to the
 * versioned copy beside it -- so no amount of trying harder on Update.exe
 * will ever produce an icon. The command names the real executable, and
 * that is the thing to follow.
 */

describe('processStartTarget', () => {
  it('reads the executable a Squirrel stub is told to launch', () => {
    expect(processStartTarget('"C:\\Users\\me\\AppData\\Local\\Discord\\Update.exe" --processStart Discord.exe'))
      .toBe('Discord.exe');
  });

  it('accepts the = form', () => {
    expect(processStartTarget('Update.exe --processStart=Slack.exe')).toBe('Slack.exe');
  });

  it('accepts a quoted target', () => {
    // Teams and Slack both quote it.
    expect(processStartTarget('"...\\Update.exe" --processStart "Teams.exe"')).toBe('Teams.exe');
  });

  it('accepts the wait variant', () => {
    expect(processStartTarget('Update.exe --processStartAndWait GitHubDesktop.exe'))
      .toBe('GitHubDesktop.exe');
  });

  it('ignores anything that follows the target', () => {
    // Squirrel passes the app's own arguments after --process-start-args.
    expect(processStartTarget('Update.exe --processStart Discord.exe --process-start-args --start-minimized'))
      .toBe('Discord.exe');
  });

  it('is not fooled by a command that merely mentions the flag', () => {
    expect(processStartTarget('Update.exe --processStart')).toBe(null);
    expect(processStartTarget('Update.exe --processStart --other')).toBe(null);
  });

  it('refuses a target that is not a bare file name', () => {
    // The name is joined onto a directory this code chose. Anything with a
    // separator or a drive in it could walk out of that directory, and a
    // Run value is attacker-writable by anything already running as the
    // user -- so the only accepted shape is a plain leaf name.
    expect(processStartTarget('Update.exe --processStart ..\\..\\evil.exe')).toBe(null);
    expect(processStartTarget('Update.exe --processStart C:\\evil.exe')).toBe(null);
    expect(processStartTarget('Update.exe --processStart sub/dir/app.exe')).toBe(null);
  });

  it('has no opinion on an ordinary command', () => {
    expect(processStartTarget('"C:\\Program Files\\KeePassXC\\KeePassXC.exe"')).toBe(null);
    expect(processStartTarget('')).toBe(null);
    expect(processStartTarget(null)).toBe(null);
  });
});

describe('newestAppDir', () => {
  it('picks the highest version, comparing numbers rather than text', () => {
    // The reason this is not a plain sort: "app-1.0.9256" sorts BELOW
    // "app-1.0.999" as text, because '2' < '9' at the third character.
    // Discord's real directory on this machine is app-1.0.9256.
    expect(newestAppDir(['app-1.0.999', 'app-1.0.9256'])).toBe('app-1.0.9256');
  });

  it('compares segment by segment', () => {
    expect(newestAppDir(['app-1.2.3', 'app-1.10.0'])).toBe('app-1.10.0');
    expect(newestAppDir(['app-2.0.0', 'app-10.0.0'])).toBe('app-10.0.0');
  });

  it('handles versions of differing length', () => {
    expect(newestAppDir(['app-1.0', 'app-1.0.1'])).toBe('app-1.0.1');
  });

  it('ignores entries that are not app directories', () => {
    expect(newestAppDir(['packages', 'app.ico', 'Update.exe', 'app-1.0.5'])).toBe('app-1.0.5');
  });

  it('returns null when there is nothing to pick', () => {
    expect(newestAppDir([])).toBe(null);
    expect(newestAppDir(['packages', 'Update.exe'])).toBe(null);
    expect(newestAppDir(null)).toBe(null);
  });
});
