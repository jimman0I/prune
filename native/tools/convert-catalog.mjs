// Converts Prune 3.x's UI catalog into Fluent files for Prune 4.0.
//
//   node native/tools/convert-catalog.mjs [--force]
//
// Reads frontend/src/i18n/catalog.js (CATALOG, extras merged), the Deep
// Clean rule text in frontend/src/i18n/cleaner/<lang>.js and its English in
// backend/src/data/cleaners.json, and writes, for every language,
// native/crates/prune-core/locales/<lang>/prune.ftl and cleaners.ftl, plus
// locales/needs-review.json.
//
// This is a one-shot: 3.x's catalog is frozen, and the .ftl files it wrote
// are source from then on (some entries were rewritten by hand afterwards).
// It refuses to overwrite them unless given --force.
//
// Keys: a 3.x dotted path becomes a Fluent id with "." replaced by "-". A
// character Fluent ids don't allow inside a segment (space, "|", "(", "-"
// and so on) becomes "_<hex code point>_", so "Run (32-bit)|machine" is
// "Run_20__28_32_2d_bit_29__7c_machine". prune-core's i18n.rs applies the
// same mapping to the key t() is given. Two keys mapping to one id is an
// error. Cleaner text is keyed "cleaner.rules.<id>.name",
// "cleaner.rules.<id>.description" and "cleaner.categories.<English name>".
//
// Functions: their parameter names come from fn.toString(). Each is called
// once with sentinel strings, and the output, with each sentinel replaced
// by `{ $name }`, is the Fluent pattern. It is then called with the numbers
// 0, 1, 2, 3, 5, 11, 21, 22 and 101, in one parameter at a time and in all
// at once; if any output differs from the pattern with the number put in,
// or a call throws, the function chose its words by the value (a plural,
// most likely). Its pattern is still written, under a "# needs-review"
// comment, and its key is listed in needs-review.json. Plural rules are
// never invented here.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const i18n = join(repo, 'frontend', 'src', 'i18n');
const out = join(repo, 'native', 'crates', 'prune-core', 'locales');

const fail = (message) => {
  console.error(`convert-catalog: ${message}`);
  process.exit(1);
};

if (existsSync(join(out, 'en', 'prune.ftl')) && !process.argv.includes('--force')) {
  fail(`${out} already has generated files, which may carry hand fixes; pass --force to overwrite them`);
}

const { CATALOG } = await import(pathToFileURL(join(i18n, 'catalog.js')).href);
const { CLEANER_TEXT } = await import(pathToFileURL(join(i18n, 'cleaner', 'index.js')).href);
const { LANGUAGES } = await import(pathToFileURL(join(i18n, 'languages.js')).href);
const rules = JSON.parse(readFileSync(join(repo, 'backend', 'src', 'data', 'cleaners.json'), 'utf8'));

const codes = LANGUAGES.map((l) => l.code);
if (codes.length !== 40) fail(`languages.js lists ${codes.length} languages, expected 40`);

// ---- ids -------------------------------------------------------------------

function segmentId(segment) {
  if (segment.includes('.')) fail(`key segment "${segment}" contains "."`);
  let id = '';
  for (const ch of segment) id += /[A-Za-z0-9_]/.test(ch) ? ch : `_${ch.codePointAt(0).toString(16)}_`;
  return id;
}

function toId(path) {
  const id = path.map(segmentId).join('-');
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(id)) fail(`key "${path.join('.')}" gives "${id}", not a Fluent id`);
  return id;
}

// ---- patterns --------------------------------------------------------------

const SENT_OPEN = '\u{E000}';
const SENT_CLOSE = '\u{E001}';
const sentinel = (name) => SENT_OPEN + name + SENT_CLOSE;
const literal = (text) => `{"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"}`;

/** One line of text as Fluent pattern text: braces become string literals,
 * and so do leading and trailing spaces (Fluent trims them) and a leading
 * "[", "*" or "." (special at the start of a continuation line). */
function escapeLine(line) {
  if (line === '') return '{""}';
  let body = line.replace(/[{}]/g, (brace) => literal(brace));
  const lead = /^ +/.exec(body);
  if (lead) body = literal(lead[0]) + body.slice(lead[0].length);
  else if (/^[[*.]/.test(body)) body = literal(body[0]) + body.slice(1);
  const trail = / +$/.exec(body);
  if (trail) body = body.slice(0, body.length - trail[0].length) + literal(trail[0]);
  return body;
}

/** `id = value`, with sentinels turned into placeables. */
function message(id, text) {
  if (text.includes('\r')) fail(`${id} contains a carriage return`);
  const lines = text.split('\n').map((line) =>
    escapeLine(line).replace(/\u{E000}([A-Za-z][A-Za-z0-9_]*)\u{E001}/gu, '{ $$$1 }')
  );
  if (lines.some((line) => line.includes(SENT_OPEN) || line.includes(SENT_CLOSE))) {
    return null;
  }
  return lines.length === 1 ? `${id} = ${lines[0]}` : `${id} =\n${lines.map((l) => `    ${l}`).join('\n')}`;
}

// ---- functions -------------------------------------------------------------

const PROBES = [0, 1, 2, 3, 5, 11, 21, 22, 101];

function parameters(fn) {
  const source = fn.toString();
  const match = /^\s*(?:async\s*)?(?:function\b[^(]*)?\(([^)]*)\)/.exec(source) ?? /^\s*([A-Za-z_$][\w$]*)\s*=>/.exec(source);
  if (!match) return null;
  const names = match[1].split(',').map((p) => p.trim()).filter(Boolean);
  return names.every((n) => /^[A-Za-z][A-Za-z0-9_]*$/.test(n)) ? names : null;
}

/** { template, review } for a function value, or a reason it can't be. */
function analyse(fn) {
  const names = parameters(fn);
  if (!names) return { error: `unreadable parameters in ${fn.toString().slice(0, 80)}` };
  let template;
  try {
    template = fn(...names.map(sentinel));
  } catch (e) {
    return { error: `throws with sentinel arguments: ${e.message}` };
  }
  if (typeof template !== 'string') return { error: `returns ${typeof template}` };

  const agrees = (args, expected) => {
    try {
      return fn(...args) === expected;
    } catch {
      return false;
    }
  };
  let review = false;
  for (const n of PROBES) {
    names.forEach((name, i) => {
      const args = names.map((other, j) => (i === j ? n : sentinel(other)));
      if (!agrees(args, template.split(sentinel(name)).join(String(n)))) review = true;
    });
    let all = template;
    for (const name of names) all = all.split(sentinel(name)).join(String(n));
    if (names.length > 1 && !agrees(names.map(() => n), all)) review = true;
  }
  return { template, review };
}

// ---- trees -----------------------------------------------------------------

function* leaves(node, path = []) {
  for (const [key, value] of Object.entries(node)) {
    if (value !== null && typeof value === 'object') yield* leaves(value, [...path, key]);
    else yield [[...path, key], value];
  }
}

const lookup = (tree, path) => path.reduce((node, key) => (node != null && Object.hasOwn(node, key) ? node[key] : undefined), tree);

/** The cleaner text of one language as a { path: text } tree. */
function cleanerTree(code) {
  const categories = [...new Set(rules.map((rule) => rule.category))];
  if (code === 'en') {
    return {
      cleaner: {
        rules: Object.fromEntries(rules.map((r) => [r.id, { name: r.name, description: r.description }])),
        categories: Object.fromEntries(categories.map((c) => [c, c]))
      }
    };
  }
  const own = CLEANER_TEXT[code];
  if (!own) fail(`no cleaner text for ${code}`);
  return { cleaner: { rules: own.rules, categories: own.categories } };
}

// ---- conversion ------------------------------------------------------------

const header = (what) =>
  `### Prune ${what}. Generated from Prune 3.x by native/tools/convert-catalog.mjs,\n` +
  `### then kept by hand: 3.x's catalog is frozen and this file is the source now.\n`;

const files = [
  { name: 'prune.ftl', what: 'UI text', tree: (code) => CATALOG[code] },
  { name: 'cleaners.ftl', what: 'Deep Clean rule text', tree: cleanerTree }
];

const idOwner = new Map();
const needsReview = {};
let strings = 0;
let functions = 0;
let reviewed = 0;

for (const file of files) {
  const enTree = file.tree('en');
  const enLeaves = [...leaves(enTree)];
  const enIds = new Set();
  for (const [path] of enLeaves) {
    const key = path.join('.');
    const id = toId(path);
    if (idOwner.has(id)) fail(`"${key}" and "${idOwner.get(id)}" both map to the id "${id}"`);
    idOwner.set(id, key);
    enIds.add(key);
  }

  for (const code of codes) {
    const tree = file.tree(code);
    if (!tree) fail(`no catalog for ${code}`);
    for (const [path] of leaves(tree)) {
      const key = path.join('.');
      if (!enIds.has(key)) fail(`${code} has "${key}", which en doesn't`);
    }
    const body = [];
    for (const [path, enValue] of enLeaves) {
      const key = path.join('.');
      const id = toId(path);
      const value = lookup(tree, path);
      if (value === undefined || value === null || value === '') fail(`${code} is missing "${key}"`);
      if (typeof value !== typeof enValue) fail(`${code}.${key} is ${typeof value}, en is ${typeof enValue}`);
      if (typeof value === 'string') {
        strings++;
        if (value.includes(SENT_OPEN) || value.includes(SENT_CLOSE)) fail(`${code}.${key} contains a sentinel character`);
        const line = message(id, value);
        if (!line) fail(`${code}.${key} could not be written`);
        body.push(line);
      } else if (typeof value === 'function') {
        functions++;
        const result = analyse(value);
        if (result.error) fail(`${code}.${key}: ${result.error}`);
        const line = message(id, result.template);
        if (!line || result.review) {
          reviewed++;
          (needsReview[code] ??= []).push(key);
          // A template whose sentinels didn't survive (a parameter that was
          // transformed, not just printed) still gets a message, so every
          // language keeps every id; the review entry says it is wrong.
          body.push('# needs-review');
          body.push(line ?? message(id, result.template.replace(/[\u{E000}\u{E001}]/gu, '')));
        } else {
          body.push(line);
        }
      } else {
        fail(`${code}.${key} is a ${typeof value}`);
      }
    }
    mkdirSync(join(out, code), { recursive: true });
    writeFileSync(join(out, code, file.name), `${header(file.what)}\n${body.join('\n')}\n`, 'utf8');
  }
}

const ordered = Object.fromEntries(codes.filter((c) => needsReview[c]).map((c) => [c, needsReview[c]]));
writeFileSync(join(out, 'needs-review.json'), `${JSON.stringify(ordered, null, 2)}\n`, 'utf8');
console.log(`converted ${strings} strings, ${functions} functions, ${reviewed} need review`);
