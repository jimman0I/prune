import { buildSearchPattern } from './leftoverPattern.js';

/** What the Advanced scan searches on beyond the full product name.
 *
 * Moderate searches for the whole derived name ("Adobe Photoshop") and the
 * publisher, which is exact and so misses a folder that only carries one
 * word of it ("Photoshop"). Advanced adds the distinctive WORDS of the name
 * and publisher. That finds more and is wrong more often -- the review
 * shows what it found under a lower confidence for exactly that reason.
 *
 * A word has to be worth searching for: a few characters of text or a word
 * that names a whole class of software ("Update", "Runtime", "Driver")
 * would match hundreds of unrelated folders. "Microsoft" and "Windows" are
 * excluded outright; a leftover search that treats either as evidence is
 * one step from proposing the operating system. */
const STOP_WORDS = new Set([
  'microsoft', 'windows', 'corporation', 'corp', 'incorporated', 'inc', 'ltd', 'limited', 'llc', 'gmbh', 'company',
  'software', 'update', 'updates', 'updater', 'setup', 'installer', 'install', 'uninstall', 'runtime', 'redistributable',
  'driver', 'drivers', 'edition', 'version', 'tool', 'tools', 'client', 'service', 'services', 'helper', 'component',
  'components', 'package', 'language', 'pack', 'library', 'libraries', 'framework', 'engine', 'player', 'launcher',
  'desktop', 'application', 'applications', 'program', 'programs', 'professional', 'enterprise', 'standard', 'common',
  'shared', 'system', 'systems', 'data', 'files', 'server', 'plugin', 'extension', 'support', 'free', 'trial', 'beta',
  'x64', 'x86', 'amd64', 'arm64', 'bit', 'the', 'and', 'for', 'with', 'from'
]);

const MIN_TOKEN_LENGTH = 4;

function escapeForRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The distinctive lower-case words of a product name and its publisher, in
 * order, without duplicates. */
export function productTokens(...texts) {
  const tokens = [];
  for (const text of texts) {
    if (typeof text !== 'string') continue;
    for (const word of text.toLowerCase().split(/[^a-z0-9+#]+/)) {
      if (word.length < MIN_TOKEN_LENGTH) continue;
      if (/^\d/.test(word)) continue;
      if (STOP_WORDS.has(word)) continue;
      if (!tokens.includes(word)) tokens.push(word);
    }
  }
  return tokens;
}

/** The three regexes a result is judged by: the product name, the publisher
 * and the distinctive words. Each is null when there is nothing to match, so
 * a missing term can never match everything. */
export function buildMatchers({ name, publisher, tokens }) {
  const compile = (source) => (source ? new RegExp(source, 'i') : null);
  return {
    name: compile(buildSearchPattern(name)),
    publisher: compile(buildSearchPattern(publisher)),
    token: compile(buildTokenPattern(tokens))
  };
}

/** How sure a name match is. The product's own name is likely; only the
 * publisher's name, or a single word of the product's, is merely possible --
 * a publisher folder is shared by everything the publisher makes, and a
 * word is shared by anything that uses it. Whatever matched, at best this is
 * "likely": certainty comes from the program's own folders, not from names. */
export function classifyLabel(label, matchers) {
  if (typeof label === 'string' && matchers.name?.test(label)) return 'likely';
  return 'possible';
}

/** A regex source matching any of the tokens as a whole word, or null when
 * there are none -- an empty pattern matches every string. The word is
 * closed on both sides, unlike the full-name pattern: "steam" must not find
 * "msteams" or "steamlink" on the strength of one shared word. */
export function buildTokenPattern(tokens) {
  const usable = (tokens || []).filter((token) => typeof token === 'string' && token !== '');
  if (usable.length === 0) return null;
  return usable.map((token) => `(?<![A-Za-z0-9])${escapeForRegex(token)}(?![A-Za-z0-9])`).join('|');
}
