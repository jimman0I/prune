import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parseRegQuery, isPruneExecutable } from './runAsAdmin.js';
import { captionsFor } from './explorerMenuCaptions.js';
import { getSettings } from './settings.js';

const execFileAsync = promisify(execFile);

/** "Add Prune to the right-click menu", as an opt-in.
 *
 * Four shell verbs in the per-user class registry (HKCU\Software\Classes, so no
 * administrator rights, and only for this account):
 *
 *   *\shell\PruneShred                  "Shred with Prune"           any file
 *   Directory\shell\PruneShred          "Shred with Prune"           any folder
 *   exefile\shell\PruneFindProgram      "Find in Prune (uninstall)"  a program
 *   lnkfile\shell\PruneFindProgram      "Find in Prune (uninstall)"  a shortcut
 *
 * each with a caption (the key's default value, in the app's language: see
 * explorerMenuCaptions.js), an Icon, and a `command` subkey holding
 *
 *   "<Prune.exe>" --shred "%1"          or          "<Prune.exe>" --find-program "%1"
 *
 * A program that adds itself to the context menu is the thing Explorer shell
 * extensions do and malware imitates, so the rules are the strict ones, each
 * with a test:
 *  - Only an explicit switch in Settings writes it. It is never a side effect
 *    of anything else, and it is off until turned on.
 *  - It is the running, packaged Prune.exe and nothing else. A development
 *    build (electron.exe), another platform, or a path that could not be put in
 *    a command safely (a quote, a percent sign, a control character, an absurd
 *    length) is refused.
 *  - The command is the quoted path, one of two fixed flags, and "%1". Nothing
 *    else can be in it, and a command that has anything else in it is not one
 *    Prune wrote (parseCommand). It is a REG_SZ, never expanded by a shell.
 *  - A request only ever SHOWS something: main.cjs turns the flag into an
 *    in-app dialog, and nothing is shredded or uninstalled without the dialog's
 *    own confirmation (electron/explorerRequests.cjs).
 *  - The registry is read for the real state; nothing is remembered in
 *    settings.json.
 *  - Turning it off removes every key it made, and the empty parents it made
 *    with them, but never a key whose command it did not write, and never a
 *    parent that anything else is in.
 *  - reg.exe is run by full path with an argv array and no shell.
 *  - The uninstaller removes the same four keys (electron/build/installer.nsh).
 *
 * `exec`, `execPath`, `platform`, `systemRoot` and `language` are injectable; no
 * test writes the real registry. */

export const SHRED_FLAG = '--shred';
export const FIND_FLAG = '--find-program';

const CLASSES = 'HKCU\\Software\\Classes';

/** The four verbs. `caption` names which of the two captions the verb shows. */
export const ENTRIES = [
  { id: 'shred-files', key: `${CLASSES}\\*\\shell\\PruneShred`, flag: SHRED_FLAG, caption: 'shred' },
  { id: 'shred-folders', key: `${CLASSES}\\Directory\\shell\\PruneShred`, flag: SHRED_FLAG, caption: 'shred' },
  { id: 'find-programs', key: `${CLASSES}\\exefile\\shell\\PruneFindProgram`, flag: FIND_FLAG, caption: 'find' },
  { id: 'find-shortcuts', key: `${CLASSES}\\lnkfile\\shell\\PruneFindProgram`, flag: FIND_FLAG, caption: 'find' }
];

const FLAGS = new Set([SHRED_FLAG, FIND_FLAG]);

/** The command a verb runs: the quoted exe path, the flag, and "%1". */
export function commandFor(exe, flag) {
  if (!FLAGS.has(flag)) throw new Error('Unknown menu flag.');
  return `"${exe}" ${flag} "%1"`;
}

/** What a command written by Prune holds, or null if it is not one:
 * `"<...\Prune.exe>" <the verb's flag> "%1"` and nothing more. */
export function parseCommand(data, flag) {
  const match = /^"([^"%]+)" (--shred|--find-program) "%1"$/.exec(String(data ?? '').trim());
  if (!match || match[2] !== flag || !isPruneExecutable(match[1], 'win32')) return null;
  return { exe: match[1] };
}

/** The packaged Prune.exe, with a path that can sit inside a quoted command:
 * no quote, no percent sign, no control character, a sane length. */
function unsafePath(execPath) {
  return typeof execPath !== 'string' || execPath.length > 400 || /["%\u0000-\u001f]/.test(execPath);
}

export function createExplorerMenu({
  exec = execFileAsync,
  execPath = process.execPath,
  platform = process.platform,
  systemRoot = process.env.SystemRoot || process.env.windir || 'C:\\Windows',
  language = async () => (await getSettings()).language
} = {}) {
  const reg = `${systemRoot}\\System32\\reg.exe`;
  const packaged = isPruneExecutable(execPath, platform);
  const reason = !packaged ? 'notPackaged' : unsafePath(execPath) ? 'unsafePath' : null;
  const supported = reason === null;
  const run = (args) => exec(reg, args, { windowsHide: true, timeout: 15_000 });

  /** Output of a read, or '' when the key or value is not there (reg.exe
   * answers exit code 1 for both, in the machine's language). Anything else
   * that goes wrong is a real error. */
  async function read(args) {
    try {
      return String((await run(args)).stdout ?? '');
    } catch (err) {
      if (err?.code === 1) return '';
      throw err;
    }
  }

  /** The captions in the app's language. A settings file that cannot be read
   * is no reason to fail: English. */
  async function currentCaptions() {
    try {
      return captionsFor(await language());
    } catch {
      return captionsFor('en');
    }
  }

  /** One verb as the registry has it:
   *   absent   no such key
   *   orphan   the key is there but has no command: it can run nothing
   *   ours     its command is Prune's own, for this verb
   *   foreign  something else's command under Prune's key name */
  async function inspect(entry, captions) {
    const head = await read(['query', entry.key, '/ve']);
    if (head.trim() === '') return { entry, state: 'absent' };
    const caption = parseRegQuery(head)[0]?.data ?? null;
    const command = parseRegQuery(await read(['query', `${entry.key}\\command`, '/ve']))[0]?.data;
    if (command === undefined) return { entry, state: 'orphan' };
    const parsed = parseCommand(command, entry.flag);
    if (!parsed) return { entry, state: 'foreign' };
    return {
      entry,
      state: 'ours',
      stale: parsed.exe.toLowerCase() !== execPath.toLowerCase(),
      captionOk: caption === captions[entry.caption]
    };
  }

  const inspectAll = (captions) => Promise.all(ENTRIES.map((entry) => inspect(entry, captions)));

  async function status() {
    const captions = await currentCaptions();
    if (!supported) {
      return { supported: false, reason, enabled: false, incomplete: false, stale: false, foreign: false, captions };
    }
    const found = await inspectAll(captions);
    const ours = found.filter((f) => f.state === 'ours');
    return {
      supported: true,
      enabled: ours.length > 0,
      incomplete: ours.length > 0 && ours.length < ENTRIES.length,
      stale: ours.some((f) => f.stale),
      foreign: found.some((f) => f.state === 'foreign'),
      captions
    };
  }

  /** A verb is written caption and icon first and the command LAST: a write
   * that stops half-way leaves a key with no command, which runs nothing. */
  async function writeEntry(entry, captions) {
    await run(['add', entry.key, '/ve', '/t', 'REG_SZ', '/d', captions[entry.caption], '/f']);
    await run(['add', entry.key, '/v', 'Icon', '/t', 'REG_SZ', '/d', `"${execPath}",0`, '/f']);
    await run(['add', `${entry.key}\\command`, '/ve', '/t', 'REG_SZ', '/d', commandFor(execPath, entry.flag), '/f']);
  }

  /** Whether a key holds nothing at all: no value and no subkey. `reg query`
   * prints the key's own path, then one line per value and per subkey. */
  async function isEmptyKey(key) {
    const out = await read(['query', key]);
    if (out.trim() === '') return false; // not there: nothing to delete
    return out.split(/\r?\n/).filter((line) => line.trim() !== '').length <= 1;
  }

  /** Deletes a verb, then the `shell` key and the class key above it if (and
   * only if) the verb was the last thing in them. */
  async function removeEntry(entry) {
    await run(['delete', entry.key, '/f']);
    const parts = entry.key.split('\\');
    for (const depth of [1, 2]) {
      const parent = parts.slice(0, parts.length - depth).join('\\');
      if (!(await isEmptyKey(parent))) break;
      await run(['delete', parent, '/f']);
    }
  }

  async function apply(enabled) {
    const captions = await currentCaptions();
    const found = await inspectAll(captions);
    if (!enabled) {
      // Only what is Prune's: its own verbs, and the commandless leftovers of a
      // write that stopped half-way. A foreign command under the name stays.
      for (const f of found) if (f.state === 'ours' || f.state === 'orphan') await removeEntry(f.entry);
      return;
    }
    const created = [];
    try {
      for (const f of found) {
        if (f.state === 'ours' && !f.stale && f.captionOk) continue;
        if (f.state !== 'ours') created.push(f.entry);
        await writeEntry(f.entry, captions);
      }
    } catch (err) {
      // Leave nothing half-made that this call started. What was Prune's before
      // stays, as it was or as far as it got.
      for (const entry of created) await removeEntry(entry).catch(() => {});
      throw err;
    }
  }

  // Changes are applied one after another: each reads what the previous one
  // left, so two quick toggles cannot undo each other half-way.
  let queue = Promise.resolve();
  const serialised = (fn) => {
    const result = queue.then(fn);
    queue = result.catch(() => {});
    return result;
  };

  function set(request) {
    const enabled = request?.enabled;
    if (enabled !== true && enabled !== false) return Promise.reject(new Error('enabled must be true or false.'));
    if (!supported) {
      return Promise.reject(Object.assign(new Error('This can only be set from the installed Prune app.'), { unsupported: true, reason }));
    }
    return serialised(async () => { await apply(enabled); return status(); });
  }

  /** Brings EXISTING Prune verbs up to date: the install moved to another
   * folder (an update), or the app's language changed. Never creates a verb and
   * never touches one that is not Prune's. */
  function repair() {
    if (!supported) return Promise.resolve({ action: 'none' });
    return serialised(async () => {
      const captions = await currentCaptions();
      const found = await inspectAll(captions);
      let updated = false;
      for (const f of found) {
        if (f.state !== 'ours' || (!f.stale && f.captionOk)) continue;
        await writeEntry(f.entry, captions);
        updated = true;
      }
      return { action: updated ? 'updated' : 'none' };
    });
  }

  return { status, set, repair };
}

const service = createExplorerMenu();
export const getExplorerMenu = () => service.status();
export const setExplorerMenu = (request) => service.set(request);
export const repairExplorerMenu = () => service.repair();
