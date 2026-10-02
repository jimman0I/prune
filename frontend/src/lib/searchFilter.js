/** The Disk Map's search box: what someone types, as a predicate.
 *
 * Three forms, told apart by what was typed and nothing else:
 *
 *   /pattern/ or /pattern/flags  -- a regular expression over the name.
 *       Case-insensitive unless flags are given (i, s, m, u are accepted;
 *       g and y are not, since a stateful regex would match differently the
 *       second time it saw the same name).
 *   text with * or ?             -- a wildcard over the WHOLE name, as in
 *       Explorer: `*.pak` is every .pak, `game?.pak` is game2.pak.
 *   anything else                -- a case-insensitive substring of the name.
 *
 * A pattern containing a path separator is matched against the full path
 * instead of the name, so `*\Games\*.pak` can say where.
 *
 * Nothing here throws. An invalid regex comes back `ok: false` with a reason
 * for the box to show, and while it is invalid nothing is filtered at all
 * (`active: false`, everything matches): half-typed `/(` should not blank the
 * screen on its way to being `/(a|b)/`. */
const REGEX_FORM = /^\/(.+)\/([a-z]*)$/s;
const ALLOWED_FLAGS = new Set(['i', 's', 'm', 'u']);
// Names are short; capping what reaches the engine keeps an accidental
// pathological pattern from being fed an absurd string.
const MAX_INPUT = 1024;

const NONE = { kind: 'none', ok: true, active: false, error: null, match: () => true };

export function compileFilter(text) {
  const raw = typeof text === 'string' ? text.trim() : '';
  if (raw === '') return NONE;

  const regexForm = REGEX_FORM.exec(raw);
  if (regexForm) {
    const [, source, flags] = regexForm;
    const bad = [...flags].find((f) => !ALLOWED_FLAGS.has(f));
    if (bad !== undefined) return invalid('regex', `Unknown flag "${bad}".`);
    let regex;
    try {
      regex = new RegExp(source, flags === '' ? 'i' : flags);
    } catch (err) {
      return invalid('regex', err.message);
    }
    // The name only. A regex that wants the path can say so in its own
    // terms with a plain-text or wildcard search instead.
    return build('regex', raw, (name) => regex.test(String(name).slice(0, MAX_INPUT)));
  }

  const lower = raw.toLowerCase();
  const usesPath = /[\\/]/.test(raw);

  if (/[*?]/.test(raw)) {
    const source = [...lower].map((ch) => (ch === '*' ? '.*' : ch === '?' ? '.' : ch.replace(/[.+^${}()|[\]\\/]/g, '\\$&'))).join('');
    const regex = new RegExp(`^${source}$`, 's');
    return build('wildcard', raw, (name, path) => regex.test(String(usesPath ? (path ?? name) : name).toLowerCase().slice(0, MAX_INPUT)));
  }

  return build('text', raw, (name, path) => String(usesPath ? (path ?? name) : name).toLowerCase().includes(lower));
}

function build(kind, raw, match) {
  return { kind, ok: true, active: true, error: null, match };
}

function invalid(kind, error) {
  return { kind, ok: false, active: false, error, match: () => true };
}
