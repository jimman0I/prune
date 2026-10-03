import { describe, it, expect } from 'vitest';
import { packagedDefaults } from './cliPaths.js';

/** Where the command line finds Prune's data when nobody told it.
 *
 * The desktop app is handed its settings, Quarantine and sqlite3.exe by
 * electron/main.cjs; `prune-cli` is run by Windows or from a console and gets
 * none of that. Without these defaults it fell back to %LOCALAPPDATA%\Prune --
 * a different folder from the app's %APPDATA%\Prune -- and so cleaned with
 * default settings, ignoring the person's exclusions and recent-files guard.
 * The defaults apply only to the copy that ships inside an installed Prune
 * (resources\backend\src\cli.js); a checkout is left alone. */

const CLI = 'C:\\Users\\me\\AppData\\Local\\Programs\\Prune\\resources\\backend\\src\\cli.js';
const env = { APPDATA: 'C:\\Users\\me\\AppData\\Roaming' };

describe('packagedDefaults', () => {
  it('points an installed copy at the app\'s own userData folder and shipped sqlite3.exe', () => {
    expect(packagedDefaults({ cliPath: CLI, env })).toEqual({
      settings: 'C:\\Users\\me\\AppData\\Roaming\\Prune\\settings.json',
      quarantine: 'C:\\Users\\me\\AppData\\Roaming\\Prune\\quarantine',
      sqlite: 'C:\\Users\\me\\AppData\\Local\\Programs\\Prune\\resources\\sqlite3.exe'
    });
  });

  it('works in any install folder, spaces included, and either slash', () => {
    const spaced = packagedDefaults({ cliPath: 'D:/Program Files/Prune/resources/backend/src/cli.js', env });
    expect(spaced.sqlite).toBe('D:\\Program Files\\Prune\\resources\\sqlite3.exe');
    expect(spaced.settings).toBe('C:\\Users\\me\\AppData\\Roaming\\Prune\\settings.json');
  });

  it('leaves a checkout alone: nothing to default', () => {
    expect(packagedDefaults({ cliPath: 'C:\\dev\\prune\\backend\\src\\cli.js', env })).toBeNull();
    expect(packagedDefaults({ cliPath: 'C:\\dev\\resources\\other\\src\\cli.js', env })).toBeNull();
  });

  it('has nothing to offer without %APPDATA%', () => {
    expect(packagedDefaults({ cliPath: CLI, env: {} })).toBeNull();
    expect(packagedDefaults({ cliPath: CLI, env: { APPDATA: '' } })).toBeNull();
  });

  it('ignores a missing path', () => {
    expect(packagedDefaults({ cliPath: undefined, env })).toBeNull();
    expect(packagedDefaults({ cliPath: '', env })).toBeNull();
  });
});
