import { parseXml, XmlError, childElements, firstChild, textOf } from './xmlParse.js';
import { expandPath } from './expandPath.js';

/** Importing a BleachBit cleaner file (CleanerML) as Deep Clean rules.
 *
 * A subset, on purpose: `<cleaner>`, `<var>`, `<option>` and `<action
 * command="delete">` with search file / glob / walk.files / walk.all.
 * Anything else is SKIPPED -- never guessed at -- and counted by what it was,
 * so the person is told exactly what they did not get. Two cases look
 * importable and are not, and are skipped for that reason:
 *
 *   - an action with a regular-expression filter (regex, nregex, wholeregex,
 *     nwholeregex). Prune's delete has no such filter; importing the action
 *     without it would delete far more than the cleaner meant.
 *   - search="walk.top" and "deep", whose meanings Prune's delete action
 *     does not reproduce.
 *
 * Nothing in the file is ever executed or fetched. `command` is compared to
 * a fixed name and otherwise only counted; paths are text that later goes
 * through Prune's own expandPath and, at run time, through every guard a
 * Deep Clean rule has -- plus the protected places (`userDefined`), because
 * nobody here curated these paths. */

/** Real BleachBit cleaners are under 20 KB. */
export const MAX_XML_BYTES = 512 * 1024;
const MAX_OPTIONS = 200;
const MAX_ACTIONS = 5000;
const MAX_PATHS_PER_ACTION = 64;
const MAX_VAR_DEPTH = 8;

export class ImportError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ImportError';
    this.code = code;
  }
}

const SEARCH_FILES_ONLY = new Set(['file', 'glob']);
const SEARCH_TREE = new Set(['walk.files', 'walk.all']);
const FILTER_ATTRS = ['regex', 'nregex', 'wholeregex', 'nwholeregex'];

/** The %VARIABLES% expandPath resolves. Others are left unresolvable here. */
const KNOWN_ENV = new Set([
  'APPDATA', 'LOCALAPPDATA', 'LOCALAPPDATALOW', 'SYSTEMROOT', 'WINDIR', 'PROGRAMDATA', 'COMMONAPPDATA',
  'SYSTEMDRIVE', 'PROGRAMFILES', 'PROGRAMFILES(X86)', 'USERPROFILE', 'TEMP', 'WINDOWSSYSTEM'
]);

/** A safe id fragment: lower-case letters, digits and underscores. */
function slug(text) {
  return String(text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
}

/** The values of a <var> that apply on Windows (no os, or os="windows"). */
function windowsValues(varNode) {
  return childElements(varNode, 'value')
    .filter((v) => !v.attrs.os || v.attrs.os.toLowerCase() === 'windows')
    .map((v) => textOf(v))
    .filter(Boolean);
}

/** Every %NAME% token in a path that expandPath does not know, or null. */
function unknownEnvToken(path) {
  let at = 0;
  while (at < path.length) {
    const open = path.indexOf('%', at);
    if (open < 0) return null;
    const close = path.indexOf('%', open + 1);
    if (close < 0) return null;
    const name = path.slice(open + 1, close);
    // A token is a short run of name characters; anything else (a literal %
    // in a folder name) is left alone.
    if (name.length > 0 && name.length <= 24 && !/[\\/*?]/.test(name)) {
      if (!KNOWN_ENV.has(name.toUpperCase())) return `%${name}%`;
      at = close + 1;
    } else {
      at = close;
    }
  }
  return null;
}

/** Resolves $$name$$ in `path` against the cleaner's variables. Returns
 * { paths } (one per combination of values) or { missing: '$$name$$' }. */
function substitute(path, vars) {
  let results = [path];
  for (let depth = 0; depth < MAX_VAR_DEPTH; depth += 1) {
    let changed = false;
    const next = [];
    for (const current of results) {
      const open = current.indexOf('$$');
      if (open < 0) { next.push(current); continue; }
      const close = current.indexOf('$$', open + 2);
      if (close < 0) return { missing: current.slice(open) };
      const name = current.slice(open + 2, close);
      const key = Object.hasOwn(vars, name) ? name : Object.keys(vars).find((k) => k.toLowerCase() === name.toLowerCase());
      if (key === undefined || vars[key].length === 0) return { missing: `$$${name}$$` };
      for (const value of vars[key]) next.push(current.slice(0, open) + value + current.slice(close + 2));
      changed = true;
    }
    results = next;
    if (results.length > MAX_PATHS_PER_ACTION) return { missing: '(too many combinations)' };
    if (!changed) return { paths: results };
  }
  // Still holding a $$ after the allowed nesting: a variable that refers to
  // itself, directly or round a loop.
  const stuck = results.find((r) => r.includes('$$')) ?? results[0];
  const open = stuck.indexOf('$$');
  const close = stuck.indexOf('$$', open + 2);
  return { missing: close > open ? stuck.slice(open, close + 2) : stuck.slice(open) };
}

/** BleachBit writes both slashes; Prune's resolver takes either, but the
 * stored form is Windows': backslashes, no trailing separator. */
function normalizeSlashes(path) {
  return path.replace(/\//g, '\\').replace(/\\{2,}/g, '\\').replace(/\\+$/, '');
}

/** Why a resolved path is not acceptable, or null. */
function pathProblem(path) {
  if (!path || path.includes('..')) return 'path';
  if (!/^([A-Za-z]:|%|~)/.test(path)) return 'path'; // relative
  const token = unknownEnvToken(path);
  if (token) return { variable: token };
  const expanded = expandPath(path);
  if (!/^[A-Za-z]:\\/.test(expanded)) return 'path';
  // A wildcard in the first two folders (C:\*, C:\Users\*) matches half the
  // drive: almost certainly a mistake, and never worth the chance.
  const segments = expanded.split('\\').filter(Boolean);
  const firstWild = segments.findIndex((s) => s.includes('*'));
  if (firstWild !== -1 && firstWild < 3) return 'path';
  return null;
}

/** Imports one cleaner file's text.
 *
 * Returns { cleaner: { id, label, description, rules }, report }. `report`
 * is { options: {total, imported, skipped}, actions: {total, imported,
 * skipped}, skipped: [{ kind, detail, count }] } where kind is one of
 * command | search | filter | os | variable | path. Throws ImportError for a
 * file that cannot be imported at all. */
export function importBleachBitXml(text) {
  if (Buffer.byteLength(String(text ?? ''), 'utf8') > MAX_XML_BYTES) {
    throw new ImportError('tooLarge', `The file is larger than ${MAX_XML_BYTES / 1024} KB.`);
  }

  let root;
  try {
    root = parseXml(text);
  } catch (err) {
    if (err instanceof XmlError) throw new ImportError('notXml', err.message);
    throw err;
  }
  if (root.name !== 'cleaner') throw new ImportError('notCleaner', 'This is not a BleachBit cleaner file.');

  const id = slug(root.attrs.id);
  if (!id) throw new ImportError('noId', 'The cleaner has no id.');
  const label = textOf(firstChild(root, 'label')) || root.attrs.id;
  const description = textOf(firstChild(root, 'description'));
  const cleanerOs = (root.attrs.os ?? '').toLowerCase();
  const wrongCleanerOs = cleanerOs && cleanerOs !== 'windows' ? cleanerOs : null;

  const vars = {};
  for (const node of childElements(root, 'var')) {
    if (node.attrs.name) vars[node.attrs.name] = windowsValues(node);
  }

  const options = childElements(root, 'option');
  if (options.length > MAX_OPTIONS) throw new ImportError('tooLarge', `More than ${MAX_OPTIONS} options.`);
  const totalActions = options.reduce((sum, o) => sum + childElements(o, 'action').length, 0);
  if (totalActions > MAX_ACTIONS) throw new ImportError('tooLarge', `More than ${MAX_ACTIONS} actions.`);

  const tally = new Map(); // "kind\0detail" -> count
  const skip = (kind, detail = '') => {
    const key = `${kind}\u0000${detail}`;
    tally.set(key, (tally.get(key) ?? 0) + 1);
  };
  const report = { options: { total: options.length, imported: 0, skipped: 0 }, actions: { total: totalActions, imported: 0, skipped: 0 }, skipped: [] };
  const rules = [];

  for (const option of options) {
    const optionId = option.attrs.id || '';
    const actions = childElements(option, 'action');
    const treePaths = [];
    const filePaths = [];
    let imported = 0;

    for (const action of actions) {
      if (wrongCleanerOs) { skip('os', wrongCleanerOs); continue; }
      const os = (action.attrs.os ?? '').toLowerCase();
      if (os && os !== 'windows') { skip('os', os); continue; }
      if (action.attrs.command !== 'delete') { skip('command', action.attrs.command || '(none)'); continue; }
      const search = action.attrs.search ?? '';
      const filesOnly = SEARCH_FILES_ONLY.has(search);
      if (!filesOnly && !SEARCH_TREE.has(search)) { skip('search', search || '(none)'); continue; }
      if (FILTER_ATTRS.some((name) => Object.hasOwn(action.attrs, name))) { skip('filter', 'regex'); continue; }

      const raw = (action.attrs.path ?? '').trim();
      if (!raw) { skip('path'); continue; }
      const resolved = substitute(raw, vars);
      if (resolved.missing) { skip('variable', resolved.missing); continue; }

      const accepted = [];
      let problem = null;
      for (const candidate of resolved.paths) {
        const normalized = normalizeSlashes(candidate.trim());
        const issue = pathProblem(normalized);
        if (issue) { problem = issue; break; }
        accepted.push(normalized);
      }
      if (problem) {
        if (typeof problem === 'object') skip('variable', problem.variable); else skip('path');
        continue;
      }
      (filesOnly ? filePaths : treePaths).push(...accepted);
      imported += 1;
    }

    report.actions.imported += imported;
    report.actions.skipped += actions.length - imported;
    if (imported === 0) { report.options.skipped += 1; continue; }
    report.options.imported += 1;

    const warning = textOf(firstChild(option, 'warning'));
    const optionDescription = textOf(firstChild(option, 'description'));
    const deleteActions = [];
    const unique = (list) => [...new Set(list)];
    if (treePaths.length > 0) deleteActions.push({ type: 'delete', paths: unique(treePaths), userDefined: true });
    if (filePaths.length > 0) deleteActions.push({ type: 'delete', paths: unique(filePaths), filesOnly: true, userDefined: true });
    rules.push({
      id: `imp_${id}_${slug(optionId) || `option${rules.length + 1}`}`,
      category: label,
      name: textOf(firstChild(option, 'label')) || optionId || `Option ${rules.length + 1}`,
      description: [optionDescription, warning].filter(Boolean).join(' '),
      recommended: false,
      is_safe: false,
      ...(warning ? { risky: true } : {}),
      imported: true,
      importedFrom: id,
      actions: deleteActions
    });
  }

  report.skipped = [...tally.entries()].map(([key, count]) => {
    const [kind, detail] = key.split('\u0000');
    return { kind, detail, count };
  });
  return { cleaner: { id, label, description, rules }, report };
}
