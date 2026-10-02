import { describe, it, expect } from 'vitest';
import { parseXml, XmlError, childElements, firstChild, textOf } from './xmlParse.js';

/** A small, strict XML parser -- a tokenizer, not pattern matching -- for the
 * one thing Prune reads XML for: BleachBit cleaner files. It builds a tree of
 * elements and nothing else. It never fetches, includes or expands anything:
 * a DOCTYPE with an internal subset (where entities are declared, and where
 * "billion laughs" lives) is refused outright. */

describe('elements and attributes', () => {
  it('parses a nested document', () => {
    const root = parseXml('<a x="1"><b>hello</b><c/></a>');
    expect(root.name).toBe('a');
    expect(root.attrs).toEqual({ x: '1' });
    expect(root.children.map((c) => c.name)).toEqual(['b', 'c']);
    expect(root.children[0].text).toBe('hello');
    expect(root.children[1].children).toEqual([]);
  });

  it('accepts single- and double-quoted attributes and any whitespace around them', () => {
    const root = parseXml("<a  p = 'one'\n\tq=\"two\" />");
    expect(root.attrs).toEqual({ p: 'one', q: 'two' });
  });

  it('keeps a > inside an attribute value', () => {
    expect(parseXml('<a p="x > y"/>').attrs.p).toBe('x > y');
  });

  it('keeps backslashes and dollar signs as they are (Windows paths, BleachBit variables)', () => {
    const root = parseXml('<action path="%LocalAppData%\\Foo\\$$base$$/Bar"/>');
    expect(root.attrs.path).toBe('%LocalAppData%\\Foo\\$$base$$/Bar');
  });

  it('allows namespace-style and dotted names', () => {
    expect(parseXml('<ns:a b.c-d="1"/>').attrs['b.c-d']).toBe('1');
  });
});

describe('text', () => {
  it('joins the text directly inside an element and ignores whitespace between children', () => {
    const root = parseXml('<a>\n  <b>one</b>\n  <b>two</b>\n</a>');
    expect(root.text.trim()).toBe('');
    expect(root.children.map((c) => c.text)).toEqual(['one', 'two']);
  });

  it('decodes the five predefined entities and numeric references', () => {
    expect(parseXml('<a>&lt;&gt;&amp;&quot;&apos; &#65;&#x42;</a>').text).toBe('<>&"\' AB');
    expect(parseXml('<a p="&lt;&amp;&#x43;"/>').attrs.p).toBe('<&C');
  });

  it('reads CDATA literally', () => {
    expect(parseXml('<a><![CDATA[<not> & markup]]></a>').text).toBe('<not> & markup');
  });

  it('rejects an entity it does not know instead of guessing', () => {
    expect(() => parseXml('<a>&nbsp;</a>')).toThrow(XmlError);
    expect(() => parseXml('<a>&#xZZ;</a>')).toThrow(XmlError);
    expect(() => parseXml('<a>&amp</a>')).toThrow(XmlError);
  });

  it('rejects a numeric reference outside the Unicode range', () => {
    expect(() => parseXml('<a>&#x110000;</a>')).toThrow(XmlError);
  });
});

describe('the parts that are skipped', () => {
  it('skips the XML declaration, comments and processing instructions', () => {
    const root = parseXml('<?xml version="1.0" encoding="UTF-8"?>\n<!-- a comment with <tags> and -dashes- -->\n<?pi data?>\n<a><!-- inside --><b/></a>\n<!-- after -->');
    expect(root.name).toBe('a');
    expect(root.children.map((c) => c.name)).toEqual(['b']);
  });

  it('skips a byte order mark', () => {
    expect(parseXml('﻿<a/>').name).toBe('a');
  });

  it('skips a plain DOCTYPE', () => {
    expect(parseXml('<!DOCTYPE cleaner SYSTEM "cleaner.dtd"><cleaner/>').name).toBe('cleaner');
  });

  it('refuses a DOCTYPE with an internal subset -- that is where entities are declared', () => {
    const bomb = '<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;">]><lolz>&lol2;</lolz>';
    expect(() => parseXml(bomb)).toThrow(/DOCTYPE|DTD|internal/i);
  });
});

describe('malformed input is an error with a position', () => {
  it.each([
    ['empty', ''],
    ['only whitespace', '   \n '],
    ['text and no element', 'hello'],
    ['unclosed element', '<a><b></a>'],
    ['never closed', '<a>'],
    ['mismatched close', '<a></b>'],
    ['two roots', '<a/><b/>'],
    ['text after the root', '<a/>junk'],
    ['attribute with no value', '<a p/>'],
    ['unquoted attribute', '<a p=1/>'],
    ['unterminated attribute', '<a p="x/>'],
    ['duplicate attribute', '<a p="1" p="2"/>'],
    ['< in an attribute value', '<a p="<"/>'],
    ['unterminated comment', '<a><!-- never ends</a>'],
    ['unterminated CDATA', '<a><![CDATA[ never ends</a>'],
    ['bad tag name', '<1a/>'],
    ['stray ampersand', '<a>x & y</a>'],
    ['unterminated tag', '<a'],
    ['close with attributes', '<a></a x="1">']
  ])('%s', (_name, text) => {
    expect(() => parseXml(text)).toThrow(XmlError);
  });

  it('says where', () => {
    try {
      parseXml('<a>\n  <b>\n</a>');
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(XmlError);
      expect(err.line).toBe(3);
      expect(err.message).toMatch(/line 3/);
    }
  });
});

describe('limits', () => {
  it('refuses a document nested deeper than the limit', () => {
    const deep = `${'<a>'.repeat(70)}${'</a>'.repeat(70)}`;
    expect(() => parseXml(deep)).toThrow(/deep/i);
    expect(parseXml(deep, { maxDepth: 100 }).name).toBe('a');
  });

  it('refuses a document with more elements than the limit', () => {
    const wide = `<a>${'<b/>'.repeat(60)}</a>`;
    expect(() => parseXml(wide, { maxNodes: 50 })).toThrow(/elements/i);
  });

  it('handles a large flat document without recursion (no stack overflow)', () => {
    const wide = `<a>${'<b p="1">t</b>'.repeat(20000)}</a>`;
    expect(parseXml(wide, { maxNodes: 100000 }).children).toHaveLength(20000);
  });
});

describe('helpers', () => {
  const root = parseXml('<a><b id="1"/><c/><b id="2"/></a>');

  it('childElements filters by name', () => {
    expect(childElements(root, 'b').map((n) => n.attrs.id)).toEqual(['1', '2']);
    expect(childElements(root).map((n) => n.name)).toEqual(['b', 'c', 'b']);
  });

  it('firstChild returns the first match or null', () => {
    expect(firstChild(root, 'b').attrs.id).toBe('1');
    expect(firstChild(root, 'zzz')).toBeNull();
  });

  it('textOf trims and collapses whitespace', () => {
    expect(textOf(parseXml('<a>  hello \n  world </a>'))).toBe('hello world');
    expect(textOf(null)).toBe('');
  });
});
