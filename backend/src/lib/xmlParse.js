/** A small, strict XML parser, for BleachBit cleaner files and nothing else.
 *
 * A tokenizer that walks the text once, character by character -- not
 * pattern matching, which is how XML gets misread. It builds a tree of
 * elements ({ name, attrs, children, text }) and does nothing else: it never
 * fetches, includes, validates against a DTD or expands anything. In
 * particular a DOCTYPE with an internal subset -- the only place entities
 * can be declared, and so the place "billion laughs" lives -- is refused,
 * and only the five predefined entities and numeric references are decoded.
 * Iterative, with an explicit stack, so a deeply or widely nested file
 * cannot overflow the call stack; depth and element count are capped.
 *
 * Deliberately not a full XML implementation: no namespaces resolution, no
 * encodings other than the JS string it is handed, no attribute-value
 * normalisation. It is strict where leniency would hide a broken file --
 * mismatched tags, duplicate attributes, stray ampersands, a second root --
 * because importing half of a cleaner is worse than importing none. */

export class XmlError extends Error {
  constructor(message, line, column) {
    super(`${message} (line ${line}, column ${column})`);
    this.name = 'XmlError';
    this.line = line;
    this.column = column;
  }
}

const isSpace = (ch) => ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
const isNameStart = (ch) => (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || ch === ':' || ch > '\u007f';
const isNameChar = (ch) => isNameStart(ch) || (ch >= '0' && ch <= '9') || ch === '-' || ch === '.';

const PREDEFINED = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

export function parseXml(input, { maxDepth = 64, maxNodes = 50000 } = {}) {
  const text = String(input ?? '');
  const n = text.length;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;

  const fail = (message, at = i) => {
    let line = 1;
    let column = 1;
    for (let k = 0; k < at && k < n; k += 1) {
      if (text[k] === '\n') { line += 1; column = 1; } else column += 1;
    }
    throw new XmlError(message, line, column);
  };

  /** Decodes &...; references in `raw`, which started at `base` in the input. */
  const decode = (raw, base) => {
    if (!raw.includes('&')) return raw;
    let out = '';
    let k = 0;
    while (k < raw.length) {
      const amp = raw.indexOf('&', k);
      if (amp < 0) { out += raw.slice(k); break; }
      out += raw.slice(k, amp);
      const semi = raw.indexOf(';', amp);
      if (semi < 0) fail('An & with no matching ;', base + amp);
      const name = raw.slice(amp + 1, semi);
      if (name[0] === '#') {
        const hex = name[1] === 'x' || name[1] === 'X';
        const digits = name.slice(hex ? 2 : 1);
        let code = NaN;
        if (digits.length > 0 && digits.length <= 8) {
          let valid = true;
          for (const d of digits) {
            const ok = hex ? /[0-9a-fA-F]/.test(d) : (d >= '0' && d <= '9');
            if (!ok) { valid = false; break; }
          }
          if (valid) code = parseInt(digits, hex ? 16 : 10);
        }
        if (!Number.isInteger(code) || code < 1 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) {
          fail(`Bad character reference &${name};`, base + amp);
        }
        out += String.fromCodePoint(code);
      } else if (Object.hasOwn(PREDEFINED, name)) {
        out += PREDEFINED[name];
      } else {
        fail(`Unknown entity &${name};`, base + amp);
      }
      k = semi + 1;
    }
    return out;
  };

  const readName = () => {
    const start = i;
    if (i >= n || !isNameStart(text[i])) fail('Expected a name');
    i += 1;
    while (i < n && isNameChar(text[i])) i += 1;
    return text.slice(start, i);
  };
  const skipSpace = () => { while (i < n && isSpace(text[i])) i += 1; };

  const stack = [];
  let root = null;
  let nodes = 0;

  while (i < n) {
    const lt = text.indexOf('<', i);
    const end = lt < 0 ? n : lt;
    if (end > i) {
      const chunk = text.slice(i, end);
      if (stack.length === 0) {
        for (let k = 0; k < chunk.length; k += 1) {
          if (!isSpace(chunk[k])) fail('Text outside the root element', i + k);
        }
      } else {
        stack[stack.length - 1].text += decode(chunk, i);
      }
    }
    if (lt < 0) { i = n; break; }
    i = lt;

    if (text.startsWith('<!--', i)) {
      const close = text.indexOf('-->', i + 4);
      if (close < 0) fail('Unterminated comment');
      i = close + 3;
      continue;
    }
    if (text.startsWith('<![CDATA[', i)) {
      if (stack.length === 0) fail('CDATA outside the root element');
      const close = text.indexOf(']]>', i + 9);
      if (close < 0) fail('Unterminated CDATA section');
      stack[stack.length - 1].text += text.slice(i + 9, close);
      i = close + 3;
      continue;
    }
    if (text.startsWith('<?', i)) {
      const close = text.indexOf('?>', i + 2);
      if (close < 0) fail('Unterminated processing instruction');
      i = close + 2;
      continue;
    }
    if (text.startsWith('<!DOCTYPE', i)) {
      if (root !== null || stack.length > 0) fail('DOCTYPE in the wrong place');
      let k = i + 9;
      let quote = null;
      while (k < n) {
        const ch = text[k];
        if (quote) { if (ch === quote) quote = null; } else if (ch === '"' || ch === "'") quote = ch;
        else if (ch === '[') fail('A DOCTYPE with an internal DTD subset is not supported', k);
        else if (ch === '>') break;
        k += 1;
      }
      if (k >= n) fail('Unterminated DOCTYPE');
      i = k + 1;
      continue;
    }
    if (text.startsWith('<!', i)) fail('Unsupported markup declaration');

    if (text.startsWith('</', i)) {
      i += 2;
      const name = readName();
      skipSpace();
      if (text[i] !== '>') fail('Expected > to end the closing tag');
      const top = stack[stack.length - 1];
      if (!top) fail(`Closing tag </${name}> with nothing open`);
      if (top.name !== name) fail(`Closing tag </${name}> does not match <${top.name}>`);
      stack.pop();
      i += 1;
      continue;
    }

    // A start tag.
    i += 1;
    const tagAt = i;
    const name = readName();
    if (stack.length === 0 && root !== null) fail('More than one root element', tagAt);
    const attrs = {};
    let selfClosing = false;
    for (;;) {
      const before = i;
      skipSpace();
      if (i >= n) fail('Unterminated tag');
      if (text[i] === '>') { i += 1; break; }
      if (text[i] === '/') {
        if (text[i + 1] !== '>') fail('Expected /> to end the tag');
        selfClosing = true;
        i += 2;
        break;
      }
      if (i === before) fail('Expected whitespace between attributes');
      const attrName = readName();
      skipSpace();
      if (text[i] !== '=') fail(`Attribute ${attrName} has no value`);
      i += 1;
      skipSpace();
      const quote = text[i];
      if (quote !== '"' && quote !== "'") fail(`Attribute ${attrName} must be quoted`);
      const close = text.indexOf(quote, i + 1);
      if (close < 0) fail(`Unterminated value for ${attrName}`);
      const raw = text.slice(i + 1, close);
      if (raw.includes('<')) fail(`A < is not allowed in the value of ${attrName}`, i + 1 + raw.indexOf('<'));
      if (Object.hasOwn(attrs, attrName)) fail(`Duplicate attribute ${attrName}`);
      attrs[attrName] = decode(raw, i + 1);
      i = close + 1;
    }

    nodes += 1;
    if (nodes > maxNodes) fail(`More than ${maxNodes} elements`, tagAt);
    const node = { name, attrs, children: [], text: '' };
    if (stack.length > 0) stack[stack.length - 1].children.push(node); else root = node;
    if (!selfClosing) {
      if (stack.length + 1 > maxDepth) fail(`Nested deeper than ${maxDepth} levels`, tagAt);
      stack.push(node);
    }
  }

  if (stack.length > 0) fail(`<${stack[stack.length - 1].name}> is never closed`, n);
  if (root === null) fail('No root element', n);
  return root;
}

/** The child elements of `node`, optionally only those named `name`. */
export function childElements(node, name) {
  const all = node?.children ?? [];
  return name === undefined ? all : all.filter((child) => child.name === name);
}

/** The first child named `name`, or null. */
export function firstChild(node, name) {
  return childElements(node, name)[0] ?? null;
}

/** An element's own text, trimmed and with runs of whitespace collapsed. */
export function textOf(node) {
  return (node?.text ?? '').replace(/\s+/g, ' ').trim();
}
